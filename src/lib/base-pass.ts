import { ApplePass } from '../interfaces';
import { BARCODES_FORMAT, STRUCTURE_FIELDS } from '../constants';

import { PassColor } from './pass-color';
import { PassImages } from './images';
import { Localizations } from './localizations';
import { getGeoPoint } from './get-geo-point';
import { PassStructure } from './pass-structure';

const STRUCTURE_FIELDS_SET = new Set([...STRUCTURE_FIELDS, 'nfc']);

export class PassBase extends PassStructure {
  images: PassImages;
  protected localization = new Localizations();

  constructor(fields: Partial<ApplePass> = {}, images?: PassImages) {
    super(fields);

    // restore via setters
    for (const [key, value] of Object.entries(fields)) {
      if (!STRUCTURE_FIELDS_SET.has(key) && key in this) {
        this[key] = value;
      }
    }

    // copy images
    this.images = new PassImages(images);
  }

  // Returns the pass.json object (not a string).
  toJSON(): Partial<ApplePass> {
    return { ...this.fields, formatVersion: 1 };
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
      if (typeof v === 'string' || v instanceof Date)
        this.fields.expirationDate = v;
      else
        throw new TypeError(
          `expirationDate should be either string or Date, received ${typeof v}`,
        );
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
      if (typeof v === 'string' || v instanceof Date)
        this.fields.relevantDate = v;
      else
        throw new TypeError(
          `relevantDate should be either string or Date, received ${typeof v}`,
        );
    }
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
   * The web service must use the HTTPS protocol; the leading https:// is included in the value of this key.
   * On devices configured for development, there is UI in Settings to allow HTTP web services.
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
    if (url.protocol !== 'https:')
      throw new TypeError(`webServiceURL must be on HTTPS!`);
    this.fields.webServiceURL = url;
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
    return this.fields.backgroundColor.getRGB();
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
    return this.fields.foregroundColor.getRGB();
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
    return this.fields.labelColor.getRGB();
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
    if (!Number.isInteger)
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
    const location: import('../interfaces').Location = {
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
    else for (const location of v) this.addLocation(location);
  }
}
