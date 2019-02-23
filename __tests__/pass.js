'use strict';

const Crypto = require('crypto');
const File = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { Readable } = require('stream');

const constants = require('../src/constants');
const Pass = require('../src/pass');
const Template = require('../src/template');

// Clone all the fields in object, except the named field, and return a new
// object.
//
// object - Object to clone
// field  - Except this field
function cloneExcept(object, field) {
  const clone = {};
  for (const key in object) {
    if (key !== field) clone[key] = object[key];
  }
  return clone;
}

function unzip(zipFile, filename) {
  return new Promise(resolve => {
    execFile(
      'unzip',
      ['-p', zipFile, filename],
      { encoding: 'binary' },
      (error, stdout) => {
        if (error) {
          throw new Error(stdout);
        } else {
          resolve(Buffer.from(stdout, 'binary'));
        }
      },
    );
  });
}

const template = new Template('coupon', {
  passTypeIdentifier: 'pass.com.example.passbook',
  teamIdentifier: 'MXL',
  labelColor: 'red',
});

template.keys(`${__dirname}/../keys`, 'secret');
const fields = {
  serialNumber: '123456',
  organizationName: 'Acme flowers',
  description: '20% of black roses',
};

describe('Pass', () => {
  test('from template', () => {
    const pass = template.createPass();

    // should copy template fields
    expect(pass.fields.passTypeIdentifier).toBe('pass.com.example.passbook');

    // should start with no images
    expect(pass.images.map.size).toBe(0);

    // should create a structure based on style
    expect(pass.fields.coupon).toBeDefined();
    expect(pass.fields.eventTicket).toBeUndefined();
  });

  test('getGeoPoint', () => {
    expect(Pass.getGeoPoint([14.235, 23.3444, 23.4444])).toMatchObject({
      longitude: expect.any(Number),
      latitude: expect.any(Number),
      altitude: expect.any(Number),
    });

    expect(() => Pass.getGeoPoint([14.235, 'brrrr', 23.4444])).toThrow();

    expect(Pass.getGeoPoint({ lat: 1, lng: 2, alt: 3 })).toMatchObject({
      longitude: 2,
      latitude: 1,
      altitude: 3,
    });

    expect(Pass.getGeoPoint({ longitude: 10, latitude: 20 })).toMatchObject({
      longitude: 10,
      latitude: 20,
      altitude: undefined,
    });

    expect(() => Pass.getGeoPoint({ lat: 1, log: 3 })).toThrow(
      'Unknown geopoint format',
    );
  });

  //
  test('barcodes as Array', () => {
    const pass = template.createPass(cloneExcept(fields, 'serialNumber'));
    expect(() =>
      pass.barcodes([
        {
          format: 'PKBarcodeFormatQR',
          message: 'Barcode message',
          messageEncoding: 'iso-8859-1',
        },
      ]),
    ).not.toThrow();
    expect(() => pass.barcodes('byaka')).toThrow();
  });

  test('without serial number should not be valid', () => {
    const pass = template.createPass(cloneExcept(fields, 'serialNumber'));
    expect(() => pass.validate()).toThrow('Missing field serialNumber');
  });

  test('without organization name should not be valid', () => {
    const pass = template.createPass(cloneExcept(fields, 'organizationName'));
    expect(() => pass.validate()).toThrow('Missing field organizationName');
  });

  test('without description should not be valid', () => {
    const pass = template.createPass(cloneExcept(fields, 'description'));
    expect(() => pass.validate()).toThrow('Missing field description');
  });

  test('without icon.png should not be valid', () => {
    const pass = template.createPass(fields);
    expect(() => pass.validate()).toThrow('Missing image icon.png');
  });

  test('without logo.png should not be valid', async () => {
    const pass = template.createPass(fields);
    pass.images.icon = 'icon.png';
    const file = File.createWriteStream('/tmp/pass.pkpass');

    const validationError = await new Promise(resolve => {
      pass.pipe(file);
      pass.on('done', () => {
        throw new Error('Expected validation error');
      });
      pass.on('error', resolve);
    });

    expect(validationError).toHaveProperty('message', 'Missing image logo.png');
  });

  test('boarding pass has string-only property in sctructure fields', async () => {
    const templ = await Template.load(
      path.resolve(__dirname, './resources/passes/BoardingPass.pass/'),
    );
    expect(templ.style).toBe('boardingPass');
    // switching transit type
    const pass = templ.createPass();
    expect(pass.transitType()).toBe(constants.TRANSIT.AIR);
    pass.transitType(constants.TRANSIT.BUS);
    expect(pass.transitType()).toBe(constants.TRANSIT.BUS);
    expect(pass.getPassJSON().boardingPass).toHaveProperty(
      'transitType',
      constants.TRANSIT.BUS,
    );
  });

  test('stream', async () => {
    const pass = template.createPass(fields);
    await pass.images.loadFromDirectory(path.resolve(__dirname, './resources'));
    pass.headerFields.add('date', 'Date', 'Nov 1');
    pass.primaryFields.add([
      { key: 'location', label: 'Place', value: 'High ground' },
    ]);
    const stream = pass.stream();
    expect(stream).toBeInstanceOf(Readable);
    const file = File.createWriteStream('/tmp/pass1.pkpass');
    stream.pipe(file);
    await new Promise(resolve => {
      file.on('close', resolve);
      stream.on('error', e => {
        throw e;
      });
    });
    // test that result is valid ZIP at least
    const res = await new Promise(resolve => {
      execFile('unzip', ['-t', '/tmp/pass1.pkpass'], (error, stdout) => {
        if (error) throw new Error(stdout);
        resolve(stdout);
      });
    });
    File.unlinkSync('/tmp/pass1.pkpass');
    expect(res).toContain('No errors detected in compressed data');
  });
});

