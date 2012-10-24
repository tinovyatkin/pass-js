// Simple Zip implementation, no compression, that opens on the iPhone.
//
// var zip = new Zip(output);
// var file = zip.addFile(filename);
// file.write(buffer);
// file.end();
// zip.close();


var EventEmitter  = require("events").EventEmitter;
var inherits      = require("util").inherits;
var Zlib          = require("zlib");


// Creates a new zip.
//
// output - Output stream
//
// Emits the following events:
// close - Done writing to output stream
// error - Encountered an error writing to output stream
function Zip(output) {
  this.output = output;
  // Set to true when zip is closed
  this._closed = false;
  // Keep track of all files added so we can write central directory
  this._files = [];
  // The currently active file
  this._active = null;
  // Current offset in the output stream
  this._offset = 0;

  var zip = this;
  output.on("close", function() {
    // Closed output, propagate.
    zip.emit("close");
  });
  output.on("error", function(error) {
    // Closed output, propagate.
    // Output error, destroy all files and propagate.
    zip._closed = true;
    for (var i in zip._files) {
      var file = zip._files[i];
      if (!file._flushed)
        file.destroy();
    }
    zip.emit("error", error);
  });
}

inherits(Zip, EventEmitter);


// -- API --


// Call this to add a file.
//
// filename - The file name
// modified - Modified date (if missing, uses current date)
//
// Returns an output stream.
Zip.prototype.addFile = function(filename, modified) {
  if (this._closed)
    throw new Error("Zip file already closed");
  var file = new File(this, filename, modified);
  this._files.push(file);
  return file;
};


// Call this when done adding files.
//
// Optional callback called when done or on error.
Zip.prototype.close = function() {
  if (this._closed)
    throw new Error("Zip file already closed");
  this._closed = true;
  // Are there any open files (not flushed)?
  for (var i in this._files) {
    if (!this._files[i]._flushed) {
      this.on("drain", this._flush);
      return;
    }
  }
  // All files are flushed, time to wrap things up
  this._flush();
};


// -- Central directory --


// Used internally to write central directory and close file.
Zip.prototype._flush = function() {
  var centralDirectoryOffset = this._offset;
  var centralDirectorySize = 0;
  for (var i in this._files) {
    var size = this._writeCentralDirectoryHeader(this._files[i]);
    centralDirectorySize += size;
  }
  this._writeEndOfCentralDirectory(centralDirectoryOffset, centralDirectorySize);
};


// Write next central directory header. Returns header size;
Zip.prototype._writeCentralDirectoryHeader = function(file) {
  var filename = new Buffer(file.filename, "utf-8");
  var buffer = new Buffer(46 + filename.length);

  // central file header signature
  write32(buffer, 0x02014b50, 0);
  // version made by
  write16(buffer, 0x133F, 4);
  // version needed to extract
  write16(buffer, 0x1314, 6);
  // general purpose bit flag
  write16(buffer, 0x0008, 8); // Use data descriptor
  // compression method
  write16(buffer, 0x0008, 10); // DEFLATE
  // last mod file time
  write16(buffer, getTimePart(file.modified), 12);
  // last mod file date
  write16(buffer, getDatePart(file.modified), 14);
  // crc-32
  write32(buffer, file._crc ^ -1, 16);
  // compressed size
  write32(buffer, file._compressedLength, 20); // no compression
  // uncompressed size
  write32(buffer, file._uncompressedLength, 24);
  // file name length
  write16(buffer, filename.length, 28);
  // extra field length
  write16(buffer, 0, 30);
  // file comment length
  write16(buffer, 0, 32);
  // disk number start
  write16(buffer, 0, 34);
  // internal file attributes
  write16(buffer, 0, 36);
  // external file attributes
  write32(buffer, 0, 38);
  // relative offset of local header 4 bytes
  write32(buffer, file._offset, 42);
  // file name (variable size)
  filename.copy(buffer, 46);
  // extra field (variable size)
  // file comment (variable size)
  this._writeBuffer(buffer);

  return buffer.length;
};


// Write end of central directory record and close output stream.
Zip.prototype._writeEndOfCentralDirectory = function(offsetOfCentralDirectory, sizeOfCentralDirectory) {
  var buffer = new Buffer(22);
  // end of central dir signature
  write32(buffer, 0x06054b50, 0);
  // number of this disk
  write16(buffer, 0, 4);
  // number of the disk with the start of the central directory
  write16(buffer, 0, 6);
  // total number of entries in the central directory on this disk
  write16(buffer, this._files.length, 8);
  // total number of entries in the central directory
  write16(buffer, this._files.length, 10);
  // size of the central directory
  write32(buffer, sizeOfCentralDirectory, 12);
  // offset to start of central directory with respect to the starting disk number
  write32(buffer, offsetOfCentralDirectory, 16);
  // .ZIP file comment length
  write16(buffer, 0, 20);
  this._writeBuffer(buffer);

  // Once this buffer is out, we're done with the output stream
  this.output.end();
};


