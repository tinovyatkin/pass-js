/**
 * Passbook are created from templates
 */

'use strict';

import * as assert from 'assert';
import * as http2 from 'http2';
import { join } from 'path';
import { promises as fs } from 'fs';

import * as colorString from 'color-string';
import * as forge from 'node-forge';
import stripJsonComments from 'strip-json-comments';

import { PassImages } from './lib/images';
import { Pass } from './pass';
import { PASS_STYLES } from './constants';
import { PassStyle, ApplePass } from './interfaces';

const {
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_PATH,
  NGHTTP2_CANCEL,
  HTTP2_METHOD_POST,
} = http2.constants;
const { stat, readFile } = fs;

// Create a new template.
//
// style  - Pass style (coupon, eventTicket, etc)
// fields - Pass fields (passTypeIdentifier, teamIdentifier, etc)
export class Template {
  style: PassStyle;
  key: forge.pki.PrivateKey;
  certificate: forge.pki.Certificate;
  images = new PassImages();
  private apn: http2.ClientHttp2Session;
  private fields: Partial<ApplePass> = {};
  /**
   *
   * @param {PassStyle} style
   * @param {{[k: string]: any }} [fields]
   */
  constructor(style: PassStyle, fields: Partial<ApplePass> = {}) {
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
  static convertToRgb(value: string): string {
    const rgb = colorString.get.rgb(value);
    if (rgb === null) throw new TypeError(`Invalid color value ${value}`);
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
  static async load(
    folderPath: string,
    keyPassword?: string,
  ): Promise<Template> {
    // Check if the path is accessible directory actually
    const stats = await stat(folderPath);
    assert.ok(stats.isDirectory(), `Path ${folderPath} must be a directory!`);

    // getting main JSON file
    const jsonContent = await readFile(join(folderPath, 'pass.json'), 'utf8');
    const passJson = JSON.parse(stripJsonComments(jsonContent)) as Partial<
      ApplePass
    >;

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
    const { passTypeIdentifier } = passJson;
    if (typeof passTypeIdentifier === 'string') {
      const keyName = `${passTypeIdentifier.replace(/^pass\./, '')}.pem`;
      const certFileName = join(folderPath, keyName);
      try {
        // following will throw if file doesn't exists or can't be read
        await template.loadCertificate(certFileName, keyPassword);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    // done
    return template;
  }

  /**
   *
   * @param {string} signerKeyMessage
   * @param {string} [password]
   */
  setPrivateKey(signerKeyMessage: string, password?: string): void {
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
  setCertificate(signerCertData: string, password?: string): void {
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
  async loadCertificate(
    signerPemFile: string,
    password?: string,
  ): Promise<void> {
    // reading and parsing certificates
    const signerCertData = await readFile(signerPemFile, 'utf8');
    this.setCertificate(signerCertData, password);
  }

  /**
   *
   * @param {string} pushToken
   */
  async pushUpdates(pushToken: string): Promise<http2.IncomingHttpHeaders> {
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
        [HTTP2_HEADER_METHOD]: HTTP2_METHOD_POST,
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

  passTypeIdentifier(v?: string): string | undefined | this {
    if (arguments.length === 1) {
      this.fields.passTypeIdentifier = v;
      return this;
    }
    return this.fields.passTypeIdentifier;
  }

  teamIdentifier(v?: string): string | undefined | this {
    if (arguments.length === 1) {
      this.fields.teamIdentifier = v;
      return this;
    }
    return this.fields.teamIdentifier;
  }

  associatedStoreIdentifiers(v?: number[]): number[] | undefined | this {
    if (arguments.length === 1) {
      this.fields.associatedStoreIdentifiers = v;
      return this;
    }
    return this.fields.associatedStoreIdentifiers;
  }

  description(v?: string): string | undefined | this {
    if (arguments.length === 1) {
      this.fields.description = v;
      return this;
    }
    return this.fields.description;
  }

  backgroundColor(v?: string): string | undefined | this {
    if (typeof v === 'string') {
      this.fields.backgroundColor = Template.convertToRgb(v);
      return this;
    }
    return this.fields.backgroundColor;
  }

  foregroundColor(v?: string): string | undefined | this {
    if (typeof v === 'string') {
      this.fields.foregroundColor = Template.convertToRgb(v);
      return this;
    }
    return this.fields.foregroundColor;
  }

  labelColor(v?: string): string | undefined | this {
    if (typeof v === 'string') {
      this.fields.labelColor = Template.convertToRgb(v);
      return this;
    }
    return this.fields.labelColor;
  }

  logoText(v?: string): string | undefined | this {
    if (typeof v === 'string') {
      this.fields.logoText = v;
      return this;
    }
    return this.fields.logoText;
  }

  organizationName(v?: string): string | undefined | this {
    if (typeof v === 'string') {
      this.fields.organizationName = v;
      return this;
    }
    return this.fields.organizationName;
  }

  groupingIdentifier(v?: string): string | undefined | this {
    if (typeof v === 'string') {
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
  suppressStripShine(v?: boolean | null): this | boolean {
    if (arguments.length === 1) {
      if (typeof v !== 'boolean')
        throw new Error('suppressStripShine value must be a boolean!');
      this.fields.suppressStripShine = v;
      return this;
    }
    return !!this.fields.suppressStripShine;
  }

  /**
   * gets or sets webServiceURL
   *
   * @param {URL | string} v
   * @returns {Template | string}
   * @memberof Template
   */
  webServiceURL(v?: URL | string): this | undefined | string {
    if (typeof v !== 'undefined') {
      // validating URL, it will throw on bad value
      const url = v instanceof URL ? v : new URL(v);
      if (url.protocol !== 'https:')
        throw new Error(`webServiceURL must be on HTTPS!`);
      this.fields.webServiceURL = url.toString();
      return this;
    }
    return this.fields.webServiceURL;
  }

  authenticationToken(v?: string): string | undefined | this {
    if (typeof v === 'string') {
      if (v.length < 16)
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
  createPass(fields: object = {}): Pass {
    // Combine template and pass fields
    return new Pass(this, { ...this.fields, ...fields }, this.images);
  }
}
