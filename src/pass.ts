// Generate a pass file.

'use strict';

import { toBuffer as createZip } from 'do-not-zip';

import { getBufferHash } from './lib/getBufferHash';
import { PassImages } from './lib/images';
import { signManifest } from './lib/signManifest-forge';
import { PassBase } from './lib/base-pass';
import { ApplePass } from './interfaces';

/**
 * @typedef {'PKBarcodeFormatQR' | 'PKBarcodeFormatPDF417' | 'PKBarcodeFormatAztec' | 'PKBarcodeFormatCode128'} BarcodeFormat
 * @typedef {{format: BarcodeFormat, message: string, messageEncoding: string}} BarcodeDescriptor
 */

// Create a new pass.
//
// template  - The template
// fields    - Pass fields (description, serialNumber, logoText)
export class Pass extends PassBase {
  private template: import('./template').Template;
  /**
   *
   * @param {import('./template')} template
   * @param {*} [fields]
   * @param {*} [images]
   */
  constructor(
    template: import('./template').Template,
    fields: Partial<ApplePass> = {},
    images?: PassImages,
  ) {
    super(fields, images);

    this.template = template;
    if (images) Object.assign(this.images, images);

    Object.preventExtensions(this);
  }

  // Validate pass, throws error if missing a mandatory top-level field or image.
  validate(): void {
    // Check required top level fields
    for (const requiredField of [
      'description',
      'organizationName',
      'passTypeIdentifier',
      'serialNumber',
      'teamIdentifier',
    ])
      if (!(requiredField in this.fields))
        throw new ReferenceError(`${requiredField} is required in a Pass`);

    // authenticationToken && webServiceURL must be either both or none
    if ('webServiceURL' in this.fields) {
      if (typeof this.fields.authenticationToken !== 'string')
        throw new Error(
          'While webServiceURL is present, authenticationToken also required!',
        );
      if (this.fields.authenticationToken.length < 16)
        throw new ReferenceError(
          'authenticationToken must be at least 16 characters long!',
        );
    } else if ('authenticationToken' in this.fields)
      throw new TypeError(
        'authenticationToken is presented in Pass data while webServiceURL is missing!',
      );

    this.images.validate();
  }

  /**
   * Returns Pass as a Buffer
   *
   * @memberof Pass
   * @returns {Promise.<Buffer>}
   */
  async asBuffer(): Promise<Buffer> {
    // Validate before attempting to create
    this.validate();
    if (!this.template.certificate)
      throw new ReferenceError(
        `Set pass certificate in template before producing pass buffers`,
      );
    if (!this.template.key)
      throw new ReferenceError(
        `Set private key in pass template before producing pass buffers`,
      );

    // Creating new Zip file
    const zip = [] as { path: string; data: Buffer | string }[];

    // Adding required files
    // Create pass.json
    zip.push({ path: 'pass.json', data: JSON.stringify(this) });

    // Localization
    zip.push(...this.localization.toArray());

    // Images
    zip.push(...(await this.images.toArray()));

    // adding manifest
    // Construct manifest here
    const manifestJson = JSON.stringify(
      zip.reduce(
        (res, { path, data }) => {
          res[path] = getBufferHash(data);
          return res;
        },
        {} as { [k: string]: string },
      ),
    );
    zip.push({ path: 'manifest.json', data: manifestJson });

    // Create signature
    const signature = signManifest(
      this.template.certificate,
      this.template.key,
      manifestJson,
    );
    zip.push({ path: 'signature', data: signature });

    // finished!
    return createZip(zip);
  }
}
