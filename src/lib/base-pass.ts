// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

import type { ApplePass, Options, SemanticTags } from '../interfaces.js';
import { BARCODES_FORMAT, STRUCTURE_FIELDS } from '../constants.js';

import { PassColor } from './pass-color.js';
import { PassImages } from './images.js';
import { Localizations } from './localizations.js';
import { getGeoPoint } from './get-geo-point.js';
import { PassStructure } from './pass-structure.js';
import { normalizeSemanticTags } from './semantic-tags.js';
import { isValidW3CDateString, normalizeDatesDeep } from './w3cdate.js';
import {
  validateUpcomingPassInformationEntries,
  type UpcomingPassInformationEntry,
} from './upcoming-pass-information.js';
import {
  validatePersonalization,
  type Personalization,
} from './personalization.js';

const STRUCTURE_FIELDS_SET = new Set([...STRUCTURE_FIELDS, 'nfc']);

export class PassBase extends PassStructure {
  readonly images: PassImages;
  readonly localization: Localizations;
  readonly options: Options | undefined;
  private personalizationData: Personalization | undefined = undefined;

  constructor(
    fields: Partial<ApplePass> = {},
    images?: PassImages,
    localizations?: Localizations,
    options?: Options,
    personalization?: Personalization,
  ) {
    super(fields);

    this.options = options;

    // restore via setters
    for (const [key, value] of Object.entries(fields)) {
      if (!STRUCTURE_FIELDS_SET.has(key) && key in this) {
        (this as Record<string, unknown>)[key] = value;
      }
    }

    // copy images
    this.images = new PassImages(images);

    // copy localizations
    this.localization = new Localizations(localizations);

    this.personalization = personalization;
  }

  // Returns the pass.json object (not a string). Any Date anywhere in the
  // plain-object tree — top-level field, inside a RelevantDateEntry,
  // inside a future nested schema — is converted to the library's W3C
  // date string format (YYYY-MM-DDTHH:MM±HH:MM), never the JS default
  // ISO 8601 with milliseconds and trailing `Z` that Date.prototype.toJSON
  // would emit during JSON.stringify.
  //
  // Class instances (PassColor, FieldsMap, NFCField, …) have their own
  // toJSON and pass through unchanged — the walker only descends into
  // plain objects and arrays.
  toJSON(): Partial<ApplePass> {
    return {
      formatVersion: 1,
      ...normalizeDatesDeep(this.fields),
    } as Partial<ApplePass>;
  }

  get passTypeIdentifier(): string | undefined {
    return this.fields.passTypeIdentifier;
  }

  set passTypeIdentifier(v: string | undefined) {
    if (!v) delete this.fields.passTypeIdentifier;
    else this.fields.passTypeIdentifier = v;
  }

  get teamIdentifier(): string | undefined {
    return this.fields.teamIdentifier;
  }

  set teamIdentifier(v: string | undefined) {
    if (!v) delete this.fields.teamIdentifier;
    else this.fields.teamIdentifier = v;
  }

  get serialNumber(): string | undefined {
    return this.fields.serialNumber;
  }

  set serialNumber(v: string | undefined) {
    if (!v) delete this.fields.serialNumber;
    else this.fields.serialNumber = v;
  }

  /**
   *  Indicates that the sharing of pass can be prohibited.
   *
   * @type {boolean}
   */
  get sharingProhibited(): boolean | undefined {
    return this.fields.sharingProhibited;
  }

  set sharingProhibited(v) {
    if (!v) delete this.fields.sharingProhibited;
    else this.fields.sharingProhibited = true;
  }

  /**
   *  Indicates that the pass is void—for example, a one time use coupon that has been redeemed.
   *
   * @type {boolean}
   */
  get voided(): boolean {
    return !!this.fields.voided;
  }

  set voided(v: boolean) {
    if (v) this.fields.voided = true;
    else delete this.fields.voided;
  }

