// Generate a pass file.

'use strict';

import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import * as assert from 'assert';

import { ZipFile } from 'yazl';

import { FieldsMap } from './lib/fieldsMap';
import { getBufferHash } from './lib/getBufferHash';
import { PassImages } from './lib/images';
import { readAndHashFile } from './lib/readAndHashFile';
import { signManifest } from './lib/signManifest-forge';
import { getW3CDateString } from './lib/w3cdate';
import {
  TOP_LEVEL_FIELDS,
  IMAGES,
  STRUCTURE_FIELDS,
  TRANSIT,
  PASS_MIME_TYPE,
  BARCODES_FORMAT,
} from './constants';

/**
 * @typedef {'PKBarcodeFormatQR' | 'PKBarcodeFormatPDF417' | 'PKBarcodeFormatAztec' | 'PKBarcodeFormatCode128'} BarcodeFormat
 * @typedef {{format: BarcodeFormat, message: string, messageEncoding: string}} BarcodeDescriptor
 */

const REQUIRED_IMAGES = new Set(
  Object.entries(IMAGES)
    .filter(([, { required }]) => required)
    .map(([imageType]) => imageType),
);

// Create a new pass.
//
// template  - The template
// fields    - Pass fields (description, serialNumber, logoText)
export class Pass extends EventEmitter {
  private template: import('./template');
  fields: {};
  structure: any;
  images: PassImages = new PassImages();
  localizations: {};
  /**
   *
   * @param {import('./template')} template
   * @param {*} [fields]
   * @param {*} [images]
   */
  constructor(template: import('./template'), fields: any = {}, images: any) {
    super();

    this.template = template;
    /** @type {{
      barcode?: BarcodeDescriptor,
      barcodes?: BarcodeDescriptor[],
      authenticationToken?: string,
      expirationDate?: string,
      relevantDate?: string,
      voided?: boolean,
      maxDistance?: number,
      locations?: {
        longitude: number,
        latitude: number,
        altitude?: number,
        relevantText: string,
      }[],
      webServiceURL?: string
    }} */
    this.fields = { ...fields };
    // Structure is basically reference to all the fields under a given style
    // key, e.g. if style is coupon then structure.primaryFields maps to
    // fields.coupon.primaryFields.
    const { style } = template;
    this.structure = this.fields[style];
    if (!this.structure) this.structure = this.fields[style] = {};
    this.images = new PassImages();
    if (images) Object.assign(this.images, images);

    // For localizations support
    /** @type {{[k: string]: string}} */
    this.localizations = {};

    // Accessor methods for top-level fields (description, serialNumber, logoText,
    // etc).
    //
    // Call with an argument to set field and return self, call with no argument to
    // get field value.
    //
    //   pass.description("Unbelievable discount");
    //   console.log(pass.description());

    Object.defineProperties(
      this,
      Object.entries(TOP_LEVEL_FIELDS)
        .filter(([key]) => !(key in this))
        .reduce(
          (props, [key, { type }]) => {
            props[key] = {
              writable: false,
              configurable: false,
              enumerable: true,
              value:
                (                /**
                 * @template T: string | any[] | boolean | Object
                 * @param {T} v
                 * @returns {T | Pass}
                 */
                <T>v: T): T | Pass => {
                  if (v) {
                    assert.ok(
                      type !== Array || Array.isArray(v),
                      `${key} must be an Array!`,
                    );
                    assert.ok(
                      type !== 'string' || typeof v === 'string',
                      `${key} must be a string`,
                    );
                    this.fields[key] = v;
                    return this;
                  }
                  return this.fields[key];
                },
            };
            return props;
          },
          /** @type {PropertyDescriptorMap} */ ({}),
        ),
    );

    // Accessor methods for structure fields (primaryFields, backFields, etc).
    //
    // For example:
    //
    //   pass.headerFields.add({ key: "time", label: "The Time", value: "10:00AM" });
    Object.defineProperties(
      this,
      Array.from(STRUCTURE_FIELDS)
        .filter(key => !(key in this))
        .reduce(
          (props, key) => {
            props[key] = {
              writable: false,
              configurable: false,
              enumerable: true,
              value: new Fields(this, key),
            };
            return props;
          },
          /** @type {PropertyDescriptorMap} */ ({}),
        ),
    );

    Object.preventExtensions(this);
  }

