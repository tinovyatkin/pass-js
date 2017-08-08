/**
 * Common constants for fields names and values:
 * https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/LowerLevel.html#//apple_ref/doc/uid/TP40012026-CH3-SW3
 * 
 */

'use strict';

const transitType = {
  AIR: 'PKTransitTypeAir',
  BOAT: 'PKTransitTypeBoat',
  BUS: 'PKTransitTypeBus',
  TRAIN: 'PKTransitTypeTrain',
  GENERIC: 'PKTransitTypeGeneric',
};
exports.transitType = transitType;

const barcodeFormat = {
  QR: 'PKBarcodeFormatQR',
  PDF417: 'PKBarcodeFormatPDF417',
  Aztec: 'PKBarcodeFormatAztec',
  Code128: 'PKBarcodeFormatCode128',
};
exports.barcodeFormat = barcodeFormat;

const dataDetector = {
  PHONE: 'PKDataDetectorTypePhoneNumber',
  LINK: 'PKDataDetectorTypeLink',
  ADDRESS: 'PKDataDetectorTypeAddress',
  CALENDAR: 'PKDataDetectorTypeCalendarEvent',
};
exports.dataDetector = dataDetector;

// Supported images.
const IMAGES = ['background', 'footer', 'icon', 'logo', 'strip', 'thumbnail'];
const DENSITIES = ['1x', '2x', '3x'];
exports.IMAGES = IMAGES;
exports.DENSITIES = DENSITIES;

// Optional top level fields
// Top-level pass fields.
// https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/TopLevel.html#//apple_ref/doc/uid/TP40012026-CH2-SW1
const TOP_LEVEL_FIELDS = {
  // Standard Keys
  description: {
    required: true,
    type: 'string',
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
