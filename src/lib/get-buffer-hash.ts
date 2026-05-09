import { createHash } from 'node:crypto';

export function getBufferHash(data: Buffer | string): string {
  return createHash('sha1').update(data).digest('hex');
}
