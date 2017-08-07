// Exported methods adds image accessors and loadImagesFrom method to
// constructor.

'use strict';

const File = require('fs');
const Path = require('path');

// Supported images.
const IMAGES = ['background', 'footer', 'icon', 'logo', 'strip', 'thumbnail'];

function applyImageMethods(constructor) {
  const prototype = constructor.prototype;

  // Accessor methods for images (logo, strip, etc).
  //
  // Call with an argument to set the image and return self, call with no
  // argument to get image value.
  //
  //   pass.icon(function(callback) { ... };
  //   console.log(pass.icon());
  //
  // The 2x suffix is used for high resolution version (file name uses @2x
  // suffix).
  //
  //   pass.icon2x("icon@2x.png");
  //   console.log(pass.icon2x());
  IMAGES.forEach(key => {
    prototype[key] = function(value) {
      if (arguments.length === 0) {
        return this.images[key];
      }
      this.images[key] = value;
      return this;
    };

    const retina = `${key}2x`;
    prototype[retina] = function(value) {
      if (arguments.length === 0) {
        return this.images[retina];
      }
      this.images[retina] = value;
      return this;
    };

    const high_res_retina = `${key}3x`;
    prototype[high_res_retina] = function(value) {
      if (arguments.length === 0) {
        return this.images[high_res_retina];
      }
      this.images[high_res_retina] = value;
      return this;
    };
  });

  // Load all images from the specified directory. Only supported images are
  // loaded, nothing bad happens if directory contains other files.
  //
  // path - Directory containing images to load
  prototype.loadImagesFrom = function(path) {
    const self = this;
    const files = File.readdirSync(path);
    files.forEach(filename => {
      const basename = Path.basename(filename, '.png');
      if (/@3x$/.test(basename) && ~IMAGES.indexOf(basename.slice(0, -3))) {
        // High resolution
        self.images[basename.replace(/@3x$/, '3x')] = Path.resolve(
          path,
          filename,
        );
      } else if (
        /@2x$/.test(basename) &&
        ~IMAGES.indexOf(basename.slice(0, -3))
      ) {
        // High resolution
        self.images[basename.replace(/@2x$/, '2x')] = Path.resolve(
          path,
          filename,
        );
      } else if (~IMAGES.indexOf(basename)) {
        // Normal resolution
        self.images[basename] = Path.resolve(path, filename);
      }
    });
    return this;
  };
}

module.exports = applyImageMethods;
