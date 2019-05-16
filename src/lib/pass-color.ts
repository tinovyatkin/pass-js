import * as colorString from 'color-string';

/**
 *  returns current value as [r,g,b] array, but stringifies to JSON as string 'rgb(r, g, b)'
 */
export class PassColor extends Array<number> {
  constructor(
    v?:
      | string
      | colorString.ColorDescriptor
      | [number, number, number]
      | PassColor,
  ) {
    super();
    if (v) this.set(v);
  }

  set(
    v:
      | string
      | colorString.ColorDescriptor
      | PassColor
      | [number, number, number],
  ): this {
    this.length = 0;
    if (Array.isArray(v)) {
      if (v.length < 3 || v.length > 4)
        throw new TypeError(
          `RGB colors array must have length 3 or 4, received ${v.length}`,
        );
      // copying first 3 numbers to our array
      for (let i = 0, n = v[i]; i < 3; n = v[++i]) {
        if (!Number.isInteger(n) || n < 0 || n > 255)
          throw new TypeError(
            `RGB colors array must consist only integers between 0 and 255, received ${JSON.stringify(
              v,
            )}`,
          );
        super.push(n);
      }
    } else if (typeof v === 'string') {
      const rgb = colorString.get.rgb(v);
      if (!rgb) throw new TypeError(`Invalid color value ${v}`);
      // convert to rgb(), stripping alpha channel
      super.push(rgb[0], rgb[1], rgb[2]);
    }
    return this;
  }

  toJSON(): string | undefined {
    if (this.length < 3) return undefined;
    return colorString.to.rgb(this);
  }
}
