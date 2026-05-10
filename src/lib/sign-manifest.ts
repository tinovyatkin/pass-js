// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

import {
  createHash,
  createSign,
  createPrivateKey,
  X509Certificate,
} from 'node:crypto';
import type { KeyObject } from 'node:crypto';

import {
  contextSpecificConstructed,
  extractCertificateInfo,
  integer,
  nullValue,
  objectIdentifier,
  octetString,
  sequence,
  setOf,
  setOfContent,
  utcTime,
} from './der.js';
import type { X509CertificateDerInfo } from './der.js';

interface CmsCertificate extends X509CertificateDerInfo {
  notAfter: Date;
}

function parseCertificate(pem: string): CmsCertificate {
  const certificate = new X509Certificate(pem);
  return {
    ...extractCertificateInfo(certificate.raw),
    notAfter: parseX509Date(certificate.validTo),
  };
}

function parseX509Date(value: string): Date {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp))
    throw new Error(`Failed to parse X.509 certificate expiry: ${value}`);
  return new Date(timestamp);
}

// Apple WWDR Certification Authority — G4
// Valid: 2020-12-16 through 2030-12-10
// Source: https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
// SHA-256 fingerprint: EA:47:57:88:55:38:DD:8C:B5:9F:F4:55:6F:67:60:87:D8:3C:85:E7:09:02:C1:22:E4:2C:08:08:B5:BC:E1:4C
const APPLE_WWDR_G4_PEM = `-----BEGIN CERTIFICATE-----
MIIEVTCCAz2gAwIBAgIUE9x3lVJx5T3GMujM/+Uh88zFztIwDQYJKoZIhvcNAQEL
BQAwYjELMAkGA1UEBhMCVVMxEzARBgNVBAoTCkFwcGxlIEluYy4xJjAkBgNVBAsT
HUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRYwFAYDVQQDEw1BcHBsZSBS
b290IENBMB4XDTIwMTIxNjE5MzYwNFoXDTMwMTIxMDAwMDAwMFowdTFEMEIGA1UE
Aww7QXBwbGUgV29ybGR3aWRlIERldmVsb3BlciBSZWxhdGlvbnMgQ2VydGlmaWNh
dGlvbiBBdXRob3JpdHkxCzAJBgNVBAsMAkc0MRMwEQYDVQQKDApBcHBsZSBJbmMu
MQswCQYDVQQGEwJVUzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANAf
eKp6JzKwRl/nF3bYoJ0OKY6tPTKlxGs3yeRBkWq3eXFdDDQEYHX3rkOPR8SGHgjo
v9Y5Ui8eZ/xx8YJtPH4GUnadLLzVQ+mxtLxAOnhRXVGhJeG+bJGdayFZGEHVD41t
QSo5SiHgkJ9OE0/QjJoyuNdqkh4laqQyziIZhQVg3AJK8lrrd3kCfcCXVGySjnYB
5kaP5eYq+6KwrRitbTOFOCOL6oqW7Z+uZk+jDEAnbZXQYojZQykn/e2kv1MukBVl
PNkuYmQzHWxq3Y4hqqRfFcYw7V/mjDaSlLfcOQIA+2SM1AyB8j/VNJeHdSbCb64D
YyEMe9QbsWLFApy9/a8CAwEAAaOB7zCB7DASBgNVHRMBAf8ECDAGAQH/AgEAMB8G
A1UdIwQYMBaAFCvQaUeUdgn+9GuNLkCm90dNfwheMEQGCCsGAQUFBwEBBDgwNjA0
BggrBgEFBQcwAYYoaHR0cDovL29jc3AuYXBwbGUuY29tL29jc3AwMy1hcHBsZXJv
b3RjYTAuBgNVHR8EJzAlMCOgIaAfhh1odHRwOi8vY3JsLmFwcGxlLmNvbS9yb290
LmNybDAdBgNVHQ4EFgQUW9n6HeeaGgujmXYiUIY+kchbd6gwDgYDVR0PAQH/BAQD
AgEGMBAGCiqGSIb3Y2QGAgEEAgUAMA0GCSqGSIb3DQEBCwUAA4IBAQA/Vj2e5bbD
eeZFIGi9v3OLLBKeAuOugCKMBB7DUshwgKj7zqew1UJEggOCTwb8O0kU+9h0UoWv
p50h5wESA5/NQFjQAde/MoMrU1goPO6cn1R2PWQnxn6NHThNLa6B5rmluJyJlPef
x4elUWY0GzlxOSTjh2fvpbFoe4zuPfeutnvi0v/fYcZqdUmVIkSoBPyUuAsuORFJ
EtHlgepZAE9bPFo22noicwkJac3AfOriJP6YRLj477JxPxpd1F1+M02cHSS+APCQ
A1iZQT0xWmJArzmoUUOSqwSonMJNsUvSq3xKX+udO7xPiEAGE/+QF4oIRynoYpgp
pU8RBWk6z/Kf
-----END CERTIFICATE-----`;

// Override via env for dev/test only.
const APPLE_WWDR_CA_PEM =
  process.env['APPLE_WWDR_CERT_PEM'] || APPLE_WWDR_G4_PEM;

