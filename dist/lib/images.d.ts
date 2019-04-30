/**
 * Base PassImages class to add image filePath manipulation
 */
export declare class PassImages {
  icon: string;
  icon2x: string;
  icon3x: string;
  logo: string;
  logo2x: string;
  logo3x: string;
  background: string;
  background2x: string;
  background3x: string;
  footer: string;
  footer2x: string;
  footer3x: string;
  strip: string;
  strip2x: string;
  strip3x: string;
  thumbnail: string;
  thumbnail2x: string;
  thumbnail3x: string;
  constructor();
  /**
   * Returns all images file names as array
   */
  all(): any[];
  /**
   * Load all images from the specified directory. Only supported images are
   * loaded, nothing bad happens if directory contains other files.
   *
   * @param {string} dir - path to a directory with images
   * @memberof PassImages
   */
  loadFromDirectory(dir: string): Promise<PassImages>;
}
