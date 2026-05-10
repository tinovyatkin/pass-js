// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

export interface X509CertificateDerInfo {
  rawCertificate: Buffer;
  tbsCertificate: Buffer;
  serialNumber: Buffer;
  issuer: Buffer;
}

interface DerElement {
  tag: number;
  contentStart: number;
  end: number;
  raw: Buffer;
}

export function rawDer(value: Buffer | Uint8Array): Buffer {
  return Buffer.from(value);
}

export function encodeLength(length: number): Buffer {
  if (!Number.isSafeInteger(length) || length < 0)
    throw new RangeError(`Invalid DER length: ${length}`);

  if (length < 0x80) return Buffer.from([length]);

  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 0x100);
  }

  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function encodeTlv(tag: number, content: Buffer): Buffer {
  if (!Number.isInteger(tag) || tag < 0 || tag > 0xff)
    throw new RangeError(`Invalid DER tag: ${tag}`);

  return Buffer.concat([
    Buffer.from([tag]),
    encodeLength(content.length),
    content,
  ]);
}

export function sequence(...values: Buffer[]): Buffer {
  return encodeTlv(0x30, Buffer.concat(values));
}

export function setOfContent(...values: Buffer[]): Buffer {
  const sorted = values.map(value => Buffer.from(value));
  sorted.sort((a, b) => Buffer.compare(a, b));
  return Buffer.concat(sorted);
}

export function setOf(...values: Buffer[]): Buffer {
  return encodeTlv(0x31, setOfContent(...values));
}

export function contextSpecificConstructed(
  tagNumber: number,
  content: Buffer,
): Buffer {
  if (!Number.isInteger(tagNumber) || tagNumber < 0 || tagNumber > 30)
    throw new RangeError(`Unsupported context-specific tag: ${tagNumber}`);

  return encodeTlv(0xa0 | tagNumber, content);
}

export function objectIdentifier(value: string): Buffer {
  const parts = value.split('.');
  if (parts.length < 2) throw new Error(`Invalid object identifier: ${value}`);

  const arcs = parts.map(part => {
    if (!/^(0|[1-9]\d*)$/.test(part))
      throw new Error(`Invalid object identifier: ${value}`);
    return BigInt(part);
  });

  const first = arcs[0];
  const second = arcs[1];
  if (
    first === undefined ||
    second === undefined ||
    first > 2n ||
    (first < 2n && second > 39n)
  )
    throw new Error(`Invalid object identifier: ${value}`);

  const encoded = [
    ...encodeOidArc(first * 40n + second),
    ...arcs.slice(2).flatMap(encodeOidArc),
  ];
  return encodeTlv(0x06, Buffer.from(encoded));
}

function encodeOidArc(value: bigint): number[] {
  if (value < 0n) throw new RangeError('OID arcs must be non-negative');
  if (value === 0n) return [0];

  const bytes: number[] = [];
  let remaining = value;
  while (remaining > 0n) {
    bytes.unshift(Number(remaining & 0x7fn));
    remaining >>= 7n;
  }

  for (let i = 0; i < bytes.length - 1; i += 1) bytes[i]! |= 0x80;
  return bytes;
}

export function integer(value: number | bigint): Buffer {
  const asBigInt = typeof value === 'bigint' ? value : BigInt(value);
  if (asBigInt < 0n)
    throw new RangeError('Only non-negative INTEGERs are supported');

  let content: Buffer;
  if (asBigInt === 0n) {
    content = Buffer.from([0]);
  } else {
    const bytes: number[] = [];
    let remaining = asBigInt;
    while (remaining > 0n) {
      bytes.unshift(Number(remaining & 0xffn));
      remaining >>= 8n;
    }
    if ((bytes[0] ?? 0) & 0x80) bytes.unshift(0);
    content = Buffer.from(bytes);
  }

  return encodeTlv(0x02, content);
}

export function octetString(value: Buffer | Uint8Array): Buffer {
  return encodeTlv(0x04, rawDer(value));
}

export function nullValue(): Buffer {
  return Buffer.from([0x05, 0x00]);
}

