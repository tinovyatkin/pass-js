[![npm (scoped)](https://img.shields.io/npm/v/@walletpass/pass-js.svg)](https://www.npmjs.com/package/@walletpass/pass-js) [![codecov](https://codecov.io/gh/walletpass/pass-js/branch/master/graph/badge.svg)](https://codecov.io/gh/walletpass/pass-js)
[![Known Vulnerabilities](https://snyk.io/test/github/walletpass/pass-js/badge.svg?targetFile=package.json)](https://snyk.io/test/github/walletpass/pass-js?targetFile=package.json) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=walletpass_pass-js&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=walletpass_pass-js) [![tested with jest](https://img.shields.io/badge/tested_with-jest-99424f.svg)](https://github.com/facebook/jest) [![install size](https://packagephobia.now.sh/badge?p=@walletpass/pass-js)](https://packagephobia.now.sh/result?p=@walletpass/pass-js)


<img src="https://docs-assets.developer.apple.com/published/c104c9bff0/841b02dd-b78c-4cad-8da4-700761d34e14.png" alt="Apple Wallet logo" width="216" height="216" align="left">

# @walletpass/pass-js

<p align="center">A Node.js library for generating Apple Wallet passes with localizations, NFC and web service push updates support. Written in Typescript.</p>

<br><br><br>


# Installation

Install with `NPM` or `yarn`:
```sh
npm install @walletpass/pass-js --save

yarn add @walletpass/pass-js
```



# Get your certificates

To start with, you'll need a certificate issued by [the iOS Provisioning
Portal](https://developer.apple.com/ios/manage/passtypeids/index.action). You
need one certificate per Pass Type ID.

After adding this certificate to your Keychain, you need to export it as a
`.p12` file first (go to Keychain Access, My Certificates and right-click to export), then convert that file into a `.pem` file using the `passkit-keys` command:

```sh
./bin/passkit-keys ./pathToKeysFolder
```
or openssl
```sh
openssl pkcs12 -in <exported_cert_and_private_key>.p12 -clcerts -out com.example.passbook.pem -passin pass:<private_key_password>
```

and copy it into the keys directory.

The [Apple Worldwide Developer Relations Certification
Authority](https://www.apple.com/certificateauthority/) certificate is not needed anymore since it is already included in this package.

# Start with a template

Start with a template. A template has all the common data fields that will be
shared between your passes.

```js
const { Template } = require("@walletpass/pass-js");

// Create a Template from local folder, see __test__/resources/passes for examples
// .load will load all fields from pass.json,
// as well as all images and com.example.passbook.pem file as key
// and localization string too
const template = await Template.load(
  "./path/to/templateFolder",
  "secretKeyPasswod"
);

// or
// create a Template from a Buffer with ZIP content
const s3 = new AWS.S3({ apiVersion: "2006-03-01", region: "us-west-2" });
const s3file = await s3
  .getObject({
    Bucket: "bucket",
    Key: "pass-template.zip"
  })
  .promise();
const template = await Template.fromBuffer(s3file.Body);

// or create it manually
const template = new Template("coupon", {
  passTypeIdentifier: "pass.com.example.passbook",
  teamIdentifier: "MXL",
  backgroundColor: "red",
  sharingProhibited: true
});
await template.images.add("icon", iconPngFileBuffer)
                     .add("logo", pathToLogoPNGfile)
```

The first argument is the pass style (`coupon`, `eventTicket`, etc), and the
second optional argument has any fields you want to set on the template.

You can access template fields directly, or from chained accessor methods, e.g:

```js
template.passTypeIdentifier = "pass.com.example.passbook";
template.teamIdentifier = "MXL";
```

The following template fields are required:

- `passTypeIdentifier` - The Apple Pass Type ID, which has the prefix `pass.`
- `teamIdentifier` - May contain an I

You can set any available fields either on a template or pass instance, such as: `backgroundColor`,
`foregroundColor`, `labelColor`, `logoText`, `organizationName`,
`suppressStripShine` and `webServiceURL`.

In addition, you need to tell the template where to find the key file:

```js
await template.loadCertificate(
  "/etc/passbook/certificate_and_key.pem",
  "secret"
);
// or set them as strings
template.setCertificate(pemEncodedPassCertificate);
template.setPrivateKey(pemEncodedPrivateKey, optionalKeyPassword);
```

If you have images that are common to all passes, you may want to specify them once in the template:

```js
// specify a single image with specific density and localization
await pass.images.add("icon", iconFilename, "2x", "ru");
// load all appropriate images in all densities and localizations
await template.images.load("./images");
```

You can add the image itself or a `Buffer`. Image format is enforced to be **PNG**.

Alternatively, if you have one directory containing the template file `pass.json`, the key
`com.example.passbook.pem` and all the needed images, you can just use this single command:

```js
const template = await Template.load(
  "./path/to/templateFolder",
  "secretKeyPasswod"
);
```

You can use the options parameter of the template factory functions to set the `allowHttp` property. This enables you to use a `webServiceUrl` in your `pass.json` that uses the HTTP protocol instead of HTTPS for development purposes:

```js
const template = await Template.load(
  "./path/to/templateFolder",
  "secretKeyPasswod",
  {
    allowHttp: true,
  },
);
```

# Create your pass

To create a new pass from a template:

```js
const pass = template.createPass({
  serialNumber: "123456",
  description: "20% off"
});
```

Just like the template, you can access pass fields directly, e.g:

```js
pass.serialNumber = "12345";
pass.description = "20% off";
```

In the JSON specification, structure fields (primary fields, secondary fields,
etc) are represented as arrays, but items must have distinct key properties. Le
sigh.

To make it easier, you can use methods of standard Map object or `add` that
will do the logical thing. For example, to add a primary field:

```js
pass.primaryFields.add({ key: "time", label: "Time", value: "10:00AM" });
```

To get one or all fields:

```js
const dateField = pass.primaryFields.get("date");
for (const [key, { value }] of pass.primaryFields.entries()) {
  // ...
}
```

To remove one or all fields:

```js
pass.primaryFields.delete("date");
pass.primaryFields.clear();
```

Adding images to a pass is the same as adding images to a template (see above).

# Working with Dates
If you have [dates in your fields](https://developer.apple.com/library/archive/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/FieldDictionary.html#//apple_ref/doc/uid/TP40012026-CH4-SW6) make sure they are in ISO 8601 format with timezone or a `Date` instance. 
 For example:

```js
const { constants } = require('@walletpass/pass-js');

pass.primaryFields.add({ key: "updated", label: "Updated at", value: new Date(), dateStyle: constants.dateTimeFormat.SHORT, timeStyle: constants.dateTimeFormat.SHORT });

// there is also a helper setDateTime method
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
// main fields also accept Date objects
pass.relevantDate = new Date(2020, 1, 1, 10, 0);
template.expirationDate = new Date(2020, 10, 10, 10, 10);
```

# Localizations

This library fully supports both [string localization](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html#//apple_ref/doc/uid/TP40012195-CH4-SW54) and/or [images localization](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html#//apple_ref/doc/uid/TP40012195-CH4-SW1):

```js
// everything from template
// will load all localized images and strings from folders like ru.lproj/ or fr-CA.lproj/
await template.load(folderPath);

// Strings

pass.localization
  .add("en-GB", {
    GATE: "GATE",
    DEPART: "DEPART",
    ARRIVE: "ARRIVE",
    SEAT: "SEAT",
    PASSENGER: "PASSENGER",
    FLIGHT: "FLIGHT"
  })
  .add("ru", {
    GATE: "ВЫХОД",
    DEPART: "ВЫЛЕТ",
    ARRIVE: "ПРИЛЁТ",
    SEAT: "МЕСТО",
    PASSENGER: "ПАССАЖИР",
    FLIGHT: "РЕЙС"
  });

// Images

await template.images.add(
  "logo" | "icon" | etc,
  imageFilePathOrBufferWithPNGdata,
  "1x" | "2x" | "3x" | undefined,
  "ru"
);
```

Localization applies for all fields' `label` and `value`. There is a note about that in [documentation](https://developer.apple.com/library/ios/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html).

# Generate the file

To generate a file:

```js
const buf = await pass.asBuffer();
await fs.writeFile("pathToPass.pkpass", buf);
```

You can send the buffer directly to an HTTP server response:

```js
app.use(async (ctx, next) => {
  ctx.status = 200;
  ctx.type = passkit.constants.PASS_MIME_TYPE;
  ctx.body = await pass.asBuffer();
});
```

# Troubleshooting with Console app

If the pass file generates without errors but you aren't able to open your pass on an iPhone, plug the iPhone into a Mac with macOS 10.14+ and open the 'Console' application. On the left, you can select your iPhone. You will then be able to inspect any errors that occur while adding the pass.

## Stay in touch

* Author - [Konstantin Vyatkin](https://github.com/tinovyatkin)
* Email - tino [at] vtkn.io

## License

`@walletpass/pass-js` is [MIT licensed](LICENSE).

# Financial Contributors

Become a financial contributor and help us sustain our community. [[Contribute](https://opencollective.com/walletpass/contribute)]