  /**
   * Date and time when the pass expires.
   *
   */
  get expirationDate(): ApplePass['expirationDate'] {
    if (typeof this.fields.expirationDate === 'string')
      return new Date(this.fields.expirationDate);
    return this.fields.expirationDate;
  }
  set expirationDate(v: ApplePass['expirationDate']) {
    if (!v) delete this.fields.expirationDate;
    else {
      if (v instanceof Date) {
        if (!Number.isFinite(v.getTime()))
          throw new TypeError(
            `Value for expirationDate must be a valid Date, received ${v.toString()}`,
          );
        this.fields.expirationDate = v;
      } else if (typeof v === 'string') {
        if (isValidW3CDateString(v)) this.fields.expirationDate = v;
        else {
          const date = new Date(v);
          if (!Number.isFinite(date.getTime()))
            throw new TypeError(
              `Value for expirationDate must be a valid Date, received ${v}`,
            );
          this.fields.expirationDate = date;
        }
      }
    }
  }

  /**
   * Date and time when the pass becomes relevant. For example, the start time of a movie.
   * Recommended for event tickets and boarding passes; otherwise optional.
   *
   * @type {string | Date}
   */
  get relevantDate(): ApplePass['relevantDate'] {
    if (typeof this.fields.relevantDate === 'string')
      return new Date(this.fields.relevantDate);
    return this.fields.relevantDate;
  }

  set relevantDate(v: ApplePass['relevantDate']) {
    if (!v) delete this.fields.relevantDate;
    else {
      if (v instanceof Date) {
        if (!Number.isFinite(v.getTime()))
          throw new TypeError(
            `Value for relevantDate must be a valid Date, received ${v.toString()}`,
          );
        this.fields.relevantDate = v;
      } else if (typeof v === 'string') {
        if (isValidW3CDateString(v)) this.fields.relevantDate = v;
        else {
          const date = new Date(v);
          if (!Number.isFinite(date.getTime()))
            throw new TypeError(
              `Value for relevantDate must be a valid Date, received ${v}`,
            );
          this.fields.relevantDate = date;
        }
      }
    }
  }

  /**
   * List of dates and date ranges during which the pass is relevant
   * (iOS 18+). Supersedes `relevantDate` for multi-window passes.
   */
  get relevantDates(): ApplePass['relevantDates'] {
    return this.fields.relevantDates;
  }
  set relevantDates(v: ApplePass['relevantDates']) {
    if (!v) delete this.fields.relevantDates;
    else this.fields.relevantDates = v;
  }

  /**
   * Ordered list of visual style schemes the pass opts into (iOS 18+).
   */
  get preferredStyleSchemes(): ApplePass['preferredStyleSchemes'] {
    return this.fields.preferredStyleSchemes;
  }
  set preferredStyleSchemes(v: ApplePass['preferredStyleSchemes']) {
    if (!v || v.length === 0) delete this.fields.preferredStyleSchemes;
    else this.fields.preferredStyleSchemes = v;
  }

  /**
   * A list of iTunes Store item identifiers for the associated apps.
   * Only one item in the list is used—the first item identifier for an app
   * compatible with the current device.
   * If the app is not installed, the link opens the App Store and shows the app.
   * If the app is already installed, the link launches the app.
   */
  get associatedStoreIdentifiers(): ApplePass['associatedStoreIdentifiers'] {
    return this.fields.associatedStoreIdentifiers;
  }
  set associatedStoreIdentifiers(v: ApplePass['associatedStoreIdentifiers']) {
    if (!v) {
      delete this.fields.associatedStoreIdentifiers;
      return;
    }
    const arrayOfNumbers = v.filter(n => Number.isInteger(n));
    if (arrayOfNumbers.length > 0)
      this.fields.associatedStoreIdentifiers = arrayOfNumbers;
    else delete this.fields.associatedStoreIdentifiers;
  }

