// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PassBase } from '../dist/lib/base-pass.js';
import type { UpcomingPassInformationEntry } from '../dist/lib/upcoming-pass-information.js';

// Valid 64-char lowercase-hex digest used across tests.
const SHA256 = 'a'.repeat(
  64,
) as UpcomingPassInformationEntry['images'] extends object ? string : string;

function baseEntry(
  overrides: Partial<UpcomingPassInformationEntry> = {},
): UpcomingPassInformationEntry {
  return {
    identifier: 'evt-1',
    name: 'Opening Night',
    type: 'event',
    ...overrides,
  };
}

describe('upcomingPassInformation', () => {
  it('valid entry round-trips, dates inside dateInformation are normalized', () => {
    const eventDate = new Date(Date.UTC(2026, 5, 1, 19, 0, 0));
    const bp = new PassBase({ eventTicket: {} });
    bp.preferredStyleSchemes = ['posterEventTicket'];
    bp.upcomingPassInformation = [
      baseEntry({
        dateInformation: {
          date: eventDate,
          timeZone: 'America/New_York',
        },
        images: {
          headerImage: {
            URLs: [
              {
                URL: 'https://cdn.example/header@2x.png',
                SHA256,
                scale: 2,
                size: 1000,
              },
            ],
          },
        },
      }),
    ];
    const json = JSON.parse(JSON.stringify(bp));
    assert.equal(json.upcomingPassInformation.length, 1);
    const entry = json.upcomingPassInformation[0];
    assert.equal(entry.identifier, 'evt-1');
    assert.equal(entry.name, 'Opening Night');
    assert.equal(entry.type, 'event');
    // Date normalized by normalizeDatesDeep at toJSON time.
    assert.match(
      entry.dateInformation.date,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2}|Z)$/,
    );
    assert.equal(entry.images.headerImage.URLs[0].SHA256, SHA256);
  });

  it('throws when pass style is not eventTicket', () => {
    const bp = new PassBase({ storeCard: {} });
    bp.preferredStyleSchemes = ['posterEventTicket'];
    assert.throws(() => {
      bp.upcomingPassInformation = [baseEntry()];
    }, /requires style "eventTicket"/);
  });

  it('throws when preferredStyleSchemes is missing posterEventTicket', () => {
    const bp = new PassBase({ eventTicket: {} });
    bp.preferredStyleSchemes = ['eventTicket'];
    assert.throws(() => {
      bp.upcomingPassInformation = [baseEntry()];
    }, /preferredStyleSchemes to include "posterEventTicket"/);
  });

  it('throws when preferredStyleSchemes is unset', () => {
    const bp = new PassBase({ eventTicket: {} });
    assert.throws(() => {
      bp.upcomingPassInformation = [baseEntry()];
    }, /preferredStyleSchemes to include "posterEventTicket"/);
  });

  it('throws when identifier is empty', () => {
    const bp = new PassBase({ eventTicket: {} });
    bp.preferredStyleSchemes = ['posterEventTicket'];
    assert.throws(() => {
      bp.upcomingPassInformation = [baseEntry({ identifier: '' })];
    }, /\.identifier must be a non-empty string/);
  });

  it('throws when name is missing', () => {
    const bp = new PassBase({ eventTicket: {} });
    bp.preferredStyleSchemes = ['posterEventTicket'];
    assert.throws(() => {
      bp.upcomingPassInformation = [
        baseEntry({
          name: undefined as unknown as string,
        }),
      ];
    }, /\.name must be a non-empty string/);
  });

  it('throws when type is not "event"', () => {
    const bp = new PassBase({ eventTicket: {} });
    bp.preferredStyleSchemes = ['posterEventTicket'];
    assert.throws(() => {
      bp.upcomingPassInformation = [
        baseEntry({
          type: 'session' as unknown as 'event',
        }),
      ];
    }, /\.type must be "event"/);
  });

  it('throws on bad SHA256', () => {
    const bp = new PassBase({ eventTicket: {} });
    bp.preferredStyleSchemes = ['posterEventTicket'];
    assert.throws(() => {
      bp.upcomingPassInformation = [
        baseEntry({
          images: {
            headerImage: {
              URLs: [
                {
                  URL: 'https://cdn.example/header.png',
                  SHA256: 'a'.repeat(63), // 63 chars = invalid
                },
              ],
            },
          },
        }),
      ];
    }, /SHA256 must be a 64-char hex string/);
  });

  it('throws on oversize image (> 2 MiB)', () => {
    const bp = new PassBase({ eventTicket: {} });
    bp.preferredStyleSchemes = ['posterEventTicket'];
    assert.throws(() => {
      bp.upcomingPassInformation = [
        baseEntry({
          images: {
            headerImage: {
              URLs: [
                {
                  URL: 'https://cdn.example/header.png',
                  SHA256,
                  size: 2 * 1024 * 1024 + 1,
                },
              ],
            },
          },
        }),
      ];
    }, /size exceeds 2 MiB/);
  });

  it('throws on malformed image URL', () => {
    const bp = new PassBase({ eventTicket: {} });
    bp.preferredStyleSchemes = ['posterEventTicket'];
    assert.throws(() => {
      bp.upcomingPassInformation = [
        baseEntry({
          images: {
            headerImage: {
              URLs: [{ URL: 'not a url', SHA256 }],
            },
          },
        }),
      ];
    }); // `new URL` throws TypeError
  });

  it('throws on empty image URLs array', () => {
    const bp = new PassBase({ eventTicket: {} });
    bp.preferredStyleSchemes = ['posterEventTicket'];
    assert.throws(() => {
      bp.upcomingPassInformation = [
        baseEntry({
          images: {
            headerImage: { URLs: [] },
          },
        }),
      ];
    }, /images\.headerImage\.URLs must be a non-empty array/);
  });

  it('clears via undefined', () => {
    const bp = new PassBase({ eventTicket: {} });
    bp.preferredStyleSchemes = ['posterEventTicket'];
    bp.upcomingPassInformation = [baseEntry()];
    assert.equal(bp.upcomingPassInformation?.length, 1);
    bp.upcomingPassInformation = undefined;
    assert.equal(bp.upcomingPassInformation, undefined);
    const json = JSON.parse(JSON.stringify(bp));
    assert.equal(json.upcomingPassInformation, undefined);
  });
});
