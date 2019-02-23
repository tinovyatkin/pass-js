/**
 * Passbook are created from templates
 */

'use strict';

const colorString = require('color-string');
const decodePrivateKey = require('./lib/decodePrivateKey');
const http2 = require('http2');
const path = require('path');
const { join } = require('path');
const { stat, readFile } = require('fs').promises;

const Pass = require('./pass');
const PassImages = require('./lib/images');
const { PASS_STYLES } = require('./constants');

const { HTTP2_HEADER_METHOD, HTTP2_HEADER_PATH } = http2.constants;

// Create a new template.
//
// style  - Pass style (coupon, eventTicket, etc)
// fields - Pass fields (passTypeIdentifier, teamIdentifier, etc)
class Template {
  constructor(style, fields = {}) {
    if (!PASS_STYLES.includes(style))
      throw new Error(`Unsupported pass style ${style}`);

    this.style = style;
    this.fields = {};
    // we will set all fields via class setters, as in the future we will implement strict validators
    // values validation: https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/TopLevel.html
    for (const [field, value] of Object.entries(fields)) {
      if (typeof this[field] === 'function') this[field](value);
    }

    if (style in fields) {
      Object.assign(this.fields, { [style]: fields[style] });
    }

    this.keysPath = 'keys';
    this.password = null;
    this.apn = null;
    this.images = new PassImages();
    Object.preventExtensions(this);
  }

  async pushUpdates(pushToken) {
    // https://developer.apple.com/library/content/documentation/UserExperience/Conceptual/PassKit_PG/Updating.html
    if (!this.apn || this.apn.destroyed) {
      // prepare certificate
      // creating APN Provider
      const identifier = this.passTypeIdentifier().replace(/^pass./, '');

      const cert = await readFile(
        path.resolve(this.keysPath, `${identifier}.pem`),
        'utf8',
      );

      /** @type {string} */
      const key = decodePrivateKey(cert, this.password, true);

      this.apn = http2.connect('https://api.push.apple.com:443', {
        key,
        cert,
      });
      // Events
      this.apn.once('goaway', () => this.apn.destroy());
      await new Promise((resolve, reject) => {
        this.apn.once('connect', resolve);
        this.apn.once('error', reject);
      });
    }

    // sending to APN
    return new Promise((resolve, reject) => {
      const req = this.apn.request({
        [HTTP2_HEADER_METHOD]: 'POST',
        [HTTP2_HEADER_PATH]: `/3/device/${encodeURIComponent(pushToken)}`,
      });

      // Cancel request after timeout
      req.setTimeout(5000, () => req.rstWithCancel());

      // Response handling
      req.on('response', headers => {
        // consuming data, even if we are not interesting in it
        req.on('data', () => {});
        req.on('end', () => resolve(headers));
      });

      // Error handling
      req.on('error', reject);
      req.on('timeout', () =>
        reject(new Error(`http2: timeout connecting to api.push.apple.com`)),
      );

      // Post payload (always empty in our case)
      req.end('{}');
    });
  }

  /**
   * Validates if given string is a correct color value for Pass fields
   *
   * @static
   * @param {string} value - a CSS color value, like 'red', '#fff', etc
   * @throws - if value is invalid this function will throw
   * @returns {string} - value converted to "rgb(222, 33, 22)" string
   * @memberof Template
   */
  static convertToRgb(value) {
    const rgb = colorString.get.rgb(value);
    if (rgb === null) throw new Error(`Invalid color value ${value}`);
    // convert to rgb(), stripping alpha channel
    return colorString.to.rgb(rgb.slice(0, 3));
  }

  passTypeIdentifier(v) {
    if (arguments.length === 1) {
      this.fields.passTypeIdentifier = v;
      return this;
    }
    return this.fields.passTypeIdentifier;
  }

  teamIdentifier(v) {
    if (arguments.length === 1) {
      this.fields.teamIdentifier = v;
      return this;
    }
    return this.fields.teamIdentifier;
  }

  associatedStoreIdentifiers(v) {
    if (arguments.length === 1) {
      this.fields.associatedStoreIdentifiers = v;
      return this;
    }
    return this.fields.associatedStoreIdentifiers;
  }

  description(v) {
    if (arguments.length === 1) {
      this.fields.description = v;
      return this;
    }
    return this.fields.description;
  }

