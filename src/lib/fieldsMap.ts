'use strict';

import * as assert from 'assert';

import { Field, FieldDescriptor, DataStyleFormat } from '../interfaces';

import { getW3CDateString } from './w3cdate';

export class FieldsMap extends Map<string, FieldDescriptor> {
  /**
   * Returns Map as array of objects with key moved inside like a key property
   */
  toJSON(): Field[] | undefined {
    if (!this.size) return undefined;
    return [...this.entries()].map(
      ([key, data]): Field => {
        // Remap Date objects to string
        if (data.value instanceof Date)
          data.value = getW3CDateString(data.value);
        return { key, ...data };
      },
    );
  }

  /**
   * Adds a field to the end of the list
   *
   * @param {Field} field - Field key or object with all fields
   * @returns {FieldsMap}
   * @memberof FieldsMap
   */
  add(field: Field): FieldsMap {
    const { key, ...data } = field;
    this.set(key, data);
    return this;
  }

  /**
   * Sets value field for a given key, without changing the rest of field properties
   *
   * @param {string} key
   * @param {string} value
   * @memberof FieldsMap
   */
  setValue(key: string, value: string): FieldsMap {
    assert.strictEqual(
      typeof key,
      'string',
      `key for setValue must be a string, received ${typeof key}`,
    );
    assert.strictEqual(
      typeof value,
      'string',
      `value for setValue must be a string, received ${typeof value}`,
    );
    const field = this.get(key) || { value };
    field.value = value;
    this.set(key, field);
    return this;
  }

  /**
   * Set a field as Date value with appropriated options
   *
   * @param {string} key
   * @param {string} label
   * @param {Date} date
   * @param {{dateStyle?: string, ignoresTimeZone?: boolean, isRelative?: boolean, timeStyle?:string}} [formatOptions]
   * @returns {FieldsMap}
   * @throws if date is not a Date or invalid Date
   * @memberof FieldsMap
   */
  setDateTime(
    key: string,
    label: string,
    date: Date,
    {
      dateStyle,
      ignoresTimeZone,
      isRelative,
      timeStyle,
    }: {
      dateStyle?: DataStyleFormat;
      ignoresTimeZone?: boolean;
      isRelative?: boolean;
      timeStyle?: DataStyleFormat;
    } = {},
  ): FieldsMap {
    assert.strictEqual(
      typeof key,
      'string',
      `Key must be a string, received ${typeof key}`,
    );
    assert.strictEqual(
      typeof label,
      'string',
      `Label must be a string, received ${typeof label}`,
    );
    assert.ok(
      date instanceof Date,
      'Third parameter of setDateTime must be an instance of Date',
    );
    //  Either specify both a date style and a time style, or neither.
    assert.strictEqual(
      !!dateStyle,
      !!timeStyle,
      'Either specify both a date style and a time style, or neither',
    );
    // adding
    this.set(key, {
      label,
      value: date,
      dateStyle,
      ignoresTimeZone,
      isRelative,
      timeStyle,
    });

    return this;
  }
}
