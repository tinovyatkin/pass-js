"use strict";

import * as path from "path";

import { PassImages } from "../src/lib/images";

describe("PassImages", () => {
  it("has class properties", () => {
    const img = new PassImages();
    expect(img).toHaveProperty("background", "");
    expect(img.loadFromDirectory).toBeInstanceOf(Function);
  });

  it("has images setter and getter", () => {
    const img = new PassImages();
    img.background = "testBackground";
    img.background2x = "testBackground2x";
    expect(img.background).toBe("testBackground");
    expect(img.background2x).toBe("testBackground2x");
    expect(img.background3x).toBeFalsy();
  });

  it("reads images from directory", async () => {
    const img = new PassImages();
    const imgDir = path.resolve(__dirname, "../images/");
    await img.loadFromDirectory(imgDir);
    expect(img.files().size).toBe(18);
  });
});
