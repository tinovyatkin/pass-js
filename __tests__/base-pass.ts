import { PassBase } from '../src/lib/base-pass';
import { TOP_LEVEL_FIELDS } from '../src/constants';

describe('PassBase', () => {
  it('should have all required pass properties', () => {
    // to be able to check NFC property it must be storeCard
    const bp = new PassBase({ storeCard: {} });
    for (const field in TOP_LEVEL_FIELDS) expect(bp).toHaveProperty(field);
  });

  it('works with locations', () => {
    const bp = new PassBase();
    expect(bp.locations).toBeUndefined();
    bp.addLocation([1, 2]);
    bp.addLocation({ lat: 3, lng: 4 }, 'The point');
    expect(bp.locations).toIncludeSameMembers([
      { latitude: 2, longitude: 1 },
      { latitude: 3, longitude: 4, relevantText: 'The point' },
    ]);
  });

  it('works with beacons', () => {
    const bp = new PassBase();
    bp.beacons = [{ proximityUUID: '1143243' }];
    expect(bp.beacons).toHaveLength(1);
    expect(() => {
      bp.beacons = [{ byaka: 'buka' }];
    }).toThrow(TypeError);
  });

  it('webServiceURL', () => {
    const bp = new PassBase();
    expect(() => {
      bp.webServiceURL = 'https://transfers.do/webservice';
    }).not.toThrow();
    // should throw on bad url
    expect(() => {
      bp.webServiceURL = '/webservice';
    }).toThrow();
  });

  it('color values as RGB triplets', () => {
    const bp = new PassBase();
    expect(() => {
      bp.backgroundColor = 'rgb(125, 125,0)';
    }).not.toThrow();
    expect(() => {
      bp.labelColor = 'rgba(33, 344,3)';
    }).toThrow();
    expect(() => {
      bp.foregroundColor = 'rgb(33, 0,287)';
    }).toThrow();
    // should convert values to rgb
    bp.foregroundColor = 'white';
    expect(bp.foregroundColor).toEqual([255, 255, 255]);
    // should convert values to rgb
    bp.foregroundColor = 'rgb(254, 254, 254)';
    expect(bp.foregroundColor).toEqual([254, 254, 254]);
    bp.foregroundColor = '#FFF';
    expect(bp.foregroundColor).toEqual([255, 255, 255]);
    bp.foregroundColor = 'rgba(0, 0, 255, 0.4)';
    expect(bp.foregroundColor).toEqual([0, 0, 255]);
    bp.foregroundColor = 'rgb(0%, 0%, 100%)';
    expect(bp.foregroundColor).toEqual([0, 0, 255]);
    // should throw on bad color
    expect(() => {
      bp.foregroundColor = 'byaka a ne color';
    }).toThrow('Invalid color value');
  });
});