// -- Buffered output --


// Write buffer to output stream.
Zip.prototype._writeBuffer = function(buffer) {
  this._offset += buffer.length;
  this.output.write(buffer);
};


function write16(buffer, value, offset) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value & 0xff00) >> 0x08;
}

function write32(buffer, value, offset) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value & 0xff00) >> 0x08;
  buffer[offset + 2] = (value & 0xff0000) >> 0x10;
  buffer[offset + 3] = (value & 0xff000000) >> 0x18;
}
        

// -- Zip file --


// Creates a new Zip file.
//
// zip      - Zip object
// filename - Filename
// modified - Modified date (optional)
function File(zip, filename, modified) {
  this.zip = zip;
  this.filename = filename;
  this.modified = modified || new Date();
  // True while file is writeable (end/destroy change this)
  this.writable = true;
  // We use this to hold any buffer if this is not the active file
  this._buffers = null;
  // Make sure we only write header once.
  this._wroteHeader = false;
  // True if file fully flushed (including data descriptor)
  this._flushed = false;
  // Offset of file within the stream
  this._offset = 0;
  this._crc = 0 ^ -1;
  this._compressedLength = this._uncompressedLength = 0;

  // Write to _deflate, count data size before passing to output.
  var file = this;
  this._deflate = Zlib.createDeflateRaw();
  this._deflate.on("data", function(buffer) {
    file._compressedLength += buffer.length;
    zip._writeBuffer(buffer);
  });
  this._deflate.on("end", this._doneWritingFile.bind(this));
}

inherits(File, EventEmitter);


// Writeable stream output
File.prototype.write = function(buffer, encoding) {
  if (!this.writable)
    throw new Error("This file no longer open for writing");
  if (typeof(buffer) == "string" || buffer instanceof String)
    buffer = new Buffer(buffer, encoding || "utf8");

  // crc-32
  for (var i = 0; i < buffer.length; i++) {
    var offset = (this._crc ^ buffer[i]) & 0xFF;
    this._crc = (this._crc >>> 8) ^ CRC32[offset];
  }
  this._compressedLength += buffer.length;

  var zip = this.zip;
  if (!zip._active)
    zip._active = this;

  if (zip._active == this) {
    // This is the active file: write the header first, then write this buffer.
    if (this._wroteHeader) {
      this._deflate.write(buffer);
    } else {
      this._writeLocalFileHeader();
      this._deflate.write(buffer);
    }
  } else {
    // Not the active file, so buffer the output.
    if (!this._buffers)
      this._buffers = [];
    this._buffers.push(buffer);
  }
  // Because we buffer we always return true.
  return true;
};

// Writeable stream end
File.prototype.end = function(buffer, encoding) {
  if (!this.writable)
    throw new Error("This file no longer open for writing");
  if (buffer)
    this.write(buffer, encoding);

  this.writable = false;
  if (this.zip._active == this) {
    // This is the active file: write the header first, then flush the file.
    if (this._wroteHeader) {
      this._flush();
    } else {
      this._writeLocalFileHeader();
      this._flush();
    }
  }
};

// Writeable stream destroy
File.prototype.destroy = function() {
  this.writable = false;
};


// Write local file header.
File.prototype._writeLocalFileHeader = function() {
  this._offset = this.zip._offset;
  var filename = new Buffer(this.filename, "utf-8");
  var buffer = new Buffer(30 + filename.length);

  // local file header signature
  write32(buffer, 0x04034b50, 0);
  // version needed to extract
  write16(buffer, 0x1314, 4);
  // general purpose bit flag  
  write16(buffer, 0x0008, 6); // Use data descriptor
  // compression method
  write16(buffer, 0x0008, 8); // DEFLATE
  // last mod file time
  write16(buffer, getTimePart(this.modified), 10);
  // last mod file date
  write16(buffer, getDatePart(this.modified), 12);
  // crc-32
  write32(buffer, 0, 14);
  // compressed size
  write32(buffer, 0, 18);
  // uncompressed size
  write32(buffer, 0, 22);
  // file name length
  write16(buffer, filename.length, 26);
  // extra field length
  write16(buffer, 0x0000, 28);
  // file name (variable size)
  filename.copy(buffer, 30);
  // extra field (variable size)

  this._wroteHeader = true;
  this.zip._writeBuffer(buffer);
};


// This is called in two cases:
// - End of file, write the data descriptor and move on
// - This file is now active, flush any open buffers
//
// If the file is still open for writing, flush any buffers.
//
// If the file is closed, flush any buffers, write data descriptor and move to
// the next file.
File.prototype._flush = function() {
  // This is now the active file
  this.zip._active = this;

  // Did we write the headers already? If not, start there.
  if (!this._wroteHeader)
    this._writeLocalFileHeader();

  // Is anything buffered? If so, flush it out to output stream and recurse.
  if (this._buffers) {
    for (var i in this._buffers) {
      var buffer = this._buffers[i];
      this._deflate.write(buffer);
    }
  }

  // Are we done writing to this file? Flush the deflated stream,
  // which triggers writing file descriptor.
  if (!this.writable)
    this._deflate.end();
};


