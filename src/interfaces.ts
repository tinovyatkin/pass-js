// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

/**
 * Field accessors class
 *
 * @see {@link https://developer.apple.com/library/archive/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/FieldDictionary.html}
 */

import { PassColor } from './lib/pass-color.js';
import { FieldsMap } from './lib/fieldsMap.js';

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

export interface SemanticTagObject {
  [key: string]: SemanticTagValue;
}

export type SemanticTagValue =
  | string
  | number
  | boolean
  | Date
  | SemanticTagObject
  | SemanticTagValue[];

// ─── Semantic-tag sub-types ─────────────────────────────────────────────────
// https://developer.apple.com/documentation/walletpasses/semantictagtype

/** ISO 4217 currency amount. */
export interface CurrencyAmount {
  amount: string | number;
  currencyCode: string;
}

/** Geographic coordinate, used by `departureLocation`, `venueLocation`, etc. */
export interface SemanticLocation {
  latitude: number;
  longitude: number;
}

export interface PersonNameComponents {
  givenName?: string;
  familyName?: string;
  middleName?: string;
  namePrefix?: string;
  nameSuffix?: string;
  nickname?: string;
  phoneticRepresentation?: string;
}

export interface WifiNetwork {
  ssid: string;
  password: string;
}

export interface Seat {
  seatDescription?: string;
  seatIdentifier?: string;
  seatNumber?: string;
  seatRow?: string;
  seatSection?: string;
  seatType?: string;
  /** iOS 18+ */
  seatAisle?: string;
  /** iOS 18+ */
  seatLevel?: string;
  /** iOS 18+. CSS-style RGB/hex color for the section swatch. */
  seatSectionColor?: string;
}

/**
 * iOS 18+ alternative to the bare `eventStartDate`, with more control over
 * time display, timezone, and TBA/TBD states (iOS 18.1).
 */
export interface EventDateInfo {
  date: string | Date;
  timeZone?: string;
  ignoreTimeComponents?: boolean;
  /** iOS 18.1 — renders "TBA" when the time has not been announced. */
  unannounced?: boolean;
  /** iOS 18.1 — renders "TBD" for undetermined start time. */
  undetermined?: boolean;
}

// iOS 26 — transit security program enums
export type PKTransitSecurityProgram =
  | 'PKTransitSecurityProgramTSAPreCheck'
  | 'PKTransitSecurityProgramTSAPreCheckTouchlessID'
  | 'PKTransitSecurityProgramOSS'
  | 'PKTransitSecurityProgramITI'
  | 'PKTransitSecurityProgramITD'
  | 'PKTransitSecurityProgramGlobalEntry'
  | 'PKTransitSecurityProgramCLEAR';

// iOS 26 — passenger capability enums
export type PKPassengerCapability =
  | 'PKPassengerCapabilityPreboarding'
  | 'PKPassengerCapabilityPriorityBoarding'
  | 'PKPassengerCapabilityCarryon'
  | 'PKPassengerCapabilityPersonalItem';

/**
 * Machine-readable metadata that Wallet uses to offer a pass and suggest
 * related actions. Covers every field Apple has documented through
 * iOS 26.
 *
 * Strictly typed — assigning a key Apple hasn't documented produces a
 * TypeScript error. To write an undocumented or not-yet-typed tag,
 * cast through `SemanticTagObject` at the assignment site.
 *
 * @see {@link https://developer.apple.com/documentation/walletpasses/supporting-semantic-tags-in-wallet-passes}
 * @see {@link https://developer.apple.com/documentation/walletpasses/semantictags}
 */