  /**
   * A URL the system passes to the associated app from
   * `associatedStoreIdentifiers` when the pass is opened.
   */
  get appLaunchURL(): ApplePass['appLaunchURL'] {
    return this.fields.appLaunchURL;
  }
  set appLaunchURL(v: ApplePass['appLaunchURL']) {
    if (!v) delete this.fields.appLaunchURL;
    else this.fields.appLaunchURL = v;
  }

  /**
   * Brief description of the pass, used by the iOS accessibility technologies.
   * Don’t try to include all of the data on the pass in its description,
   * just include enough detail to distinguish passes of the same type.
   */
  get description(): string | undefined {
    return this.fields.description;
  }

  set description(v: string | undefined) {
    if (!v) delete this.fields.description;
    else this.fields.description = v;
  }

  /**
   * Machine-readable metadata used by Wallet to offer pass-related actions.
   */
  get semantics(): SemanticTags | undefined {
    return this.fields.semantics;
  }
  set semantics(v: SemanticTags | undefined) {
    if (!v) {
      delete this.fields.semantics;
      return;
    }
    this.fields.semantics = normalizeSemanticTags(v);
  }

  /**
   * Custom information for companion apps. Not displayed to the user.
   */
  get userInfo(): ApplePass['userInfo'] {
    return this.fields.userInfo;
  }
  set userInfo(v: ApplePass['userInfo']) {
    if (v === undefined || v === null) delete this.fields.userInfo;
    else this.fields.userInfo = v;
  }

  /**
   * Contents of `personalization.json`, used by Wallet's NFC reward-card
   * signup flow. The file is only emitted when the final bundle also has a
   * serialized NFC dictionary and a `personalizationLogo*.png` asset.
   */
  get personalization(): Personalization | undefined {
    return this.personalizationData;
  }
  set personalization(v: Personalization | undefined) {
    if (!v) {
      this.personalizationData = undefined;
      return;
    }
    this.personalizationData = validatePersonalization(v);
  }

  /**
   * Display name of the organization that originated and signed the pass.
   */
  get organizationName(): string | undefined {
    return this.fields.organizationName;
  }
  set organizationName(v: string | undefined) {
    if (!v) delete this.fields.organizationName;
    else this.fields.organizationName = v;
  }

  /**
   * Optional for event tickets and boarding passes; otherwise not allowed.
   * Identifier used to group related passes.
   * If a grouping identifier is specified, passes with the same style,
   * pass type identifier, and grouping identifier are displayed as a group.
   * Otherwise, passes are grouped automatically.
   * Use this to group passes that are tightly related,
   * such as the boarding passes for different connections of the same trip.
   */
  get groupingIdentifier(): string | undefined {
    return this.fields.groupingIdentifier;
  }

  set groupingIdentifier(v: string | undefined) {
    if (!v) delete this.fields.groupingIdentifier;
    else this.fields.groupingIdentifier = v;
  }

  /**
   * If true, the strip image is displayed without a shine effect.
   * The default value prior to iOS 7.0 is false.
   * In iOS 7.0, a shine effect is never applied, and this key is deprecated.
   */
  get suppressStripShine(): boolean {
    return !!this.fields.suppressStripShine;
  }
  set suppressStripShine(v: boolean) {
    if (!v) delete this.fields.suppressStripShine;
    else this.fields.suppressStripShine = true;
  }

  /**
   * Text displayed next to the logo on the pass.
   */
  get logoText(): string | undefined {
    return this.fields.logoText;
  }
  set logoText(v: string | undefined) {
    if (!v) delete this.fields.logoText;
    else this.fields.logoText = v;
  }

