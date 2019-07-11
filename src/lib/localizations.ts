/**
 * Class to handle Apple pass localizations
 *
 * @see {@link @see https://apple.co/2M9LWVu} - String Resources
 * @see {@link https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html#//apple_ref/doc/uid/TP40012195-CH4-SW54}
 */

import { createReadStream, promises as fs } from 'fs';
import { createInterface } from 'readline';
import * as path from 'path';
import { EOL } from 'os';

import { normalizeLocale } from './normalize-locale';

/**
 * Just as in C, some characters must be prefixed with a backslash before you can include them in the string.
 * These characters include double quotation marks, the backslash character itself,
 * and special control characters such as linefeed (\n) and carriage returns (\r).
 *
 * @see {@link https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/LoadingResources/Strings/Strings.html#//apple_ref/doc/uid/10000051i-CH6-SW13}
 */

export function escapeString(str: string): string {
  return str
    .replace(/["\\]/g, '\\$&') // quote and backslash
    .split(EOL)
    .join('\\n'); // escape new lines
}

export function unescapeString(str: string): string {
  return str
    .split('\\n') // new line
    .join(EOL)
    .replace(/\\(["\\])/g, '$1'); // quote and backslash
}

async function readStringsFromStream(
  stream: import('stream').Readable,
): Promise<Map<string, string>> {
  const res = new Map() as Map<string, string>;
  let nextLineIsComment = false;
  stream.setEncoding('utf-16le');
  const rl = createInterface(stream);
  for await (const line of rl) {
    // skip empty lines
    const l = line.trim();
    if (!l) continue;
    // check if starts with '/*' and skip comments
    if (nextLineIsComment || l.startsWith('/*')) {
      nextLineIsComment = !l.endsWith('*/');
      continue;
    }
    // check for first quote, assignment operator, and final semicolon
    const test = /^"(?<msgId>.+)"\s*=\s*"(?<msgStr>.+)"\s*;/.exec(l);
    if (!test) continue;
    const { msgId, msgStr } = test.groups as { msgId: string; msgStr: string };
    res.set(unescapeString(msgId), unescapeString(msgStr));
  }
  return res;
}

/**
 * @see {@link https://github.com/justinklemm/i18n-strings-files/blob/dae303ed60d9d43dbe1a39bb66847be8a0d62c11/index.coffee#L100}
 * @param {string} filename - path to pass.strings file
 */
export async function readLprojStrings(
  filename: string,
): Promise<Map<string, string>> {
  return readStringsFromStream(
    createReadStream(filename, { encoding: 'utf16le' }),
  );
}

/**
 * Converts given translations map into UTF-16 encoded buffer in .lproj format
 *
 * @param {Map.<string, string>} strings
 */
export function getLprojBuffer(strings: Map<string, string>): Buffer {
  /**
   * Just as in C, some characters must be prefixed with a backslash before you can include them in the string.
   * These characters include double quotation marks, the backslash character itself,
   * and special control characters such as linefeed (\n) and carriage returns (\r).
   *
   * @see {@link https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/LoadingResources/Strings/Strings.html#//apple_ref/doc/uid/10000051i-CH6-SW13}
   */
  return Buffer.from(
    '\ufeff' /* byte order mark - UTF16 LE */ +
      [...strings]
        .map(
          ([key, value]) =>
            `"${escapeString(key)}" = "${escapeString(value)}";`,
        )
        .join('\n'), // macOs compatible output for Buffer, so no EOL
    'utf16le',
  );
}

/**
 * Localizations class Map<lang, Map<key, translation>>
 */
export class Localizations extends Map<string, Map<string, string>> {
  constructor(v?: Localizations) {
    // copy localizations if provided
    super(
      v instanceof Localizations
        ? [...v].map(([lang, map]) => [lang, new Map([...map])])
        : undefined,
    );
  }

  /**
   *
   * @param {string} lang -  ISO 3166 alpha-2 code for the language
   * @param {{ [k: string]?: string }} values
   */
  add(lang: string, values: { [k: string]: string }): this {
    const locale = normalizeLocale(lang);
    const map: Map<string, string> = this.get(locale) || new Map();
    for (const [key, value] of Object.entries(values)) {
      map.set(key, value);
    }
    if (!this.has(lang)) this.set(locale, map);
    return this;
  }

  toArray(): { path: string; data: Buffer }[] {
    return [...this].map(([lang, map]) => ({
      path: `${lang}.lproj/pass.strings`,
      data: getLprojBuffer(map),
    }));
  }

  async addFile(language: string, filename: string): Promise<void> {
    this.set(normalizeLocale(language), await readLprojStrings(filename));
  }

  async addFromStream(
    language: string,
    stream: import('stream').Readable,
  ): Promise<void> {
    this.set(normalizeLocale(language), await readStringsFromStream(stream));
  }

  /**
   * Loads available localizations from given folder path
   *
   * @param {string} dirPath
   */
  async load(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const loaders: Promise<void>[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // check if it's a localization folder
      const test = /^(?<lang>[-A-Z_a-z]+)\.lproj$/.exec(entry.name);
      if (!test) continue;
      const { lang } = test.groups as { lang: string };
      const currentPath = path.join(dirPath, entry.name);
      const localizations = await fs.readdir(currentPath, {
        withFileTypes: true,
      });
      // check if it has strings and load
      if (localizations.find(f => f.isFile() && f.name === 'pass.strings'))
        loaders.push(
          this.addFile(lang, path.join(currentPath, 'pass.strings')),
        );
    }
    await Promise.all(loaders);
  }
}
