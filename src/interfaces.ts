/**
 * Field accessors class
 *
 * @see {@link https://developer.apple.com/library/archive/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/FieldDictionary.html}
 */

import { PassColor } from './lib/pass-color';
import { FieldsMap } from './lib/fieldsMap';

export type DataDetectors =
  | 'PKDataDetectorTypePhoneNumber'
  | 'PKDataDetectorTypeLink'
  | 'PKDataDetectorTypeAddress'
  | 'PKDataDetectorTypeCalendarEvent';

export type DataStyleFormat =
  | 'PKDateStyleNone'
  | 'PKDateStyleShort'
  | 'PKDateStyleMedium'
  | 'PKDateStyleLong'
  | 'PKDateStyleFull';

export type TextAlignment =
  | 'PKTextAlignmentLeft'
  | 'PKTextAlignmentCenter'
  | 'PKTextAlignmentRight'
  | 'PKTextAlignmentNatural';

export type NumberStyle =
  | 'PKNumberStyleDecimal'
  | 'PKNumberStylePercent'
  | 'PKNumberStyleScientific'
  | 'PKNumberStyleSpellOut';

export type FieldDescriptor = {
  // Standard Field Dictionary Keys
  label?: string;
  attributedValue?: string | number;
  changeMessage?: string;
  dataDetectorTypes?: DataDetectors[];
} & (
  | {
      value: string;
      textAlignment?: TextAlignment;
    }
  | {
      value: Date;
      // Date Style Keys
      dateStyle?: DataStyleFormat;
      ignoresTimeZone?: boolean;
      isRelative?: boolean;
      timeStyle?: DataStyleFormat;
    }
  | {
      value: number;
      // Number Style Keys
      currencyCode?: string;
      numberStyle?: NumberStyle;
    });

export type Field = {
  // Standard Field Dictionary Keys
  key: string;
} & FieldDescriptor;

export type PassStyle =
  | 'boardingPass'
  | 'coupon'
  | 'eventTicket'
  | 'storeCard'
  | 'generic';

export type BarcodeFormat =
  | 'PKBarcodeFormatQR'
  | 'PKBarcodeFormatPDF417'
  | 'PKBarcodeFormatAztec'
  | 'PKBarcodeFormatCode128';
export interface BarcodeDescriptor {
  /**
   *  Barcode format. For the barcode dictionary, you can use only the following values: PKBarcodeFormatQR, PKBarcodeFormatPDF417, or PKBarcodeFormatAztec. For dictionaries in the barcodes array, you may also use PKBarcodeFormatCode128.
   */
  format: BarcodeFormat;
  /**
   * Message or payload to be displayed as a barcode.
   */
  message: string;
  /**
   * Text encoding that is used to convert the message from the string representation to a data representation to render the barcode. The value is typically iso-8859-1, but you may use another encoding that is supported by your barcode scanning infrastructure.
   */
  messageEncoding: string;
  /**
   * Optional. Text displayed near the barcode. For example, a human-readable version of the barcode data in case the barcode doesn’t scan.
   */
  altText?: string;
}

/**
 * Top-Level Keys
 * The top level of the pass.json file is a dictionary.
 * The following sections list the required and optional keys used in this dictionary.
 * For each key whose value is a dictionary or an array of dictionaries,
 * there is also a section in Lower-Level Keys that lists the keys for that dictionary.
 *
 * @see {@link https://developer.apple.com/library/archive/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/TopLevel.html#//apple_ref/doc/uid/TP40012026-CH2-SW1}
 */

/**
 * Information that is required for all passes.
 */
export interface PassStandardKeys {
  /**
   * Brief description of the pass, used by the iOS accessibility technologies.
   * Don’t try to include all of the data on the pass in its description,
   * just include enough detail to distinguish passes of the same type.
   */
  description: string;
  /**
   * Version of the file format. The value must be 1.
   */
  formatVersion: 1;
  /**
   * Display name of the organization that originated and signed the pass.
   */
  organizationName: string;
  /**
   * Pass type identifier, as issued by Apple.
   * The value must correspond with your signing certificate.
   */
  passTypeIdentifier: string;
  /**
   * Serial number that uniquely identifies the pass.
   * No two passes with the same pass type identifier may have the same serial number.
   */
  serialNumber: string;
  /**
   * Team identifier of the organization that originated and signed the pass, as issued by Apple.
   */
  teamIdentifier: string;
  /**
   * Possibility to prohibit a sharing of pass
   */
  sharingProhibited: boolean;
}

