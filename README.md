[![npm (scoped)](https://img.shields.io/npm/v/@walletpass/pass-js.svg)](https://www.npmjs.com/package/@walletpass/pass-js)
[![codecov](https://codecov.io/github/tinovyatkin/pass-js/graph/badge.svg)](https://codecov.io/github/tinovyatkin/pass-js)

<img src="https://docs-assets.developer.apple.com/published/c104c9bff0/841b02dd-b78c-4cad-8da4-700761d34e14.png" alt="Apple Wallet logo" width="216" height="216" align="left">

# @walletpass/pass-js

<p align="center">A Node.js library for generating Apple Wallet passes with localizations, NFC, and web-service push updates. Written in TypeScript.</p>

<br><br><br>

## Installation

```sh
npm install @walletpass/pass-js
# or
yarn add @walletpass/pass-js
```

## Get your certificates

To start, you'll need a certificate issued by [the iOS Provisioning Portal](https://developer.apple.com/ios/manage/passtypeids/index.action). You need one certificate per Pass Type ID.

After adding this certificate to your Keychain, export it as a `.p12` file (Keychain Access → My Certificates → right-click → Export), then convert it into a `.pem` file using the `passkit-keys` command:

```sh
./bin/passkit-keys ./pathToKeysFolder
```

Or directly with `openssl`:

```sh
openssl pkcs12 -in <exported_cert_and_private_key>.p12 -clcerts -out com.example.passbook.pem -passin pass:<private_key_password>
```

Then copy the `.pem` file into your keys directory.

The [Apple Worldwide Developer Relations Certification Authority](https://www.apple.com/certificateauthority/) certificate is bundled with this package — you don't need to supply it yourself.

## Start with a template

A template carries the fields, images, and localizations shared between your passes. Use it to stamp out individual passes.

`Template.load` and `Template.fromBuffer` are intended for trusted template
assets. Do not pass attacker-controlled folders, ZIP buffers, or `.pkpass`
bundles to these APIs; loading untrusted bundles can consume excessive memory
and may crash or stall the process.

```js
import { Template } from '@walletpass/pass-js';

// Create a Template from a local folder. `.load` reads all fields from
// pass.json, all images, the com.example.passbook.pem private key, and
// any .lproj localization folders.
const template = await Template.load(
  './path/to/templateFolder',
  'secretKeyPassword',
);

// Or create a Template from a Buffer containing ZIP-compressed pass bundle
// data (for example, a .pkpass fetched from S3):
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-west-2' });
const s3file = await s3.send(
  new GetObjectCommand({ Bucket: 'bucket', Key: 'pass-template.zip' }),
);
const buffer = Buffer.from(await s3file.Body.transformToByteArray());
const template = await Template.fromBuffer(buffer);

// Or construct one by hand:
const template = new Template('coupon', {
  passTypeIdentifier: 'pass.com.example.passbook',
  teamIdentifier: 'MXL',
  backgroundColor: 'red',
  sharingProhibited: true,
});
await template.images.add('icon', iconPngFileBuffer);
await template.images.add('logo', pathToLogoPNGfile);
```

The first argument to the `Template` constructor is the pass style (`coupon`, `eventTicket`, etc.); the second is an optional object with any fields you want to set on the template.

You can access template fields directly:

```js
template.passTypeIdentifier = 'pass.com.example.passbook';
template.teamIdentifier = 'MXL';
```

The following fields are required on every pass:

- `passTypeIdentifier` — the Apple Pass Type ID (has the `pass.` prefix)
- `teamIdentifier` — your Apple Developer team identifier

You can set any documented pass field on a template or pass instance — for example, `backgroundColor`, `foregroundColor`, `labelColor`, `logoText`, `organizationName`, `suppressStripShine`, and `webServiceURL`.

Load the signing key into the template:

```js
await template.loadCertificate(
  '/etc/passbook/certificate_and_key.pem',
  'secret',
);
// …or set them directly from strings:
template.setCertificate(pemEncodedPassCertificate);
template.setPrivateKey(pemEncodedPrivateKey, optionalKeyPassword);
```

If you have images common to every pass (logos, icons, background art), add them once on the template:

```js
// Add a single image with a specific density and locale
await template.images.add('icon', iconFilename, '2x', 'ru');
// Or load all images in all densities and locales at once
await template.images.load('./images');
```

Image input may be a file path or a `Buffer`. Format is enforced: only **PNG** is accepted.

For NFC reward-card signup flows, add PassKit personalization metadata and a
150 x 40 point personalization logo:

```js
const template = new Template('storeCard', {
  passTypeIdentifier: 'pass.com.example.passbook',
  teamIdentifier: 'MXL',
});

template.nfc.message = 'member-id';
template.personalization = {
  description: 'Join Acme Rewards',
  requiredPersonalizationFields: [
    'PKPassPersonalizationFieldName',
    'PKPassPersonalizationFieldEmailAddress',
  ],
  termsAndConditions: '<a href="https://example.com/terms">Terms</a>',
};
await template.images.add('personalizationLogo', personalizationLogoPng);
```

`personalization.json` and `personalizationLogo*.png` are emitted only when
the final pass has NFC data, personalization metadata, and at least one
personalization logo. If any piece is missing, the personalization files are
left out of the generated bundle.

If you have a single directory that contains `pass.json`, the key
`com.example.passbook.pem`, and all the images you need, one call does everything:

```js
const template = await Template.load(
  './path/to/templateFolder',
  'secretKeyPassword',
);
```

Use the optional third argument to enable `allowHttp` — useful for development when your `webServiceURL` points at an HTTP (not HTTPS) server:

```js
const template = await Template.load(
  './path/to/templateFolder',
  'secretKeyPassword',
  { allowHttp: true },
);
```

## Create your pass

To create a new pass from a template:

```js
const pass = template.createPass({
  serialNumber: '123456',
  description: '20% off',
});
```

Just like a template, you can assign pass fields directly:

```js
pass.serialNumber = '12345';
pass.description = '20% off';
```

Apple's JSON schema represents structure fields (primary fields, secondary fields, etc.) as arrays whose items must have distinct `key` properties. To keep that ergonomic, this library exposes a `Map`-like API with an additional `add` method that does the logical thing:

```js
pass.primaryFields.add({ key: 'time', label: 'Time', value: '10:00AM' });
```

Read one or all fields:

```js
const dateField = pass.primaryFields.get('date');
for (const [key, { value }] of pass.primaryFields.entries()) {
  // …
}
```

Remove one or all fields:

```js
pass.primaryFields.delete('date');
pass.primaryFields.clear();
```

Adding images to a pass works exactly like adding them to a template (see above).

## Working with dates

If your fields contain [dates](https://developer.apple.com/library/archive/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/FieldDictionary.html#//apple_ref/doc/uid/TP40012026-CH4-SW6), supply them as ISO 8601 strings with a timezone or as native `Date` instances:

```js
import { constants } from '@walletpass/pass-js';

pass.primaryFields.add({
  key: 'updated',
  label: 'Updated at',
  value: new Date(),
  dateStyle: constants.dateTimeFormat.SHORT,
  timeStyle: constants.dateTimeFormat.SHORT,
});

// The `setDateTime` helper wraps the common case:
pass.auxiliaryFields.setDateTime(
  'serviceDate',
  'DATE',
  serviceMoment.toDate(),
  {
    dateStyle: constants.dateTimeFormat.MEDIUM,
    timeStyle: constants.dateTimeFormat.NONE,
    changeMessage: 'Service date changed to %@.',
  },
);

// Top-level date fields also accept Date objects:
pass.relevantDate = new Date(2026, 1, 1, 10, 0);
template.expirationDate = new Date(2026, 10, 10, 10, 10);
```

## Localizations

This library fully supports both [string localization](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html#//apple_ref/doc/uid/TP40012195-CH4-SW54) and [image localization](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html#//apple_ref/doc/uid/TP40012195-CH4-SW1):

```js
// Everything at once, from a template folder.
// Loads all localized images and strings from folders like `ru.lproj/`
// or `fr-CA.lproj/`.
await template.load(folderPath);

// Strings only:
pass.localization
  .add('en-GB', {
    GATE: 'GATE',
    DEPART: 'DEPART',
    ARRIVE: 'ARRIVE',
    SEAT: 'SEAT',
    PASSENGER: 'PASSENGER',
    FLIGHT: 'FLIGHT',
  })
  .add('ru', {
    GATE: 'ВЫХОД',
    DEPART: 'ВЫЛЕТ',
    ARRIVE: 'ПРИЛЁТ',
    SEAT: 'МЕСТО',
    PASSENGER: 'ПАССАЖИР',
    FLIGHT: 'РЕЙС',
  });

// Images:
await template.images.add(
  'logo' /* or 'icon', etc. */,
  imageFilePathOrBufferWithPNGdata,
  '2x' /* density: '1x' | '2x' | '3x' | undefined */,
  'ru' /* language code */,
);
```

Localization applies to each field's `label` and `value`. See [the Apple docs](https://developer.apple.com/library/ios/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html) for details.

## Generate the `.pkpass` file

To generate the pass as a Buffer:

```js
import { writeFile } from 'node:fs/promises';

const buf = await pass.asBuffer();
await writeFile('pathToPass.pkpass', buf);
```

Or stream the Buffer directly as an HTTP response:

```js
app.use(async (ctx, next) => {
  ctx.status = 200;
  ctx.type = constants.PASS_MIME_TYPE;
  ctx.body = await pass.asBuffer();
});
```

## "Add to Apple Wallet" button

`getAddToWalletButton({ locale })` returns Apple's localized badge SVG
as a `Buffer` (falls back to `en-US`). Usage must follow Apple's
[Add to Apple Wallet guidelines](https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/).
The repo currently ships a placeholder `en-US.svg`; the maintainer
needs to drop Apple's branded SVG assets into
`src/assets/add-to-wallet/` before the next minor release.

## Troubleshooting with the Console app

If the pass file generates without errors but you can't open it on an iPhone, connect the iPhone to a Mac running macOS 10.14 or later and open the **Console** application. Select your device on the left, then watch for errors emitted while the system tries to add the pass.

## Supply chain safety

- **Zero runtime dependencies.** `@walletpass/pass-js` ships with an empty
  `dependencies` map in `package.json` — everything it needs is either in
  the Node.js standard library or implemented in this repo. Nothing is
  pulled from npm when you install this package.
- **Trusted publishing with provenance.** Releases go to npm via
  [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers)
  (GitHub OIDC, no long-lived token). Every published tarball carries an
  [npm provenance attestation](https://docs.npmjs.com/generating-provenance-statements)
  linking it back to the exact GitHub commit and workflow run that built
  it — verifiable with `npm audit signatures`.

## Stay in touch

- Author — [Konstantin Vyatkin](https://github.com/tinovyatkin)
- Email — tino [at] vtkn.io

## License

`@walletpass/pass-js` is licensed under [AGPL-3.0-or-later](LICENSE).
