'use strict';

import type { SemanticTags, SemanticTagValue } from '../interfaces';

import { getW3CDateString } from './w3cdate';

function normalizeSemanticValue(value: SemanticTagValue): SemanticTagValue {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime()))
      throw new TypeError(`Semantic tag Date values must be valid`);
    return getW3CDateString(value);
  }

  if (Array.isArray(value)) return value.map(normalizeSemanticValue);

  // The truthiness check excludes null, because typeof null is 'object'.
  if (value && typeof value === 'object') {
    const result: { [key: string]: SemanticTagValue } = {};
    for (const [key, nestedValue] of Object.entries(value))
      result[key] = normalizeSemanticValue(nestedValue);
    return result;
  }

  return value;
}

export function normalizeSemanticTags(tags: SemanticTags): SemanticTags {
  return normalizeSemanticValue(tags) as SemanticTags;
}
