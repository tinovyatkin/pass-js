// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

/**
 * Common constants for fields names and values:
 * https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/LowerLevel.html#//apple_ref/doc/uid/TP40012026-CH3-SW3
 *
 */

import type {
  PassStyle,
  TransitType,
  TextAlignment,
  NumberStyle,
  BarcodeFormat,
  DataStyleFormat,
  DataDetectors,
  PassCommonStructure,
  ApplePass,
} from './interfaces.js';
import type { ImageType, ImageDensity } from './lib/images.js';

export const PASS_MIME_TYPE = 'application/vnd.apple.pkpass';

export const TRANSIT = {
  AIR: 'PKTransitTypeAir' as TransitType,
  BOAT: 'PKTransitTypeBoat' as TransitType,
  BUS: 'PKTransitTypeBus' as TransitType,
  TRAIN: 'PKTransitTypeTrain' as TransitType,
  GENERIC: 'PKTransitTypeGeneric' as TransitType,
};

export const textDirection = {
  LEFT: 'PKTextAlignmentLeft' as TextAlignment,
  CENTER: 'PKTextAlignmentCenter' as TextAlignment,
  RIGHT: 'PKTextAlignmentRight' as TextAlignment,
  NATURAL: 'PKTextAlignmentNatural' as TextAlignment,
};

export const barcodeFormat = {
  QR: 'PKBarcodeFormatQR' as BarcodeFormat,
  PDF417: 'PKBarcodeFormatPDF417' as BarcodeFormat,
  Aztec: 'PKBarcodeFormatAztec' as BarcodeFormat,
  Code128: 'PKBarcodeFormatCode128' as BarcodeFormat,
};

export const dateTimeFormat = {
  NONE: 'PKDateStyleNone' as DataStyleFormat,
  SHORT: 'PKDateStyleShort' as DataStyleFormat,
  MEDIUM: 'PKDateStyleMedium' as DataStyleFormat,
  LONG: 'PKDateStyleLong' as DataStyleFormat,
  FULL: 'PKDateStyleFull' as DataStyleFormat,
};

export const dataDetector = {
  PHONE: 'PKDataDetectorTypePhoneNumber' as DataDetectors,
  LINK: 'PKDataDetectorTypeLink' as DataDetectors,
  ADDRESS: 'PKDataDetectorTypeAddress' as DataDetectors,
  CALENDAR: 'PKDataDetectorTypeCalendarEvent' as DataDetectors,
};

export const numberStyle = {
  DECIMAL: 'PKNumberStyleDecimal' as NumberStyle,
  PERCENT: 'PKNumberStylePercent' as NumberStyle,
  SCIENTIFIC: 'PKNumberStyleScientific' as NumberStyle,
  SPELL_OUT: 'PKNumberStyleSpellOut' as NumberStyle,
};

/**
 * Supported images.
 */

export const IMAGES: {
  [k in ImageType]: { width: number; height: number; required?: boolean };
} = {
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
  personalizationLogo: {
    width: 150,
    height: 40,
  },
};

export const DENSITIES: ReadonlySet<ImageDensity> = new Set(['1x', '2x', '3x']);

// Supported passbook styles.
export const PASS_STYLES: ReadonlySet<PassStyle> = new Set([
  'boardingPass',
  'coupon',
  'eventTicket',
  'storeCard',
  'generic',
]);

// Optional top level fields
// Top-level pass fields.
// https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/TopLevel.html#//apple_ref/doc/uid/TP40012026-CH2-SW1
export const TOP_LEVEL_FIELDS: {
  [k in keyof ApplePass]?: {
    required?: boolean;
    type: 'string' | 'number' | typeof Array | typeof Boolean | typeof Object;
    templatable?: boolean;
    localizable?: boolean;
    minlength?: number;
  };
} = {
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
  sharingProhibited: {
    required: false,
    type: Boolean,
    templatable: true,
  },
  associatedStoreIdentifiers: {
    required: false,
    type: Array,
    templatable: true,
  },
  appLaunchURL: {
    required: false,
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
  relevantDates: {
    type: Array,
  },
  // Visual Appearance Keys
  barcodes: {
    type: Array,
  },
  preferredStyleSchemes: {
    type: Array,
    templatable: true,
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
  semantics: {
    type: Object,
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
  // iOS 18 Event Ticket Keys — Event Guide URLs, contact, transfer/sell
  bagPolicyURL: { type: 'string', templatable: true },
  orderFoodURL: { type: 'string', templatable: true },
  parkingInformationURL: { type: 'string', templatable: true },
  directionsInformationURL: { type: 'string', templatable: true },
  purchaseParkingURL: { type: 'string', templatable: true },
  merchandiseURL: { type: 'string', templatable: true },
  transitInformationURL: { type: 'string', templatable: true },
  accessibilityURL: { type: 'string', templatable: true },
  addOnURL: { type: 'string', templatable: true },
  contactVenueEmail: { type: 'string', templatable: true },
  contactVenuePhoneNumber: { type: 'string', templatable: true },
  contactVenueWebsite: { type: 'string', templatable: true },
  transferURL: { type: 'string', templatable: true },
  sellURL: { type: 'string', templatable: true },
  // iOS 18 Event Ticket Keys — styling + misc
  suppressHeaderDarkening: { type: Boolean, templatable: true },
  footerBackgroundColor: { type: 'string', templatable: true },
  useAutomaticColors: { type: Boolean, templatable: true },
  auxiliaryStoreIdentifiers: { type: Array, templatable: true },
  eventLogoText: { type: 'string', templatable: true, localizable: true },
  // iOS 26 Enhanced / Semantic Boarding Pass Keys
  changeSeatURL: { type: 'string', templatable: true },
  entertainmentURL: { type: 'string', templatable: true },
  purchaseAdditionalBaggageURL: { type: 'string', templatable: true },
  purchaseLoungeAccessURL: { type: 'string', templatable: true },
  purchaseWifiURL: { type: 'string', templatable: true },
  upgradeURL: { type: 'string', templatable: true },
  managementURL: { type: 'string', templatable: true },
  registerServiceAnimalURL: { type: 'string', templatable: true },
  reportLostBagURL: { type: 'string', templatable: true },
  requestWheelchairURL: { type: 'string', templatable: true },
  transitProviderWebsiteURL: { type: 'string', templatable: true },
  transitProviderEmail: { type: 'string', templatable: true },
  transitProviderPhoneNumber: { type: 'string', templatable: true },
  // iOS 26 Poster Event Ticket — upcoming chained events
  upcomingPassInformation: { type: Array },
};

// Pass structure keys.
// https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/LowerLevel.html#//apple_ref/doc/uid/TP40012026-CH3-SW3
export const STRUCTURE_FIELDS: readonly (keyof PassCommonStructure)[] = [
  'additionalInfoFields',
  'auxiliaryFields',
  'backFields',
  'headerFields',
  'primaryFields',
  'secondaryFields',
];

export const BARCODES_FORMAT: ReadonlySet<BarcodeFormat> = new Set([
  'PKBarcodeFormatQR',
  'PKBarcodeFormatPDF417',
  'PKBarcodeFormatAztec',
  'PKBarcodeFormatCode128',
]);
