/**
 * Base PassImages class to add image filePath manipulation
 */

'use strict';

import * as assert from 'assert';
import { promisify } from 'util';
import { basename, extname, resolve } from 'path';
import { promises as fs, createReadStream } from 'fs';

import * as imagesize from 'imagesize';

const { stat, readdir } = fs;
const imageSize: (
  v: import('stream').Readable,
) => Promise<{
  format: 'gif' | 'png' | 'jpeg';
  width: number;
  height: number;
}> = promisify(imagesize);

type ImageDensity = '1x' | '2x' | '3x';
type ImageType =
  | 'logo'
  | 'icon'
  | 'background'
  | 'footer'
  | 'strip'
  | 'thumbnail';

export class PassImages {
  icon = '';
  icon2x = '';
  icon3x = '';

  logo = '';
  logo2x = '';
  logo3x = '';

  background = '';
  background2x = '';
  background3x = '';

  footer = '';
  footer2x = '';
  footer3x = '';

  strip = '';
  strip2x = '';
  strip3x = '';

  thumbnail = '';
  thumbnail2x = '';
  thumbnail3x = '';

  constructor() {
    Object.preventExtensions(this);
  }

  /**
   * Returns all images file names as array
   */
  files(): Set<string> {
    return new Set(
      Object.getOwnPropertyNames(this)
        .filter((prop): boolean => typeof this[prop] === 'string' && this[prop])
        .map((image): string => this[image]),
    );
  }

  /**
   * Load all images from the specified directory. Only supported images are
   * loaded, nothing bad happens if directory contains other files.
   *
   * @param {string} dir - path to a directory with images
   * @memberof PassImages
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity, complexity
  async loadFromDirectory(dir: string): Promise<PassImages> {
    const fullPath = resolve(dir);
    const stats = await stat(fullPath);
    assert.ok(stats.isDirectory(), `Path ${fullPath} must be a directory!`);

    const files = await readdir(fullPath);
    for (const filePath of files) {
      // we are interesting only in PNG files
      if (extname(filePath).toLowerCase() === '.png') {
        const fileName = basename(filePath, '.png');
        // this will split imagename like background@2x into 'background' and '2x' and fail on anything else
        const re = /^([a-z]+)(@([23]x))?$/.exec(fileName);
        if (!re) continue;
        const imageType = re[1] as ImageType;
        if (!(imageType in this)) continue;
        const density = re[3] as ImageDensity;
        const densityMulti = density ? parseInt(density.charAt(0), 10) : 1;
        assert.ok(
          Number.isInteger(densityMulti) &&
            densityMulti >= 1 &&
            densityMulti <= 3,
          `Invalid image density ${density}`,
        );

        const absolutePath = resolve(fullPath, filePath);
        const { format, width, height } = await imageSize(
          createReadStream(absolutePath),
        );
        assert.strictEqual(format, 'png', `File ${filePath} is not PNG!`);
        assert.ok(
          Number.isInteger(width) && width > 0,
          `Image ${fileName} has invalid width`,
        );
        assert.ok(
          Number.isInteger(height) && height > 0,
          `Image ${fileName} has invalid height`,
        );

        /**
         * @see {@link https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html}
         */
        switch (imageType) {
          case 'icon':
            assert.strictEqual(
              width,
              29 * densityMulti,
              `icon image must have width ${29 *
                densityMulti}px for ${densityMulti}x density`,
            );
            assert.strictEqual(
              height,
              29 * densityMulti,
              `icon image must have height ${29 *
                densityMulti}px for ${densityMulti}x density`,
            );
            switch (densityMulti) {
              case 1:
                this.icon = absolutePath;
                break;

              case 2:
                this.icon2x = absolutePath;
                break;

              case 3:
                this.icon3x = absolutePath;
                break;
            }
            break;

          case 'logo':
            assert.ok(
              width <= 160 * densityMulti,
              `logo image must have width no large than ${160 *
                densityMulti}px for ${densityMulti}x density`,
            );
            assert.ok(
              height <= 50 * densityMulti,
              `log image must have height ${50 *
                densityMulti}px for ${densityMulti}x density`,
            );
            switch (densityMulti) {
              case 1:
                this.logo = absolutePath;
                break;

              case 2:
                this.logo2x = absolutePath;
                break;

              case 3:
                this.logo3x = absolutePath;
                break;
            }
            break;

          case 'background':
            assert.ok(
              width <= 180 * densityMulti,
              `background image must have width ${180 *
                densityMulti}px for ${densityMulti}x density`,
            );
            assert.ok(
              height <= 220 * densityMulti,
              `background image must have height ${220 *
                densityMulti}px for ${densityMulti}x density`,
            );
            switch (densityMulti) {
              case 1:
                this.background = absolutePath;
                break;

              case 2:
                this.background2x = absolutePath;
                break;

              case 3:
                this.background3x = absolutePath;
                break;
            }
            break;

          case 'footer':
            assert.ok(
              width <= 286 * densityMulti,
              `footer image must have width ${286 *
                densityMulti}px for ${densityMulti}x density`,
            );
            assert.ok(
              height <= 15 * densityMulti,
              `footer image must have height ${15 *
                densityMulti}px for ${densityMulti}x density`,
            );
            switch (densityMulti) {
              case 1:
                this.footer = absolutePath;
                break;

              case 2:
                this.footer2x = absolutePath;
                break;

              case 3:
                this.footer3x = absolutePath;
                break;
            }
            break;

          case 'strip':
            assert.ok(
              width <= 375 * densityMulti,
              `strip image must have width ${375 *
                densityMulti}px for ${densityMulti}x density`,
            );
            assert.ok(
              height <= 144 * densityMulti,
              `strip image must have height ${144 *
                densityMulti}px for ${densityMulti}x density`,
            );
            switch (densityMulti) {
              case 1:
                this.strip = absolutePath;
                break;

              case 2:
                this.strip2x = absolutePath;
                break;

              case 3:
                this.strip3x = absolutePath;
                break;
            }
            break;

          case 'thumbnail':
            assert.ok(
              width <= 90 * densityMulti,
              `thumbnail image must have width no large than ${90 *
                densityMulti}px for ${densityMulti}x density`,
            );
            assert.ok(
              height <= 90 * densityMulti,
              `thumbnail image must have height ${90 *
                densityMulti}px for ${densityMulti}x density`,
            );
            switch (densityMulti) {
              case 1:
                this.thumbnail = absolutePath;
                break;

              case 2:
                this.thumbnail2x = absolutePath;
                break;

              case 3:
                this.thumbnail3x = absolutePath;
                break;
            }
            break;
        }
      }
    }

    return this;
  }
}
