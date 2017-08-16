/* eslint-disable no-nested-ternary */

'use strict';

/**
 * Returns object with only selected properties
 * 
 * @param {Object} obj 
 * @param {string | string[]} args 
 * @returns {Object}
 */
function only(obj, ...args) {
  if (!obj || typeof obj !== 'object' || !Object.keys(obj).length) return {};
  if (arguments.length === 1) return obj;
  const properties =
    args.length === 1
      ? Array.isArray(args[0]) ? args[0] : String(args[0]).split(/\s+/)
      : args;
  const res = {};
  properties.forEach(prop => {
    if (prop in obj) res[prop] = obj[prop];
  });
  return res;
}
module.exports = only;