  /**
   * The URL of a web service that conforms to the API described in PassKit Web Service Reference.
   * The web service must use the HTTPS protocol in production; the leading https:// is included in the value of this key.
   * On devices configured for development, there is UI in Settings to allow HTTP web services. You can use the options
   * parameter to set allowHTTP to be able to use URLs that use the HTTP protocol.
   *
   * @see {@link https://developer.apple.com/library/archive/documentation/PassKit/Reference/PassKit_WebService/WebService.html#//apple_ref/doc/uid/TP40011988}
   */
  get webServiceURL(): URL | string | undefined {
    return this.fields.webServiceURL;
  }
  set webServiceURL(v: URL | string | undefined) {
    if (!v) {
      delete this.fields.webServiceURL;
      return;
    }

    // validating URL, it will throw on bad value
    const url = v instanceof URL ? v : new URL(v);
    const allowHttp = this.options?.allowHttp ?? false;
    if (!allowHttp && url.protocol !== 'https:') {
      throw new TypeError(`webServiceURL must be on HTTPS!`);
    }
    this.fields.webServiceURL = v;
  }

  /**
   * The authentication token to use with the web service.
   * The token must be 16 characters or longer.
   */
  get authenticationToken(): string | undefined {
    return this.fields.authenticationToken;
  }
  set authenticationToken(v: string | undefined) {
    if (!v) {
      delete this.fields.authenticationToken;
      return;
    }

    if (typeof v !== 'string')
      throw new TypeError(
        `authenticationToken must be a string, received ${typeof v}`,
      );
    if (v.length < 16)
      throw new TypeError(
        `authenticationToken must must be 16 characters or longer`,
      );
    this.fields.authenticationToken = v;
  }

  /**
   * Background color of the pass, specified as an CSS-style RGB triple.
   *
   * @example rgb(23, 187, 82)
   */
  get backgroundColor():
    | [number, number, number]
    | string
    | undefined
    | PassColor {
    if (!(this.fields.backgroundColor instanceof PassColor)) return undefined;
    return this.fields.backgroundColor;
  }
  set backgroundColor(
    v: string | [number, number, number] | undefined | PassColor,
  ) {
    if (!v) {
      delete this.fields.backgroundColor;
      return;
    }
    if (!(this.fields.backgroundColor instanceof PassColor))
      this.fields.backgroundColor = new PassColor(v);
    else this.fields.backgroundColor.set(v);
  }

  /**
   * Foreground color of the pass, specified as a CSS-style RGB triple.
   *
   * @example rgb(100, 10, 110)
   */
  get foregroundColor():
    | [number, number, number]
    | string
    | undefined
    | PassColor {
    if (!(this.fields.foregroundColor instanceof PassColor)) return undefined;
    return this.fields.foregroundColor;
  }
  set foregroundColor(
    v: string | [number, number, number] | PassColor | undefined,
  ) {
    if (!v) {
      delete this.fields.foregroundColor;
      return;
    }
    if (!(this.fields.foregroundColor instanceof PassColor))
      this.fields.foregroundColor = new PassColor(v);
    else this.fields.foregroundColor.set(v);
  }

  /**
   * Color of the label text, specified as a CSS-style RGB triple.
   *
   * @example rgb(255, 255, 255)
   */
  get labelColor(): [number, number, number] | string | undefined | PassColor {
    if (!(this.fields.labelColor instanceof PassColor)) return undefined;
    return this.fields.labelColor;
  }
  set labelColor(v: string | [number, number, number] | PassColor | undefined) {
    if (!v) {
      delete this.fields.labelColor;
      return;
    }
    if (!(this.fields.labelColor instanceof PassColor))
      this.fields.labelColor = new PassColor(v);
    else this.fields.labelColor.set(v);
  }

  /**
   * Color of the strip text, specified as a CSS-style RGB triple.
   *
   * @example rgb(255, 255, 255)
   */
  get stripColor(): [number, number, number] | string | undefined | PassColor {
    if (!(this.fields.stripColor instanceof PassColor)) return undefined;
    return this.fields.stripColor;
  }
  set stripColor(v: string | [number, number, number] | PassColor | undefined) {
    if (!v) {
      delete this.fields.stripColor;
      return;
    }
    if (!(this.fields.stripColor instanceof PassColor))
      this.fields.stripColor = new PassColor(v);
    else this.fields.stripColor.set(v);
  }

