// Simple Zip implementation, no compression, that opens on the iPhone.
//
// var zip = new Zip(output);
// var file = zip.addFile(filename);
// file.write(buffer);
// file.end();
// zip.close();
//
// See http://www.pkware.com/documents/casestudies/APPNOTE.TXT
/* eslint-disable no-underscore-dangle, no-bitwise */

'use strict';

const { EventEmitter } = require('events');
const File = require('./zip-file');
const { getTimePart, getDatePart } = require('./get-part-time');

// const debug = console.log;
const debug = () => {};

// Creates a new zip.
//
// output - Output stream
//
// Emits the following events:
// end   - Finished writing to output stream
// error - Encountered an error writing to output stream
class Zip extends EventEmitter {
  constructor(output) {
    super();
    this.output = output;
    // Set to true when zip is closed
    this._closed = false;
    // Keep track of all files added so we can write central directory
    this._files = [];
    // The currently active file
    this._active = null;
    // Current offset in the output stream
    this._offset = 0;

    const zip = this;
    output.on('error', error => {
      debug('Zip file encountered an error', error);
      // Closed output, propagate.
      // Output error, destroy all files and propagate.
      zip._closed = true;
      for (const i in zip._files) {
        const file = zip._files[i];
        if (!file._done) file.destroy();
      }
      zip.emit('error', error);
    });
    output.on('finish', () => {
      debug('Zip completed');
      zip.emit('end');
    });
    output.on('close', () => {
      debug('Zip completed');
      zip.emit('end');
    });

    Object.preventExtensions(this);
  }

  /**
   * Call this to add a file.
   * 
   * @param {string} filename - The file name
   * @param {any} modified - Modified date (if missing, uses current date)
   * @returns {Stream} - Returns an output stream.
   * @memberof Zip
   */
  addFile(filename, modified) {
    if (this._closed) throw new Error('Zip file already closed');
    const file = new File(this, filename, modified);
    this._files.push(file);
    return file;
  }

  // -- API --

  /**
   * Call this when done adding files.
   * 
   * @memberof Zip
   */
  close() {
    if (this._closed) throw new Error('Zip file already closed');
    this._closed = true;
    // Are there any open files (not flushed)?
    for (const i in this._files) {
      if (!this._files[i]._done) {
        this.on('drain', this._flush);
        return;
      }
    }
    // All files are flushed, time to wrap things up
    this._flush();
  }

  // -- Central directory --

  /**
   * Used internally to write central directory and close file.
   * 
   * @memberof Zip
   * @private
   */
  _flush() {
    const centralDirectoryOffset = this._offset;
    let centralDirectorySize = 0;
    for (const i in this._files)
      this._writeCentralDirectoryHeader(this._files[i]);
    centralDirectorySize = this._offset - centralDirectoryOffset;
    this._writeEndOfCentralDirectory(
      centralDirectoryOffset,
      centralDirectorySize,
    );
    // Once this buffer is out, we're done with the output stream
    this.output.end();
  }

  /**
   * Write next central directory header
   * 
   * @param {{filename: string}} file 
   * @memberof Zip
   * @private
   */
  _writeCentralDirectoryHeader(file) {
    const filename = Buffer.from(file.filename, 'utf-8');
    const buffer = Buffer.alloc(46 + filename.length);

    // central file header signature
    buffer.writeInt32LE(0x02014b50, 0);
    // version made by
    buffer.writeUInt16LE(0x133f, 4);
    // version needed to extract
    buffer.writeUInt16LE(0x1314, 6);
    // general purpose bit flag
    buffer.writeUInt16LE(0x0008, 8); // Use data descriptor
    // compression method
    buffer.writeUInt16LE(0x0008, 10); // DEFLATE
    // last mod file time
    buffer.writeUInt16LE(getTimePart(file.modified), 12);
    // last mod file date
    buffer.writeUInt16LE(getDatePart(file.modified), 14);
    // crc-32
    buffer.writeInt32LE(file._crc ^ -1, 16);
    // compressed size
    buffer.writeInt32LE(file._compressedLength, 20); // no compression
    // uncompressed size
    buffer.writeInt32LE(file._uncompressedLength, 24);
    // file name length
    buffer.writeUInt16LE(filename.length, 28);
    // extra field length
    buffer.writeUInt16LE(0, 30);
    // file comment length
    buffer.writeUInt16LE(0, 32);
    // disk number start
    buffer.writeUInt16LE(0, 34);
    // internal file attributes
    buffer.writeUInt16LE(0, 36);
    // external file attributes
    buffer.writeInt32LE(0, 38);
    // relative offset of local header 4 bytes
    buffer.writeInt32LE(file._offset, 42);
    // file name (variable size)
    filename.copy(buffer, 46);
    // extra field (variable size)
    // file comment (variable size)
    this._writeBuffer(buffer);
  }

  /**
   * Write end of central directory record and close output stream.
   * 
   * @param {number} offsetOfCentralDirectory 
   * @param {number} sizeOfCentralDirectory 
   * @memberof Zip
   * @private
   */
  _writeEndOfCentralDirectory(
    offsetOfCentralDirectory,
    sizeOfCentralDirectory,
  ) {
    const buffer = Buffer.alloc(22);
    // end of central dir signature
    buffer.writeInt32LE(0x06054b50, 0);
    // number of this disk
    buffer.writeUInt16LE(0, 4);
    // number of the disk with the start of the central directory
    buffer.writeUInt16LE(0, 6);
    // total number of entries in the central directory on this disk
    buffer.writeUInt16LE(this._files.length, 8);
    // total number of entries in the central directory
    buffer.writeUInt16LE(this._files.length, 10);
    // size of the central directory
    buffer.writeInt32LE(sizeOfCentralDirectory, 12);
    // offset to start of central directory with respect to the starting disk number
    buffer.writeInt32LE(offsetOfCentralDirectory, 16);
    // .ZIP file comment length
    buffer.writeUInt16LE(0, 20);
    this._writeBuffer(buffer);
  }

  // -- Buffered output --

  /**
   * Returns true if this is the active file.
   * 
   * @param {string} file 
   * @returns {boolean}
   * @memberof Zip
   */
  isActive(file) {
    if (this._active === file) return true;
    if (!this._active) {
      this._active = file;
      return true;
    }
    return false;
  }

  /**
   * Call this to pass active batton to the next file.
   * 
   * @memberof Zip
   */
  nextActive() {
    this._active = null;
    let done = true;
    for (const i in this._files) {
      const file = this._files[i];
      if (!file._done) {
        done = false;

        if (!file.writable) {
          // Completed, not flushed: this is now the active file
          this._active = file;
          file._flush();
          return;
        }
      }
    }
    // No files open or need flushing: emit drain event
    if (done) this.emit('drain');
  }

  /**
   * Write buffer to output stream.
   * 
   * @param {Buffer} buffer 
   * @memberof Zip
   * @private
   */
  _writeBuffer(buffer) {
    this._offset += buffer.length;
    this.output.write(buffer);
  }
}

module.exports = Zip;
