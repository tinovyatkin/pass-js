/* eslint-disable node/no-unpublished-require */

'use strict';

const pipeIntoStream = require('../src/lib/pipe-into-stream');
const { randomFillSync } = require('crypto');
const { WritableStreamBuffer } = require('stream-buffers');

describe('pipeIntoStream', () => {
  test('piping a buffer into a stream', done => {
    // creating test buffer and fill it with random data
    const testBuffer = Buffer.alloc(1024);
    randomFillSync(testBuffer);
    // create writable stream
    const ws = new WritableStreamBuffer({ initialSize: 1024 });
    pipeIntoStream(ws, testBuffer, () => {
      expect(testBuffer.compare(ws.getContents())).toBe(0);
      done();
    });
  });
});