  /**
   * Maximum distance in meters from a relevant latitude and longitude that the pass is relevant.
   * This number is compared to the pass’s default distance and the smaller value is used.
   */
  get maxDistance(): number | undefined {
    return this.fields.maxDistance;
  }
  set maxDistance(v: number | undefined) {
    if (!v) {
      delete this.fields.maxDistance;
      return;
    }
    if (!Number.isInteger(v))
      throw new TypeError(
        'maxDistance must be a positive integer distance in meters!',
      );
    this.fields.maxDistance = v;
  }

  /**
   * Beacons marking locations where the pass is relevant.
   */
  get beacons(): ApplePass['beacons'] {
    return this.fields.beacons;
  }
  set beacons(v: ApplePass['beacons']) {
    if (!v || !Array.isArray(v)) {
      delete this.fields.beacons;
      return;
    }
    for (const beacon of v) {
      if (!beacon.proximityUUID)
        throw new TypeError(`each beacon must contain proximityUUID`);
    }
    // copy array
    this.fields.beacons = [...v];
  }

  /**
   * Information specific to the pass’s barcode.
   * The system uses the first valid barcode dictionary in the array.
   * Additional dictionaries can be added as fallbacks.
   */
  get barcodes(): ApplePass['barcodes'] {
    return this.fields.barcodes;
  }
  set barcodes(v: ApplePass['barcodes']) {
    if (!v) {
      delete this.fields.barcodes;
      delete this.fields.barcode;
      return;
    }

    if (!Array.isArray(v))
      throw new TypeError(`barcodes must be an Array, received ${typeof v}`);

    // Barcodes dictionary: https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/LowerLevel.html#//apple_ref/doc/uid/TP40012026-CH3-SW3
    for (const barcode of v) {
      if (!BARCODES_FORMAT.has(barcode.format))
        throw new TypeError(
          `Barcode format value ${barcode.format} is invalid!`,
        );
      if (typeof barcode.message !== 'string')
        throw new TypeError('Barcode message string is required');
      if (typeof barcode.messageEncoding !== 'string')
        throw new TypeError('Barcode messageEncoding is required');
    }

    // copy array
    this.fields.barcodes = [...v];
  }

  /**
   * Adds a location where a pass is relevant.
   *
   * @param {number[] | { lat: number, lng: number, alt?: number } | { longitude: number, latitude: number, altitude?: number }} point
   * @param {string} [relevantText]
   * @returns {this}
   */
  addLocation(
    point:
      | number[]
      | { lat: number; lng: number; alt?: number }
      | { longitude: number; latitude: number; altitude?: number },
    relevantText?: string,
  ): this {
    const { longitude, latitude, altitude } = getGeoPoint(point);
    const location: import('../interfaces.js').Location = {
      longitude,
      latitude,
    };
    if (altitude) location.altitude = altitude;
    if (typeof relevantText === 'string') location.relevantText = relevantText;
    if (!Array.isArray(this.fields.locations))
      this.fields.locations = [location];
    else this.fields.locations.push(location);
    return this;
  }

  get locations(): ApplePass['locations'] {
    return this.fields.locations;
  }

  set locations(v: ApplePass['locations']) {
    delete this.fields.locations;
    if (!v) return;
    if (!Array.isArray(v)) throw new TypeError(`locations must be an array`);
    else
      for (const location of v)
        this.addLocation(location, location.relevantText);
  }

  // ─── iOS 18 event-ticket: Event Guide URL keys ─────────────────────────
  // 12 optional URL fields. `new URL(v)` validates shape only — no scheme
  // restriction (Apple recommends https but mailto/tel/custom schemes are
  // accepted in the wild). Contact email and phone are plain strings
  // (below); they are not URLs.

  get bagPolicyURL(): string | undefined {
    return this.fields.bagPolicyURL;
  }
  set bagPolicyURL(v: string | undefined) {
    if (!v) {
      delete this.fields.bagPolicyURL;
      return;
    }
    void new URL(v);
    this.fields.bagPolicyURL = v;
  }

