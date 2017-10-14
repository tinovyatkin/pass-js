'use strict';

/**
 * Field accessors class
 */

const { getW3CDateString } = require('./w3cdate');
const only = require('./only');

class Fields {
  /**
   * Creates an instance of Fields
   * 
   * @param {Pass} pass - parent Pass class
   * @param {string} key - key name that these fields are bound to
   * @memberof Fields
   */
  constructor(pass, key) {
    this.pass = pass;
    this.key = key;
    Object.preventExtensions(this);
  }

  /**
   * Returns an array of all fields.
   * 
   * @returns {{key: string, value: string, label: string}[]}
   * @memberof Fields
   */
  all() {
    if (!(this.key in this.pass.structure)) this.pass.structure[this.key] = [];
    return this.pass.structure[this.key];
  }

  /**
   * Adds a field to the end of the list
   * 
   * @param {string | {key: string, label: string, value: string}} key - Field key or object with all fields
   * @param {string} [label] - Field label (optional)
   * @param {string} [value] - Field value
   * @param {Object} [options] - Other field options (e.g. dateStyle)
   * @returns {Fields}
   * @memberof Fields
   */
  add(key, label, value, options) {
    if (arguments.length > 1) {
      this.remove(key);
      const field = { key, value };
      if (label) field.label = label;
      if (options) Object.assign(field, options);
      this.all().push(field);
    } else if (Array.isArray(key)) {
      for (const k of key) this.add(k);
    } else {
      this.remove(key.key);
      // save object copy
      this.all().push(Object.assign({}, key));
    }
    return this;
  }

  /**
   * Returns a field
   * 
   * @param {string} key 
   * @returns {{key: string, label: string, value: string}} If field exists, returns an object with common keys and rest of keys
   * @memberof Fields
   */
  get(key) {
    return this.all().find(v => v.key === key);
  }

  /**
   * Sets value field for a given key
   * 
   * @param {string} key 
   * @param {string} value 
   * @memberof Fields
   */
  setValue(key, value) {
    if (typeof key !== 'string')
      throw new TypeError(
        `key for setValue must be a string, received ${typeof key}`,
      );
    if (typeof value !== 'string')
      throw new TypeError(
        `value for setValue must be a string, received ${typeof value}`,
      );
    const field = this.get(key);
    if (!field) return this.add({ key, value });
    field.value = value;
    return this;
  }

  /**
   * Removes a given field.
   * 
   * @param {string} key 
   * @returns {Fields}
   * @memberof Fields
   */
  remove(key) {
    const idx = this.all().findIndex(v => v.key === key);
    if (idx > -1) {
      this.all().splice(idx, 1);
      // remove property completely if there is no fields left
      if (this.all().length === 0) this.clear();
    }
    return this;
  }

  /**
   * Set a field as Date value with appropriated options
   * 
   * @param {string} key
   * @param {string} label
   * @param {Date} date 
   * @param {{dateStyle?: string, ignoresTimeZone?: boolean, isRelative?: boolean, timeStyle?:string}} [formatOptions]
   * @returns {Fields}
   * @throws if date is not a Date or invalid Date
   * @memberof Fields
   */
  setDateTime(key, label, date, formatOptions = {}) {
    if (!(date instanceof Date) || !isFinite(date))
      throw new Error(
        'First parameter of setDateTime must be an instance of Date',
      );
    //  Either specify both a date style and a time style, or neither.
    if (
      (!('dateStyle' in formatOptions) && 'timeStyle' in formatOptions) ||
      ('dateStyle' in formatOptions && !('timeStyle' in formatOptions))
    )
      throw new Error(
        'Either specify both a date style and a time style, or neither',
      );
    // adding
    this.add(
      Object.assign(
        {
          key,
          label,
          value: getW3CDateString(date),
        },
        only(
          formatOptions,
          'dateStyle timeStyle ignoresTimeZone isRelative changeMessage',
        ),
      ),
    );
    return this;
  }

  /**
   * Removes all fields.
   * 
   * @returns {Fields}
   * @memberof Fields
   */
  clear() {
    delete this.pass.structure[this.key];
    return this;
  }
}

module.exports = Fields;
