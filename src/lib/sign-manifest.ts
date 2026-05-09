import {
  createHash,
  createSign,
  createPrivateKey,
  X509Certificate,
} from 'node:crypto';
import type { KeyObject } from 'node:crypto';

import * as asn1js from 'asn1js';
import {
  Certificate as PkiCertificate,
  ContentInfo,
  EncapsulatedContentInfo,
  IssuerAndSerialNumber,
  SignedData,
  SignerInfo,
  SignedAndUnsignedAttributes,
  Attribute,
  AlgorithmIdentifier,
} from 'pkijs';

// Convert a PEM certificate into a pkijs Certificate by going through the
// node:crypto X509Certificate parser (which accepts PEM and emits DER in .raw).
function parsePkiCertificate(pem: string): PkiCertificate {
  const der = new X509Certificate(pem).raw;
  const ab = der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength);
  const asn1 = asn1js.fromBER(ab);
  if (asn1.offset === -1) {
    throw new Error('Failed to parse X.509 certificate: invalid ASN.1');
  }
  return new PkiCertificate({ schema: asn1.result });
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
const OID_SHA1 = '1.3.14.3.2.26';
const OID_RSA_ENCRYPTION = '1.2.840.113549.1.1.1';

const APPLE_WWDR_CA = parsePkiCertificate(APPLE_WWDR_CA_PEM);

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
const wwdrNotAfter = APPLE_WWDR_CA.notAfter.value;
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
  const signerCert = parsePkiCertificate(certificatePem);

  const keyObject =
    typeof privateKey === 'string' ? createPrivateKey(privateKey) : privateKey;

  const manifestBytes = Buffer.from(manifestJson, 'utf8');
  const digest = createHash('sha1').update(manifestBytes).digest();

  // Authenticated attributes: content-type, message-digest, signing-time.
  // These are what Apple requires in the SignerInfo.
  const signedAttrs = new SignedAndUnsignedAttributes({
    type: 0,
    attributes: [
      new Attribute({
        type: OID_CONTENT_TYPE,
        values: [new asn1js.ObjectIdentifier({ value: OID_DATA })],
      }),
      new Attribute({
        type: OID_MESSAGE_DIGEST,
        values: [new asn1js.OctetString({ valueHex: digest })],
      }),
      new Attribute({
        type: OID_SIGNING_TIME,
        values: [new asn1js.UTCTime({ valueDate: new Date() })],
      }),
    ],
  });

  const signerInfo = new SignerInfo({
    version: 1,
    sid: new IssuerAndSerialNumber({
      issuer: signerCert.issuer,
      serialNumber: signerCert.serialNumber,
    }),
    digestAlgorithm: new AlgorithmIdentifier({ algorithmId: OID_SHA1 }),
    signedAttrs,
    signatureAlgorithm: new AlgorithmIdentifier({
      algorithmId: OID_RSA_ENCRYPTION,
    }),
  });

  // Serialize the signed attributes (SET OF), sign with RSA-SHA1.
  // Per RFC 5652 §5.4, the IMPLICIT [0] is replaced with an explicit SET tag
  // for the signed bytes.
  const attrsDer = Buffer.from(
    (signedAttrs.toSchema() as asn1js.Constructed).toBER(false),
  );
  // Replace the IMPLICIT [0] tag (0xA0) with explicit SET (0x31).
  const toSign = Buffer.concat([Buffer.from([0x31]), attrsDer.subarray(1)]);

  const signature = createSign('sha1').update(toSign).sign(keyObject);
  signerInfo.signature = new asn1js.OctetString({ valueHex: signature });

  const signedData = new SignedData({
    version: 1,
    digestAlgorithms: [new AlgorithmIdentifier({ algorithmId: OID_SHA1 })],
    encapContentInfo: new EncapsulatedContentInfo({
      eContentType: OID_DATA,
      // No eContent — detached signature.
    }),
    certificates: [signerCert, APPLE_WWDR_CA],
    signerInfos: [signerInfo],
  });

  // Wrap in ContentInfo.
  const contentInfo = new ContentInfo({
    contentType: '1.2.840.113549.1.7.2', // id-signedData
    content: signedData.toSchema(true),
  });

  const ber = contentInfo.toSchema().toBER(false);
  return Buffer.from(ber);
}