  get orderFoodURL(): string | undefined {
    return this.fields.orderFoodURL;
  }
  set orderFoodURL(v: string | undefined) {
    if (!v) {
      delete this.fields.orderFoodURL;
      return;
    }
    void new URL(v);
    this.fields.orderFoodURL = v;
  }

  get parkingInformationURL(): string | undefined {
    return this.fields.parkingInformationURL;
  }
  set parkingInformationURL(v: string | undefined) {
    if (!v) {
      delete this.fields.parkingInformationURL;
      return;
    }
    void new URL(v);
    this.fields.parkingInformationURL = v;
  }

  get directionsInformationURL(): string | undefined {
    return this.fields.directionsInformationURL;
  }
  set directionsInformationURL(v: string | undefined) {
    if (!v) {
      delete this.fields.directionsInformationURL;
      return;
    }
    void new URL(v);
    this.fields.directionsInformationURL = v;
  }

  get purchaseParkingURL(): string | undefined {
    return this.fields.purchaseParkingURL;
  }
  set purchaseParkingURL(v: string | undefined) {
    if (!v) {
      delete this.fields.purchaseParkingURL;
      return;
    }
    void new URL(v);
    this.fields.purchaseParkingURL = v;
  }

  get merchandiseURL(): string | undefined {
    return this.fields.merchandiseURL;
  }
  set merchandiseURL(v: string | undefined) {
    if (!v) {
      delete this.fields.merchandiseURL;
      return;
    }
    void new URL(v);
    this.fields.merchandiseURL = v;
  }

  get transitInformationURL(): string | undefined {
    return this.fields.transitInformationURL;
  }
  set transitInformationURL(v: string | undefined) {
    if (!v) {
      delete this.fields.transitInformationURL;
      return;
    }
    void new URL(v);
    this.fields.transitInformationURL = v;
  }

  get accessibilityURL(): string | undefined {
    return this.fields.accessibilityURL;
  }
  set accessibilityURL(v: string | undefined) {
    if (!v) {
      delete this.fields.accessibilityURL;
      return;
    }
    void new URL(v);
    this.fields.accessibilityURL = v;
  }

  get addOnURL(): string | undefined {
    return this.fields.addOnURL;
  }
  set addOnURL(v: string | undefined) {
    if (!v) {
      delete this.fields.addOnURL;
      return;
    }
    void new URL(v);
    this.fields.addOnURL = v;
  }

  get contactVenueWebsite(): string | undefined {
    return this.fields.contactVenueWebsite;
  }
  set contactVenueWebsite(v: string | undefined) {
    if (!v) {
      delete this.fields.contactVenueWebsite;
      return;
    }
    void new URL(v);
    this.fields.contactVenueWebsite = v;
  }

  get transferURL(): string | undefined {
    return this.fields.transferURL;
  }
  set transferURL(v: string | undefined) {
    if (!v) {
      delete this.fields.transferURL;
      return;
    }
    void new URL(v);
    this.fields.transferURL = v;
  }

  get sellURL(): string | undefined {
    return this.fields.sellURL;
  }
  set sellURL(v: string | undefined) {
    if (!v) {
      delete this.fields.sellURL;
      return;
    }
    void new URL(v);
    this.fields.sellURL = v;
  }

  // ─── iOS 18 event-ticket: plain-string keys ────────────────────────────
  // Not URLs; stored as strings with delete-on-empty semantics.

  get contactVenueEmail(): string | undefined {
    return this.fields.contactVenueEmail;
  }
  set contactVenueEmail(v: string | undefined) {
    if (!v) delete this.fields.contactVenueEmail;
    else this.fields.contactVenueEmail = v;
  }

  get contactVenuePhoneNumber(): string | undefined {
    return this.fields.contactVenuePhoneNumber;
  }
  set contactVenuePhoneNumber(v: string | undefined) {
    if (!v) delete this.fields.contactVenuePhoneNumber;
    else this.fields.contactVenuePhoneNumber = v;
  }

