import { inflateRawSync } from 'node:zlib';

// CRC-32 (IEEE 802.3) table, built once.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let sum = 0xffffffff;
  for (const b of bytes) sum = (sum >>> 8) ^ CRC_TABLE[(sum ^ b) & 0xff]!;
  return (sum ^ 0xffffffff) >>> 0;
}

// ─── Writer ─────────────────────────────────────────────────────────────────

export interface ZipWriteEntry {
  readonly path: string;
  readonly data: Buffer | string;
}

// Writes a STORE-only (no compression) ZIP bundle suitable for .pkpass files.
// pkpass payloads are small JSON + small PNGs; compression is counterproductive.
export function writeZip(files: readonly ZipWriteEntry[]): Buffer {
  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let localOffset = 0;

  for (const { path, data } of files) {
    const body = typeof data === 'string' ? Buffer.from(data) : data;
    const name = Buffer.from(path, 'utf8');
    const checksum = crc32(body);
    const size = body.length;

    // Local file header + data
    const local = Buffer.alloc(30 + name.length + size);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(10, 4); // version needed to extract (1.0 — STORE only)
    local.writeUInt16LE(0, 6); // general purpose bit flag
    local.writeUInt16LE(0, 8); // compression method (0 = STORE)
    local.writeUInt16LE(0, 10); // last mod file time
    local.writeUInt16LE(0, 12); // last mod file date
    local.writeUInt32LE(checksum, 14); // CRC-32
    local.writeUInt32LE(size, 18); // compressed size
    local.writeUInt32LE(size, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26); // file name length
    local.writeUInt16LE(0, 28); // extra field length
    name.copy(local, 30);
    body.copy(local, 30 + name.length);
    localRecords.push(local);

    // Central directory header
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0); // central directory signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(10, 6); // version needed to extract
    central.writeUInt16LE(0, 8); // general purpose bit flag
    central.writeUInt16LE(0, 10); // compression method
    central.writeUInt16LE(0, 12); // last mod file time
    central.writeUInt16LE(0, 14); // last mod file date
    central.writeUInt32LE(checksum, 16); // CRC-32
    central.writeUInt32LE(size, 20); // compressed size
    central.writeUInt32LE(size, 24); // uncompressed size
    central.writeUInt16LE(name.length, 28); // file name length
    central.writeUInt16LE(0, 30); // extra field length
    central.writeUInt16LE(0, 32); // file comment length
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal file attributes
    central.writeUInt32LE(0, 38); // external file attributes
    central.writeUInt32LE(localOffset, 42); // relative offset of local header
    name.copy(central, 46);
    centralRecords.push(central);

    localOffset += local.length;
  }

  const central = Buffer.concat(centralRecords);
  // End of central directory record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // number of this disk
  eocd.writeUInt16LE(0, 6); // disk where central directory starts
  eocd.writeUInt16LE(files.length, 8); // entries on this disk
  eocd.writeUInt16LE(files.length, 10); // total entries in central directory
  eocd.writeUInt32LE(central.length, 12); // size of central directory
  eocd.writeUInt32LE(localOffset, 16); // offset of central directory
  eocd.writeUInt16LE(0, 20); // ZIP file comment length

  return Buffer.concat([...localRecords, central, eocd]);
}

// ─── Reader ─────────────────────────────────────────────────────────────────

export interface ZipReadEntry {
  readonly filename: string;
  readonly crc32: number;
  readonly uncompressedSize: number;
  readonly method: 0 | 8;
  readonly localHeaderOffset: number;
}

export interface UnzippedBuffer {
  readonly entries: readonly ZipReadEntry[];
  getBuffer(entry: ZipReadEntry): Buffer;
}

// Safety caps — pkpass bundles are tiny. Reject anything abusive.
const MAX_ENTRIES = 4096;
const MAX_ENTRY_SIZE = 16 * 1024 * 1024; // 16 MiB per entry
const MAX_COMMENT_LEN = 0xffff;

