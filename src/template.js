// Passbook are created from templates

'use strict';

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
    this.fields = Object.assign({}, fields);
    this.keysPath = 'keys';
    this.images = new PassImages();
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
      this.fields.foregroundColor = v;
      return this;
    }
    return this.fields.foregroundColor;
  }

  labelColor(v) {
    if (arguments.length === 1) {
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

  suppressStripShine(v) {
    if (arguments.length === 1) {
      this.fields.suppressStripShine = v;
      return this;
    }
    return this.fields.suppressStripShine;
  }

  webServiceURL(v) {
    if (arguments.length === 1) {
      this.fields.webServiceURL = v;
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
