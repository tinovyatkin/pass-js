// Passbook are created from templates

'use strict';

const { URL } = require('url');
const PassImages = require('./lib/images');
const Pass = require('./pass');

// Supported passbook styles.
const STYLES = [
  'boardingPass',
  'coupon',
  'eventTicket',
  'generic',
  'storeCard',
];

// Create a new template.
//
// style  - Pass style (coupon, eventTicket, etc)
// fields - Pass fields (passTypeIdentifier, teamIdentifier, etc)
class Template {
  constructor(style, fields = {}) {
    if (!STYLES.includes(style))
      throw new Error(`Unsupported pass style ${style}`);

    this.style = style;
    this.fields = {};
    // we will set all fields via class setters, as in the future we will implement strict validators
    // values validation: https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/TopLevel.html
    for (const [field, value] of Object.entries(fields)) {
      if (typeof this[field] === 'function') this[field](value);
    }

    this.keysPath = 'keys';
    this.images = new PassImages();
  }

  static validateColorValue(value) {
    // it must throw on invalid value
    // valid values are like rgb(123, 2, 22)
    /^rgb\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\s*\)$/
      .exec(value)
      .slice(1)
      .map(v => parseInt(v, 10))
      .some(v => {
        if (isNaN(v) || v < 0 || v > 255)
          throw new Error(`Invalid color value ${value}`);
        return false;
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

  backgroundColor(v) {
    if (arguments.length === 1) {
      this.fields.backgroundColor = v;
      return this;
    }
    return this.fields.backgroundColor;
  }

  foregroundColor(v) {
    if (arguments.length === 1) {
      Template.validateColorValue(v);
      this.fields.foregroundColor = v;
      return this;
    }
    return this.fields.foregroundColor;
  }

  labelColor(v) {
    if (arguments.length === 1) {
      Template.validateColorValue(v);
      this.fields.labelColor = v;
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

  /**
   * Sets path to directory containing keys and password for accessing keys.
   * 
   * @param {string} path - Path to directory containing key files (default is 'keys')
   * @param {string} password - Password to use with keys
   * @memberof Template
   */
  keys(path, password) {
    if (path) this.keysPath = path;
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
}

module.exports = Template;
