// Generate a pass file.

'use strict';

const { EventEmitter } = require('events');
const Path = require('path');
const { PassThrough } = require('stream');

const Zip = require('./lib/zip');
const PassImages = require('./lib/images');
const SHAWriteStream = require('./lib/SHAWriteStream');
const signManifest = require('./lib/signManifest-openssl');
const Fields = require('./lib/fields');
const pipeIntoStream = require('./lib/pipe-into-stream');

const {
  TOP_LEVEL_FIELDS,
  IMAGES,
  STRUCTURE_FIELDS,
  TRANSIT,
  PASS_MIME_TYPE,
} = require('./constants');

const REQUIRED_IMAGES = Object.entries(IMAGES)
  .filter(([, { required }]) => required)
  .map(([imageType]) => imageType);

// Create a new pass.
//
// template  - The template
// fields    - Pass fields (description, serialNumber, logoText)
class Pass extends EventEmitter {
  constructor(template, fields = {}, images) {
    super();

    this.template = template;
    this.fields = Object.assign({}, fields);
    // Structure is basically reference to all the fields under a given style
    // key, e.g. if style is coupon then structure.primaryFields maps to
    // fields.coupon.primaryFields.
    const style = template.style;
    this.structure = this.fields[style];
    if (!this.structure) this.structure = this.fields[style] = {};
    this.images = new PassImages();
    if (images) Object.assign(this.images, images);

    // For localizations support
    this.localizations = {};

    // Accessor methods for top-level fields (description, serialNumber, logoText,
    // etc).
    //
    // Call with an argument to set field and return self, call with no argument to
    // get field value.
    //
    //   pass.description("Unbelievable discount");
    //   console.log(pass.description());
    Object.entries(TOP_LEVEL_FIELDS).forEach(([key, { type }]) => {
      if (typeof this[key] !== 'function')
        this[key] = v => {
        if (arguments) { // eslint-disable-line
            if (type === Array && !Array.isArray(v))
              throw new Error(`${key} must be an Array!`);
            this.fields[key] = v;
            return this;
          }
          return this.fields[key];
        };
    });

    // Accessor methods for structure fields (primaryFields, backFields, etc).
    //
    // For example:
    //
    //   pass.headerFields.add("time", "The Time", "10:00AM");
    //   pass.backFields.add("url", "Web site", "http://example.com");
    STRUCTURE_FIELDS.forEach(key => {
      if (!(key in this))
        Object.defineProperty(this, key, {
          writable: false,
          enumerable: true,
          value: new Fields(this, key),
        });
    });
  }

  transitType(v) {
    if (arguments.length === 1) {
      // setting transit type
      // only allowed at boardingPass
      if (this.template.style !== 'boardingPass')
        throw new Error('transitType field is only allowed at boarding passes');
      if (!Object.values(TRANSIT).includes(v))
        throw new Error(`Unknown value ${v} for transit type`);
      this.structure.transitType = v;
      return this;
    }
    // getting value
    return this.structure.transitType;
  }

  static isValidW3CDateString(dateStr) {
    if (typeof dateStr !== 'string') return false;
    // W3C date format with optional seconds
    return /^20[1-9]{2}-[0-1][0-9]-[0-3][0-9]T[0-5][0-9]:[0-5][0-9](:[0-5][0-9])?(Z|([-+][0-1][0-9]:[03]0)$)/.test(
      dateStr,
    );
  }