  backgroundColor(v) {
    if (arguments.length === 1) {
      this.fields.backgroundColor = Template.convertToRgb(v);
      return this;
    }
    return this.fields.backgroundColor;
  }

  foregroundColor(v) {
    if (arguments.length === 1) {
      this.fields.foregroundColor = Template.convertToRgb(v);
      return this;
    }
    return this.fields.foregroundColor;
  }

  labelColor(v) {
    if (arguments.length === 1) {
      this.fields.labelColor = Template.convertToRgb(v);
      return this;
    }
    return this.fields.labelColor;
  }

  logoText(v) {
    if (arguments.length === 1) {
      this.fields.logoText = v;
      return this;
    }
    return this.fields.logoText;
  }

  organizationName(v) {
    if (arguments.length === 1) {
      this.fields.organizationName = v;
      return this;
    }
    return this.fields.organizationName;
  }

  groupingIdentifier(v) {
    if (arguments.length === 1) {
      this.fields.groupingIdentifier = v;
      return this;
    }
    return this.fields.groupingIdentifier;
  }

  /**
   * sets or gets suppressStripShine
   *
   * @param {boolean?} v
   * @returns {Template | boolean}
   * @memberof Template
   */
  suppressStripShine(v) {
    if (arguments.length === 1) {
      if (typeof v !== 'boolean')
        throw new Error('suppressStripShine value must be a boolean!');
      this.fields.suppressStripShine = v;
      return this;
    }
    return this.fields.suppressStripShine;
  }

  /**
   * gets or sets webServiceURL
   *
   * @param {URL | string} v
   * @returns {Template | string}
   * @memberof Template
   */
  webServiceURL(v) {
    if (arguments.length === 1) {
      // validating URL, it will throw on bad value
      const url = v instanceof URL ? v : new URL(v);
      if (url.protocol !== 'https:')
        throw new Error(`webServiceURL must be on HTTPS!`);
      this.fields.webServiceURL = url.toString();
      return this;
    }
    return this.fields.webServiceURL;
  }

  authenticationToken(v) {
    if (arguments.length === 1) {
      if (typeof v !== 'string' || v.length < 16)
        throw new Error(
          `authenticationToken must be a string and have more than 16 characters`,
        );
      this.fields.authenticationToken = v;
      return this;
    }
    return this.fields.authenticationToken;
  }

  /**
   * Sets path to directory containing keys and password for accessing keys.
   *
   * @param {string} keysPath - Path to directory containing key files (default is 'keys')
   * @param {string} password - Password to use with keys
   * @memberof Template
   */
  keys(keysPath, password) {
    if (typeof keysPath === 'string') this.keysPath = keysPath;
    if (password) this.password = password;
  }

  /**
   * Create a new pass from a template.
   *
   * @param {Object} fields
   * @returns {Pass}
   * @memberof Template
   */
  createPass(fields = {}) {
    // Combine template and pass fields
    return new Pass(this, Object.assign({}, this.fields, fields), this.images);
  }

  /**
   * Loads Template, images and key from a given path
   *
   * @static
   * @param {string} folderPath
   * @param {string} keyPassword - optional key password
   * @returns {Promise.<Template>}
   * @throws - if given folder doesn't contain pass.json or it is in invalid format
   * @memberof Template
   */
  static async load(folderPath, keyPassword) {
    // Check if the path is accessible directory actually
    const stats = await stat(folderPath);
    if (!stats.isDirectory())
      throw new Error(`Path ${folderPath} must be a directory!`);

    // getting main JSON file
    const passJson = JSON.parse(
      await readFile(join(folderPath, 'pass.json'), 'utf8'),
    );

    // Trying to detect the type of pass
    let type;
    if (
      !PASS_STYLES.some(t => {
        if (t in passJson) {
          type = t;
          return true;
        }
        return false;
      })
    )
      throw new Error('Unknown pass style!');

    const template = new Template(type, passJson);

    // load images from the same folder
    await template.images.loadFromDirectory(folderPath);

    // checking if there is a key - must be named ${passTypeIdentifier}.pem
    const typeIdentifier = passJson.passTypeIdentifier;
    const keyName = `${typeIdentifier.replace(/^pass\./, '')}.pem`;
    try {
      const keyStat = await stat(join(folderPath, keyName));
      if (keyStat.isFile()) template.keys(folderPath, keyPassword);
      // eslint-disable-next-line no-empty
    } catch (_) {}
    // done
    return template;
  }
}

module.exports = Template;