export function utcTime(value: Date): Buffer {
  const timestamp = value.getTime();
  if (!Number.isFinite(timestamp)) throw new Error('Invalid UTCTime date');

  const year = value.getUTCFullYear();
  if (year < 1950 || year > 2049)
    throw new RangeError(`UTCTime year out of range: ${year}`);

  const encoded =
    pad2(year % 100) +
    pad2(value.getUTCMonth() + 1) +
    pad2(value.getUTCDate()) +
    pad2(value.getUTCHours()) +
    pad2(value.getUTCMinutes()) +
    pad2(value.getUTCSeconds()) +
    'Z';

  return encodeTlv(0x17, Buffer.from(encoded, 'ascii'));
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function extractCertificateInfo(
  certificateDer: Buffer | Uint8Array,
): X509CertificateDerInfo {
  const der = rawDer(certificateDer);

  try {
    const certificate = readDerElement(der, 0);
    expectTag(certificate, 0x30, 'certificate');
    if (certificate.end !== der.length)
      throw new Error('certificate has trailing data');

    const tbsCertificate = readDerElement(der, certificate.contentStart);
    expectTag(tbsCertificate, 0x30, 'tbsCertificate');

    let cursor = tbsCertificate.contentStart;
    const firstTbsField = readDerElement(der, cursor);
    if (firstTbsField.tag === 0xa0) {
      const version = readDerElement(der, firstTbsField.contentStart);
      expectTag(version, 0x02, 'certificate version');
      if (version.end !== firstTbsField.end)
        throw new Error('certificate version field has trailing data');
      cursor = firstTbsField.end;
    }

    const serialNumber = readDerElement(der, cursor);
    expectTag(serialNumber, 0x02, 'certificate serialNumber');
    cursor = serialNumber.end;

    const signature = readDerElement(der, cursor);
    expectTag(signature, 0x30, 'certificate signature algorithm');
    cursor = signature.end;

    const issuer = readDerElement(der, cursor);
    expectTag(issuer, 0x30, 'certificate issuer');

    return {
      rawCertificate: Buffer.from(certificate.raw),
      tbsCertificate: Buffer.from(tbsCertificate.raw),
      serialNumber: Buffer.from(serialNumber.raw),
      issuer: Buffer.from(issuer.raw),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse X.509 certificate DER: ${detail}`, {
      cause: error,
    });
  }
}

function readDerElement(input: Buffer, offset: number): DerElement {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= input.length)
    throw new Error(`element offset ${offset} is outside input`);

  const tag = input[offset];
  if (tag === undefined) throw new Error(`missing tag at offset ${offset}`);
  if ((tag & 0x1f) === 0x1f)
    throw new Error(`high-tag-number form is unsupported at offset ${offset}`);

  const firstLength = input[offset + 1];
  if (firstLength === undefined)
    throw new Error(`missing length at offset ${offset}`);

  let contentStart = offset + 2;
  let length: number;
  if ((firstLength & 0x80) === 0) {
    length = firstLength;
  } else {
    const lengthOctets = firstLength & 0x7f;
    if (lengthOctets === 0) throw new Error('indefinite lengths are not DER');
    if (lengthOctets > 6) throw new Error('DER length is too large');
    if (contentStart + lengthOctets > input.length)
      throw new Error(`truncated length at offset ${offset}`);
    if (input[contentStart] === 0)
      throw new Error(`non-minimal length at offset ${offset}`);

    length = 0;
    for (let i = 0; i < lengthOctets; i += 1)
      length = length * 0x100 + input[contentStart + i]!;
    if (length < 0x80)
      throw new Error(`non-minimal length at offset ${offset}`);
    contentStart += lengthOctets;
  }

  const end = contentStart + length;
  if (end > input.length)
    throw new Error(`element overruns input at offset ${offset}`);

  return {
    tag,
    contentStart,
    end,
    raw: input.subarray(offset, end),
  };
}

function expectTag(element: DerElement, expected: number, label: string): void {
  if (element.tag !== expected)
    throw new Error(
      `${label} has tag 0x${element.tag.toString(16)}, expected 0x${expected.toString(16)}`,
    );
}
