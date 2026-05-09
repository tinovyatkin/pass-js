// Passbook templates

import * as http2 from 'node:http2';
import { createPrivateKey, type KeyObject, X509Certificate } from 'node:crypto';
import { join } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';

import stripJsonComments from 'strip-json-comments';

import { Pass } from './pass.js';
import { PASS_STYLES } from './constants.js';
import type { PassStyle, ApplePass, Options } from './interfaces.js';
import { PassBase } from './lib/base-pass.js';
import { readZip } from './lib/zip.js';
import type { PassImages } from './lib/images.js';
import type { Localizations } from './lib/localizations.js';

const {
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_PATH,
  NGHTTP2_CANCEL,
  HTTP2_METHOD_POST,
} = http2.constants;

export class Template extends PassBase {
  key?: KeyObject;
  certificate?: string;
  private apn?: http2.ClientHttp2Session;

  constructor(
    style?: PassStyle,
    fields: Partial<ApplePass> = {},
    images?: PassImages,
    localization?: Localizations,
    options?: Options,
  ) {
    super(fields, images, localization, options);

    if (style) {
      if (!PASS_STYLES.has(style))
        throw new TypeError(`Unsupported pass style ${style}`);
      this.style = style;
    }
  }

  // Load a Template, images, and key from a directory on disk.
  static async load(
    folderPath: string,
    keyPassword?: string,
    options?: Options,
  ): Promise<Template> {
    const entries = await readdir(folderPath, { withFileTypes: true });
    let template: Template;

    if (entries.find(entry => entry.isFile() && entry.name === 'pass.json')) {
      const jsonContent = await readFile(join(folderPath, 'pass.json'), 'utf8');
      const passJson = JSON.parse(
        stripJsonComments(jsonContent),
      ) as Partial<ApplePass>;

      let type: PassStyle | undefined;
      for (const t of PASS_STYLES) {
        if (t in passJson) {
          type = t;
          break;
        }
      }
      if (!type) throw new TypeError('Unknown pass style!');
      template = new Template(type, passJson, undefined, undefined, options);
    } else {
      template = createDefaultTemplate(options);
    }

    const { passTypeIdentifier } = template;
    const keyName = passTypeIdentifier
      ? `${passTypeIdentifier.replace(/^pass\./, '')}.pem`
      : undefined;

    const entriesLoader: Promise<void>[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const test = /(?<lang>[-A-Z_a-z]+)\.lproj/.exec(entry.name);
        if (!test?.groups?.['lang']) continue;
        const lang = test.groups['lang'];
        const currentPath = join(folderPath, entry.name);
        const localizations = await readdir(currentPath, {
          withFileTypes: true,
        });
        if (localizations.find(f => f.isFile() && f.name === 'pass.strings'))
          entriesLoader.push(
            template.localization.addFile(
              lang,
              join(currentPath, 'pass.strings'),
            ),
          );
        for (const f of localizations) {
          const img = template.images.parseFilename(f.name);
          if (img)
            entriesLoader.push(
              template.images.add(
                img.imageType,
                join(currentPath, f.name),
                img.density,
                lang,
                options?.disableImageCheck,
              ),
            );
        }
      } else {
        if (entry.name === keyName) {
          entriesLoader.push(
            template.loadCertificate(join(folderPath, keyName), keyPassword),
          );
          continue;
        }
        const img = template.images.parseFilename(entry.name);
        if (img)
          entriesLoader.push(
            template.images.add(
              img.imageType,
              join(folderPath, entry.name),
              img.density,
              undefined,
              options?.disableImageCheck,
            ),
          );
      }
    }
    await Promise.all(entriesLoader);
    return template;
  }

  // Reconstruct a Template from a pre-zipped buffer (e.g. a .pkpass fetched
  // from S3). Reads pass.json, images, and localization strings out of the
  // bundle.
  static async fromBuffer(
    buffer: Buffer,
    options?: Options,
  ): Promise<Template> {
    const zip = readZip(buffer);
    if (zip.entries.length < 1)
      throw new TypeError(`Provided ZIP buffer contains no entries`);

    let template = createDefaultTemplate(options);

    for (const entry of zip.entries) {
      if (entry.filename.endsWith('/')) continue;

      if (/\/?pass\.json$/i.test(entry.filename)) {
        if (template.style)
          throw new TypeError(
            `Archive contains more than one pass.json - found ${entry.filename}`,
          );
        const buf = zip.getBuffer(entry);
        const passJSON = JSON.parse(
          stripJsonComments(buf.toString('utf8')),
        ) as Partial<ApplePass>;
        template = new Template(
          undefined,
          passJSON,
          template.images,
          template.localization,
          options,
        );
      } else {
        const img = template.images.parseFilename(entry.filename);
        if (img) {
          const imgBuffer = zip.getBuffer(entry);
          await template.images.add(
            img.imageType,
            imgBuffer,
            img.density,
            img.lang,
            options?.disableImageCheck,
          );
        } else {
          const test = /(^|\/)(?<lang>[-_a-z]+)\.lproj\/pass\.strings$/i.exec(
            entry.filename,
          );
          if (test?.groups?.['lang']) {
            const buf = zip.getBuffer(entry);
            await template.localization.addFromBuffer(test.groups['lang'], buf);
          }
        }
      }
    }
    return template;
  }

  // Accepts a PEM-encoded RSA private key. If the key is encrypted, supply
  // a password. Stored as a node:crypto KeyObject for use at sign time.
  setPrivateKey(pem: string, password?: string): void {
    try {
      this.key = createPrivateKey({
        key: pem,
        format: 'pem',
        passphrase: password,
      });
    } catch (err) {
      throw new Error(
        'Failed to decode provided private key. Invalid password?',
        { cause: err },
      );
    }
  }

  // Accepts a PEM that contains the signing certificate, and optionally
  // a private key (as exported from `openssl pkcs12 -in ... -out ... -nodes`
  // or similar). Private-key extraction mirrors the previous node-forge
  // behaviour: any "-----BEGIN …KEY-----" block is used.
  setCertificate(pem: string, password?: string): void {
    const certMatch = pem.match(
      /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/,
    );
    if (!certMatch)
      throw new Error(
        'Failed to decode provided certificate: no PEM cert block found',
      );

    // Validate by parsing — throws if malformed.
    // eslint-disable-next-line no-new
    new X509Certificate(certMatch[0]);

    this.certificate = certMatch[0];

    const keyMatch = pem.match(
      /-----BEGIN (?:ENCRYPTED |RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:ENCRYPTED |RSA |EC )?PRIVATE KEY-----/,
    );
    if (keyMatch) this.setPrivateKey(keyMatch[0], password);
  }

  async loadCertificate(
    signerPemFile: string,
    password?: string,
  ): Promise<void> {
    const signerCertData = await readFile(signerPemFile, 'utf8');
    this.setCertificate(signerCertData, password);
  }

  // Push an update notification to a device via Apple's APN service.
  // See Apple docs: Updating a Pass.
  async pushUpdates(pushToken: string): Promise<http2.IncomingHttpHeaders> {
    if (!this.apn || this.apn.destroyed) {
      await new Promise<void>((resolve, reject) => {
        if (!this.key)
          throw new ReferenceError(
            `Set private key before trying to push pass updates`,
          );
        if (!this.certificate)
          throw new ReferenceError(
            `Set pass certificate before trying to push pass updates`,
          );
        const apn = http2.connect('https://api.push.apple.com:443', {
          key: this.key.export({ type: 'pkcs8', format: 'pem' }),
          cert: this.certificate,
        });
        apn.unref();
        apn
          .once('goaway', () => {
            if (this.apn && !this.apn.destroyed) this.apn.destroy();
          })
          .once('error', reject)
          .once('connect', () => {
            if (apn.destroyed)
              throw new Error('APN was destroyed before connecting');
            this.apn = apn;
            resolve();
          });
      });
    }

    return new Promise<http2.IncomingHttpHeaders>((resolve, reject) => {
      if (!this.apn || this.apn.destroyed)
        throw new Error('APN was destroyed before connecting');
      const req = this.apn.request({
        [HTTP2_HEADER_METHOD]: HTTP2_METHOD_POST,
        [HTTP2_HEADER_PATH]: `/3/device/${encodeURIComponent(pushToken)}`,
      });

      req.setTimeout(5000, () => {
        req.close(NGHTTP2_CANCEL, () =>
          reject(new Error(`http2: timeout connecting to api.push.apple.com`)),
        );
      });

      req.once('error', reject);
      req.once('response', resolve);
      req.end('{}');
    });
  }

  createPass(fields: Partial<ApplePass> = {}): Pass {
    return new Pass(
      this,
      { ...this.fields, ...fields },
      this.images,
      this.localization,
      this.options,
    );
  }
}

function createDefaultTemplate(options?: Options): Template {
  return new Template(undefined, {}, undefined, undefined, options);
}
