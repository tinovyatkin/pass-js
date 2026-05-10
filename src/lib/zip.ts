// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

import { crc32 as zlibCrc32, inflateRawSync } from 'node:zlib';

export function crc32(bytes: Uint8Array): number {
  return zlibCrc32(bytes) >>> 0;
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE_BYTES = Buffer.from([
  0x50, 0x4b, 0x05, 0x06,
]);

const LOCAL_FILE_HEADER_LEN = 30;
const CENTRAL_DIRECTORY_HEADER_LEN = 46;
const END_OF_CENTRAL_DIRECTORY_LEN = 22;
const ZIP32_MAX = 0xffffffff;

// Safety caps — pkpass bundles are tiny. Reject anything abusive.
const MAX_ENTRIES = 4096;
const MAX_ENTRY_SIZE = 16 * 1024 * 1024; // 16 MiB per entry
const MAX_COMMENT_LEN = 0xffff;

// ─── Writer ─────────────────────────────────────────────────────────────────

export interface ZipWriteEntry {
  readonly path: string;
  readonly data: Buffer | string;
}

// Rejects entry paths that the reader would treat as unsafe (leading slash,
// backslash, or a `..` segment). Keeps writeZip/readZip in lockstep so we
// can't produce a bundle we'd then refuse to read, and prevents downstream
// consumers from using the library to emit zip-slip archives.
const UNSAFE_PATH_RE = /^\/|\\|(^|\/)\.\.(\/|$)/;

interface PreparedZipEntry {
  readonly name: Buffer;
  readonly body: Buffer;
  readonly checksum: number;
  readonly size: number;
  readonly localOffset: number;
}

function assertZip32(value: number, description: string): void {
  if (value > ZIP32_MAX) {
    throw new Error(`ZIP is too large: ${description} requires ZIP64`);
  }
}

// Writes a STORE-only (no compression) ZIP bundle suitable for .pkpass files.
// pkpass payloads are small JSON + small PNGs; compression is counterproductive.
export function writeZip(files: readonly ZipWriteEntry[]): Buffer {
  if (files.length > MAX_ENTRIES) {
    throw new Error(
      `ZIP has too many entries (${files.length} > ${MAX_ENTRIES})`,
    );
  }

  const entries: PreparedZipEntry[] = [];
  let localOffset = 0;
  let centralSize = 0;

  for (const { path, data } of files) {
    if (UNSAFE_PATH_RE.test(path)) {
      throw new Error(
        `Entry "${path}" has an unsafe path (leading slash, backslash, or '..' segment)`,
      );
    }
    const body = typeof data === 'string' ? Buffer.from(data) : data;
    const name = Buffer.from(path, 'utf8');
    if (name.length > 0xffff) {
      throw new Error(
        `Entry "${path}" filename is too long (${name.length} > 65535 bytes)`,
      );
    }
    const checksum = crc32(body);
    const size = body.length;
    assertZip32(size, `entry "${path}"`);

    entries.push({ name, body, checksum, size, localOffset });

    localOffset += LOCAL_FILE_HEADER_LEN + name.length + size;
    centralSize += CENTRAL_DIRECTORY_HEADER_LEN + name.length;
    assertZip32(localOffset, 'local file records');
    assertZip32(centralSize, 'central directory');
  }

  const centralOffset = localOffset;
  const totalSize = localOffset + centralSize + END_OF_CENTRAL_DIRECTORY_LEN;
  assertZip32(totalSize, 'archive');

  const out = Buffer.allocUnsafe(totalSize);
  let p = 0;

  for (const entry of entries) {
    out.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, p);
    out.writeUInt16LE(10, p + 4); // version needed to extract (1.0 — STORE)
    out.writeUInt16LE(0, p + 6); // general purpose bit flag
    out.writeUInt16LE(0, p + 8); // compression method (0 = STORE)
    out.writeUInt16LE(0, p + 10); // last mod file time
    out.writeUInt16LE(0, p + 12); // last mod file date
    out.writeUInt32LE(entry.checksum, p + 14); // CRC-32
    out.writeUInt32LE(entry.size, p + 18); // compressed size
    out.writeUInt32LE(entry.size, p + 22); // uncompressed size
    out.writeUInt16LE(entry.name.length, p + 26); // file name length
    out.writeUInt16LE(0, p + 28); // extra field length
    entry.name.copy(out, p + LOCAL_FILE_HEADER_LEN);
    entry.body.copy(out, p + LOCAL_FILE_HEADER_LEN + entry.name.length);
    p += LOCAL_FILE_HEADER_LEN + entry.name.length + entry.size;
  }

  for (const entry of entries) {
    out.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, p);
    out.writeUInt16LE(20, p + 4); // version made by
    out.writeUInt16LE(10, p + 6); // version needed to extract
    out.writeUInt16LE(0, p + 8); // general purpose bit flag
    out.writeUInt16LE(0, p + 10); // compression method
    out.writeUInt16LE(0, p + 12); // last mod file time
    out.writeUInt16LE(0, p + 14); // last mod file date
    out.writeUInt32LE(entry.checksum, p + 16); // CRC-32
    out.writeUInt32LE(entry.size, p + 20); // compressed size
    out.writeUInt32LE(entry.size, p + 24); // uncompressed size
    out.writeUInt16LE(entry.name.length, p + 28); // file name length
    out.writeUInt16LE(0, p + 30); // extra field length
    out.writeUInt16LE(0, p + 32); // file comment length
    out.writeUInt16LE(0, p + 34); // disk number start
    out.writeUInt16LE(0, p + 36); // internal file attributes
    out.writeUInt32LE(0, p + 38); // external file attributes
    out.writeUInt32LE(entry.localOffset, p + 42); // local header offset
    entry.name.copy(out, p + CENTRAL_DIRECTORY_HEADER_LEN);
    p += CENTRAL_DIRECTORY_HEADER_LEN + entry.name.length;
  }

  out.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, p); // EOCD signature
  out.writeUInt16LE(0, p + 4); // number of this disk
  out.writeUInt16LE(0, p + 6); // disk where central directory starts
  out.writeUInt16LE(files.length, p + 8); // entries on this disk
  out.writeUInt16LE(files.length, p + 10); // total central directory entries
  out.writeUInt32LE(centralSize, p + 12); // size of central directory
  out.writeUInt32LE(centralOffset, p + 16); // offset of central directory
  out.writeUInt16LE(0, p + 20); // ZIP file comment length

  return out;
}

