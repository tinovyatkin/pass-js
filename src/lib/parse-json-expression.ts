// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

import { Script, createContext } from 'node:vm';

const EVALUATION_TIMEOUT_MS = 100;

/**
 * Parses a JSON-compatible JavaScript expression, primarily so pass.json
 * fixtures can contain comments without carrying a comment-stripping parser.
 *
 * The input is evaluated as the argument to JSON.stringify inside a fresh VM
 * context with string/WASM code generation disabled and a short timeout.
 * JSON.parse then rehydrates the string in the main realm, which strips
 * functions, accessors, prototypes, and other non-JSON values down to plain
 * JSON data before Template consumes it.
 */
export function parseJsonObjectExpression(
  source: string,
  filename = 'JSON input',
): Record<string, unknown> {
  const context = createContext(Object.create(null), {
    codeGeneration: { strings: false, wasm: false },
    microtaskMode: 'afterEvaluate',
    name: 'pass-js JSON expression parser',
  });
  const script = new Script(`"use strict";\nJSON.stringify(${source}\n)`, {
    filename,
    importModuleDynamically() {
      throw new TypeError('Dynamic import is not available while parsing JSON');
    },
  });

  const json = script.runInContext(context, { timeout: EVALUATION_TIMEOUT_MS });
  if (typeof json !== 'string')
    throw new TypeError(`${filename} must evaluate to a JSON value`);

  const value = JSON.parse(json) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${filename} must evaluate to a JSON object`);
  return value as Record<string, unknown>;
}