  get eventLogoText(): string | undefined {
    return this.fields.eventLogoText;
  }
  set eventLogoText(v: string | undefined) {
    if (!v) delete this.fields.eventLogoText;
    else this.fields.eventLogoText = v;
  }

  // ─── iOS 18 event-ticket: styling + misc ──────────────────────────────

  get suppressHeaderDarkening(): boolean {
    return !!this.fields.suppressHeaderDarkening;
  }
  set suppressHeaderDarkening(v: boolean) {
    if (!v) delete this.fields.suppressHeaderDarkening;
    else this.fields.suppressHeaderDarkening = true;
  }

  get useAutomaticColors(): boolean {
    return !!this.fields.useAutomaticColors;
  }
  set useAutomaticColors(v: boolean) {
    if (!v) delete this.fields.useAutomaticColors;
    else this.fields.useAutomaticColors = true;
  }

  // Overrides the chin/footer color in the new event-ticket layout.
  // Uses the same PassColor machinery as backgroundColor.
  get footerBackgroundColor():
    | [number, number, number]
    | string
    | undefined
    | PassColor {
    if (!(this.fields.footerBackgroundColor instanceof PassColor))
      return undefined;
    return this.fields.footerBackgroundColor;
  }
  set footerBackgroundColor(
    v: string | [number, number, number] | undefined | PassColor,
  ) {
    if (!v) {
      delete this.fields.footerBackgroundColor;
      return;
    }
    if (!(this.fields.footerBackgroundColor instanceof PassColor))
      this.fields.footerBackgroundColor = new PassColor(v);
    else this.fields.footerBackgroundColor.set(v);
  }

  // Secondary App Store IDs; filter to integers like
  // associatedStoreIdentifiers does (drop non-integer / non-number entries).
  get auxiliaryStoreIdentifiers(): ApplePass['auxiliaryStoreIdentifiers'] {
    return this.fields.auxiliaryStoreIdentifiers;
  }
  set auxiliaryStoreIdentifiers(v: ApplePass['auxiliaryStoreIdentifiers']) {
    if (!v) {
      delete this.fields.auxiliaryStoreIdentifiers;
      return;
    }
    const arrayOfNumbers = v.filter(n => Number.isInteger(n));
    if (arrayOfNumbers.length > 0)
      this.fields.auxiliaryStoreIdentifiers = arrayOfNumbers;
    else delete this.fields.auxiliaryStoreIdentifiers;
  }

  // ─── iOS 26 enhanced / semantic boarding pass: URL keys ───────────────

  get changeSeatURL(): string | undefined {
    return this.fields.changeSeatURL;
  }
  set changeSeatURL(v: string | undefined) {
    if (!v) {
      delete this.fields.changeSeatURL;
      return;
    }
    void new URL(v);
    this.fields.changeSeatURL = v;
  }

  get entertainmentURL(): string | undefined {
    return this.fields.entertainmentURL;
  }
  set entertainmentURL(v: string | undefined) {
    if (!v) {
      delete this.fields.entertainmentURL;
      return;
    }
    void new URL(v);
    this.fields.entertainmentURL = v;
  }

  get purchaseAdditionalBaggageURL(): string | undefined {
    return this.fields.purchaseAdditionalBaggageURL;
  }
  set purchaseAdditionalBaggageURL(v: string | undefined) {
    if (!v) {
      delete this.fields.purchaseAdditionalBaggageURL;
      return;
    }
    void new URL(v);
    this.fields.purchaseAdditionalBaggageURL = v;
  }

  get purchaseLoungeAccessURL(): string | undefined {
    return this.fields.purchaseLoungeAccessURL;
  }
  set purchaseLoungeAccessURL(v: string | undefined) {
    if (!v) {
      delete this.fields.purchaseLoungeAccessURL;
      return;
    }
    void new URL(v);
    this.fields.purchaseLoungeAccessURL = v;
  }

