'use strict';

const assert = require('assert');

/**
 * Checks if given string is a valid W3C date representation
 *
 * @param {string} dateStr
 * @returns {boolean}
 */
function isValidW3CDateString(dateStr) {
  if (typeof dateStr !== 'string') return false;
  // W3C date format with optional seconds
  return /^20[1-9]{2}-[01]\d-[0-3]\dT[0-5]\d:[0-5]\d(:[0-5]\d)?(Z|([+-][01]\d:[03]0)$)/.test(
    dateStr,
  );
}
module.exports.isValidW3CDateString = isValidW3CDateString;

/**
 * Converts given string or Date instance into valid W3C date string
 *
 * @param {string | Date} value
 * @throws if given string can't be converted into w3C date
 * @returns {string}
 */
function getW3CDateString(value) {
  assert.ok(
    typeof value === 'string' || value instanceof Date,
    'Argument must be either a string or Date object',
  );
  if (typeof value === 'string' && isValidW3CDateString(value)) return value;

  const date = value instanceof Date ? value : new Date(value);
  assert.ok(isFinite(date), 'Invalid date value!');
  // creating W3C date (we will always do without seconds)
  const month = (1 + date.getMonth()).toFixed().padStart(2, '0');
  const day = date
    .getDate()
    .toFixed()
    .padStart(2, '0');
  const hours = date
    .getHours()
    .toFixed()
    .padStart(2, '0');
  const minutes = date
    .getMinutes()
    .toFixed()
    .padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const offsetHours = Math.abs(Math.floor(offset / 60))
    .toFixed()
    .padStart(2, '0');
  const offsetMinutes = (Math.abs(offset) - parseInt(offsetHours, 10) * 60)
    .toFixed()
    .padStart(2, '0');
  const offsetSign = offset < 0 ? '-' : '+';
  return `${date.getFullYear()}-${month}-${day}T${hours}:${minutes}${offsetSign}${offsetHours}:${offsetMinutes}`;
}
module.exports.getW3CDateString = getW3CDateString;
