'use strict';

/**
 * Checks if given string is a valid W3C date representation
 * 
 * @param {string} dateStr 
 * @returns {boolean}
 */
function isValidW3CDateString(dateStr) {
  if (typeof dateStr !== 'string') return false;
  // W3C date format with optional seconds
  return /^20[1-9]{2}-[0-1][0-9]-[0-3][0-9]T[0-5][0-9]:[0-5][0-9](:[0-5][0-9])?(Z|([-+][0-1][0-9]:[03]0)$)/.test(
    dateStr,
  );
}
exports.isValidW3CDateString = isValidW3CDateString;

/**
 * Converts given string or Date instance into valid W3C date string
 * 
 * @param {string | Date} value 
 * @throws if given string can't be converted into w3C date
 * @returns {string}
 */
function getW3CDateString(value) {
  if (typeof value !== 'string' && !(value instanceof Date))
    throw new Error('Argument must be either a string or Date object');
  if (isValidW3CDateString(value)) return value;

  const date = value instanceof Date ? value : new Date(value);
  if (!isFinite(date)) throw new Error('Invalid date value!');
  // creating W3C date (we will always do without seconds)
  const month = (1 + date.getMonth()).toFixed().padStart(2, '0');
  const day = date.getDate().toFixed().padStart(2, '0');
  const hours = date.getHours().toFixed().padStart(2, '0');
  const minutes = date.getMinutes().toFixed().padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const offsetHours = Math.abs(Math.floor(offset / 60))
    .toFixed()
    .padStart(2, '0');
  const offsetMinutes = (Math.abs(offset) - offsetHours * 60)
    .toFixed()
    .padStart(2, '0');
  const offsetSign = offset < 0 ? '-' : '+';
  return `${date.getFullYear()}-${month}-${day}T${hours}:${minutes}${offsetSign}${offsetHours}:${offsetMinutes}`;
}
exports.getW3CDateString = getW3CDateString;