  get purchaseWifiURL(): string | undefined {
    return this.fields.purchaseWifiURL;
  }
  set purchaseWifiURL(v: string | undefined) {
    if (!v) {
      delete this.fields.purchaseWifiURL;
      return;
    }
    void new URL(v);
    this.fields.purchaseWifiURL = v;
  }

  get upgradeURL(): string | undefined {
    return this.fields.upgradeURL;
  }
  set upgradeURL(v: string | undefined) {
    if (!v) {
      delete this.fields.upgradeURL;
      return;
    }
    void new URL(v);
    this.fields.upgradeURL = v;
  }

  get managementURL(): string | undefined {
    return this.fields.managementURL;
  }
  set managementURL(v: string | undefined) {
    if (!v) {
      delete this.fields.managementURL;
      return;
    }
    void new URL(v);
    this.fields.managementURL = v;
  }

  get registerServiceAnimalURL(): string | undefined {
    return this.fields.registerServiceAnimalURL;
  }
  set registerServiceAnimalURL(v: string | undefined) {
    if (!v) {
      delete this.fields.registerServiceAnimalURL;
      return;
    }
    void new URL(v);
    this.fields.registerServiceAnimalURL = v;
  }

  get reportLostBagURL(): string | undefined {
    return this.fields.reportLostBagURL;
  }
  set reportLostBagURL(v: string | undefined) {
    if (!v) {
      delete this.fields.reportLostBagURL;
      return;
    }
    void new URL(v);
    this.fields.reportLostBagURL = v;
  }

  get requestWheelchairURL(): string | undefined {
    return this.fields.requestWheelchairURL;
  }
  set requestWheelchairURL(v: string | undefined) {
    if (!v) {
      delete this.fields.requestWheelchairURL;
      return;
    }
    void new URL(v);
    this.fields.requestWheelchairURL = v;
  }

  get transitProviderWebsiteURL(): string | undefined {
    return this.fields.transitProviderWebsiteURL;
  }
  set transitProviderWebsiteURL(v: string | undefined) {
    if (!v) {
      delete this.fields.transitProviderWebsiteURL;
      return;
    }
    void new URL(v);
    this.fields.transitProviderWebsiteURL = v;
  }

  // iOS 26 transit provider — contact fields (plain strings, not URLs)

  get transitProviderEmail(): string | undefined {
    return this.fields.transitProviderEmail;
  }
  set transitProviderEmail(v: string | undefined) {
    if (!v) delete this.fields.transitProviderEmail;
    else this.fields.transitProviderEmail = v;
  }

  get transitProviderPhoneNumber(): string | undefined {
    return this.fields.transitProviderPhoneNumber;
  }
  set transitProviderPhoneNumber(v: string | undefined) {
    if (!v) delete this.fields.transitProviderPhoneNumber;
    else this.fields.transitProviderPhoneNumber = v;
  }

  // ─── iOS 26 poster event ticket: upcomingPassInformation ──────────────
  // Setter validates per-entry shape (identifier / name / type / image
  // URLs + SHA256 + size). The cross-field check that the pass is an
  // eventTicket opted into `posterEventTicket` runs at pass-build time
  // in `Pass.validate()` via `assertUpcomingPassInformationContext`,
  // so hydrating a pass from a plain object whose keys happen to put
  // `upcomingPassInformation` before `preferredStyleSchemes` doesn't
  // throw during construction. Dates inside `dateInformation.date` are
  // normalized to W3C strings by `normalizeDatesDeep` at toJSON time
  // (see PassBase.toJSON above).

  get upcomingPassInformation(): UpcomingPassInformationEntry[] | undefined {
    return this.fields.upcomingPassInformation;
  }
  set upcomingPassInformation(v: UpcomingPassInformationEntry[] | undefined) {
    if (!v) {
      delete this.fields.upcomingPassInformation;
      return;
    }
    this.fields.upcomingPassInformation =
      validateUpcomingPassInformationEntries(v);
  }
}
