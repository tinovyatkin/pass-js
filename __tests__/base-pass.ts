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