  static getW3CDateString(value) {
    if (typeof value !== 'string' && !(value instanceof Date))
      throw new Error('Argument must be either a string or Date object');
    if (Pass.isValidW3CDateString(value)) return value;

    const date = value instanceof Date ? value : new Date(value);
    if (!isFinite(date)) throw new Error('Invalid date value!');
    // creating W3C date (we will always do without seconds)
    const year = date.getFullYear();
    const month = (1 + date.getMonth()).toFixed().padStart(2, '0');
    const day = date.getDate().toFixed().padStart(2, '0');
    const hours = date.getHours().toFixed().padStart(2, '0');
    const minutes = date.getMinutes().toFixed().padStart(2, '0');
    const offset = -date.getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(offset / 60))
      .toFixed()
      .padStart(2, '0');
    const offsetMinutes = (Math.abs(offset) - offsetHours * 60)
      .toFixed()
      .padStart(2, '0');
    const offsetSign = offset < 0 ? '-' : '+';
    return `${year}-${month}-${day}T${hours}:${minutes}${offsetSign}${offsetHours}:${offsetMinutes}`;
  }

  /**
   * Date and time when the pass expires.
   * 
   * @param {string | Date} v - value to set
   * @returns {Pass | string}
   * @throws when passed value can't be interpreted as W3C string
   * @memberof Pass
   */
  expirationDate(v) {
    if (arguments.length === 1) {
      this.fields.expirationDate = Pass.getW3CDateString(v);
      return this;
    }
    return this.fields.expirationDate;
  }

  /**
   *  Indicates that the pass is void—for example, a one time use coupon that has been redeemed.
   * 
   * @param {boolean} v 
   * @returns {Pass | boolean}
   * @memberof Pass
   */
  voided(v) {
    if (arguments.length === 1) {
      if (v) this.fields.voided = true;
      else delete this.fields.voided;
      return this;
    }
    return !!this.fields.voided;
  }

  /**
   * Date and time when the pass becomes relevant. For example, the start time of a movie.
   * Recommended for event tickets and boarding passes; otherwise optional.
   * 
   * @param {string | Date} v - value to set
   * @returns {Pass | string}
   * @throws when passed value can't be interpreted as W3C string
   * @memberof Pass
   */
  relevantDate(v) {
    if (arguments.length === 1) {
      this.fields.relevantDate = Pass.getW3CDateString(v);
      return this;
    }
    return this.fields.relevantDate;
  }

  /**
   * Maximum distance in meters from a relevant latitude and longitude that the pass is relevant.
   * This number is compared to the pass’s default distance and the smaller value is used.
   * 
   * @param {number} v - distance in meters
   * @returns {Pass | number}
   * @memberof Pass
   */
  maxDistance(v) {
    if (arguments.length === 1) {
      if (!Number.isInteger(v) || v <= 0)
        throw new Error(
          'Number must be a positive integer distance in meters!',
        );
      this.fields.maxDistance = v;
      return this;
    }
    return this.fields.maxDistance;
  }

  /**
   * Returns normalized geopoint object from geoJSON, {lat, lng} or {lattitude,longutude,altitude}
   * 
   * @param {number[] | { lat: number, lng: number, alt?: number } | { longitude: number, latitude: number, altitude?: number }} point
   * @returns {{ longitude: number, latitude: number, altitude: number }}
   * @throws on unknown point format
   * @memberof Pass
   */
  static getGeoPoint(point) {
    if (!point) throw new Error("Can't get coordinates from undefined");

    // GeoJSON Array [longitude, latitude(, elevation)]
    if (Array.isArray(point)) {
      if (point.length < 2 || !point.every(n => Number.isFinite(n)))
        throw new Error(
          `Invalid GeoJSON array of numbers, length must be 2 to 3, received ${point.length}`,
        );
      return {
        longitude: point[0],
        latitude: point[1],
        altitude: point[2],
      };
    }

    // it can be an object with both lat and lng properties
    if ('lat' in point && 'lng' in point) {
      return {
        longitude: point.lng,
        latitude: point.lat,
        altitude: point.alt,
      };
    }

    if ('longitude' in point && 'latitude' in point) {
      // returning a copy
      return {
        longitude: point.longitude,
        latitude: point.latitude,
        altitude: point.altitude || point.elevation,
      };
    }

    // If we are here it means we can't understand what a hell is it
    throw new Error(`Unknown geopoint format: ${JSON.stringify(point)}`);
  }

  /**
   * Adds a location where a pass is relevant.
   * 
   * @param {number[] | { lat: number, lng: number, alt?: number } | { longitude: number, latitude: number, altitude?: number }} point
   * @param {string} relevantText 
   * @returns {Pass}
   * @memberof Pass
   */
  addLocation(point, relevantText) {
    if (!Array.isArray(this.fields.locations)) this.fields.locations = [];
    const { longitude, latitude, altitude } = Pass.getGeoPoint(point);
    this.fields.locations.push({
      longitude,
      latitude,
      altitude,
      relevantText,
    });
    return this;
  }

  /**
   * Gets or sets Pass barcodes field
   * 
   * @param {Array.<{format: string, message: string, messageEncoding: string}>} v
   */
  barcodes(v) {
    if (arguments.length === 1) {
      if (!Array.isArray(v)) throw new Error('barcodes must be an Array!');
      // Barcodes dictionary: https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/LowerLevel.html#//apple_ref/doc/uid/TP40012026-CH3-SW3
      v.forEach(barcode => {
        if (
          ![
            'PKBarcodeFormatQR',
            'PKBarcodeFormatPDF417',
            'PKBarcodeFormatAztec',
            'PKBarcodeFormatCode128',
          ].includes(barcode.format)
        )
          throw new Error(`Barcode format value ${barcode.format} is invalid!`);
        if (typeof barcode.message !== 'string')
          throw new Error('Barcode message string is required');
        if (typeof barcode.messageEncoding !== 'string')
          throw new Error('Barcode messageEncoding is required');
      });
      // copy array
      this.fields.barcodes = [...v];
      // set backward compatibility field
      Object.assign(this.fields, { barcode: v[0] });
      return this;
    }
    return this.fields.barcodes;
  }

  // Localization
  addLocalization(lang, values) {
    // map, escaping the " symbol
    this.localizations[lang] =
      (lang in this.localizations ? `${this.localizations[lang]}\n` : '') +
      Object.entries(values)
        .map(
          ([originalStr, translatedStr]) =>
            `"${originalStr}" = "${translatedStr.replace(/"/g, '\\"')}";`,
        )
        .join('\n');
  }

  // Validate pass, throws error if missing a mandatory top-level field or image.
  validate() {
    Object.entries(TOP_LEVEL_FIELDS).some(([field, { required }]) => {
      if (required && !(field in this.fields))
        throw new Error(`Missing field ${field}`);
      return false;
    });

    // authenticationToken && webServiceURL must be either both or none
    if ('webServiceURL' in this.fields) {
      if (!('authenticationToken' in this.fields))
        throw new Error(
          'While webServiceURL is present, authenticationToken also required!',
        );
      if (this.fields.authenticationToken.length < 16)
        throw new Error(
          'authenticationToken must be at least 16 characters long!',
        );
    } else if ('authenticationToken' in this.fields)
      throw new Error(
        'authenticationToken is presented in Pass data while webServiceURL is missing!',
      );

    // validate color fields
    // valid values must be like rgb(123, 2, 22)
    Object.keys(TOP_LEVEL_FIELDS)
      .filter(v => v.endsWith('Color'))
      .filter(v => v in this.fields)
      .forEach(colorFieldName => {
        const value = this.fields[colorFieldName];
        try {
          /^rgb\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\s*\)$/
            .exec(value)
            .slice(1)
            .map(v => parseInt(v, 10))
            .some(v => {
              if (isNaN(v) || v < 0 || v > 255)
                throw new Error(`Invalid color value ${value}`);
              return false;
            });
        } catch (e) {
          throw new Error(
            `Color value "${value}" for field "${colorFieldName}" is invalid, must be an rgb(...)`,
          );
        }
      });

    REQUIRED_IMAGES.some(image => {
      if (!this.images.map.has(image))
        throw new Error(`Missing image ${image}.png`);
      return false;
    });
  }

  // Returns the pass.json object (not a string).
  getPassJSON() {
    return Object.assign({}, this.fields, { formatVersion: 1 });
  }

  /**
   * Pipe pass to a write stream.
   * 
   * @param {Writable} output - Write stream
   * @memberof Pass
   */
  pipe(output) {
    const zip = new Zip(output);
    let lastError;

    zip.on('error', error => {
      lastError = error;
    });

    // Validate before attempting to create
    try {
      this.validate();
    } catch (error) {
      setImmediate(() => {
        this.emit('error', error);
      });
      return;
    }

    // Construct manifest here
    const manifest = {};

    /**
     * Add file to zip and it's SHA to manifest
     * 
     * @param {string} filename 
     * @returns {SHAWriteStream}
     */
    const addFile = filename =>
      new SHAWriteStream(manifest, filename, zip.addFile(filename));

    const doneWithImages = () => {
      if (lastError) {
        zip.close();
        this.emit('error', lastError);
      } else {
        setImmediate(() => {
          this.signZip(zip, manifest, error => {
            if (error) {
              return this.emit('error', error);
            }
            zip.close();
            zip.on('end', () => {
              this.emit('end');
            });
            zip.on('error', err => {
              this.emit('error', err);
            });
          });
        });
      }
    };

    // Create pass.json
    const passJson = Buffer.from(JSON.stringify(this.getPassJSON()), 'utf-8');
    addFile('pass.json').end(passJson, 'utf8');

    // Localization
    Object.entries(this.localizations).forEach(([lang, strings]) => {
      addFile(`${lang}.lproj/pass.strings`).end(Buffer.from(strings), 'utf-16');
    });

    let expecting = 0;
    this.images.map.forEach((imageVariants, imageType) => {
      imageVariants.forEach((file, density) => {
        const filename = `${imageType}${density !== '1x'
          ? `@${density}`
          : ''}.png`;
        pipeIntoStream(addFile(filename), file, error => {
          --expecting;
          if (error) lastError = error;
          if (expecting === 0) doneWithImages();
        });
        ++expecting;
      });
    });
  }

  /**
   * Use this to send pass as HTTP response.
   * Adds appropriate headers and pipes pass to response.
   * 
   * @param {http.response} response - HTTP response
   * @memberof Pass
   */
  render(response) {
    return new Promise((resolve, reject) => {
      response.setHeader('Content-Type', PASS_MIME_TYPE);
      this.on('error', reject);
      this.on('end', resolve);
      this.pipe(response);
    });
  }

  /**
   * Returns the Pass as a Readable strem
   * 
   * @returns {Stream}
   * @memberof Pass
   */
  stream() {
    const stream = new PassThrough();
    this.pipe(stream);
    return stream;
  }

  /**
   * Add manifest.json and signature files.
   * 
   * @param {Zip} zip 
   * @param {Object} manifest 
   * @param {Function} callback
   * @memberof Pass
   */
  signZip(zip, manifest, callback) {
    const json = JSON.stringify(manifest);
    // Add manifest.json
    zip.addFile('manifest.json').end(json, 'utf-8');
    // Create signature
    const identifier = this.template.passTypeIdentifier().replace(/^pass./, '');
    signManifest(
      Path.resolve(this.template.keysPath, `${identifier}.pem`),
      Path.resolve(__dirname, '../keys/wwdr.pem'),
      this.template.password,
      json,
      (error, signature) => {
        if (!error) {
          // Write signature file
          zip.addFile('signature').end(signature);
        }
        callback(error);
      },
    );
  }
}

module.exports = Pass;