// Called when we're done writing the deflated file, takes care of writing data
// descriptor and activating the next file.
File.prototype._doneWritingFile = function() {
  this._writeDataDescriptor();
  // No longer the active file
  this.zip._active = null;
  this._flushed = true;
  this.emit("close");

  // Do we have any more unflushed file?
  for (var i in this.zip._files) {
    var file = this.zip._files[i];
    if (file != this && !file._flushed) {
      // This is now the active file, flush it
      file._flush();
      return;
    }
  }
  // No files open or need flushing, emit drain event
  this.zip.emit("drain");
};


// Write file descriptor at end of file, and then make the next file active.
File.prototype._writeDataDescriptor = function() {
  // Write data descriptor at end of file: this is used for data we can only
  // determine after processing file (CRC, length).
  var buffer = new Buffer(12);
  write32(buffer, this._crc ^ -1, 0);
  // compressed size
  write32(buffer, this._compressedLength, 4);
  // uncompressed size
  write32(buffer, this._uncompressedLength, 8);
  this.zip._writeBuffer(buffer);
};


// -- Misc function --


// Deflates all files in the file list, calls callback when done.
//
// Updates files.compressed with the Zlib deflated buffer.
function deflateFile(files, callback) {
  var file = files[0];
  if (file) {
    Zlib.deflateRaw(file.content, function(error, buffer) {
      file.compressed = buffer;
      deflateFile(files.slice(1), callback);
    });
  } else
    callback();
}


// Extract date value from Date
function getDatePart(date) {
  return ((date.getFullYear() - 1980) << 9) |
         ((date.getMonth() + 1) << 5) |
         date.getDate();            
}

// Extract time value from Date
function getTimePart(date) {
  return (date.getHours() << 11) |
         (date.getMinutes() << 5) |
         date.getSeconds() / 2;
}

    
var CRC32 = [ 0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA, 0x076DC419, 0x706AF48F,
              0xE963A535, 0x9E6495A3, 0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988,
              0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91, 0x1DB71064, 0x6AB020F2,
              0xF3B97148, 0x84BE41DE, 0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7,
              0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC, 0x14015C4F, 0x63066CD9,
              0xFA0F3D63, 0x8D080DF5, 0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172,
              0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B, 0x35B5A8FA, 0x42B2986C,
              0xDBBBC9D6, 0xACBCF940, 0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59,
              0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116, 0x21B4F4B5, 0x56B3C423,
              0xCFBA9599, 0xB8BDA50F, 0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924,
              0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D, 0x76DC4190, 0x01DB7106,
              0x98D220BC, 0xEFD5102A, 0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433,
              0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818, 0x7F6A0DBB, 0x086D3D2D,
              0x91646C97, 0xE6635C01, 0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E,
              0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457, 0x65B0D9C6, 0x12B7E950,
              0x8BBEB8EA, 0xFCB9887C, 0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65,
              0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2, 0x4ADFA541, 0x3DD895D7,
              0xA4D1C46D, 0xD3D6F4FB, 0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0,
              0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9, 0x5005713C, 0x270241AA,
              0xBE0B1010, 0xC90C2086, 0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,
              0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4, 0x59B33D17, 0x2EB40D81,
              0xB7BD5C3B, 0xC0BA6CAD, 0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A,
              0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683, 0xE3630B12, 0x94643B84,
              0x0D6D6A3E, 0x7A6A5AA8, 0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1,
              0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE, 0xF762575D, 0x806567CB,
              0x196C3671, 0x6E6B06E7, 0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC,
              0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5, 0xD6D6A3E8, 0xA1D1937E,
              0x38D8C2C4, 0x4FDFF252, 0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,
              0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60, 0xDF60EFC3, 0xA867DF55,
              0x316E8EEF, 0x4669BE79, 0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236,
              0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F, 0xC5BA3BBE, 0xB2BD0B28,
              0x2BB45A92, 0x5CB36A04, 0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D,
              0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A, 0x9C0906A9, 0xEB0E363F,
              0x72076785, 0x05005713, 0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38,
              0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21, 0x86D3D2D4, 0xF1D4E242,
              0x68DDB3F8, 0x1FDA836E, 0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777,
              0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C, 0x8F659EFF, 0xF862AE69,
              0x616BFFD3, 0x166CCF45, 0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2,
              0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB, 0xAED16A4A, 0xD9D65ADC,
              0x40DF0B66, 0x37D83BF0, 0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,
              0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6, 0xBAD03605, 0xCDD70693,
              0x54DE5729, 0x23D967BF, 0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94,
              0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D ];


module.exports = Zip;

