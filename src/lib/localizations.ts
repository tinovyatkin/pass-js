/**
 * Class to handle Apple pass localizations
 *
 * @see {@link @see https://apple.co/2M9LWVu} - String Resources
 * @see {@link https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html#//apple_ref/doc/uid/TP40012195-CH4-SW54}
 */

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import * as path from 'path';
import { EOL } from 'os';

import * as glob from 'fast-glob';

/**
 * @see {@link https://github.com/justinklemm/i18n-strings-files/blob/dae303ed60d9d43dbe1a39bb66847be8a0d62c11/index.coffee#L100}
 * @param {string} filename - path to pass.strings file
 */
export async function readLprojStrings(
  filename: string,
): Promise<Map<string, string>> {
  const res = new Map() as Map<string, string>;
  let nextLineIsComment = false;
  const rl = createInterface(
    createReadStream(filename, { encoding: 'utf16le' }),
  );
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
    let { msgId, msgStr } = test.groups as { msgId: string; msgStr: string };
    /**
     * Just as in C, some characters must be prefixed with a backslash before you can include them in the string.
     * These characters include double quotation marks, the backslash character itself,
     * and special control characters such as linefeed (\n) and carriage returns (\r).
     * @see {@link https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/LoadingResources/Strings/Strings.html#//apple_ref/doc/uid/10000051i-CH6-SW13}
     */
    //  convert escaped quotes
    msgId = msgId.replace(/\\"/g, '"');
    msgStr = msgStr.replace(/\\"/g, '"');
    //  convert escaped new lines
    msgId = msgId.replace(/\\n/g, EOL);
    msgStr = msgStr.replace(/\\n/g, EOL);
    res.set(msgId, msgStr);
  }
  return res;
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
   * @see {@link https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/LoadingResources/Strings/Strings.html#//apple_ref/doc/uid/10000051i-CH6-SW13}
   */
  return Buffer.from(
    '\ufeff' /* byte order mark - UTF16 LE */ +
      [...strings]
        .map(
          ([key, value]) =>
            `"${key
              .replace(/\n/gm, '\\n') // escape new lines
              .replace(/"/g, '"')}" = "${value
              .replace(/\n/gm, '\\n') // escape new lines
              .replace(/"/g, '"')}";`,
        )
        .join(EOL),
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
    const map: Map<string, string> = this.get(lang) || new Map();
    for (const [key, value] of Object.entries(values)) {
      map.set(key, value);
    }
    if (!this.has(lang)) this.set(lang, map);
    return this;
  }

  toArray(): { path: string; data: Buffer }[] {
    return [...this].map(([lang, map]) => ({
      path: `${lang}.lproj/pass.strings`,
      data: getLprojBuffer(map),
    }));
  }

  /**
   * Loads available localizations from given folder path
   *
   * @param {string} dirPath
   */
  async load(dirPath: string): Promise<void> {
    for await (const file of glob.stream(
      [path.join(dirPath, '*.lproj/pass.strings')],
      {
        onlyFiles: true,
        deep: 1,
      },
    )) {
      if (typeof file !== 'string') continue;
      /*
          The file is always ends with something like /zh_CN.lproj/pass.string
          So, taking the end will give us a language
          */
      const language = path
        .basename(path.dirname(file), '.lproj')
        .replace(/_/g, '-'); // we will tolerate zh_CN as well as zh-CN
      /**
       * @see {@link https://stackoverflow.com/questions/8758340/regex-to-detect-locales}
       */
      if (
        !/^[A-Za-z]{2,4}(-([A-Za-z]{4}|\d{3}))?(-([A-Za-z]{2}|\d{3}))?$/.test(
          language,
        )
      ) {
        console.warn(
          'Localization file %s was not loaded because "%s" is not looks like a valid language/locale code',
          file,
          language,
        );
        return;
      }
      this.set(language, await readLprojStrings(file));
    }
  }
}
