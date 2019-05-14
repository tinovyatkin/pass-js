import * as colorString from 'color-string';

export class PassColor {
  private color: [number, number, number] | undefined;
  constructor(
    v?:
      | string
      | colorString.ColorDescriptor
      | [number, number, number]
      | PassColor,
  ) {
    if (v) this.set(v);
  }

  set(
    v:
      | string
      | colorString.ColorDescriptor
      | PassColor
      | [number, number, number],
  ): this {
    if (Array.isArray(v)) {
      if (v.length < 3 || v.length > 4)
        throw new TypeError(
          `RGB colors array must have length 3 or 4, received ${v.length}`,
        );
      // copying array
      const rgbWithoutAlpha = v.slice(0, 3) as [number, number, number];
      if (!rgbWithoutAlpha.every(n => Number.isInteger(n) && n >= 0 && n < 256))
        throw new TypeError(
          `RGB colors array must consist only integers between 0 and 255, received ${JSON.stringify(
            rgbWithoutAlpha,
          )}`,
        );
      this.color = rgbWithoutAlpha;
    } else if (typeof v === 'string') {
      const rgb = colorString.get.rgb(v);
      if (!rgb) throw new TypeError(`Invalid color value ${v}`);
      // convert to rgb(), stripping alpha channel
      this.color = rgb.slice(0, 3) as [number, number, number];
    } else if (v instanceof PassColor) this.color = v.getRGB();
    return this;
  }

  /**
   * returns current value as [r,g,b] array
   */
  getRGB(): [number, number, number] | undefined {
    return this.color;
  }

  toJSON(): string | undefined {
    if (!this.color) return undefined;
    return colorString.to.rgb(this.color);
  }
}
