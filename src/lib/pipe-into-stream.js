'use strict';

const { createReadStream } = require('fs');

function bufferIntoStream(stream, buffer, callback) {
  stream.on('close', callback);
  stream.on('error', callback);
  stream.end(buffer, undefined, callback);
}

function fileIntoStream(stream, filename, callback) {
  const fileStream = createReadStream(filename);
  stream.on('error', callback);
  stream.on('close', callback);
  fileStream.pipe(stream);
}

/**
 * Pipes given source (filename or buffer) into a given writeble stream
 * 
 * @param {WritableStream} stream 
 * @param {string | Buffer | Function} source - filename or Buffer
 * @param {Function} callback
 * @returns {Promise}
 */
function pipeIntoStream(stream, source, callback) {
  if (Buffer.isBuffer(source))
    return bufferIntoStream(stream, source, callback);
  if (typeof source === 'string' || source instanceof String)
    return fileIntoStream(stream, source, callback);
  if (typeof source === 'function') return source(stream, callback);

  throw new Error(
    `Cannot load image ${source}, must be String (filename), Buffer or function`,
  );
}
module.exports = pipeIntoStream;