// OIDs Apple requires in the PKCS#7 SignedData.
const OID_CONTENT_TYPE = '1.2.840.113549.1.9.3';
const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';
const OID_SIGNING_TIME = '1.2.840.113549.1.9.5';
const OID_DATA = '1.2.840.113549.1.7.1';
const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';
const OID_SHA1 = '1.3.14.3.2.26';
const OID_RSA_ENCRYPTION = '1.2.840.113549.1.1.1';

const APPLE_WWDR_CA = parseCertificate(APPLE_WWDR_CA_PEM);

// Emit a process warning if the bundled WWDR cert is within 90 days of
// expiry (or already expired). The 2013–2023 G1 silently expired and every
// downstream user shipped broken passes for months before anyone noticed —
// this is the guard that should catch the next rotation.
//
// Uses process.emitWarning (rather than console.warn) so consumers can
// silence or intercept it the standard Node way:
//   node --disable-warning=WalletPassWWDRExpiring app.js
//   process.on('warning', w => { if (w.code === 'WALLETPASS_WWDR_EXPIRED') ... })
const WWDR_WARN_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const wwdrNotAfter = APPLE_WWDR_CA.notAfter;
const msUntilExpiry = wwdrNotAfter.getTime() - Date.now();
if (msUntilExpiry < WWDR_WARN_WINDOW_MS) {
  const when = wwdrNotAfter.toISOString().slice(0, 10);
  const days = Math.ceil(msUntilExpiry / (24 * 60 * 60 * 1000));
  if (msUntilExpiry < 0) {
    process.emitWarning(
      `Bundled Apple WWDR certificate expired on ${when}. Signed passes will fail validation. Upgrade @walletpass/pass-js or override via APPLE_WWDR_CERT_PEM. See https://www.apple.com/certificateauthority/`,
      { type: 'WalletPassWWDRExpired', code: 'WALLETPASS_WWDR_EXPIRED' },
    );
  } else {
    process.emitWarning(
      `Bundled Apple WWDR certificate expires on ${when} (${days} days). Upgrade @walletpass/pass-js before then to avoid silently shipping invalid passes.`,
      { type: 'WalletPassWWDRExpiring', code: 'WALLETPASS_WWDR_EXPIRING' },
    );
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

// Sign the manifest.json of an Apple Wallet pass bundle.
// Returns a detached PKCS#7 (CMS) SignedData DER blob suitable for the
// pkpass `signature` file.
//
// - `certificatePem`: the Pass Type ID signing certificate (PEM).
// - `privateKey`: the matching RSA private key as a PEM string or
//   a node:crypto KeyObject. Pass a password via `createPrivateKey`
//   before calling if the key is encrypted.
// - `manifestJson`: the manifest.json contents to sign (string).
export function signManifest(
  certificatePem: string,
  privateKey: string | KeyObject,
  manifestJson: string,
): Buffer {
  const signerCert = parseCertificate(certificatePem);

  const keyObject =
    typeof privateKey === 'string' ? createPrivateKey(privateKey) : privateKey;

  const manifestBytes = Buffer.from(manifestJson, 'utf8');
  const digest = createHash('sha1').update(manifestBytes).digest();

  const signedAttributes = [
    cmsAttribute(OID_CONTENT_TYPE, objectIdentifier(OID_DATA)),
    cmsAttribute(OID_MESSAGE_DIGEST, octetString(digest)),
    cmsAttribute(OID_SIGNING_TIME, utcTime(new Date())),
  ];
  const signedAttributesContent = setOfContent(...signedAttributes);
  const signedAttributesDer = setOf(...signedAttributes);

  // CMS signs the DER SET OF attributes, while SignerInfo stores the same
  // content under the IMPLICIT [0] signedAttrs tag.
  const signature = createSign('sha1')
    .update(signedAttributesDer)
    .sign(keyObject);

  const signerInfo = sequence(
    integer(1),
    sequence(signerCert.issuer, signerCert.serialNumber),
    algorithmIdentifier(OID_SHA1),
    contextSpecificConstructed(0, signedAttributesContent),
    algorithmIdentifier(OID_RSA_ENCRYPTION, nullValue()),
    octetString(signature),
  );

  const signedData = sequence(
    integer(1),
    setOf(algorithmIdentifier(OID_SHA1)),
    sequence(objectIdentifier(OID_DATA)),
    contextSpecificConstructed(
      0,
      setOfContent(signerCert.rawCertificate, APPLE_WWDR_CA.rawCertificate),
    ),
    setOf(signerInfo),
  );

  return sequence(
    objectIdentifier(OID_SIGNED_DATA),
    contextSpecificConstructed(0, signedData),
  );
}

function algorithmIdentifier(oid: string, parameters?: Buffer): Buffer {
  const parts = [objectIdentifier(oid)];
  if (parameters !== undefined) parts.push(parameters);
  return sequence(...parts);
}

function cmsAttribute(type: string, ...values: Buffer[]): Buffer {
  return sequence(objectIdentifier(type), setOf(...values));
}
