'use strict';

import { getW3CDateString, isValidW3CDateString } from '../src/lib/w3cdate';

describe('W3C dates strings ', () => {
  it('isValidW3CDateString', () => {
    expect(isValidW3CDateString('2012-07-22T14:25-08:00')).toBeTruthy();
    // allow seconds too
    expect(isValidW3CDateString('2018-07-16T19:20:30+01:00')).toBeTruthy();
    expect(isValidW3CDateString('2012-07-22')).toBeFalsy();
  });

  it('getW3CDateString', () => {
    const date = new Date();
    const res = getW3CDateString(date);
    expect(isValidW3CDateString(res)).toBeTruthy();
    // must not cust seconds if supplied as string
    expect(getW3CDateString('2018-07-16T19:20:30+01:00')).toBe(
      '2018-07-16T19:20:30+01:00',
    );
  });

  it('parseable to Date', () => {
    const date = new Date();
    const str = getW3CDateString(date);
    const date1 = new Date(str);
    // it's up to minutes, so, check everything apart
    expect(isFinite(date1.getDate())).toBeTruthy();
    expect(date1.getFullYear()).toBe(date.getFullYear());
    expect(date1.getMonth()).toBe(date.getMonth());
    expect(date1.getDay()).toBe(date.getDay());
    expect(date1.getHours()).toBe(date.getHours());
    expect(date1.getMinutes()).toBe(date.getMinutes());
    expect(date.getTimezoneOffset()).toBe(date.getTimezoneOffset());
  });
});