/**
 * Information about an app that is associated with a pass.
 */
export interface PassAssociatedAppKeys {
  /**
   * A URL to be passed to the associated app when launching it.
   * The app receives this URL in the application:didFinishLaunchingWithOptions:
   * and application:openURL:options: methods of its app delegate.
   * If this key is present, the associatedStoreIdentifiers key must also be present.
   */
  appLaunchURL?: string;
  /**
   * A list of iTunes Store item identifiers for the associated apps.
   * Only one item in the list is used—the first item identifier for an app
   * compatible with the current device.
   * If the app is not installed, the link opens the App Store and shows the app.
   * If the app is already installed, the link launches the app.
   */
  associatedStoreIdentifiers?: number[];
}

/**
 * Custom information about a pass provided for a companion app to use.
 */
export interface PassCompanionAppKeys {
  /**
   * Custom information for companion apps. This data is not displayed to the user.
   * For example, a pass for a cafe could include information about
   * the user’s favorite drink and sandwich in a machine-readable form
   * for the companion app to read, making it easy to place an order for “the usual” from the app.
   */
  userInfo?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Information about when a pass expires and whether it is still valid.
 * A pass is marked as expired if the current date is after the pass’s expiration date,
 * or if the pass has been explicitly marked as voided.
 */
export interface PassExpirationKeys {
  /**
   * Date and time when the pass expires.
   * The value must be a complete date with hours and minutes,
   * and may optionally include seconds.
   */
  expirationDate?: string | Date;
  /**
   * Indicates that the pass is void—for example, a one time use coupon that has been redeemed.
   * The default value is false.
   */
  voided?: boolean;
}

/**
 * Information about a location beacon.
 */
export interface Beacon {
  /**
   * Unique identifier of a Bluetooth Low Energy location beacon.
   */
  proximityUUID: string;
  /**
   * Major identifier of a Bluetooth Low Energy location beacon.
   */
  major?: number;
  /**
   * Minor identifier of a Bluetooth Low Energy location beacon.
   */
  minor?: number;
  /**
   * Text displayed on the lock screen when the pass is currently relevant.
   * For example, a description of the nearby location
   *
   * @example “Store nearby on 1st and Main.”
   */
  relevantText?: string;
}

/**
 * Location Dictionary Keys
 */
export interface Location {
  /**
   * Latitude, in degrees, of the location.
   */
  latitude: number;
  /**
   * Longitude, in degrees, of the location.
   */
  longitude: number;
  /**
   * Altitude, in meters, of the location.
   */
  altitude?: number;
  /**
   * Text displayed on the lock screen when the pass is currently relevant.
   * For example, a description of the nearby location
   *
   * @example “Store nearby on 1st and Main.”
   */
  relevantText?: string;
}

/**
 * Information about where and when a pass is relevant.
 */
export interface PassRelevanceKeys {
  /**
   * Beacons marking locations where the pass is relevant.
   */
  beacons?: Beacon[];
  /**
   * Locations where the pass is relevant.
   * For example, the location of your store.
   */
  locations?: Location[];
  /**
   * Maximum distance in meters from a relevant latitude and longitude that the pass is relevant.
   * This number is compared to the pass’s default distance and the smaller value is used.
   */
  maxDistance?: number;
  /**
   * Date and time when the pass becomes relevant.
   * For example, the start time of a movie.
   * The value must be a complete date with hours and minutes,
   * and may optionally include seconds.
   */
  relevantDate?: string | Date;
}

/**
 * Pass common structure keys
 *
 * @see {@link https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/LowerLevel.html#//apple_ref/doc/uid/TP40012026-CH3-SW3}
 */
export interface PassCommonStructure {
  /**
   *  Fields to be displayed in the header on the front of the pass.
   * Use header fields sparingly; unlike all other fields,
   * they remain visible when a stack of passes are displayed.
   */
  headerFields?: Field[] | FieldsMap;
  /**
   * Fields to be displayed prominently on the front of the pass.
   */
  primaryFields?: Field[] | FieldsMap;
  /**
   * Fields to be displayed on the front of the pass.
   */
  secondaryFields?: Field[] | FieldsMap;
  /**
   * Additional fields to be displayed on the front of the pass.
   */
  auxiliaryFields?: Field[] | FieldsMap;
  /**
   * Fields to be on the back of the pass.
   */
  backFields?: Field[] | FieldsMap;
}

/**
 * Keys that define the visual style and appearance of the pass.
 */
export interface PassVisualAppearanceKeys {
  /**
   * Information specific to the pass’s barcode.
   * For this dictionary’s keys, see Barcode Dictionary Keys.
   * DEPRECATED in iOS 9.0 and later; use `barcodes` instead.
   */
  barcode?: BarcodeDescriptor;
  /**
   * Information specific to the pass’s barcode.
   * The system uses the first valid barcode dictionary in the array.
   * Additional dictionaries can be added as fallbacks.
   */
  barcodes?: BarcodeDescriptor[];
  /**
   * Background color of the pass, specified as an CSS-style RGB triple.
   *
   * @example rgb(23, 187, 82)
   */
  backgroundColor?: PassColor | string;
  /**
   * Foreground color of the pass, specified as a CSS-style RGB triple.
   *
   * @example rgb(100, 10, 110)
   */
  foregroundColor?: PassColor | string;
  /**
   * Optional for event tickets and boarding passes; otherwise not allowed.
   * Identifier used to group related passes.
   * If a grouping identifier is specified, passes with the same style,
   * pass type identifier, and grouping identifier are displayed as a group.
   * Otherwise, passes are grouped automatically.
   * Use this to group passes that are tightly related,
   * such as the boarding passes for different connections of the same trip.
   */
  groupingIdentifier?: string;
  /**
   * Color of the label text, specified as a CSS-style RGB triple.
   *
   * @example rgb(255, 255, 255)
   */
  labelColor?: PassColor | string;
  /**
   * Color of the strip text, specified as a CSS-style RGB triple.
   *
   * @example rgb(255, 255, 255)
   */
  stripColor?: PassColor | string;
  /**
   * Text displayed next to the logo on the pass.
   */
  logoText?: string;
  /**
   * If true, the strip image is displayed without a shine effect.
   * The default value prior to iOS 7.0 is false.
   * In iOS 7.0, a shine effect is never applied, and this key is deprecated.
   */
  suppressStripShine?: boolean;
}

export interface PassWebServiceKeys {
  /**
   * The URL of a web service that conforms to the API described in PassKit Web Service Reference.
   * The web service must use the HTTPS protocol in production; the leading https:// is included in the value of this key.
   * On devices configured for development, there is UI in Settings to allow HTTP web services. You can use the options
   * parameter to set allowHTTP to be able to use URLs that use the HTTP protocol.
   *
   * @see {@link https://developer.apple.com/library/archive/documentation/PassKit/Reference/PassKit_WebService/WebService.html#//apple_ref/doc/uid/TP40011988}
   */
  webServiceURL?: URL | string;
  /**
   * The authentication token to use with the web service.
   * The token must be 16 characters or longer.
   */
  authenticationToken?: string;
}

export interface NFCDictionary {
  /**
   * The payload to be transmitted to the Apple Pay terminal.
   * Must be 64 bytes or less.
   * Messages longer than 64 bytes are truncated by the system.
   */
  message: string;
  /**
   * The public encryption key used by the Value Added Services protocol.
   * Use a Base64 encoded X.509 SubjectPublicKeyInfo structure containing a ECDH public key for group P256.
   */
  encryptionPublicKey?: string | import('node-forge').pki.PublicKey;
}

/**
 * NFC-enabled pass keys support sending reward card information as part of an Apple Pay transaction.
 */

export type TransitType =
  | 'PKTransitTypeAir'
  | 'PKTransitTypeBoat'
  | 'PKTransitTypeBus'
  | 'PKTransitTypeTrain'
  | 'PKTransitTypeGeneric';

export interface BoardingPass {
  boardingPass: {
    /**
     * Type of transit.
     */
    transitType: TransitType;
  } & PassCommonStructure;
}

export interface CouponPass {
  coupon: PassCommonStructure;
}

export interface EventTicketPass {
  eventTicket: PassCommonStructure;
}

export interface GenericPass {
  generic: PassCommonStructure;
}

export interface StoreCardPass {
  storeCard: PassCommonStructure;
  nfc?: NFCDictionary;
}

export type PassStructureFields =
  | BoardingPass
  | CouponPass
  | EventTicketPass
  | GenericPass
  | StoreCardPass;

export type ApplePass = PassStandardKeys &
  PassAssociatedAppKeys &
  PassCompanionAppKeys &
  PassExpirationKeys &
  PassRelevanceKeys &
  PassVisualAppearanceKeys &
  PassWebServiceKeys &
  PassStructureFields;

export interface Options {
  allowHttp: boolean;
  disableImageCheck: boolean;
}