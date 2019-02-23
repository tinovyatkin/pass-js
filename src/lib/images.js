/**
 * Base PassImages class to add image filePath manipulation
 */

'use strict';

const { basename, extname, resolve } = require('path');
const { stat, readdir } = require('fs').promises;

// Supported images.
const { IMAGES, DENSITIES } = require('../constants');

class PassImages {
  constructor() {
    // Creating this way to make it invisible
    this.map = new Map();

    // define setters and getters for particular images
    for (const imageType in IMAGES) {
      Object.defineProperty(this, imageType, {
        enumerable: false,
        get: this.getImage.bind(this, imageType),
        set: this.setImage.bind(this, imageType, '1x'),
      });
      // setting retina properties too
      for (const density of DENSITIES) {
        Object.defineProperty(this, imageType + density, {
          enumerable: false,
          get: this.getImage.bind(this, imageType, density),
          set: this.setImage.bind(this, imageType, density),
        });
      }
    }

    Object.preventExtensions(this);
  }

  /**
   * Returns a given imageType path with a density
   *
   * @param {string} imageType
   * @param {string} density - can be '2x' or '3x'
   * @returns {string} - image path
   * @memberof PassImages
   */
  getImage(imageType, density = '1x') {
    if (!(imageType in IMAGES))
      throw new Error(`Requested unknown image type: ${imageType}`);
    if (!DENSITIES.includes(density))
      throw new Error(`Invalid desity for "${imageType}": ${density}`);
    if (!this.map.has(imageType)) return undefined;
    return this.map.get(imageType).get(density);
  }

  /**
   * Saves a given imageType path
   *
   * @param {string} imageType
   * @param {string} density
   * @param {string} fileName
   * @memberof PassImages
   */
  setImage(imageType, density = '1x', fileName) {
    if (!(imageType in IMAGES))
      throw new Error(`Attempted to set unknown image type: ${imageType}`);
    const imgData = this.map.get(imageType) || new Map();
    imgData.set(density, fileName);
    this.map.set(imageType, imgData);
  }

  /**
   * Load all images from the specified directory. Only supported images are
   * loaded, nothing bad happens if directory contains other files.
   *
   * @param {string} dir - path to a directory with images
   * @memberof PassImages
   */
  async loadFromDirectory(dir) {
    const fullPath = resolve(dir);
    const stats = await stat(fullPath);
    if (!stats.isDirectory())
      throw new Error(`Path ${fullPath} must be a directory!`);

    const files = await readdir(fullPath);
    for (const filePath of files) {
      // we are interesting only in PNG files
      if (extname(filePath) === '.png') {
        const fileName = basename(filePath, '.png');
        // this will split imagename like background@2x into 'background' and '2x' and fail on anything else
        const [, imageType, , density] =
          /^([a-z]+)(@([23]x))?$/.exec(fileName) || [];
        if (imageType in IMAGES && (!density || DENSITIES.includes(density)))
          this.setImage(imageType, density, resolve(fullPath, filePath));
      }
    }

    return this;
  }
}

module.exports = PassImages;
