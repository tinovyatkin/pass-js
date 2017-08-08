'use strict';

// Field accessors.
class Fields {
  constructor(pass, key) {
    this.pass = pass;
    this.key = key;
  }

  // Adds a field to the end of the list.
  //
  // You can call this method with three/four arguments:
  // key      - Field key
  // label    - Field label (optional)
  // value    - Field value
  // options  - Other field options (e.g. dateStyle)
  //
  // You can call this method with a single object that contains all field
  // properties (key, label, etc).
  //
  // You can also call with an array of either one.
  //
  // Returns self.
  add(key, label, value, options) {
    let field;
    let k;
    if (arguments.length > 1) {
      this.remove(key);
      field = { key, value };
      if (label) field.label = label;
      if (options) {
        for (k in options) field[k] = options[k];
      }
      this.all().push(field);
    } else if (Array.isArray(arguments[0])) {
      const array = arguments[0];
      for (const i in array) this.add.call(this, array[i]);
    } else {
      const properties = arguments[0];
      key = properties.key;
      this.remove(key);
      field = {};
      for (k in properties) field[k] = properties[k];
      this.all().push(field);
    }
    return this;
  }

  // Returns a field.
  //
  // If field exists, returns an object with:
  // key      - Field key
  // label    - Field label (optional)
  // value    - Field value
  // Other field options (e.g. dateStyle)
  get(key) {
    const fields = this.pass.structure[this.key];
    if (fields) {
      for (const i in fields) {
        const field = fields[i];
        if (field.key === key) return field;
      }
    }
    return null;
  }

  // Returns an array of all fields.
  all() {
    let fields = this.pass.structure[this.key];
    if (!fields) this.pass.structure[this.key] = fields = [];
    return fields;
  }

  // Removes a given field.
  remove(key) {
    const fields = this.pass.structure[this.key];
    if (fields) {
      for (const i in fields) {
        if (fields[i].key === key) {
          fields.splice(i, 1);
          break;
        }
      }
    }
    return this;
  }

  // Removes all fields.
  clear() {
    this.pass.structure[this.key] = [];
    return this;
  }
}

module.exports = Fields;
