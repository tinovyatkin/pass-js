// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

// iOS 26 `upcomingPassInformation` — declares future events chained to a
// poster-event-ticket pass. Only valid when:
//   - pass style is `eventTicket`
//   - `preferredStyleSchemes` includes `'posterEventTicket'`
// Dates inside `dateInformation.date` serialize to W3C strings via the
// existing `normalizeDatesDeep` walker inside `PassBase.toJSON()`; no
// normalization is done at assignment time.
//
// See https://developer.apple.com/documentation/walletpasses/upcomingpassinformationentry

import type { ApplePass, Field, SemanticTags } from '../interfaces.js';

// Apple caps remote image downloads at 2 MiB per entry.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const SHA256_HEX = /^[0-9a-f]{64}$/i;

/** An individual density variant of a remote image. */
export interface ImageURLEntry {
  /** HTTPS URL Wallet downloads at render time. */
  URL: string;
  /** Lowercase-hex SHA-256 of the downloaded bytes. */
  SHA256: string;
  /** 1, 2, or 3. Defaults to 1 when unspecified. */
  scale?: 1 | 2 | 3;
  /** Byte size of the image; must not exceed 2 MiB. */
  size?: number;
}

/** Remote image dictionary with one or more density variants. */
export interface Image {
  URLs: ImageURLEntry[];
  /** When `true`, Wallet may reuse a matching local asset if available. */
  reuseExisting?: boolean;
}

/** Image slots recognized for an upcoming pass information entry. */
export interface Images {
  headerImage?: Image;
  venueMap?: Image;
}

/**
 * URLs embedded in the upcoming entry's event guide. Mirrors the 14
 * pass-level `PassEventTicketKeys` URL fields.
 */
export interface UpcomingURLs {
  accessibilityURL?: string;
  addOnURL?: string;
  bagPolicyURL?: string;
  contactVenueEmail?: string;
  contactVenuePhoneNumber?: string;
  contactVenueWebsite?: string;
  directionsInformationURL?: string;
  merchandiseURL?: string;
  orderFoodURL?: string;
  parkingInformationURL?: string;
  purchaseParkingURL?: string;
  sellURL?: string;
  transferURL?: string;
  transitInformationURL?: string;
}

/** Structured date metadata for an upcoming event. */
export interface DateInformation {
  /** ISO-8601 / W3C string or `Date`. Required. */
  date: string | Date;
  /** IANA time zone name (e.g. `America/New_York`). */
  timeZone?: string;
  /** When `true`, the pass displays only the date, not the time. */
  ignoreTimeComponents?: boolean;
  /** When `true`, the system treats the event as all-day. */
  isAllDay?: boolean;
  /** When `true`, the pass shows "Time TBA". */
  isUnannounced?: boolean;
  /** When `true`, the pass shows the date as undetermined. */
  isUndetermined?: boolean;
}

/**
 * Per-entry semantic tags. Uses the pass-level `SemanticTags` shape plus
 * the MapKit Place ID field unique to upcoming entries.
 */
export type UpcomingEntrySemantics = SemanticTags & {
  venuePlaceID?: string;
};

export type UpcomingPassInformationType = 'event';

/** A single upcoming pass information entry. */
export interface UpcomingPassInformationEntry {
  /** Stable unique identifier; Wallet uses this to chain updates. */
  identifier: string;
  /** Human-readable name of the upcoming event. */
  name: string;
  /** Must equal `'event'` (reserved for future values). */
  type: UpcomingPassInformationType;
  /** Fields shown on the entry's details view. */
  additionalInfoFields?: Field[];
  /**
   * App Store identifiers associated with this specific upcoming entry.
   * The first ID compatible with the device is used.
   */
  auxiliaryStoreIdentifiers?: number[];
  /** Fields shown on the back of the entry's details view. */
  backFields?: Field[];
  /** Start/end timing metadata; if omitted, entry is labeled TBD. */
  dateInformation?: DateInformation;
  /** Remote images to render in the details view. */
  images?: Images;
  /** When `true`, the entry is currently active. Defaults to `false`. */
  isActive?: boolean;
  /** Per-entry semantic tags. */
  semantics?: UpcomingEntrySemantics;
  /** URLs for the event guide of this upcoming entry. */
  URLs?: UpcomingURLs;
}

/**
 * Validates a full `upcomingPassInformation` payload against the iOS 26
 * spec. Throws `TypeError` on any rule violation; returns the input
 * array unchanged on success so the caller can inline the result.
 *
 * Runtime-only — static types in `UpcomingPassInformationEntry` already
 * steer correct shapes; these checks catch cases where consumers build
 * entries dynamically or cast through `any`.
 */
export function validateUpcomingPassInformation(
  value: UpcomingPassInformationEntry[],
  pass: Partial<ApplePass>,
): UpcomingPassInformationEntry[] {
  if (!Array.isArray(value))
    throw new TypeError('upcomingPassInformation must be an array');

  if (!('eventTicket' in pass))
    throw new TypeError('upcomingPassInformation requires style "eventTicket"');

  const schemes = pass.preferredStyleSchemes;
  if (!Array.isArray(schemes) || !schemes.includes('posterEventTicket'))
    throw new TypeError(
      'upcomingPassInformation requires preferredStyleSchemes to include "posterEventTicket"',
    );

  for (const [i, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object')
      throw new TypeError(`upcomingPassInformation[${i}] must be an object`);

    if (typeof entry.identifier !== 'string' || entry.identifier.length === 0)
      throw new TypeError(
        `upcomingPassInformation[${i}].identifier must be a non-empty string`,
      );

    if (typeof entry.name !== 'string' || entry.name.length === 0)
      throw new TypeError(
        `upcomingPassInformation[${i}].name must be a non-empty string`,
      );

    if (entry.type !== 'event')
      throw new TypeError(`upcomingPassInformation[${i}].type must be "event"`);

    if (entry.images) {
      for (const slot of Object.keys(entry.images) as (keyof Images)[]) {
        const img = entry.images[slot];
        if (!img) continue;
        if (!Array.isArray(img.URLs) || img.URLs.length === 0)
          throw new TypeError(
            `upcomingPassInformation[${i}].images.${slot}.URLs must be a non-empty array`,
          );
        for (const [j, url] of img.URLs.entries()) {
          if (typeof url.URL !== 'string')
            throw new TypeError(
              `upcomingPassInformation[${i}].images.${slot}.URLs[${j}].URL must be a string`,
            );
          // URL shape validation (throws on malformed); no scheme restriction.
          void new URL(url.URL);
          if (typeof url.SHA256 !== 'string' || !SHA256_HEX.test(url.SHA256))
            throw new TypeError(
              `upcomingPassInformation[${i}].images.${slot}.URLs[${j}].SHA256 must be a 64-char hex string`,
            );
          if (typeof url.size === 'number' && url.size > MAX_IMAGE_BYTES)
            throw new TypeError(
              `upcomingPassInformation[${i}].images.${slot}.URLs[${j}].size exceeds 2 MiB`,
            );
        }
      }
    }
  }

  return value;
}
