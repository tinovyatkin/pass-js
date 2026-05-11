// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

import type {
  SemanticTagObject,
  SemanticTags,
  SemanticTagValue,
} from '../interfaces.js';

import { getW3CDateString } from './w3cdate.js';

// Adds `value` to the recursion-path set and returns a `Disposable` that
// removes it when the enclosing block exits (normal return, throw, or
// early exit). Used via `using` to guarantee the set is always rebalanced
// without a manual try/finally.
function enterPath(onPath: Set<object>, value: object): Disposable {
  onPath.add(value);
  return {
    [Symbol.dispose]() {
      onPath.delete(value);
    },
  };
}

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
    using _cycleGuard = enterPath(onPath, value);
    return value.map(v => normalizeSemanticValue(v, onPath));
  }

  // The truthiness check excludes null, because typeof null is 'object'.
  if (value && typeof value === 'object') {
    if (onPath.has(value))
      throw new TypeError(`Semantic tags must not contain cyclic references`);
    using _cycleGuard = enterPath(onPath, value);
    const result: { [key: string]: SemanticTagValue } = {};
    for (const [key, nestedValue] of Object.entries(value))
      result[key] = normalizeSemanticValue(nestedValue, onPath);
    return result;
  }

  return value;
}

// Deep-copies semantic tag dictionaries, converting Date values to W3C date
// strings and throwing on cyclic input. Only values currently on the active
// recursion path count as a cycle — shared subtrees used in multiple
// branches are acyclic and serialize normally.
export function normalizeSemanticTags(tags: SemanticTags): SemanticTags {
  // Cast-through: the runtime walker treats any plain object as a
  // `SemanticTagObject`, but the strictly-typed `SemanticTags` interface
  // intentionally lacks an index signature. The narrowing is purely a
  // compile-time safety net; the walk is schema-agnostic.
  return normalizeSemanticValue(
    tags as unknown as SemanticTagObject,
    new Set<object>(),
  ) as SemanticTags;
}
