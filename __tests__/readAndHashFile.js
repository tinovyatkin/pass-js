'use strict';

const path = require('path');

const readAndHashFile = require('../src/lib/readAndHashFile');

test('readAndHashFile', async () => {
  const res = await readAndHashFile(
    path.resolve(__dirname, './resources/thumbnail@2x.png'),
    'TEST_NAME',
  );
  expect(res).toMatchObject({
    name: 'TEST_NAME',
    hash: 'ac640c623741c0081fb1592d6353ebb03122244f',
    content: expect.any(Buffer),
  });
});
