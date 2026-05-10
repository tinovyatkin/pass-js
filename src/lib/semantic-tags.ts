// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

import type { SemanticTags, SemanticTagValue } from '../interfaces.js';

import { getW3CDateString } from './w3cdate.js';

function normalizeSemanticValue(
  value: SemanticTagValue,
  onPath: Set<object>,
): SemanticTagValue {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime()))
      throw new TypeError(`Semantic tag Date values must be valid`);
    return getW3CDateString(value);
  }

  if (Array.isArray(value)) {
    if (onPath.has(value))
      throw new TypeError(`Semantic tags must not contain cyclic references`);
    onPath.add(value);
    try {
      return value.map(v => normalizeSemanticValue(v, onPath));
    } finally {
      onPath.delete(value);
    }
  }

  // The truthiness check excludes null, because typeof null is 'object'.
  if (value && typeof value === 'object') {
    if (onPath.has(value))
      throw new TypeError(`Semantic tags must not contain cyclic references`);
    onPath.add(value);
    try {
      const result: { [key: string]: SemanticTagValue } = {};
      for (const [key, nestedValue] of Object.entries(value))
        result[key] = normalizeSemanticValue(nestedValue, onPath);
      return result;
    } finally {
      onPath.delete(value);
    }
  }

  return value;
}

// Deep-copies semantic tag dictionaries, converting Date values to W3C date
// strings and throwing on cyclic input. Only values currently on the active
// recursion path count as a cycle — shared subtrees used in multiple
// branches are acyclic and serialize normally.
export function normalizeSemanticTags(tags: SemanticTags): SemanticTags {
  return normalizeSemanticValue(tags, new Set<object>()) as SemanticTags;
}