export interface SemanticTags {
  // ── Pre-iOS-18 baseline ──────────────────────────────────────────────────
  airlineCode?: string;
  artistIDs?: string[];
  awayTeamAbbreviation?: string;
  awayTeamLocation?: string;
  awayTeamName?: string;
  balance?: CurrencyAmount;
  boardingGroup?: string;
  boardingSequenceNumber?: string;
  carNumber?: string;
  confirmationNumber?: string;
  currentArrivalDate?: string | Date;
  currentBoardingDate?: string | Date;
  currentDepartureDate?: string | Date;
  departureAirportCode?: string;
  departureAirportName?: string;
  departureGate?: string;
  departureLocation?: SemanticLocation;
  departureLocationDescription?: string;
  departurePlatform?: string;
  departureStationName?: string;
  departureTerminal?: string;
  destinationAirportCode?: string;
  destinationAirportName?: string;
  destinationGate?: string;
  destinationLocation?: SemanticLocation;
  destinationLocationDescription?: string;
  destinationPlatform?: string;
  destinationStationName?: string;
  destinationTerminal?: string;
  duration?: number;
  eventEndDate?: string | Date;
  eventName?: string;
  eventStartDate?: string | Date;
  eventType?:
    | 'PKEventTypeGeneric'
    | 'PKEventTypeLivePerformance'
    | 'PKEventTypeMovie'
    | 'PKEventTypeSports'
    | 'PKEventTypeConference'
    | 'PKEventTypeConvention'
    | 'PKEventTypeWorkshop'
    | 'PKEventTypeSocialGathering';
  flightCode?: string;
  flightNumber?: number;
  genre?: string;
  homeTeamAbbreviation?: string;
  homeTeamLocation?: string;
  homeTeamName?: string;
  leagueAbbreviation?: string;
  leagueName?: string;
  membershipProgramName?: string;
  membershipProgramNumber?: string;
  originalArrivalDate?: string | Date;
  originalBoardingDate?: string | Date;
  originalDepartureDate?: string | Date;
  passengerName?: PersonNameComponents;
  performerNames?: string[];
  priorityStatus?: string;
  seats?: Seat[];
  securityScreening?: string;
  silenceRequested?: boolean;
  sportName?: string;
  totalPrice?: CurrencyAmount;
  transitProvider?: string;
  transitStatus?: string;
  transitStatusReason?: string;
  vehicleName?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  venueEntrance?: string;
  venueLocation?: SemanticLocation;
  venueName?: string;
  venuePhoneNumber?: string;
  venueRoom?: string;
  wifiAccess?: WifiNetwork[];

  // ── iOS 18 event-ticket additions ────────────────────────────────────────
  /** iOS 18 */
  admissionLevel?: string;
  /** iOS 18 */
  admissionLevelAbbreviation?: string;
  /** iOS 18 */
  albumIDs?: string[];
  /** iOS 18. `true` enables AirPlay playback controls on the pass. */
  airplay?: boolean;
  /** iOS 18 */
  attendeeName?: string;
  /** iOS 18 */
  additionalTicketAttributes?: string;
  /** iOS 18 */
  entranceDescription?: string;
  /** iOS 18. Short message shown during a live activity. */
  eventLiveMessage?: string;
  /** iOS 18 / 18.1. Structured alternative to `eventStartDate`. */
  eventStartDateInfo?: EventDateInfo;
  /** iOS 18 */
  playlistIDs?: string[];
  /** iOS 18 */
  tailgatingAllowed?: boolean;
  /** iOS 18 */
  venueGatesOpenDate?: string | Date;
  /** iOS 18 */
  venueParkingLotsOpenDate?: string | Date;
  /** iOS 18 */
  venueBoxOfficeOpenDate?: string | Date;
  /** iOS 18 */
  venueDoorsOpenDate?: string | Date;
  /** iOS 18 */
  venueFanZoneOpenDate?: string | Date;
  /** iOS 18 */
  venueOpenDate?: string | Date;
  /** iOS 18 */
  venueCloseDate?: string | Date;
  /** iOS 18 */
  venueRegionName?: string;
  /** iOS 18 */
  venueEntranceGate?: string;
  /** iOS 18 */
  venueEntranceDoor?: string;
  /** iOS 18 */
  venueEntrancePortal?: string;

  // ── iOS 26 enhanced boarding pass additions ─────────────────────────────
  /** iOS 26 */
  boardingZone?: string;
  /** iOS 26 */
  departureCityName?: string;
  /** iOS 26 */
  destinationCityName?: string;
  /** iOS 26 */
  departureLocationSecurityPrograms?: PKTransitSecurityProgram[];
  /** iOS 26 */
  destinationLocationSecurityPrograms?: PKTransitSecurityProgram[];
  /** iOS 26 */
  passengerEligibleSecurityPrograms?: PKTransitSecurityProgram[];
  /** iOS 26. IANA time zone name, e.g. `America/Chicago`. */
  departureLocationTimeZone?: string;
  /** iOS 26. IANA time zone name, e.g. `America/Los_Angeles`. */
  destinationLocationTimeZone?: string;
  /** iOS 26 */
  internationalDocumentsAreVerified?: boolean;
  /** iOS 26 */
  internationalDocumentsVerifiedDeclarationName?: string;
  /** iOS 26. MapKit Place IDs referencing lounge locations. */
  loungePlaceIDs?: string[];
  /** iOS 26 */
  membershipProgramStatus?: string;
  /** iOS 26 */
  passengerAirlineSSRs?: string[];
  /** iOS 26 */
  passengerCapabilities?: PKPassengerCapability[];
  /** iOS 26. IATA information SSRs. */
  passengerInformationSSRs?: string[];
  /** iOS 26. IATA service SSRs. */
  passengerServiceSSRs?: string[];
  /** iOS 26. Fare class badge displayed on the boarding pass. */
  ticketFareClass?: string;
}

