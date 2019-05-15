/**
 * Base PassImages class to add image filePath manipulation
 */

'use strict';

import { promisify } from 'util';
import * as path from 'path';
import { createReadStream, promises as fs } from 'fs';

import glob from 'fast-glob';
import * as imagesize from 'imagesize';

import { IMAGES, DENSITIES } from '../constants';

interface ImageSizeResult {
  format: 'gif' | 'png' | 'jpeg';
  width: number;
  height: number;
}

const imageSize: (
  v: import('stream').Readable,
) => Promise<ImageSizeResult> = promisify(imagesize);

type ImageDensity = '1x' | '2x' | '3x';
type ImageType =
  | 'logo'
  | 'icon'
  | 'background'
  | 'footer'
  | 'strip'
  | 'thumbnail';

const IMAGES_GLOB = `(${Object.keys(IMAGES).join('|')})*(@2x|@3x).png`;
const IMAGES_TYPES = new Set(Object.keys(IMAGES));

export class PassImages {
  private map: Map<string, string | Buffer> = new Map();

  constructor(images?: PassImages) {
    if (images instanceof PassImages) {
      this.map = new Map([...images.map]);
    }
    Object.preventExtensions(this);
  }

  get count(): number {
    return this.map.size;
  }

  async toArray(): Promise<{ path: string; data: Buffer }[]> {
    return Promise.all(
      [...this.map].map(async ([filepath, pathOrBuffer]) => ({
        path: filepath,
        data:
          typeof pathOrBuffer === 'string'
            ? await fs.readFile(pathOrBuffer)
            : pathOrBuffer,
      })),
    );
  }

  /**
   * Checks that all required images is set or throws elsewhere
   */
  validate(): void {
    const keys = [...this.map.keys()];
    // Check for required images
    for (const requiredImage of ['icon', 'logo'])
      if (!keys.some(img => img.endsWith(`${requiredImage}.png`)))
        throw new SyntaxError(`Missing required image ${requiredImage}.png`);
  }

  /**
   * Load all images from the specified directory. Only supported images are
   * loaded, nothing bad happens if directory contains other files.
   *
   * @param {string} dir - path to a directory with images
   * @memberof PassImages
   */
  async loadFromDirectory(dir: string): Promise<PassImages> {
    for await (const file of glob.stream(
      [path.join(dir, IMAGES_GLOB), path.join(dir, '*.lproj', IMAGES_GLOB)],
      {
        onlyFiles: true,
        deep: 1,
      },
    )) {
      if (typeof file !== 'string') continue;
      // getting image type and optional density and language
      const re = /((?<lang>[-A-Z_a-z]+)\.lproj\/)?(?<imageType>[a-z]+)(@(?<density>[23]x))?\.png$/.exec(
        file,
      );
      if (!re) continue;
      const { imageType, density, lang } = re.groups as {
        imageType: ImageType;
        density?: ImageDensity;
        lang?: string;
      };
      await this.setImage(imageType, file, density, lang);
    }

    return this;
  }

  async setImage(
    imageType: ImageType,
    pathOrBuffer: string | Buffer,
    density?: ImageDensity,
    lang?: string,
  ): Promise<void> {
    if (!IMAGES_TYPES.has(imageType))
      throw new TypeError(`Unknown image type ${imageSize} for ${imageType}`);
    if (density && !DENSITIES.has(density))
      throw new TypeError(`Invalid density ${density} for ${imageType}`);

    // check data
    let sizeRes;
    if (typeof pathOrBuffer === 'string') {
      const rs = createReadStream(pathOrBuffer);
      sizeRes = await imageSize(rs);
      rs.destroy();
    } else {
      if (!Buffer.isBuffer(pathOrBuffer))
        throw new TypeError(
          `Image data for ${imageType} must be either file path or buffer`,
        );
      const { Parser } = imagesize;
      const parser = Parser();
      const res = parser.parse(pathOrBuffer);
      if (!res !== Parser.DONE)
        throw new TypeError(
          `Supplied buffer doesn't contain valid PNG image for ${imageType}`,
        );
      sizeRes = parser.getResult() as ImageSizeResult;
    }
    this.checkImage(imageType, sizeRes, density);
    this.map.set(this.getImageFilename(imageType, density, lang), pathOrBuffer);
  }

  // eslint-disable-next-line complexity
  private checkImage(
    imageType: ImageType,
    sizeResult: ImageSizeResult,
    density?: ImageDensity,
  ): void {
    const densityMulti = density ? parseInt(density.charAt(0), 10) : 1;
    const { format, width, height } = sizeResult;
    if (format !== 'png')
      throw new TypeError(`Image for "${imageType}" is not a PNG file!`);
    if (!Number.isInteger(width) || width <= 0)
      throw new TypeError(`Image ${imageType} has invalid width: ${width}`);
    if (!Number.isInteger(height) || height <= 0)
      throw new TypeError(`Image ${imageType} has invalid height: ${height}`);
    /**
     * @see {@link https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html}
     */
    switch (imageType) {
      case 'icon':
        if (width !== 29 * densityMulti)
          throw new TypeError(
            `icon image must have width ${29 *
              densityMulti}px for ${densityMulti}x density`,
          );
        if (height !== 29 * densityMulti)
          throw new TypeError(
            `icon image must have height ${29 *
              densityMulti}px for ${densityMulti}x density`,
          );
        break;

      case 'logo':
        if (width > 160 * densityMulti)
          throw new TypeError(
            `logo image must have width no large than ${160 *
              densityMulti}px for ${densityMulti}x density`,
          );
        // if (height > 50 * densityMulti)
        //   throw new TypeError(
        //     `logo image must have height ${50 *
        //       densityMulti}px for ${densityMulti}x density, received ${height}`,
        //   );
        break;

      case 'background':
        if (width > 180 * densityMulti)
          throw new TypeError(
            `background image must have width ${180 *
              densityMulti}px for ${densityMulti}x density`,
          );
        if (height > 220 * densityMulti)
          throw new TypeError(
            `background image must have height ${220 *
              densityMulti}px for ${densityMulti}x density`,
          );
        break;

      case 'footer':
        if (width > 286 * densityMulti)
          throw new TypeError(
            `footer image must have width ${286 *
              densityMulti}px for ${densityMulti}x density`,
          );
        if (height > 15 * densityMulti)
          throw new TypeError(
            `footer image must have height ${15 *
              densityMulti}px for ${densityMulti}x density`,
          );
        break;

      case 'strip':
        // if (width > 375 * densityMulti)
        //   throw new TypeError(
        //     `strip image must have width ${375 *
        //       densityMulti}px for ${densityMulti}x density, received ${width}`,
        //   );
        if (height > 144 * densityMulti)
          throw new TypeError(
            `strip image must have height ${144 *
              densityMulti}px for ${densityMulti}x density`,
          );
        break;

      case 'thumbnail':
        if (width > 120 * densityMulti)
          throw new TypeError(
            `thumbnail image must have width no large than ${90 *
              densityMulti}px for ${densityMulti}x density, received ${width}`,
          );
        if (height > 150 * densityMulti)
          throw new TypeError(
            `thumbnail image must have height ${90 *
              densityMulti}px for ${densityMulti}x density, received ${height}`,
          );
        break;
    }
  }

  private getImageFilename(
    imageType: ImageType,
    density?: ImageDensity,
    lang?: string,
  ): string {
    return `${lang ? `${lang}.lproj/` : ''}${imageType}${
      /^[23]x$/.test(density || '') ? `@${density}` : ''
    }.png`;
  }
}
