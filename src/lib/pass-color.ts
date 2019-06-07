import * as colorNames from 'color-name';

const ABBR_RE = /^#([\da-f])([\da-f])([\da-f])([\da-f])?$/i;
const HEX_RE = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})([\da-f]{2})?$/i;
const PERCENT_RE = /^rgba?\(\s*([+-]?[\d.]+)%\s*,\s*([+-]?[\d.]+)%\s*,\s*([+-]?[\d.]+)%\s*(?:,\s*([+-]?[\d.]+)\s*)?\)$/i;
const RGBA_RE = /^rgba?\(\s*(1?\d{1,2}|2[0-4]\d|25[0-5])\s*,\s*(1?\d{1,2}|2[0-4]\d|25[0-5])\s*,\s*(1?\d{1,2}|2[0-4]\d|25[0-5])\s*(?:,\s*([+-]?[\d.]+)\s*)?\)$/i;

function is0to255(num: number): boolean {
  if (!Number.isInteger(num)) return false;
  return num >= 0 && num <= 255;
}

/**
 * Converts given string into RGB array
 *
 * @param {string} colorString - color string, like 'blue', "#FFF", "rgba(200, 60, 60, 0.3)", "rgb(200, 200, 200)", "rgb(0%, 0%, 100%)"
 */
function getRgb(colorString: string): [number, number, number] {
  // short paths
  const string = colorString.trim();
  if (string in colorNames) return colorNames[string];
  if (/transparent/i.test(string)) return [0, 0, 0];

  // we don't need to recheck values because they are enforced by regexes
  let match = ABBR_RE.exec(string);
  if (match) {
    return match.slice(1, 4).map(c => parseInt(c + c, 16)) as [
      number,
      number,
      number,
    ];
  }
  if ((match = HEX_RE.exec(string))) {
    return match.slice(1, 4).map(v => parseInt(v, 16)) as [
      number,
      number,
      number,
    ];
  }
  if ((match = RGBA_RE.exec(string))) {
    return match.slice(1, 4).map(c => parseInt(c, 10)) as [
      number,
      number,
      number,
    ];
  }
  if ((match = PERCENT_RE.exec(string))) {
    return match.slice(1, 4).map(c => {
      const r = Math.round(parseFloat(c) * 2.55);
      if (is0to255(r)) return r;
      throw new TypeError(
        `Invalid color value "${colorString}": value ${c}% (${r}) is not between 0 and 255`,
      );
    }) as [number, number, number];
  }

  throw new TypeError(
    `Invalid color value "${colorString}": unknown format - must be something like 'blue', "#FFF", "rgba(200, 60, 60, 0.3)", "rgb(200, 200, 200)", "rgb(0%, 0%, 100%)"`,
  );
}

/**
 *  returns current value as [r,g,b] array, but stringifies to JSON as string 'rgb(r, g, b)'
 */
export class PassColor extends Array<number> {
  constructor(v?: string | [number, number, number] | PassColor) {
    super();
    if (v) this.set(v);
  }

  set(v: string | PassColor | [number, number, number]): this {
    this.length = 0;
    if (Array.isArray(v)) {
      if (v.length < 3 || v.length > 4)
        throw new TypeError(
          `RGB colors array must have length 3 or 4, received ${v.length}`,
        );
      // copying first 3 numbers to our array
      for (let i = 0, n = v[i]; i < 3; n = v[++i]) {
        if (!is0to255(n))
          throw new TypeError(
            `RGB colors array must consist only integers between 0 and 255, received ${JSON.stringify(
              v,
            )}`,
          );
        super.push(n);
      }
    } else if (typeof v === 'string') {
      super.push(...getRgb(v));
    }
    return this;
  }

  toJSON(): string | undefined {
    if (this.length !== 3) return undefined;
    return `rgb(${this.join(', ')})`;
  }
}
