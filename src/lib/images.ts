/**
 * Base PassImages class to add image filePath manipulation
 */

'use strict';

import { promisify } from 'util';
import * as path from 'path';
import { createReadStream, promises as fs } from 'fs';

import * as imagesize from 'imagesize';

import { IMAGES, DENSITIES } from '../constants';

import { normalizeLocale } from './normalize-locale';

interface ImageSizeResult {
  format: 'gif' | 'png' | 'jpeg';
  width: number;
  height: number;
}

const imageSize: (
  v: import('stream').Readable,
) => Promise<ImageSizeResult> = promisify(imagesize);

export type ImageDensity = '1x' | '2x' | '3x';
export type ImageType =
  | 'logo'
  | 'icon'
  | 'background'
  | 'footer'
  | 'strip'
  | 'thumbnail';

const IMAGES_TYPES = new Set(Object.keys(IMAGES));
export const IMAGE_FILENAME_REGEX = new RegExp(
  `(^|/)((?<lang>[-A-Z_a-z]+).lproj/)?(?<imageType>${Object.keys(IMAGES).join(
    '|',
  )}+)(@(?<density>[23]x))?.png$`,
);

export class PassImages extends Map<string, string | Buffer> {
  constructor(images?: PassImages) {
    super(images instanceof PassImages ? [...images] : undefined);
  }

  async toArray(): Promise<{ path: string; data: Buffer }[]> {
    return Promise.all(
      [...this].map(async ([filepath, pathOrBuffer]) => ({
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
    const keys = [...this.keys()];
    // Check for required images
    for (const requiredImage of ['icon', 'logo'])
      if (!keys.some(img => img.endsWith(`${requiredImage}.png`)))
        throw new SyntaxError(`Missing required image ${requiredImage}.png`);
  }

  /**
   * Load all images from the specified directory. Only supported images are
   * loaded, nothing bad happens if directory contains other files.
   *
   * @param {string} dirPath - path to a directory with images
   * @param {boolean} disableImageCheck - disable image dimension validation
   * @memberof PassImages
   */
  async load(dirPath: string, disableImageCheck?: boolean): Promise<this> {
    // Check if the path is accessible directory actually
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    // checking rest of files
    const entriesLoader: Promise<void>[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // check if it's a localization folder
        const test = /(?<lang>[-A-Z_a-z]+)\.lproj/.exec(entry.name);
        if (!test?.groups?.lang) continue;
        const { lang } = test.groups;
        // reading this directory
        const currentPath = path.join(dirPath, entry.name);
        const localizations = await fs.readdir(currentPath, {
          withFileTypes: true,
        });
        // check if we have any localized images
        for (const f of localizations) {
          const img = this.parseFilename(f.name);
          if (img)
            entriesLoader.push(
              this.add(
                img.imageType,
                path.join(currentPath, f.name),
                img.density,
                lang,
                disableImageCheck
              ),
            );
        }
      } else {
        // check it it's an image
        const img = this.parseFilename(entry.name);
        if (img)
          entriesLoader.push(
            this.add(
              img.imageType,
              path.join(dirPath, entry.name),
              img.density,
              undefined,
              disableImageCheck
            ),
          );
      }
    }
    await Promise.all(entriesLoader);
    return this;
  }

  // eslint-disable-line max-params
  async add(
    imageType: ImageType,
    pathOrBuffer: string | Buffer,
    density?: ImageDensity,
    lang?: string,
    disableImageCheck?: boolean
  ): Promise<void> {
    if (!IMAGES_TYPES.has(imageType))
      throw new TypeError(`Unknown image type ${imageSize} for ${imageType}`);
    if (density && !DENSITIES.has(density))
      throw new TypeError(`Invalid density ${density} for ${imageType}`);

    // check data
    let sizeRes;
    if (typeof pathOrBuffer === 'string') {
      // PNG size is in first 24 bytes
      const rs = createReadStream(pathOrBuffer, { highWaterMark: 30 });
      sizeRes = await imageSize(rs);
      // see https://github.com/nodejs/node/issues/25335#issuecomment-451945106
      rs.once('readable', () => rs.destroy());
    } else {
      if (!Buffer.isBuffer(pathOrBuffer))
        throw new TypeError(
          `Image data for ${imageType} must be either file path or buffer`,
        );
      const { Parser } = imagesize;
      const parser = Parser();
      const res = parser.parse(pathOrBuffer);
      if (res !== Parser.DONE)
        throw new TypeError(
          `Supplied buffer doesn't contain valid PNG image for ${imageType}`,
        );
      sizeRes = parser.getResult() as ImageSizeResult;
    }
    if (!disableImageCheck) this.checkImage(imageType, sizeRes, density);
    super.set(this.getImageFilename(imageType, density, lang), pathOrBuffer);
  }

  parseFilename(
    fileName: string,
  ):
    | { imageType: ImageType; density?: ImageDensity; lang?: string }
    | undefined {
    const test = IMAGE_FILENAME_REGEX.exec(fileName);
    if (!test?.groups) return undefined;
    const res: {
      imageType: ImageType;
      density?: ImageDensity;
      lang?: string;
    } = { imageType: test.groups.imageType as ImageType };
    if (test.groups.density) res.density = test.groups.density as ImageDensity;
    if (test.groups.lang) res.lang = normalizeLocale(test.groups.lang);
    return res;
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
        if (width < 29 * densityMulti)
          throw new TypeError(
            `icon image must have width ${29 *
              densityMulti}px for ${densityMulti}x density`,
          );
        if (height < 29 * densityMulti)
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
    return `${lang ? `${normalizeLocale(lang)}.lproj/` : ''}${imageType}${
      /^[23]x$/.test(density || '') ? `@${density}` : ''
    }.png`;
  }
}
