// Generate a pass file.

import { getBufferHash } from './lib/get-buffer-hash.js';
import type { PassImages } from './lib/images.js';
import { signManifest } from './lib/sign-manifest.js';
import { PassBase } from './lib/base-pass.js';
import { writeZip, type ZipWriteEntry } from './lib/zip.js';
import type { ApplePass, Options } from './interfaces.js';
import type { Template } from './template.js';
import type { Localizations } from './lib/localizations.js';

// Create a new pass.
//
// template  - The template
// fields    - Pass fields (description, serialNumber, logoText)
export class Pass extends PassBase {
  private readonly template: Template;

  constructor(
    template: Template,
    fields: Partial<ApplePass> = {},
    images?: PassImages,
    localization?: Localizations,
    options?: Options,
  ) {
    super(fields, images, localization, options);
    this.template = template;

    Object.preventExtensions(this);
  }

  // Validate pass, throws error if missing a mandatory top-level field or image.
  validate(): void {
    for (const requiredField of [
      'description',
      'organizationName',
      'passTypeIdentifier',
      'serialNumber',
      'teamIdentifier',
    ]) {
      if (!(requiredField in this.fields))
        throw new ReferenceError(`${requiredField} is required in a Pass`);
    }

    if ('webServiceURL' in this.fields) {
      if (typeof this.fields.authenticationToken !== 'string')
        throw new Error(
          'While webServiceURL is present, authenticationToken also required!',
        );
      if (this.fields.authenticationToken.length < 16)
        throw new ReferenceError(
          'authenticationToken must be at least 16 characters long!',
        );
    } else if ('authenticationToken' in this.fields) {
      throw new TypeError(
        'authenticationToken is present in Pass data while webServiceURL is missing!',
      );
    }

    this.images.validate();
  }

  async asBuffer(): Promise<Buffer> {
    this.validate();
    if (!this.template.certificate)
      throw new ReferenceError(
        `Set pass certificate in template before producing pass buffers`,
      );
    if (!this.template.key)
      throw new ReferenceError(
        `Set private key in pass template before producing pass buffers`,
      );

    const zip: ZipWriteEntry[] = [];

    zip.push({ path: 'pass.json', data: Buffer.from(JSON.stringify(this)) });
    zip.push(...this.localization.toArray());
    zip.push(...(await this.images.toArray()));

    const manifestJson = JSON.stringify(
      zip.reduce<Record<string, string>>((res, { path, data }) => {
        res[path] = getBufferHash(data);
        return res;
      }, {}),
    );
    zip.push({ path: 'manifest.json', data: manifestJson });

    const signature = signManifest(
      this.template.certificate,
      this.template.key,
      manifestJson,
    );
    zip.push({ path: 'signature', data: signature });

    return writeZip(zip);
  }
}