  /**
   * Returns normalized geopoint object from geoJSON, {lat, lng} or {lattitude,longutude,altitude}
   *
   * @param {number[] | { lat: number, lng: number, alt?: number } | { longitude: number, latitude: number, altitude?: number }} point
   * @returns {{ longitude: number, latitude: number, altitude: number }}
   * @throws on unknown point format
   * @memberof Pass
   */
  static getGeoPoint(point: number[] | { lat: number; lng: number; alt?: number; } | { longitude: number; latitude: number; altitude?: number; }): { longitude: number; latitude: number; altitude: number; } {
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
   *
   * @param {string} [v]
   * @returns {string | Pass}
   */
  transitType(v: string): string | Pass {
    if (!v) return this.structure.transitType;
    // setting transit type
    // only allowed at boardingPass
    assert.strictEqual(
      this.template.style,
      'boardingPass',
      'transitType field is only allowed at boarding passes',
    );
    assert.ok(
      Object.values(TRANSIT).includes(v),
      `Unknown value ${v} for transit type`,
    );
    this.structure.transitType = v;
    return this;
  }

  /**
   * Date and time when the pass expires.
   *
   * @param {string | Date} v - value to set
   * @returns {Pass | string}
   * @throws when passed value can't be interpreted as W3C string
   * @memberof Pass
   */
  expirationDate(v: string | Date): Pass | string {
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
  voided(v: boolean): Pass | boolean {
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
  relevantDate(v: string | Date): Pass | string {
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
  maxDistance(v: number): Pass | number {
    if (!v) return this.fields.maxDistance;
    assert.ok(
      Number.isInteger(v) && v > 0,
      'Number must be a positive integer distance in meters!',
    );
    this.fields.maxDistance = v;
    return this;
  }

  /**
   * Adds a location where a pass is relevant.
   *
   * @param {number[] | { lat: number, lng: number, alt?: number } | { longitude: number, latitude: number, altitude?: number }} point
   * @param {string} relevantText
   * @returns {Pass}
   * @memberof Pass
   */
  addLocation(point: number[] | { lat: number; lng: number; alt?: number; } | { longitude: number; latitude: number; altitude?: number; }, relevantText: string): Pass {
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
   * @param {BarcodeDescriptor[]} [v]
   */
  barcodes(v: BarcodeDescriptor[]) {
    if (!v) return this.fields.barcodes;

    assert.ok(Array.isArray(v), 'barcodes must be an Array!');
    // Barcodes dictionary: https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/LowerLevel.html#//apple_ref/doc/uid/TP40012026-CH3-SW3
    for (const barcode of v) {
      assert.ok(
        BARCODES_FORMAT.has(barcode.format),
        `Barcode format value ${barcode.format} is invalid!`,
      );
      assert.strictEqual(
        typeof barcode.message,
        'string',
        'Barcode message string is required',
      );
      assert.strictEqual(
        typeof barcode.messageEncoding,
        'string',
        'Barcode messageEncoding is required',
      );
    }

    // copy array
    this.fields.barcodes = [...v];
    // set backward compatibility field
    [this.fields.barcode] = v;
    return this;
  }

  // Localization
  /**
   *
   * @param {string} lang
   * @param {{[k: string]: string}} values
   */
  addLocalization(lang: string, values: { [k: string]: string; }) {
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
    for (const [field, { required }] of Object.entries(TOP_LEVEL_FIELDS))
      assert.ok(!required || field in this.fields, `Missing field ${field}`);

    // authenticationToken && webServiceURL must be either both or none
    if ('webServiceURL' in this.fields) {
      assert.ok(
        'authenticationToken' in this.fields,
        'While webServiceURL is present, authenticationToken also required!',
      );
      assert.ok(
        this.fields.authenticationToken.length >= 16,
        'authenticationToken must be at least 16 characters long!',
      );
    } else
      assert.ok(
        !('authenticationToken' in this.fields),
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
            .forEach(v => {
              assert.ok(
                Number.isInteger(v) && v >= 0 && v < 256,
                `Invalid color value ${value}`,
              );
            });
        } catch (err) {
          throw new Error(
            `Color value "${value}" for field "${colorFieldName}" is invalid, must be an rgb(...)`,
          );
        }
      });

    for (const image of REQUIRED_IMAGES) {
      assert.ok(
        this.images.map.has(image),
        `Missing required image ${image}.png`,
      );
    }
  }

  // Returns the pass.json object (not a string).
  toJSON() {
    return { ...this.fields, formatVersion: 1 };
  }

  /**
   * Pipe pass to a write stream.
   *
   * @param {import('stream').Writable} output - Write stream
   * @memberof Pass
   */
  async pipe(output: import('stream').Writable) {
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
    const manifest: { [k: string]: string; } = /** @type {{ [k: string]: string }} */ ({});

    // Adding required files
    // Create pass.json
    const passJson = Buffer.from(JSON.stringify(this), 'utf-8');
    // saving hash to manifest
    manifest['pass.json'] = getBufferHash(passJson);
    zip.addBuffer(passJson, 'pass.json', { compress: false });

    // Localization
    for (const [lang, strings] of Object.entries(this.localizations)) {
      const fileName = `${lang}.lproj/pass.strings`;
      const fileContent = Buffer.from(strings, 'utf-16');
      manifest[fileName] = getBufferHash(fileContent);
      zip.addBuffer(fileContent, fileName, { compress: false });
    }

    // Images
    const images: Promise<{ name: string; hash: string; content: Buffer; }>[] = /** @type {Promise.<{ name: string, hash: string, content: Buffer }>[]} */ ([]);
    for (const [imageType, imageVariants] of this.images.map) {
      for (const [density, file] of imageVariants) {
        const filename = `${imageType}${
          density !== '1x' ? `@${density}` : ''
        }.png`;
        images.push(readAndHashFile(file, filename));
      }
    }

    // awaiting all images and updating manifest
    const imagesRes = await Promise.all(images);
    for (const { name, hash, content } of imagesRes) {
      manifest[name] = hash;
      zip.addBuffer(content, name, { compress: false });
    }

    // adding manifest
    const manifestJson = JSON.stringify(manifest);
    zip.addBuffer(Buffer.from(manifestJson, 'utf8'), 'manifest.json');

    // Create signature
    const signature = signManifest(
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
  async render(response: import('http').ServerResponse) {
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
  stream(): import('stream').Readable {
    const stream = new PassThrough();
    this.pipe(stream);
    return stream;
  }
}

