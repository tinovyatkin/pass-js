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

  it('isValidW3CDateString rejects trailing garbage after Z', () => {
    // `Z` branch must be anchored to end of string.
    assert.ok(!isValidW3CDateString('2026-01-01T12:34Zgarbage'));
    assert.ok(!isValidW3CDateString('2026-01-01T12:34:56Zmore'));
  });

  it('isValidW3CDateString accepts non-standard timezone offsets', () => {
    // :45 offsets exist in the real world — Nepal (+05:45), Chatham Is.
    // (+12:45 in NZDT). Some sources also emit :15.
    assert.ok(isValidW3CDateString('2026-01-01T12:34+05:45'));
    assert.ok(isValidW3CDateString('2026-01-01T12:34+12:45'));
    assert.ok(isValidW3CDateString('2026-01-01T12:34+05:30'));
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

  it('formats negative non-whole-hour UTC offsets', () => {
    // Local Y-M-D h:m follow the process TZ; only the offset suffix is under
    // test. getTimezoneOffset() is minutes to add to local time to reach UTC.
    const date = new Date('2024-01-15T12:00:00Z');
    const cases: Array<[offsetMinutes: number, suffix: string]> = [
      // America/St_Johns standard time (UTC−03:30). Previously "-04:-30".
      [210, '-03:30'],
      // America/St_Johns daylight time (UTC−02:30).
      [150, '-02:30'],
      // Pacific/Marquesas (UTC−09:30). Previously "-10:-30".
      [570, '-09:30'],
      // Sub-hour negative offset. Previously "-01:-30".
      [30, '-00:30'],
      // Positive fractional offsets must keep working (Nepal, India).
      [-345, '+05:45'],
      [-330, '+05:30'],
      // Whole-hour and UTC.
      [240, '-04:00'],
      [-60, '+01:00'],
      [0, '+00:00'],
    ];
    for (const [offsetMinutes, suffix] of cases) {
      date.getTimezoneOffset = () => offsetMinutes;
      const res = getW3CDateString(date);
      assert.equal(res.slice(-6), suffix, res);
      assert.ok(isValidW3CDateString(res), res);
      assert.ok(Number.isFinite(getDateFromW3CString(res).getTime()), res);
    }
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
    assert.equal(date1.getTimezoneOffset(), date.getTimezoneOffset());
  });

  it('throws on invalid argument type', () => {
    assert.throws(
      () => getW3CDateString({ byaka: 'buka' } as unknown as Date),
      TypeError,
    );
  });

  it('parses Z timezone and seconds', () => {
    const d = getDateFromW3CString('2026-06-01T12:34:56Z');
    assert.equal(d.toISOString(), '2026-06-01T12:34:56.000Z');
  });

  it('parses ±HH:MM offset without seconds', () => {
    const d = getDateFromW3CString('2011-12-08T13:00-04:00');
    // 13:00 at -04:00 → 17:00 UTC
    assert.equal(d.toISOString(), '2011-12-08T17:00:00.000Z');
  });

  it('rejects inputs the validator rejects', () => {
    assert.throws(() => getDateFromW3CString('2012-07-22'));
    assert.throws(() => getDateFromW3CString('not a date'));
  });
});