// Reads a STORE/DEFLATE ZIP from a Buffer. Supports what .pkpass files use
// and nothing else: no ZIP64, no encryption, no multi-disk, no exotic codecs.
export function readZip(buf: Buffer): UnzippedBuffer {
  // 1. Find End-Of-Central-Directory record by scanning back from the end.
  // EOCD is at least 22 bytes, plus up to 64K of trailing comment.
  const eocdMin = 22;
  const searchStart = Math.max(0, buf.length - eocdMin - MAX_COMMENT_LEN);
  let eocdOffset = -1;
  for (let i = buf.length - eocdMin; i >= searchStart; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error('Invalid ZIP: end-of-central-directory record not found');
  }

  const entryCount = buf.readUInt16LE(eocdOffset + 10);
  const centralSize = buf.readUInt32LE(eocdOffset + 12);
  const centralOffset = buf.readUInt32LE(eocdOffset + 16);

  if (entryCount > MAX_ENTRIES) {
    throw new Error(`ZIP has too many entries (${entryCount} > ${MAX_ENTRIES})`);
  }
  if (
    centralOffset + centralSize > eocdOffset ||
    centralOffset + 46 > buf.length
  ) {
    throw new Error('Invalid ZIP: central directory out of bounds');
  }

  // 2. Parse central directory with strict bounds checks against both the
  // declared central directory region and the buffer itself.
  const centralEnd = centralOffset + centralSize;
  const entries: ZipReadEntry[] = [];
  let p = centralOffset;
  for (let i = 0; i < entryCount; i++) {
    if (p + 46 > centralEnd) {
      throw new Error('Malformed ZIP central directory: entry header truncated');
    }
    if (buf.readUInt32LE(p) !== 0x02014b50) {
      throw new Error('Invalid ZIP: bad central directory entry signature');
    }
    const method = buf.readUInt16LE(p + 10);
    const entryCrc = buf.readUInt32LE(p + 16);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);

    const entryBlockEnd = p + 46 + nameLen + extraLen + commentLen;
    if (entryBlockEnd > centralEnd) {
      throw new Error(
        'Malformed ZIP central directory: entry extends past central directory bounds',
      );
    }
    const filename = buf.toString('utf8', p + 46, p + 46 + nameLen);

    if (method !== 0 && method !== 8) {
      throw new Error(
        `Unsupported compression method ${method} for entry "${filename}"; only STORE (0) and DEFLATE (8) are supported`,
      );
    }
    if (uncompressedSize > MAX_ENTRY_SIZE) {
      throw new Error(
        `Entry "${filename}" exceeds max size (${uncompressedSize} > ${MAX_ENTRY_SIZE})`,
      );
    }
    if (/^\/|\\|(^|\/)\.\.(\/|$)/.test(filename)) {
      throw new Error(
        `Entry "${filename}" has an unsafe path (leading slash, backslash, or '..' segment)`,
      );
    }
    if (localHeaderOffset + 30 > centralOffset) {
      throw new Error(
        `Invalid ZIP: entry "${filename}" local header offset out of bounds`,
      );
    }

    entries.push({
      filename,
      crc32: entryCrc >>> 0,
      uncompressedSize,
      method: method as 0 | 8,
      localHeaderOffset,
    });
    p = entryBlockEnd;
  }

  return {
    entries,
    getBuffer(entry: ZipReadEntry): Buffer {
      // Re-read the local file header to know the real data start offset.
      const h = entry.localHeaderOffset;
      if (h + 30 > buf.length) {
        throw new Error(
          `Invalid ZIP: local header for "${entry.filename}" out of bounds`,
        );
      }
      if (buf.readUInt32LE(h) !== 0x04034b50) {
        throw new Error(
          `Invalid ZIP: bad local header for entry "${entry.filename}"`,
        );
      }
      const localNameLen = buf.readUInt16LE(h + 26);
      const localExtraLen = buf.readUInt16LE(h + 28);
      const compressedSize = buf.readUInt32LE(h + 18);
      const dataStart = h + 30 + localNameLen + localExtraLen;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > buf.length || dataStart < h + 30) {
        throw new Error(
          `Invalid ZIP: entry "${entry.filename}" data out of bounds`,
        );
      }
      const raw = buf.subarray(dataStart, dataEnd);
      const out =
        entry.method === 0
          ? Buffer.from(raw)
          : inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_SIZE });

      if (out.length !== entry.uncompressedSize) {
        throw new Error(
          `Entry "${entry.filename}" size mismatch: header says ${entry.uncompressedSize}, got ${out.length}`,
        );
      }
      if (crc32(out) !== entry.crc32) {
        throw new Error(
          `Entry "${entry.filename}" CRC32 mismatch (header ${entry.crc32.toString(
            16,
          )}, got ${crc32(out).toString(16)})`,
        );
      }
      return out;
    },
  };
}
