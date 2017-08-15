'use strict';

/**
 * Field accessors class
 */

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