export type FieldDescriptor = {
  // Standard Field Dictionary Keys
  label?: string;
  attributedValue?: string | number;
  changeMessage?: string;
  dataDetectorTypes?: DataDetectors[];
  semantics?: SemanticTags;
  /** eventTicket auxiliaryFields only */
  row?: 0 | 1;
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
    }
);

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

export interface PassSemanticKeys {
  /**
   * Machine-readable metadata for Wallet suggestions. This dictionary may
   * also be specified on individual pass fields.
   */
  semantics?: SemanticTags;
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
 * A date/time range during which the pass is relevant. Either a point
 * in time (`relevantDate`) or a window (`startDate`/`endDate`).
 *
 * @see {@link https://developer.apple.com/documentation/walletpasses/pass/relevantdates}
 */
export interface RelevantDateEntry {
  /** ISO 8601 date-time at which the pass becomes relevant. */
  relevantDate?: string | Date;
  /** Start of a relevance window (ISO 8601 date-time). */
  startDate?: string | Date;
  /** End of a relevance window (ISO 8601 date-time). */
  endDate?: string | Date;
}

/**
 * Undocumented-in-prose but valid top-level `calendarEvent` field.
 * @see {@link https://developer.apple.com/documentation/walletpasses/pass/calendarevent}
 */
export interface CalendarEvent {
  title: string;
  location?: string;
  startDate: string | Date;
  endDate: string | Date;
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
   *
   * @deprecated Prefer `relevantDates` (iOS 18+) for new passes. The
   * singular `relevantDate` is still emitted for backward compatibility
   * but Apple recommends the array form for event tickets and boarding
   * passes with multiple relevant windows.
   */
  relevantDate?: string | Date;
  /**
   * List of dates and date ranges during which the pass is relevant.
   * Added in iOS 18. Supersedes the singular `relevantDate` for passes
   * with multiple relevance windows (e.g. multi-leg itineraries).
   *
   * @see {@link https://developer.apple.com/documentation/walletpasses/pass/relevantdates}
   */
  relevantDates?: RelevantDateEntry[];
  /**
   * Calendar event associated with the pass. Presented at WWDC 2018.
   *
   * @see {@link https://developer.apple.com/documentation/walletpasses/pass/calendarevent}
   */
  calendarEvent?: CalendarEvent;
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
  /**
   * Event-ticket dashboard fields (iOS 18+). Only valid on `eventTicket`
   * passes; the setter on `PassStructure` throws a ReferenceError if
   * accessed on another style.
   */
  additionalInfoFields?: Field[] | FieldsMap;
}

/**
 * Keys that define the visual style and appearance of the pass.
 */
export interface PassVisualAppearanceKeys {
  /**
   * Information specific to the pass’s barcode.
   * For this dictionary’s keys, see Barcode Dictionary Keys.
   *
   * @deprecated Deprecated in iOS 9.0 and later; use `barcodes` instead.
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
  /**
   * Ordered list of visual style schemes the pass opts into, in order
   * of preference. iOS 18+ renders `posterEventTicket` with richer
   * hero imagery for event passes; iOS 26 adds `semanticBoardingPass`
   * for enhanced boarding-pass layouts. Older OSes silently fall back
   * to the classic style.
   *
   * @see {@link https://developer.apple.com/documentation/walletpasses/preferredstyleschemes}
   */
  preferredStyleSchemes?: (
    | 'posterEventTicket'
    | 'eventTicket'
    | 'boardingPass'
    | 'semanticBoardingPass'
  )[];
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
  encryptionPublicKey?: string;
  /**
   * Indicates whether the NFC pass requires authentication.
   * When `true`, the user must authenticate (Face ID / Touch ID / passcode)
   * before the pass is transmitted via NFC.
   */
  requiresAuthentication?: boolean;
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

/**
 * iOS 18 event-ticket "Event Guide" and styling keys.
 *
 * All fields are optional. They apply only to `eventTicket` passes
 * using the new poster layout (`preferredStyleSchemes` includes
 * `'posterEventTicket'`). Older iOS versions silently ignore them.
 */
export interface PassEventTicketKeys {
  /** Event Guide: URL to the bag/re-entry policy. */
  bagPolicyURL?: string;
  /** Event Guide: URL to order food at the venue. */
  orderFoodURL?: string;
  /** Event Guide: URL to parking information. */
  parkingInformationURL?: string;
  /** Event Guide: URL to directions to the venue. */
  directionsInformationURL?: string;
  /** Event Guide: URL to purchase parking. */
  purchaseParkingURL?: string;
  /** Event Guide: URL to purchase merchandise. */
  merchandiseURL?: string;
  /** Event Guide: URL to transit information. */
  transitInformationURL?: string;
  /** Event Guide: URL to accessibility information. */
  accessibilityURL?: string;
  /** Event Guide: URL to add-on experiences / upgrades. */
  addOnURL?: string;
  /** Event Guide: venue contact email address (plain string, not a URL). */
  contactVenueEmail?: string;
  /** Event Guide: venue contact phone number. */
  contactVenuePhoneNumber?: string;
  /** Event Guide: venue website URL. */
  contactVenueWebsite?: string;
  /** Menu dropdown: URL to initiate ticket transfer. */
  transferURL?: string;
  /** Menu dropdown: URL to resell the ticket. */
  sellURL?: string;
  /** Disables the automatic dark shadow behind the header in new layouts. */
  suppressHeaderDarkening?: boolean;
  /** Overrides the footer chin color (defaults to blurred background). */
  footerBackgroundColor?: PassColor | string;
  /**
   * When `true`, Wallet derives `foregroundColor` and `labelColor` from
   * the background image automatically; any explicit values are ignored.
   */
  useAutomaticColors?: boolean;
  /**
   * Secondary App Store identifiers related to the event ticket. Unlike
   * `associatedStoreIdentifiers`, apps listed here cannot read the user's
   * passes.
   */
  auxiliaryStoreIdentifiers?: number[];
  /** iOS 18.1. Text shown next to the logo on `posterEventTicket` passes. */
  eventLogoText?: string;
}

/**
 * iOS 26 enhanced / semantic boarding-pass keys.
 *
 * Available when `preferredStyleSchemes` includes `'semanticBoardingPass'`.
 * All fields are optional.
 */
export interface PassEnhancedBoardingPassKeys {
  /** URL for changing the seat. */
  changeSeatURL?: string;
  /** URL for in-flight entertainment. */
  entertainmentURL?: string;
  /** URL for purchasing additional checked baggage. */
  purchaseAdditionalBaggageURL?: string;
  /** URL for purchasing lounge access. */
  purchaseLoungeAccessURL?: string;
  /** URL for purchasing in-flight Wi-Fi. */
  purchaseWifiURL?: string;
  /** URL for upgrading the flight. */
  upgradeURL?: string;
  /** URL for general ticket management. */
  managementURL?: string;
  /** URL for registering a service animal. */
  registerServiceAnimalURL?: string;
  /** URL for reporting a lost bag. */
  reportLostBagURL?: string;
  /** URL for requesting a wheelchair. */
  requestWheelchairURL?: string;
  /** Transit provider website URL. */
  transitProviderWebsiteURL?: string;
  /** Transit provider email address (plain string, not a URL). */
  transitProviderEmail?: string;
  /** Transit provider phone number. */
  transitProviderPhoneNumber?: string;
}

/**
 * iOS 26 poster-event-ticket key for declaring upcoming passes chained
 * to this one. The nested shape lives in
 * `src/lib/upcoming-pass-information.ts`; the setter on `PassBase`
 * validates style/scheme pre-conditions and each entry's shape.
 */
export interface PassUpcomingKeys {
  upcomingPassInformation?: import('./lib/upcoming-pass-information.js').UpcomingPassInformationEntry[];
}

export type ApplePass = PassStandardKeys &
  PassAssociatedAppKeys &
  PassCompanionAppKeys &
  PassSemanticKeys &
  PassExpirationKeys &
  PassRelevanceKeys &
  PassVisualAppearanceKeys &
  PassWebServiceKeys &
  PassStructureFields &
  PassEventTicketKeys &
  PassEnhancedBoardingPassKeys &
  PassUpcomingKeys;

export interface Options {
  allowHttp?: boolean;
  disableImageCheck?: boolean;
}
