/**
 * Common constants for fields names and values:
 * https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/LowerLevel.html#//apple_ref/doc/uid/TP40012026-CH3-SW3
 * 
 */

'use strict';

const PASS_MIME_TYPE = 'application/vnd.apple.pkpass';
exports.PASS_MIME_TYPE = PASS_MIME_TYPE;

const TRANSIT = {
  AIR: 'PKTransitTypeAir',
  BOAT: 'PKTransitTypeBoat',
  BUS: 'PKTransitTypeBus',
  TRAIN: 'PKTransitTypeTrain',
  GENERIC: 'PKTransitTypeGeneric',
};
exports.TRANSIT = TRANSIT;

const textDirection = {
  LEFT: 'PKTextAlignmentLeft',
  CENTER: 'PKTextAlignmentCenter',
  RIGHT: 'PKTextAlignmentRight',
  NATURAL: 'PKTextAlignmentNatural',
};
exports.textDirection = textDirection;

const barcodeFormat = {
  QR: 'PKBarcodeFormatQR',
  PDF417: 'PKBarcodeFormatPDF417',
  Aztec: 'PKBarcodeFormatAztec',
  Code128: 'PKBarcodeFormatCode128',
};
exports.barcodeFormat = barcodeFormat;

const dateTimeFormat = {
  NONE: 'PKDateStyleNone',
  SHORT: 'PKDateStyleShort',
  MEDIUM: 'PKDateStyleMedium',
  LONG: 'PKDateStyleLong',
  FULL: 'PKDateStyleFull',
};
exports.dateTimeFormat = dateTimeFormat;

const dataDetector = {
  PHONE: 'PKDataDetectorTypePhoneNumber',
  LINK: 'PKDataDetectorTypeLink',
  ADDRESS: 'PKDataDetectorTypeAddress',
  CALENDAR: 'PKDataDetectorTypeCalendarEvent',
};
exports.dataDetector = dataDetector;

// Supported images.
const IMAGES = {
  icon: {
    width: 29,
    height: 29,
    required: true,
  },
  logo: {
    width: 160,
    height: 50,
    required: true,
  },
  background: {
    width: 180,
    height: 220,
  },
  footer: {
    width: 295,
    height: 15,
  },
  strip: {
    width: 375,
    height: 123,
  },
  thumbnail: {
    width: 90,
    height: 90,
  },
};

const DENSITIES = ['1x', '2x', '3x'];
exports.IMAGES = IMAGES;
exports.DENSITIES = DENSITIES;

// Supported passbook styles.
const PASS_STYLES = [
  'boardingPass',
  'coupon',
  'eventTicket',
  'storeCard',
  'generic',
];
exports.PASS_STYLES = PASS_STYLES;

// Optional top level fields
// Top-level pass fields.
// https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/TopLevel.html#//apple_ref/doc/uid/TP40012026-CH2-SW1
const TOP_LEVEL_FIELDS = {
  // Standard Keys
  description: {
    required: true,
    type: 'string',
    templatable: true,
    localizable: true,
  },
  organizationName: {
    required: true,
    type: 'string',
    templatable: true,
    localizable: true,
  },
  passTypeIdentifier: {
    required: true,
    type: 'string',
    templatable: true,
  },
  serialNumber: {
    required: true,
    type: 'string',
  },
  teamIdentifier: {
    required: true,
    type: 'string',
    templatable: true,
  },
  // Expiration Keys
  expirationDate: {
    type: 'string', // W3C date, as a string
  },
  voided: {
    type: Boolean,
  },
  // Relevance Keys
  beacons: {
    type: Array,
  },
  locations: {
    type: Array,
  },
  maxDistance: {
    type: 'number',
  },
  relevantDate: {
    type: 'string', // W3C date, as a string
  },
  // Visual Appearance Keys
  barcodes: {
    type: Array,
  },
  backgroundColor: {
    type: 'string',
    templatable: true,
  },
  foregroundColor: {
    type: 'string',
    templatable: true,
  },
  groupingIdentifier: {
    type: 'string',
  },
  labelColor: {
    type: 'string',
    templatable: true,
  },
  logoText: {
    type: 'string',
    templatable: true,
    localizable: true,
  },
  suppressStripShine: {
    type: Boolean,
    templatable: true,
  },
  // Web Service Keys
  authenticationToken: {
    type: 'string',
    minlength: 16,
  },
  webServiceURL: {
    type: 'string',
    templatable: true,
  },
  // NFC-Enabled Pass Keys
  nfc: {
    type: Object,
  },
};
exports.TOP_LEVEL_FIELDS = TOP_LEVEL_FIELDS;

// Pass structure keys.
// https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/LowerLevel.html#//apple_ref/doc/uid/TP40012026-CH3-SW3
const STRUCTURE_FIELDS = [
  'auxiliaryFields',
  'backFields',
  'headerFields',
  'primaryFields',
  'secondaryFields',
  'transitType',
];
exports.STRUCTURE_FIELDS = STRUCTURE_FIELDS;

// These images are required for a valid pass.
const REQUIRED_IMAGES = ['icon', 'logo'];
exports.REQUIRED_IMAGES = REQUIRED_IMAGES;
