// Generate a pass file.

'use strict';

const { EventEmitter } = require('events');
const Path = require('path');

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

    REQUIRED_IMAGES.some(image => {
      if (!this.images.map.has(image))
        throw new Error(`Missing image ${image}.png`);
      return false;
    });
  }

  // Returns the pass.json object (not a string).
  getPassJSON() {
    const fields = Object.assign({}, this.fields);
    fields.formatVersion = 1;
    return fields;
  }

  // Pipe pass to a write stream.
  //
  // output - Write stream
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
    // Add file to zip and it's SHA to manifest
    function addFile(filename) {
      const file = zip.addFile(filename);
      const sha = new SHAWriteStream(manifest, filename, file);
      return sha;
    }
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
   * @param {any} response - HTTP response
   * @memberof Pass
   */
  render(response) {
    return new Promise((resolve, reject) => {
      response.setHeader('Content-Type', 'application/vnd.apple.pkpass');
      this.on('error', reject);
      this.on('end', resolve);
      this.pipe(response);
    });
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
