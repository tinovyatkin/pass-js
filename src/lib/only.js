'use strict';

/**
 * Returns object with only selected properties
 *
 * @param {Object} obj
 * @param {string[]} args
 * @returns {Object}
 */
function only(obj, ...args) {
  if (!obj || typeof obj !== 'object' || !Object.keys(obj).length) return {};
  if (arguments.length === 1) return obj;
  /** @type {string[]} */
  const properties =
    args.length === 1
      ? Array.isArray(args[0])
        ? args[0]
        : String(args[0]).split(/\s+/)
      : args;
  const res = {};
  if (properties.length < 1) return res;
  Object.defineProperties(
    res,
    properties
      .filter(prop => obj.hasOwnProperty(prop))
      .reduce((result, prop) => {
        result[prop] = Object.getOwnPropertyDescriptor(obj, prop);
        return result;
      }, {}),
  );
  return res;
}
module.exports = only;
