import { createHash } from 'node:crypto';

// SHA-1 is used because Apple's PassKit spec requires SHA-1 hex digests
// in the `manifest.json` map (one entry per file in the pkpass bundle).
// This is NOT a security-sensitive hash — it's a fingerprint the bundle
// format demands. The PKCS#7 signature over manifest.json (in sign-manifest.ts)
// is what provides integrity/authenticity.
//
// Do not change this to SHA-256 or stronger without changing the Apple spec.
// See: https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html
export function getBufferHash(data: Buffer | string): string {
  return createHash('sha1').update(data).digest('hex');
}
