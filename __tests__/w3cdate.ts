import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getW3CDateString,
  isValidW3CDateString,
  getDateFromW3CString,
} from '../dist/lib/w3cdate.js';

describe('W3C dates strings', () => {
  it('isValidW3CDateString', () => {
    assert.ok(isValidW3CDateString('2012-07-22T14:25-08:00'));
    // allow seconds too
    assert.ok(isValidW3CDateString('2018-07-16T19:20:30+01:00'));
    assert.ok(!isValidW3CDateString('2012-07-22'));
  });

  it('getW3CDateString', () => {
    const date = new Date();
    const res = getW3CDateString(date);
    assert.ok(isValidW3CDateString(res));
    // must not cut seconds if supplied as string
    assert.equal(
      getW3CDateString('2018-07-16T19:20:30+01:00'),
      '2018-07-16T19:20:30+01:00',
    );
  });

  it('parseable to Date', () => {
    const date = new Date();
    const str = getW3CDateString(date);
    const date1 = new Date(str);
    assert.ok(Number.isFinite(date1.getDate()));
    assert.equal(date1.getFullYear(), date.getFullYear());
    assert.equal(date1.getMonth(), date.getMonth());
    assert.equal(date1.getDay(), date.getDay());
    assert.equal(date1.getHours(), date.getHours());
    assert.equal(date1.getMinutes(), date.getMinutes());
    assert.equal(date.getTimezoneOffset(), date.getTimezoneOffset());
  });

  it('throws on invalid argument type', () => {
    assert.throws(
      () => getW3CDateString({ byaka: 'buka' } as unknown as Date),
      TypeError,
    );
  });

  it('circle conversion', { skip: true }, () => {
    assert.equal(
      getW3CDateString(getDateFromW3CString('2011-12-08T13:00-04:00')),
      '2011-12-08T13:00-04:00',
    );
  });
});
