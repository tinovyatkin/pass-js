import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PassBase } from '../dist/lib/base-pass.js';
import { TOP_LEVEL_FIELDS } from '../dist/constants.js';
import { getW3CDateString } from '../dist/lib/w3cdate.js';

describe('PassBase', () => {
  it('should have all required pass properties', () => {
    // to be able to check NFC property it must be storeCard
    const bp = new PassBase({ storeCard: {} });
    for (const field in TOP_LEVEL_FIELDS) {
      assert.ok(field in bp, `missing property ${field}`);
    }
  });

  it('works with locations', () => {
    const bp = new PassBase();
    assert.equal(bp.locations, undefined);
    bp.addLocation([1, 2]);
    bp.addLocation({ lat: 3, lng: 4 }, 'The point');
    assert.deepEqual(bp.locations, [
      { latitude: 2, longitude: 1 },
      { latitude: 3, longitude: 4, relevantText: 'The point' },
    ]);
  });

  it('works with locations as setter', () => {
    const bp = new PassBase();
    assert.equal(bp.locations, undefined);
    bp.locations = [
      { longitude: 123, latitude: 321, relevantText: 'Test text' },
    ];
    assert.deepEqual(bp.locations, [
      { longitude: 123, latitude: 321, relevantText: 'Test text' },
    ]);
  });

  it('works with beacons', () => {
    const bp = new PassBase();
    bp.beacons = [{ proximityUUID: '1143243' }];
    assert.equal(bp.beacons?.length, 1);
    assert.throws(() => {
      bp.beacons = [{ byaka: 'buka' } as unknown as { proximityUUID: string }];
    }, TypeError);
  });

  it('webServiceURL', () => {
    const bp = new PassBase();
    assert.doesNotThrow(() => {
      bp.webServiceURL = 'https://transfers.do/webservice';
    });
    assert.equal(
      JSON.stringify(bp),
      '{"formatVersion":1,"webServiceURL":"https://transfers.do/webservice"}',
    );
    // should throw on bad url
    assert.throws(() => {
      bp.webServiceURL = '/webservice';
    });

    const bpWithAllowHttpFalse = new PassBase({}, undefined, undefined, {
      allowHttp: false,
    });
    assert.throws(() => {
      bpWithAllowHttpFalse.webServiceURL = 'http://transfers.do/webservice';
    });

    const bpWithAllowHttpTrue = new PassBase({}, undefined, undefined, {
      allowHttp: true,
    });
    assert.doesNotThrow(() => {
      bpWithAllowHttpTrue.webServiceURL = 'http://transfers.do/webservice';
    });
  });

  it('serializes semantic tags at the pass level', () => {
    const eventStartDate = new Date(2026, 0, 2, 3, 4);
    const bp = new PassBase({
      eventTicket: {},
      semantics: {
        eventName: 'Animated Movie',
        eventStartDate,
        totalPrice: { amount: 1250, currencyCode: 'USD' },
        venueLocation: { latitude: 37.330886, longitude: -122.007427 },
      },
    });
    assert.deepEqual(bp.semantics, {
      eventName: 'Animated Movie',
      eventStartDate: getW3CDateString(eventStartDate),
      totalPrice: { amount: 1250, currencyCode: 'USD' },
      venueLocation: { latitude: 37.330886, longitude: -122.007427 },
    });
    assert.match(JSON.stringify(bp), /"semantics"/);
    bp.semantics = undefined;
    assert.equal(bp.semantics, undefined);
  });

  it('rejects invalid Date values in semantics', () => {
    const bp = new PassBase({ eventTicket: {} });
    assert.throws(() => {
      bp.semantics = { eventStartDate: new Date('not a date') };
    }, /Semantic tag Date values must be valid/);
  });

  it('relevantDates + preferredStyleSchemes (iOS 18+)', () => {
    const bp = new PassBase({ eventTicket: {} });
    // starts empty
    assert.equal(bp.relevantDates, undefined);
    assert.equal(bp.preferredStyleSchemes, undefined);

    bp.relevantDates = [
      { relevantDate: '2026-06-01T19:00-07:00' },
      {
        startDate: '2026-06-02T18:00-07:00',
        endDate: '2026-06-02T22:00-07:00',
      },
    ];
    bp.preferredStyleSchemes = ['posterEventTicket', 'eventTicket'];

    const serialized = JSON.parse(JSON.stringify(bp));
    assert.equal(serialized.relevantDates.length, 2);
    assert.deepEqual(serialized.preferredStyleSchemes, [
      'posterEventTicket',
      'eventTicket',
    ]);

    // clearing
    bp.relevantDates = undefined;
    bp.preferredStyleSchemes = [];
    assert.equal(bp.relevantDates, undefined);
    assert.equal(bp.preferredStyleSchemes, undefined);
  });

  it('relevantDates Date entries are normalized to W3C strings', () => {
    const bp = new PassBase({ eventTicket: {} });
    bp.relevantDates = [
      {
        startDate: new Date(Date.UTC(2026, 5, 1, 12, 0, 0)),
        endDate: new Date(Date.UTC(2026, 5, 1, 14, 0, 0)),
      },
    ];
    const out = bp.toJSON() as {
      relevantDates: { startDate: string; endDate: string }[];
    };
    // No milliseconds, no trailing Z — matches the format the rest of
    // the library emits (getW3CDateString style: YYYY-MM-DDTHH:MM±HH:MM).
    assert.ok(typeof out.relevantDates[0].startDate === 'string');
    assert.doesNotMatch(out.relevantDates[0].startDate, /\.\d{3}Z$/);
    assert.match(
      out.relevantDates[0].startDate,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2}|Z)$/,
    );
    // Pre-formatted strings pass through unchanged.
    bp.relevantDates = [{ relevantDate: '2026-06-02T10:00-07:00' }];
    const out2 = bp.toJSON() as {
      relevantDates: { relevantDate: string }[];
    };
    assert.equal(out2.relevantDates[0].relevantDate, '2026-06-02T10:00-07:00');
  });

  it('semantics shared subtrees are not mistaken for cycles', () => {
    const bp = new PassBase({ eventTicket: {} });
    // The same location object used twice — acyclic, should serialize.
    const venue = { latitude: 37.330886, longitude: -122.007427 };
    bp.semantics = {
      venueLocation: venue,
      departureLocation: venue,
    };
    assert.deepEqual(bp.semantics, {
      venueLocation: venue,
      departureLocation: venue,
    });
  });

  it('semantics actual cycles still throw', () => {
    const bp = new PassBase({ eventTicket: {} });
    const loop: Record<string, unknown> = {};
    loop['self'] = loop;
    assert.throws(() => {
      bp.semantics = loop as Record<string, never>;
    }, /cyclic references/);
  });

  it('appLaunchURL get/set', () => {
    const bp = new PassBase();
    assert.equal(bp.appLaunchURL, undefined);
    bp.appLaunchURL = 'mybrand://open/pass/abc';
    assert.equal(bp.appLaunchURL, 'mybrand://open/pass/abc');
    assert.match(
      JSON.stringify(bp),
      /"appLaunchURL":"mybrand:\/\/open\/pass\/abc"/,
    );
    bp.appLaunchURL = undefined;
    assert.equal(bp.appLaunchURL, undefined);
  });

  it('userInfo round-trips through toJSON and clears on undefined', () => {
    const bp = new PassBase();
    assert.equal(bp.userInfo, undefined);
    bp.userInfo = { foo: 'bar', num: 42, nested: { a: [1, 2, 3] } };
    assert.deepEqual(bp.userInfo, {
      foo: 'bar',
      num: 42,
      nested: { a: [1, 2, 3] },
    });
    const json = JSON.parse(JSON.stringify(bp));
    assert.deepEqual(json.userInfo, {
      foo: 'bar',
      num: 42,
      nested: { a: [1, 2, 3] },
    });
    bp.userInfo = undefined;
    assert.equal(bp.userInfo, undefined);
    assert.equal(JSON.parse(JSON.stringify(bp)).userInfo, undefined);
    // hydration from constructor fields
    const bp2 = new PassBase({ userInfo: { token: 'xyz' } });
    assert.deepEqual(bp2.userInfo, { token: 'xyz' });
  });

  it('userInfo is deep-cloned on assignment so callers cannot mutate pass state', () => {
    const source = { token: 'abc', nested: { roles: ['admin'] } };
    const bp = new PassBase();
    bp.userInfo = source;
    source.token = 'mutated';
    source.nested.roles.push('extra');
    assert.deepEqual(bp.userInfo, {
      token: 'abc',
      nested: { roles: ['admin'] },
    });
  });

  it('P0 iOS 18 event-ticket URL setters round-trip', () => {
    const urlFields = [
      'bagPolicyURL',
      'orderFoodURL',
      'parkingInformationURL',
      'directionsInformationURL',
      'purchaseParkingURL',
      'merchandiseURL',
      'transitInformationURL',
      'accessibilityURL',
      'addOnURL',
      'contactVenueWebsite',
      'transferURL',
      'sellURL',
    ] as const;
    const bp = new PassBase({ eventTicket: {} }) as unknown as Record<
      string,
      string | undefined
    >;
    for (const key of urlFields) {
      assert.equal(bp[key], undefined, `${key} should start undefined`);
      const url = `https://example.com/${key}`;
      bp[key] = url;
      assert.equal(bp[key], url, `${key} should persist the set value`);
      assert.match(
        JSON.stringify(bp),
        new RegExp(`"${key}":"https://example.com/${key}"`),
        `${key} should serialize into pass.json`,
      );
      bp[key] = undefined;
      assert.equal(bp[key], undefined, `${key} should clear on undefined`);
    }
    // Malformed URL throws for every setter.
    for (const key of urlFields) {
      assert.throws(
        () => {
          bp[key] = '/not-a-url';
        },
        TypeError,
        `${key} should reject malformed URL`,
      );
    }
  });

  it('P0 iOS 18 event-ticket plain-string setters', () => {
    const bp = new PassBase();
    bp.contactVenueEmail = 'venue@example.com';
    bp.contactVenuePhoneNumber = '+1-555-0100';
    bp.eventLogoText = 'World Cup 2026';
    assert.equal(bp.contactVenueEmail, 'venue@example.com');
    assert.equal(bp.contactVenuePhoneNumber, '+1-555-0100');
    assert.equal(bp.eventLogoText, 'World Cup 2026');
    const json = JSON.parse(JSON.stringify(bp));
    assert.equal(json.contactVenueEmail, 'venue@example.com');
    assert.equal(json.contactVenuePhoneNumber, '+1-555-0100');
    assert.equal(json.eventLogoText, 'World Cup 2026');
    // Delete-on-empty.
    bp.contactVenueEmail = undefined;
    bp.contactVenuePhoneNumber = undefined;
    bp.eventLogoText = undefined;
    const json2 = JSON.parse(JSON.stringify(bp));
    assert.equal(json2.contactVenueEmail, undefined);
    assert.equal(json2.contactVenuePhoneNumber, undefined);
    assert.equal(json2.eventLogoText, undefined);
  });

  it('P0 iOS 18 event-ticket boolean setters', () => {
    const bp = new PassBase();
    assert.equal(bp.suppressHeaderDarkening, false);
    assert.equal(bp.useAutomaticColors, false);
    bp.suppressHeaderDarkening = true;
    bp.useAutomaticColors = true;
    const on = JSON.parse(JSON.stringify(bp));
    assert.equal(on.suppressHeaderDarkening, true);
    assert.equal(on.useAutomaticColors, true);
    // false deletes
    bp.suppressHeaderDarkening = false;
    bp.useAutomaticColors = false;
    const off = JSON.parse(JSON.stringify(bp));
    assert.equal(off.suppressHeaderDarkening, undefined);
    assert.equal(off.useAutomaticColors, undefined);
  });

  it('P0 auxiliaryStoreIdentifiers filters to integers', () => {
    const bp = new PassBase();
    bp.auxiliaryStoreIdentifiers = [1, 2.5, 3, 'x' as unknown as number];
    assert.deepEqual(bp.auxiliaryStoreIdentifiers, [1, 3]);
    // Empty effective array deletes.
    bp.auxiliaryStoreIdentifiers = [2.5, 'x' as unknown as number];
    assert.equal(bp.auxiliaryStoreIdentifiers, undefined);
    bp.auxiliaryStoreIdentifiers = undefined;
    assert.equal(bp.auxiliaryStoreIdentifiers, undefined);
  });

  it('P0 footerBackgroundColor accepts PassColor inputs', () => {
    const bp = new PassBase();
    assert.equal(bp.footerBackgroundColor, undefined);
    bp.footerBackgroundColor = '#FF0000';
    assert.deepEqual(Array.from(bp.footerBackgroundColor!), [255, 0, 0]);
    bp.footerBackgroundColor = 'rgb(0, 128, 0)';
    assert.deepEqual(Array.from(bp.footerBackgroundColor!), [0, 128, 0]);
    bp.footerBackgroundColor = 'navy';
    assert.deepEqual(Array.from(bp.footerBackgroundColor!), [0, 0, 128]);
    assert.throws(() => {
      bp.footerBackgroundColor = 'not-a-color';
    }, /Invalid color value/);
    bp.footerBackgroundColor = undefined;
    assert.equal(bp.footerBackgroundColor, undefined);
  });

  it('P0 additionalInfoFields is gated on eventTicket', () => {
    // storeCard should throw on access
    const store = new PassBase({ storeCard: {} });
    assert.throws(
      () => store.additionalInfoFields,
      /only allowed on eventTicket/,
    );
    // eventTicket should allow add + serialize
    const evt = new PassBase({ eventTicket: {} });
    evt.additionalInfoFields.add({ key: 'info', value: 'See our FAQ' });
    const json = JSON.parse(JSON.stringify(evt));
    assert.deepEqual(json.eventTicket.additionalInfoFields, [
      { key: 'info', value: 'See our FAQ' },
    ]);
    // Constructor-side hydration also works.
    const evt2 = new PassBase({
      eventTicket: {
        additionalInfoFields: [{ key: 'info2', value: 'Rules apply' }],
      },
    });
    assert.equal(evt2.additionalInfoFields.size, 1);
  });

  it('P0 preferredStyleSchemes accepts iOS 26 schemes', () => {
    const bp = new PassBase({
      boardingPass: { transitType: 'PKTransitTypeAir' },
    });
    bp.preferredStyleSchemes = ['semanticBoardingPass', 'boardingPass'];
    const json = JSON.parse(JSON.stringify(bp));
    assert.deepEqual(json.preferredStyleSchemes, [
      'semanticBoardingPass',
      'boardingPass',
    ]);
  });

  it('P0 typed SemanticTags (iOS 18 fields) compile + serialize', () => {
    const eventStart = new Date(Date.UTC(2026, 5, 1, 20, 0, 0));
    const bp = new PassBase({
      eventTicket: {},
      semantics: {
        admissionLevel: 'VIP',
        admissionLevelAbbreviation: 'VIP',
        entranceDescription: 'Main entrance',
        venueOpenDate: eventStart,
        eventStartDateInfo: {
          date: eventStart,
          timeZone: 'America/Chicago',
          unannounced: true,
        },
        seats: [
          {
            seatSection: 'A',
            seatRow: '12',
            seatNumber: '7',
            seatAisle: 'Left',
            seatLevel: '2',
            seatSectionColor: '#FF0000',
          },
        ],
        tailgatingAllowed: true,
      },
    });
    const json = JSON.parse(JSON.stringify(bp));
    assert.equal(json.semantics.admissionLevel, 'VIP');
    assert.equal(json.semantics.tailgatingAllowed, true);
    assert.equal(json.semantics.seats[0].seatSectionColor, '#FF0000');
    // venueOpenDate is a Date in input → W3C string in output.
    assert.match(
      json.semantics.venueOpenDate,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2}|Z)$/,
    );
    assert.equal(json.semantics.eventStartDateInfo.timeZone, 'America/Chicago');
    assert.equal(json.semantics.eventStartDateInfo.unannounced, true);
  });

  it('P1 iOS 26 enhanced boarding-pass URL setters round-trip', () => {
    const urlFields = [
      'changeSeatURL',
      'entertainmentURL',
      'purchaseAdditionalBaggageURL',
      'purchaseLoungeAccessURL',
      'purchaseWifiURL',
      'upgradeURL',
      'managementURL',
      'registerServiceAnimalURL',
      'reportLostBagURL',
      'requestWheelchairURL',
      'transitProviderWebsiteURL',
    ] as const;
    const bp = new PassBase({
      boardingPass: { transitType: 'PKTransitTypeAir' },
    }) as unknown as Record<string, string | undefined>;
    for (const key of urlFields) {
      assert.equal(bp[key], undefined);
      const url = `https://airline.example/${key}`;
      bp[key] = url;
      assert.equal(bp[key], url);
      assert.match(JSON.stringify(bp), new RegExp(`"${key}":"${url}"`));
      bp[key] = undefined;
      assert.equal(bp[key], undefined);
      assert.throws(() => {
        bp[key] = '/nope';
      }, TypeError);
    }
  });

  it('P1 iOS 26 transit provider contact setters', () => {
    const bp = new PassBase({
      boardingPass: { transitType: 'PKTransitTypeAir' },
    });
    bp.transitProviderEmail = 'support@airline.example';
    bp.transitProviderPhoneNumber = '+1-800-FLY-AWAY';
    assert.equal(bp.transitProviderEmail, 'support@airline.example');
    assert.equal(bp.transitProviderPhoneNumber, '+1-800-FLY-AWAY');
    bp.transitProviderEmail = undefined;
    bp.transitProviderPhoneNumber = undefined;
    const json = JSON.parse(JSON.stringify(bp));
    assert.equal(json.transitProviderEmail, undefined);
    assert.equal(json.transitProviderPhoneNumber, undefined);
  });

  it('P1 typed SemanticTags (iOS 26 fields) compile + serialize', () => {
    const bp = new PassBase({
      boardingPass: { transitType: 'PKTransitTypeAir' },
      semantics: {
        boardingZone: '3',
        departureCityName: 'London',
        destinationCityName: 'Shanghai',
        departureLocationTimeZone: 'Europe/London',
        destinationLocationTimeZone: 'Asia/Shanghai',
        passengerCapabilities: [
          'PKPassengerCapabilityPreboarding',
          'PKPassengerCapabilityPriorityBoarding',
        ],
        passengerEligibleSecurityPrograms: [
          'PKTransitSecurityProgramTSAPreCheck',
          'PKTransitSecurityProgramGlobalEntry',
        ],
        departureLocationSecurityPrograms: [
          'PKTransitSecurityProgramTSAPreCheck',
        ],
        destinationLocationSecurityPrograms: ['PKTransitSecurityProgramCLEAR'],
        ticketFareClass: 'Economy',
        membershipProgramStatus: 'Gold',
        loungePlaceIDs: ['I123456', 'I654321'],
        passengerAirlineSSRs: ['MEAL'],
        passengerInformationSSRs: ['FQTV'],
        passengerServiceSSRs: ['WCHR'],
        internationalDocumentsAreVerified: true,
        internationalDocumentsVerifiedDeclarationName: 'DOCS OK',
      },
    });
    const json = JSON.parse(JSON.stringify(bp));
    assert.equal(json.semantics.boardingZone, '3');
    assert.deepEqual(json.semantics.passengerCapabilities, [
      'PKPassengerCapabilityPreboarding',
      'PKPassengerCapabilityPriorityBoarding',
    ]);
    assert.equal(json.semantics.ticketFareClass, 'Economy');
    assert.equal(json.semantics.internationalDocumentsAreVerified, true);
  });

  it('color values as RGB triplets', () => {
    const bp = new PassBase();
    assert.doesNotThrow(() => {
      bp.backgroundColor = 'rgb(125, 125,0)';
    });
    assert.throws(() => {
      bp.labelColor = 'rgba(33, 344,3)';
    });
    assert.throws(() => {
      bp.foregroundColor = 'rgb(33, 0,287)';
    });
    assert.doesNotThrow(() => {
      bp.stripColor = 'rgb(0, 0, 0)';
    });
    // should convert values to rgb
    bp.foregroundColor = 'white';
    assert.deepEqual(Array.from(bp.foregroundColor!), [255, 255, 255]);
    bp.foregroundColor = 'rgb(254, 254, 254)';
    assert.deepEqual(Array.from(bp.foregroundColor!), [254, 254, 254]);
    bp.foregroundColor = '#FFF';
    assert.deepEqual(Array.from(bp.foregroundColor!), [255, 255, 255]);
    bp.foregroundColor = 'rgba(0, 0, 255, 0.4)';
    assert.deepEqual(Array.from(bp.foregroundColor!), [0, 0, 255]);
    bp.foregroundColor = 'rgb(0%, 0%, 100%)';
    assert.deepEqual(Array.from(bp.foregroundColor!), [0, 0, 255]);
    bp.stripColor = 'black';
    assert.deepEqual(Array.from(bp.stripColor!), [0, 0, 0]);
    // should throw on bad color
    assert.throws(() => {
      bp.foregroundColor = 'byaka a ne color';
    }, /Invalid color value/);
  });
});
