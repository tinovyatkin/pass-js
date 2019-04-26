// Generate a pass file.

'use strict';

const { EventEmitter } = require('events');
const { PassThrough } = require('stream');

const { ZipFile } = require('yazl');

const Fields = require('./lib/fields');
const getBufferHash = require('./lib/getBufferHash');
const PassImages = require('./lib/images');
const readAndHashFile = require('./lib/readAndHashFile');
const signManifest = require('./lib/signManifest-forge');
const { getW3CDateString } = require('./lib/w3cdate');
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
  /**
   *
   * @param {import('./template')} template
   * @param {*} fields
   * @param {*} images
   */
  constructor(template, fields = {}, images) {
    super();

    this.template = template;
    this.fields = Object.assign({}, fields);
    // Structure is basically reference to all the fields under a given style
    // key, e.g. if style is coupon then structure.primaryFields maps to
    // fields.coupon.primaryFields.
    const { style } = template;
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
          // eslint-disable-next-line prefer-rest-params
          if (arguments) {
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
    for (const key of STRUCTURE_FIELDS) {
      if (!(key in this))
        Object.defineProperty(this, key, {
          writable: false,
          enumerable: true,
          value: new Fields(this, key),
        });
    }

    Object.preventExtensions(this);
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
      this.fields.expirationDate = getW3CDateString(v);
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
      this.fields.relevantDate = getW3CDateString(v);
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
          `Invalid GeoJSON array of numbers, length must be 2 to 3, received ${
            point.length
          }`,
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
        } catch (err) {
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
   * @param {import('stream').Writable} output - Write stream
   * @memberof Pass
   */
  async pipe(output) {
    // Validate before attempting to create
    try {
      this.validate();
    } catch (err) {
      setImmediate(() => this.emit('error', err));
      return;
    }

    // Creating new Zip file
    const zip = new ZipFile();
    zip.outputStream
      .pipe(output)
      .once('close', () => this.emit('close'))
      .once('end', () => this.emit('end'))
      .once('error', err => this.emit('error', err));

    // Construct manifest here
    const manifest = {};

    // Adding required files
    // Create pass.json
    const passJson = Buffer.from(JSON.stringify(this.getPassJSON()), 'utf-8');
    // saving hash to manifest
    manifest['pass.json'] = getBufferHash(passJson);
    zip.addBuffer(passJson, 'pass.json', { compress: false });

    // Localization
    Object.entries(this.localizations).forEach(([lang, strings]) => {
      const fileName = `${lang}.lproj/pass.strings`;
      const fileContent = Buffer.from(strings, 'utf-16');
      manifest[fileName] = getBufferHash(fileContent);
      zip.addBuffer(fileContent, fileName, { compress: false });
    });

    // Images
    const images = [];
    this.images.map.forEach((imageVariants, imageType) =>
      imageVariants.forEach((file, density) => {
        const filename = `${imageType}${
          density !== '1x' ? `@${density}` : ''
        }.png`;
        images.push(readAndHashFile(file, filename));
      }),
    );

    // awaiting all images and updating manifest
    const imagesRes = await Promise.all(images);
    imagesRes.forEach(({ name, hash, content }) => {
      manifest[name] = hash;
      zip.addBuffer(content, name, { compress: false });
    });

    // adding manifest
    const manifestJson = JSON.stringify(manifest);
    zip.addBuffer(Buffer.from(manifestJson, 'utf8'), 'manifest.json');

    // Create signature
    const signature = await signManifest(
      this.template.certificate,
      this.template.key,
      manifestJson,
    );
    zip.addBuffer(signature, 'signature', { compress: false });

    // finished!
    zip.end();
  }

  /**
   * Use this to send pass as HTTP response.
   * Adds appropriate headers and pipes pass to response.
   *
   * @param {import('http').ServerResponse} response - HTTP response
   * @memberof Pass
   */
  render(response) {
    return new Promise((resolve, reject) => {
      response.setHeader('Content-Type', PASS_MIME_TYPE);
      this.once('error', reject);
      this.once('end', resolve);
      this.pipe(response);
    });
  }

  /**
   * Returns the Pass as a Readable stream
   *
   * @returns {import('stream').Readable}
   * @memberof Pass
   */
  stream() {
    const stream = new PassThrough();
    this.pipe(stream);
    return stream;
  }
}

module.exports = Pass;