// ─── Reader ─────────────────────────────────────────────────────────────────

export interface ZipReadEntry {
  readonly filename: string;
  readonly crc32: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly method: 0 | 8;
  readonly localHeaderOffset: number;
}

export interface UnzippedBuffer {
  readonly entries: readonly ZipReadEntry[];
  getBuffer(entry: ZipReadEntry): Buffer;
}

// Reads a STORE/DEFLATE ZIP from a Buffer. Supports what .pkpass files use
// and nothing else: no ZIP64, no encryption, no multi-disk, no exotic codecs.
export function readZip(buf: Buffer): UnzippedBuffer {
  // 1. Find End-Of-Central-Directory record by scanning back from the end.
  // EOCD is at least 22 bytes, plus up to 64K of trailing comment.
  const searchStart = Math.max(
    0,
    buf.length - END_OF_CENTRAL_DIRECTORY_LEN - MAX_COMMENT_LEN,
  );
  let eocdOffset = -1;
  let searchFrom = buf.length - END_OF_CENTRAL_DIRECTORY_LEN;
  while (searchFrom >= searchStart) {
    const candidate = buf.lastIndexOf(
      END_OF_CENTRAL_DIRECTORY_SIGNATURE_BYTES,
      searchFrom,
    );
    if (candidate < searchStart) break;
    const commentLen = buf.readUInt16LE(
      candidate + END_OF_CENTRAL_DIRECTORY_LEN - 2,
    );
    if (candidate + END_OF_CENTRAL_DIRECTORY_LEN + commentLen === buf.length) {
      eocdOffset = candidate;
      break;
    }
    searchFrom = candidate - 1;
  }
  if (eocdOffset < 0) {
    throw new Error('Invalid ZIP: end-of-central-directory record not found');
  }

  const entryCount = buf.readUInt16LE(eocdOffset + 10);
  const centralSize = buf.readUInt32LE(eocdOffset + 12);
  const centralOffset = buf.readUInt32LE(eocdOffset + 16);

  if (entryCount > MAX_ENTRIES) {
    throw new Error(
      `ZIP has too many entries (${entryCount} > ${MAX_ENTRIES})`,
    );
  }
  if (
    centralOffset > eocdOffset ||
    centralSize > eocdOffset - centralOffset ||
    (entryCount > 0 &&
      centralOffset + CENTRAL_DIRECTORY_HEADER_LEN > buf.length)
  ) {
    throw new Error('Invalid ZIP: central directory out of bounds');
  }

  // 2. Parse central directory with strict bounds checks against both the
  // declared central directory region and the buffer itself.
  const centralEnd = centralOffset + centralSize;
  const entries: ZipReadEntry[] = [];
  let p = centralOffset;
  for (let i = 0; i < entryCount; i++) {
    if (p + CENTRAL_DIRECTORY_HEADER_LEN > centralEnd) {
      throw new Error(
        'Malformed ZIP central directory: entry header truncated',
      );
    }
    if (buf.readUInt32LE(p) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('Invalid ZIP: bad central directory entry signature');
    }
    const method = buf.readUInt16LE(p + 10);
    const entryCrc = buf.readUInt32LE(p + 16);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);

    const entryBlockEnd =
      p + CENTRAL_DIRECTORY_HEADER_LEN + nameLen + extraLen + commentLen;
    if (entryBlockEnd > centralEnd) {
      throw new Error(
        'Malformed ZIP central directory: entry extends past central directory bounds',
      );
    }
    const filename = buf.toString(
      'utf8',
      p + CENTRAL_DIRECTORY_HEADER_LEN,
      p + CENTRAL_DIRECTORY_HEADER_LEN + nameLen,
    );

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
    if (UNSAFE_PATH_RE.test(filename)) {
      throw new Error(
        `Entry "${filename}" has an unsafe path (leading slash, backslash, or '..' segment)`,
      );
    }
    if (localHeaderOffset + LOCAL_FILE_HEADER_LEN > centralOffset) {
      throw new Error(
        `Invalid ZIP: entry "${filename}" local header offset out of bounds`,
      );
    }

    if (compressedSize > MAX_ENTRY_SIZE) {
      throw new Error(
        `Entry "${filename}" compressed size exceeds max (${compressedSize} > ${MAX_ENTRY_SIZE})`,
      );
    }

    entries.push({
      filename,
      crc32: entryCrc >>> 0,
      compressedSize,
      uncompressedSize,
      method: method as 0 | 8,
      localHeaderOffset,
    });
    p = entryBlockEnd;
  }

  return {
    entries,
    getBuffer(entry: ZipReadEntry): Buffer {
      // Re-read the local file header for name/extra lengths only.
      //
      // The compressed size must come from the central directory: streaming
      // writers (general-purpose bit 3 set) leave local-header size fields
      // as zero and only populate them in the central directory. pkpass
      // bundles produced this way are valid and the standard mandates this.
      const h = entry.localHeaderOffset;
      if (h + LOCAL_FILE_HEADER_LEN > buf.length) {
        throw new Error(
          `Invalid ZIP: local header for "${entry.filename}" out of bounds`,
        );
      }
      if (buf.readUInt32LE(h) !== LOCAL_FILE_HEADER_SIGNATURE) {
        throw new Error(
          `Invalid ZIP: bad local header for entry "${entry.filename}"`,
        );
      }
      const localNameLen = buf.readUInt16LE(h + 26);
      const localExtraLen = buf.readUInt16LE(h + 28);
      const dataStart =
        h + LOCAL_FILE_HEADER_LEN + localNameLen + localExtraLen;
      const dataEnd = dataStart + entry.compressedSize;
      if (dataEnd > buf.length || dataStart < h + LOCAL_FILE_HEADER_LEN) {
        throw new Error(
          `Invalid ZIP: entry "${entry.filename}" data out of bounds`,
        );
      }
      const raw = buf.subarray(dataStart, dataEnd);
      const out =
        entry.method === 0
          ? Buffer.from(raw)
          : inflateRawSync(raw, {
              maxOutputLength: Math.max(1, entry.uncompressedSize),
            });

      if (out.length !== entry.uncompressedSize) {
        throw new Error(
          `Entry "${entry.filename}" size mismatch: header says ${entry.uncompressedSize}, got ${out.length}`,
        );
      }
      const actualCrc = crc32(out);
      if (actualCrc !== entry.crc32) {
        throw new Error(
          `Entry "${entry.filename}" CRC32 mismatch (header ${entry.crc32.toString(
            16,
          )}, got ${actualCrc.toString(16)})`,
        );
      }
      return out;
    },
  };
}
