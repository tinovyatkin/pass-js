import { getGeoPoint } from '../src/lib/get-geo-point';

describe('getGeoPoint', () => {
  it('works with 4 numbers array', () => {
    expect(getGeoPoint([14.235, 23.3444, 23.4444])).toMatchObject({
      longitude: expect.any(Number),
      latitude: expect.any(Number),
      altitude: expect.any(Number),
    });
  });

  it('throws on bad input', () => {
    expect(() => getGeoPoint([14.235, 'brrrr', 23.4444])).toThrow();
    expect(() => getGeoPoint({ lat: 1, log: 3 })).toThrow(
      'Unknown geo point format',
    );
  });

  it('works with lat/lng/alt object', () => {
    expect(getGeoPoint({ lat: 1, lng: 2, alt: 3 })).toMatchObject({
      longitude: 2,
      latitude: 1,
      altitude: 3,
    });
  });

  it('work with longitude/latitude object', () => {
    expect(getGeoPoint({ longitude: 10, latitude: 20 })).toMatchObject({
      longitude: 10,
      latitude: 20,
      altitude: undefined,
    });
  });
});
