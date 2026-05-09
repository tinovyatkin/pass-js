import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getGeoPoint } from '../dist/lib/get-geo-point.js';

describe('getGeoPoint', () => {
  it('works with 4 numbers array', () => {
    const p = getGeoPoint([14.235, 23.3444, 23.4444]);
    assert.equal(typeof p.longitude, 'number');
    assert.equal(typeof p.latitude, 'number');
    assert.equal(typeof p.altitude, 'number');
  });

  it('throws on bad input', () => {
    assert.throws(() => getGeoPoint([14.235, 'brrrr' as unknown as number, 23.4444]));
    assert.throws(
      () => getGeoPoint({ lat: 1, log: 3 } as unknown as { lat: number; lng: number }),
      /Unknown geo point format/,
    );
  });

  it('works with lat/lng/alt object', () => {
    assert.deepEqual(getGeoPoint({ lat: 1, lng: 2, alt: 3 }), {
      longitude: 2,
      latitude: 1,
      altitude: 3,
    });
  });

  it('works with longitude/latitude object', () => {
    assert.deepEqual(getGeoPoint({ longitude: 10, latitude: 20 }), {
      longitude: 10,
      latitude: 20,
      altitude: undefined,
    });
  });
});
