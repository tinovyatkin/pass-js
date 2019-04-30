/**
 * Base PassImages class to add image filePath manipulation
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const imagesize_1 = require("imagesize");
const util_1 = require("util");
// Supported images.
const path_1 = require("path");
const fs_1 = require("fs");
const { stat, readdir } = fs_1.promises;
const imageSize = util_1.promisify(imagesize_1.default);
class PassImages {
    constructor() {
        Object.preventExtensions(this);
    }
    /**
     * Returns all images file names as array
     */
    all() {
        return Object.getOwnPropertyNames(this)
            .filter(prop => typeof this[prop] === "string")
            .map(image => this[image]);
    }
    /**
     * Load all images from the specified directory. Only supported images are
     * loaded, nothing bad happens if directory contains other files.
     *
     * @param {string} dir - path to a directory with images
     * @memberof PassImages
     */
    async loadFromDirectory(dir) {
        const fullPath = path_1.resolve(dir);
        const stats = await stat(fullPath);
        assert.ok(stats.isDirectory(), `Path ${fullPath} must be a directory!`);
        const files = await readdir(fullPath);
        for (const filePath of files) {
            // we are interesting only in PNG files
            if (path_1.extname(filePath).toLowerCase() === ".png") {
                const fileName = path_1.basename(filePath, ".png");
                // this will split imagename like background@2x into 'background' and '2x' and fail on anything else
                const re = /^([a-z]+)(@([23]x))?$/.exec(fileName);
                if (!re)
                    continue;
                const imageType = re[1];
                if (!(imageType in this))
                    continue;
                const density = re[3];
                const densityMulti = density ? parseInt(density.charAt(0), 10) : 1;
                assert.ok(Number.isInteger(densityMulti) &&
                    densityMulti >= 1 &&
                    densityMulti <= 3, `Invalid image density ${density}`);
                const absolutePath = path_1.resolve(fullPath, filePath);
                const { format, width, height } = await imageSize(absolutePath);
                assert.strictEqual(format, "png", `File ${filePath} is not PNG!`);
                switch (imageType) {
                    case "icon":
                        assert.strictEqual(width, 29 * densityMulti, `icon image must have width ${29 *
                            densityMulti}px for ${densityMulti}x density`);
                        assert.strictEqual(height, 29 * densityMulti, `icon image must have height ${29 *
                            densityMulti}px for ${densityMulti}x density`);
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
                    case "logo":
                        assert.strictEqual(width, 160 * densityMulti, `logo image must have width ${160 *
                            densityMulti}px for ${densityMulti}x density`);
                        assert.strictEqual(height, 50 * densityMulti, `log image must have height ${50 *
                            densityMulti}px for ${densityMulti}x density`);
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
                    case "background":
                        assert.strictEqual(width, 180 * densityMulti, `background image must have width ${180 *
                            densityMulti}px for ${densityMulti}x density`);
                        assert.strictEqual(height, 220 * densityMulti, `background image must have height ${220 *
                            densityMulti}px for ${densityMulti}x density`);
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
                }
            }
        }
        return this;
    }
}
exports.PassImages = PassImages;
