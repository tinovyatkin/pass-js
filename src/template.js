/**
 * Passbook are created from templates
 */

'use strict';

const assert = require('assert');
const http2 = require('http2');
const { join } = require('path');
const { stat, readFile, access } = require('fs').promises;
const {
  constants: { R_OK },
} = require('fs');

const colorString = require('color-string');
const forge = require('node-forge');

const PassImages = require('./lib/images');
const Pass = require('./pass');
const { PASS_STYLES } = require('./constants');

const {
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_PATH,
  NGHTTP2_CANCEL,
} = http2.constants;

// Create a new template.
//
// style  - Pass style (coupon, eventTicket, etc)
// fields - Pass fields (passTypeIdentifier, teamIdentifier, etc)
class Template {
  /** @type {import('node-forge').pki.PrivateKey} */
  key;
  /** @type {import('node-forge').pki.Certificate} */
  certificate;
  fields = {};
  /** @type {string} */
  password;
  /** @type {http2.ClientHttp2Session} */
  apn;
  images = new PassImages();
  /**
   *
   * @param {string} style
   * @param {{[k: string]: any }} [fields]
   */
  constructor(style, fields = {}) {
    assert.ok(PASS_STYLES.has(style), `Unsupported pass style ${style}`);

    this.style = style;
    // we will set all fields via class setters, as in the future we will implement strict validators
    // values validation: https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/TopLevel.html
    for (const [field, value] of Object.entries(fields)) {
      if (typeof this[field] === 'function') this[field](value);
    }

    if (style in fields) {
      Object.assign(this.fields, { [style]: fields[style] });
    }

    Object.preventExtensions(this);
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
    assert.ok(Array.isArray(rgb), `Invalid color value ${value}`);
    // convert to rgb(), stripping alpha channel
    return colorString.to.rgb(rgb.slice(0, 3));
  }

  /**
   * Loads Template, images and key from a given path
   *
   * @static
   * @param {string} folderPath
   * @param {string} [keyPassword] - optional key password
   * @returns {Promise.<Template>}
   * @throws - if given folder doesn't contain pass.json or it is in invalid format
   * @memberof Template
   */
  static async load(folderPath, keyPassword) {
    // Check if the path is accessible directory actually
    const stats = await stat(folderPath);
    assert.ok(stats.isDirectory(), `Path ${folderPath} must be a directory!`);

    // getting main JSON file
    const passJson = JSON.parse(
      await readFile(join(folderPath, 'pass.json'), 'utf8'),
    );

    // Trying to detect the type of pass
    let type;
    for (const t of PASS_STYLES) {
      if (t in passJson) {
        type = t;
        break;
      }
    }
    assert.ok(type, 'Unknown pass style!');

    const template = new Template(type, passJson);

    // load images from the same folder
    await template.images.loadFromDirectory(folderPath);

    // checking if there is a key - must be named ${passTypeIdentifier}.pem
    const typeIdentifier = passJson.passTypeIdentifier;
    const keyName = `${typeIdentifier.replace(/^pass\./, '')}.pem`;
    const certFileName = join(folderPath, keyName);
    try {
      // following will throw if file doesn't exists or can't be read
      await access(certFileName, R_OK);
      await template.loadCertificate(certFileName, keyPassword);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    // done
    return template;
  }

  /**
   *
   * @param {string} signerKeyMessage
   * @param {string} [password]
   */
  setPrivateKey(signerKeyMessage, password) {
    this.key = forge.pki.decryptRsaPrivateKey(signerKeyMessage, password);
    assert.ok(
      this.key,
      'Failed to decode provided private key. Invalid password?',
    );
  }

  /**
   *
   * @param {string} signerCertData - certificate and optional private key as PEM encoded string
   * @param {string} [password] - optional password to decode private key
   */
  setCertificate(signerCertData, password) {
    // the PEM file from P12 contains both, certificate and private key
    // getting signer certificate
    this.certificate = forge.pki.certificateFromPem(signerCertData);
    assert.ok(this.certificate, 'Failed to decode provided certificate');

    // check if signerCertData also contains private key and use it
    const pemMessages = forge.pem.decode(signerCertData);

    // getting signer private key
    const signerKeyMessage = pemMessages.find(message =>
      message.type.includes('KEY'),
    );
    if (signerKeyMessage)
      this.setPrivateKey(forge.pem.encode(signerKeyMessage), password);
  }

  /**
   *
   * @param {string} signerPemFile - path to PEM file with certificate and private key
   * @param {string} password - private key decoding password
   */
  async loadCertificate(signerPemFile, password) {
    // reading and parsing certificates
    const signerCertData = await readFile(signerPemFile, 'utf8');
    this.setCertificate(signerCertData, password);
  }

  /**
   *
   * @param {string} pushToken
   */
  async pushUpdates(pushToken) {
    // https://developer.apple.com/library/content/documentation/UserExperience/Conceptual/PassKit_PG/Updating.html
    if (!this.apn || this.apn.destroyed) {
      // creating APN Provider
      this.apn = http2.connect('https://api.push.apple.com:443', {
        key: forge.pki.privateKeyToPem(this.key),
        cert: forge.pki.certificateToPem(this.certificate),
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
      req.setTimeout(5000, () => req.close(NGHTTP2_CANCEL));

      // Response handling
      req.on('response', headers => {
        // consuming data, even if we are not interesting in it
        req.on('data', () => {});
        req.once('end', () => resolve(headers));
      });

      // Error handling
      req.once('error', reject);
      req.once('timeout', () =>
        reject(new Error(`http2: timeout connecting to api.push.apple.com`)),
      );

      // Post payload (always empty in our case)
      req.end('{}');
    });
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
   * Create a new pass from a template.
   *
   * @param {Object} fields
   * @returns {Pass}
   * @memberof Template
   */
  createPass(fields = {}) {
    // Combine template and pass fields
    return new Pass(this, { ...this.fields, ...fields }, this.images);
  }
}

module.exports = Template;
