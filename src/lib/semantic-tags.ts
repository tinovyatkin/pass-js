import type { SemanticTags, SemanticTagValue } from '../interfaces.js';

import { getW3CDateString } from './w3cdate.js';

function normalizeSemanticValue(
  value: SemanticTagValue,
  seen: WeakSet<object>,
): SemanticTagValue {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime()))
      throw new TypeError(`Semantic tag Date values must be valid`);
    return getW3CDateString(value);
  }

  if (Array.isArray(value)) {
    if (seen.has(value))
      throw new TypeError(`Semantic tags must not contain cyclic references`);
    seen.add(value);
    return value.map(v => normalizeSemanticValue(v, seen));
  }

  // The truthiness check excludes null, because typeof null is 'object'.
  if (value && typeof value === 'object') {
    if (seen.has(value))
      throw new TypeError(`Semantic tags must not contain cyclic references`);
    seen.add(value);
    const result: { [key: string]: SemanticTagValue } = {};
    for (const [key, nestedValue] of Object.entries(value))
      result[key] = normalizeSemanticValue(nestedValue, seen);
    return result;
  }

  return value;
}

export function normalizeSemanticTags(tags: SemanticTags): SemanticTags {
  return normalizeSemanticValue(tags, new WeakSet()) as SemanticTags;
}