describe('generated', () => {
  const pass = template.createPass(fields);

  beforeAll(async () => {
    jest.setTimeout(100000);
    await pass.images.loadFromDirectory(path.resolve(__dirname, './resources'));
    pass.headerFields.add('date', 'Date', 'Nov 1');
    pass.primaryFields.add([
      { key: 'location', label: 'Place', value: 'High ground' },
    ]);
    if (File.existsSync('/tmp/pass.pkpass'))
      File.unlinkSync('/tmp/pass.pkpass');
    const file = File.createWriteStream('/tmp/pass.pkpass');
    await new Promise(resolve => {
      pass.pipe(file);
      pass.on('close', resolve);
      pass.on('error', err => {
        throw err;
      });
    });
  });

  test('should be a valid ZIP', done => {
    execFile('unzip', ['-t', '/tmp/pass.pkpass'], (error, stdout) => {
      if (error) throw new Error(stdout);
      expect(stdout).toContain('No errors detected in compressed data');
      done(error);
    });
  });

  test('should contain pass.json', async () => {
    const res = JSON.parse(await unzip('/tmp/pass.pkpass', 'pass.json'));

    expect(res).toMatchObject({
      passTypeIdentifier: 'pass.com.example.passbook',
      teamIdentifier: 'MXL',
      serialNumber: '123456',
      organizationName: 'Acme flowers',
      description: '20% of black roses',
      coupon: {
        headerFields: [
          {
            key: 'date',
            label: 'Date',
            value: 'Nov 1',
          },
        ],
        primaryFields: [
          {
            key: 'location',
            label: 'Place',
            value: 'High ground',
          },
        ],
      },
      formatVersion: 1,
    });
  });

  test('should contain a manifest', async () => {
    const res = JSON.parse(await unzip('/tmp/pass.pkpass', 'manifest.json'));
    expect(res).toMatchObject({
      'pass.json': expect.any(String), // '87c2bd96d4bcaf55f0d4d7846a5ae1fea85ea628',
      'icon.png': 'e0f0bcd503f6117bce6a1a3ff8a68e36d26ae47f',
      'icon@2x.png': '10e4a72dbb02cc526cef967420553b459ccf2b9e',
      'logo.png': 'abc97e3b2bc3b0e412ca4a853ba5fd90fe063551',
      'logo@2x.png': '87ca39ddc347646b5625062a349de4d3f06714ac',
      'strip.png': '68fc532d6c76e7c6c0dbb9b45165e62fbb8e9e32',
      'strip@2x.png': '17e4f5598362d21f92aa75bc66e2011a2310f48e',
      'thumbnail.png': 'e199fc0e2839ad5698b206d5f4b7d8cb2418927c',
      'thumbnail@2x.png': 'ac640c623741c0081fb1592d6353ebb03122244f',
    });
  });

  // this test depends on MacOS specific signpass, so, run only on MacOS
  if (process.platform === 'darwin') {
    test('should contain a signature', done => {
      execFile(
        path.resolve(__dirname, './resources/bin/signpass'),
        ['-v', '/tmp/pass.pkpass'],
        (error, stdout) => {
          expect(stdout).toContain('*** SUCCEEDED ***');
          done();
        },
      );
    });
  }

  test('should contain the icon', async () => {
    const buffer = await unzip('/tmp/pass.pkpass', 'icon.png');
    expect(
      Crypto.createHash('sha1')
        .update(buffer)
        .digest('hex'),
    ).toBe('e0f0bcd503f6117bce6a1a3ff8a68e36d26ae47f');
  });

  test('should contain the logo', async () => {
    const buffer = await unzip('/tmp/pass.pkpass', 'logo.png');
    expect(
      Crypto.createHash('sha1')
        .update(buffer)
        .digest('hex'),
    ).toBe('abc97e3b2bc3b0e412ca4a853ba5fd90fe063551');
  });
});
