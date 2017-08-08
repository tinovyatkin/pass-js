'use strict';

const { Writable } = require('stream');
const { createHash } = require('crypto');

// -- Manifest output stream --

// A write stream that calculates SHA from the output and updates the manifest
// accordingly.
//
// manifest - Manifest object
// filename - Filename (manifest property to set)
// output   - Pipe to this output stream
class SHAWriteStream extends Writable {
  constructor(manifest, filename, output) {
    super();

    this.output = output;
    this.manifest = manifest;
    this.filename = filename;
    this.sha = createHash('sha1');
    output.on('close', this.emit.bind(this, 'close'));
    output.on('error', this.emit.bind(this, 'error'));
  }

  write(buffer, encoding) {
    this.output.write(buffer, encoding);
    this.sha.update(buffer, encoding);
    return true;
  }

  end(buffer, encoding) {
    if (buffer) this.write(buffer, encoding);
    this.output.end();
    this.manifest[this.filename] = this.sha.digest('hex');
  }
}

module.exports = SHAWriteStream;
