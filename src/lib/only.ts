'use strict';

/**
 * Returns object with only selected properties
 *
 * @template T
 * @param {T} obj
 * @param {string} props
 * @returns {Partial<T>}
 */
export function only<T>(obj: T, props?: string): Partial<T> {
  if (!obj || typeof obj !== 'object' || !Object.keys(obj).length) return {};
  if (!props) return obj;
  const res = {};
  const propertyDescriptors = Object.getOwnPropertyDescriptors(obj);
  const properties = new Set(props.trim().split(/\s+/));
  if (properties.size < 1) return res;
  for (const prop in propertyDescriptors) {
    if (!properties.has(prop)) delete propertyDescriptors[prop];
  }
  Object.defineProperties(res, propertyDescriptors);
  return res;
}
