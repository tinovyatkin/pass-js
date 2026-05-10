// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

/**
 * Removes JavaScript-style line and block comments from JSON text.
 *
 * Comments are replaced with whitespace instead of deleted so JSON.parse error
 * positions still point near the original source. String literals are copied
 * untouched, so `//` and `/*` inside field values are preserved.
 */
export function stripJsonComments(source: string): string {
  let output = '';
  let quote = '';
  let escaped = false;

  for (let i = 0; i < source.length; ) {
    const char = source[i]!;
    const next = source[i + 1];

    if (quote) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      i++;
    } else if (char === '"' || char === "'") {
      quote = char;
      output += char;
      i++;
    } else if (char === '/' && next === '/') {
      output += '  ';
      i += 2;
      while (i < source.length && source[i] !== '\n' && source[i] !== '\r') {
        output += ' ';
        i++;
      }
    } else if (char === '/' && next === '*') {
      output += '  ';
      i += 2;
      while (
        i < source.length &&
        !(source[i] === '*' && source[i + 1] === '/')
      ) {
        output += source[i] === '\n' || source[i] === '\r' ? source[i] : ' ';
        i++;
      }
      if (i >= source.length)
        throw new SyntaxError('Unterminated block comment');
      output += '  ';
      i += 2;
    } else {
      output += char;
      i++;
    }
  }

  return output;
}
