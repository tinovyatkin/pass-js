/**
 * Common constants for fields names and values:
 * https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/LowerLevel.html#//apple_ref/doc/uid/TP40012026-CH3-SW3
 *
 */
export declare const PASS_MIME_TYPE = 'application/vnd.apple.pkpass';
export declare const TRANSIT: {
  AIR: string;
  BOAT: string;
  BUS: string;
  TRAIN: string;
  GENERIC: string;
};
export declare const textDirection: {
  LEFT: string;
  CENTER: string;
  RIGHT: string;
  NATURAL: string;
};
export declare const barcodeFormat: {
  QR: string;
  PDF417: string;
  Aztec: string;
  Code128: string;
};
export declare const dateTimeFormat: {
  NONE: string;
  SHORT: string;
  MEDIUM: string;
  LONG: string;
  FULL: string;
};
export declare const dataDetector: {
  PHONE: string;
  LINK: string;
  ADDRESS: string;
  CALENDAR: string;
};
/** @type {{[k: string]: { width: number, height: number, required?: boolean }}} */
export declare const IMAGES: {
  icon: {
    width: number;
    height: number;
    required: boolean;
  };
  logo: {
    width: number;
    height: number;
    required: boolean;
  };
  background: {
    width: number;
    height: number;
  };
  footer: {
    width: number;
    height: number;
  };
  strip: {
    width: number;
    height: number;
  };
  thumbnail: {
    width: number;
    height: number;
  };
};
export declare const DENSITIES: Set<string>;
export declare const PASS_STYLES: Set<string>;
export declare const TOP_LEVEL_FIELDS: {
  description: {
    required: boolean;
    type: string;
    templatable: boolean;
    localizable: boolean;
  };
  organizationName: {
    required: boolean;
    type: string;
    templatable: boolean;
    localizable: boolean;
  };
  passTypeIdentifier: {
    required: boolean;
    type: string;
    templatable: boolean;
  };
  serialNumber: {
    required: boolean;
    type: string;
  };
  teamIdentifier: {
    required: boolean;
    type: string;
    templatable: boolean;
  };
  associatedStoreIdentifiers: {
    required: boolean;
    type: ArrayConstructor;
    templatable: boolean;
  };
  expirationDate: {
    type: string;
  };
  voided: {
    type: BooleanConstructor;
  };
  beacons: {
    type: ArrayConstructor;
  };
  locations: {
    type: ArrayConstructor;
  };
  maxDistance: {
    type: string;
  };
  relevantDate: {
    type: string;
  };
  barcodes: {
    type: ArrayConstructor;
  };
  backgroundColor: {
    type: string;
    templatable: boolean;
  };
  foregroundColor: {
    type: string;
    templatable: boolean;
  };
  groupingIdentifier: {
    type: string;
  };
  labelColor: {
    type: string;
    templatable: boolean;
  };
  logoText: {
    type: string;
    templatable: boolean;
    localizable: boolean;
  };
  suppressStripShine: {
    type: BooleanConstructor;
    templatable: boolean;
  };
  authenticationToken: {
    type: string;
    minlength: number;
  };
  webServiceURL: {
    type: string;
    templatable: boolean;
  };
  nfc: {
    type: ObjectConstructor;
  };
};
export declare const STRUCTURE_FIELDS: Set<string>;
/** @type {Set.<'PKBarcodeFormatQR' | 'PKBarcodeFormatPDF417' | 'PKBarcodeFormatAztec' | 'PKBarcodeFormatCode128'>} */
export declare const BARCODES_FORMAT: Set<string>;
