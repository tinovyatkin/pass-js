/**
 * Base PassImages class to add image filePath manipulation
 */

'use strict';

const { stat, readdir } = require('fs-nextra');
const { basename, extname, resolve } = require('path');

// Supported images.
const IMAGES = ['background', 'footer', 'icon', 'logo', 'strip', 'thumbnail'];
const DENSITIES = ['2x', '3x'];

class PassImages {
  constructor() {
    this.images = new Map();
    // define setters and getters for particular images
    IMAGES.forEach(imageType => {
      Object.defineProperty(this, imageType, {
        enumerable: true,
        get: this.getImage.bind(this, imageType),
        set: this.setImage.bind(this, imageType, ''),
      });
      // setting retina properties too
      DENSITIES.forEach(density => {
        Object.defineProperty(this, imageType + density, {
          enumerable: true,
          get: this.getImage.bind(this, imageType, density),
          set: this.setImage.bind(this, imageType, density),
        });
      });
    });
  }

  /**
   * Returns a given imageType path with a density
   * 
   * @param {string} imageType 
   * @param {string} density - can be '2x' or '3x'
   * @returns {string} - image path
   * @memberof PassImages
   */
  getImage(imageType, density) {
    if (!IMAGES.includes(imageType))
      throw new Error(`Requested unknown image type: ${imageType}`);
    if (!density) return this.images.get(imageType);
    if (!DENSITIES.includes(density))
      throw new Error(`Invalid desity for "${imageType}": ${density}`);
    return this.images.get(`${imageType}@${density}`);
  }

  /**
   * Saves a given imageType path
   * 
   * @param {string} imageType 
   * @param {string} density 
   * @param {string} fileName 
   * @memberof PassImages
   */
  setImage(imageType, density, fileName) {
    if (!IMAGES.includes(imageType))
      throw new Error(`Attempted to set unknown image type: ${imageType}`);
    if (!density) this.images.set(imageType, fileName);
    else this.images.set(`${imageType}@${density}`, fileName);
  }

  /**
   * Load all images from the specified directory. Only supported images are
   * loaded, nothing bad happens if directory contains other files.
   *
   * @param {string} dir - path to a directory with images
   * @memberof PassImages
   */
  async loadFromDirectory(dir) {
    const stats = await stat(dir);
    if (!stats.isDirectory())
      throw new Error(`Path ${dir} must be a directory!`);

    const files = await readdir(dir);
    for (const filePath of files) {
      // we are interesting only in PNG files
      if (extname(filePath) === '.png') {
        const fileName = basename(filePath, '.png');
        // this will split imagename like background@2x into 'background' and '2x' and fail on anything else
        const [, imageType, , density] =
          /^([a-z]+)(@([2-3]x))?$/.exec(fileName) || [];
        if (
          IMAGES.includes(imageType) &&
          (!density || DENSITIES.includes(density))
        )
          this.setImage(imageType, density, resolve(dir, filePath));
      }
    }

    return this;
  }
}

module.exports = PassImages;
