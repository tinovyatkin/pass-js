## 6.0 May 2019

- Rewritten in TypeScript, so, all the type checking and VSCode InteliSense magic are now available
- **[Breaking]** Switched to properties instead of getters/setters functions:

  ```js
  // was
  pass.foregroundColor("red");
  console.log(pass.foregroundColor()); // -> 'rgb(255, 0, 0)'
  // since 6.0
  pass.foregroundColor = "red";
  console.log(pass.foregroundColor); // -> [255, 0, 0]
  ```

- **[Breaking]** Drop stream API, removing `Pass.render`, `Pass.pipe` and `Pass.stream`. Only available method now is `async pass.asBuffer()` that resolves into a Buffer with ZIP file content:

  ```js
  router.use(async (ctx, next) => {
    ctx.status = 200;
    ctx.type = passkit.constants.PASS_MIME_TYPE;
    ctx.body = await pass.asBuffer();
  });
  ```

  Motivation here is simple: while Node.js originally is all about streams, with async functions in place and relatively small size of pass files it makes no sense to use streams. Removing it makes whole lib way simpler and faster while also improving developer experience.

- **[Breaking]** Structure fields `.add` method now works only with object hash:

  ```js
  // was
  pass.headerFields.add("date", "Date", "Nov 1");
  pass.primaryFields.add([
    { key: "location", label: "Place", value: "High ground" }
  ]);
  // since 6.0 the only call signature available is:
  pass.primaryFields.add({
    key: "location",
    label: "Place",
    value: "High ground"
  });
  ```

- **[Breaking]** Not setting/reading deprecated `barcode` property anymore. Use `barcodes` array.
- **[FIX]** Mutating images and base fields in Pass doesn't affect original template anymore
- **[Feature]** Template `pass.json` can now have comments that will be stripped in resulting pass

- **[May be Breaking]** `Pass` class is not extending `EventEmitter` anymore

## 5.1 Apr 26, 2019

- **[Breaking]** Requires Node >= 10.1 (we use `fs.promises` etc)
- _Feature_ template.setCertificate(process.env.APPLE_PASS_CERTIFICATE);
- _Feature_ template.setPrivateKey(
  process.env.APPLE_PASS_PRIVATE_KEY,
  process.env.APPLE_PASS_KEY_PASSWORD,
  )
- _Feature_ use `process.env.APPLE_WWDR_CERT_PEM` to override Apple Certificate
- Lot of refactoring...

## 4.3 Nov 1, 2017

- Switched from using _in-house_ Zip implementation to `yazl` and refactored `Pass.pipe` for simplier form using `async` function.

## 4.2 Nov 1, 2017

- switched from our fork of `node-apn` to native HTTP2 implementation from Node 8.8 LTS.
- don't compress any file, just store inside of Zip, so, it suppose to be faster and more compatible

## 4.1 October 14, 2017

- added `textDirection` to constants
- added `associatedStoreIdentifiers` into templatable fields (thanks to @antoniomika)

## 4.0 August 19, 2017

- Replaced `openssl` spawning for native JavaScript `node-forge` implementation of manifest signing.

## 3.8 August 17, 2017

- Implemented `Template.pushUpdates(pushToken)` that sends APN update request for a given pass type to a pushToken (get pushToken at PassKit Web Service)

## 3.7 August 15, 2017

- Implemented `Fields.setDateTime(key, label, date, formatOptions = {})` to set date/time style values to a structure fields. Example: `pass.auxiliaryFields.setDateTime('arrival', 'ARRIVAL TIME', arrivalDateObj, { dateStyle: constants.dateTimeFormat.NONE, timeStyle: constants.dateTimeFormat.SHORT })`

## 3.6 August 14, 2017

- Added `setValue(key, value)` method for structure fields to make templating easier. Example: `pass.headerFields.setValue('port', 'New Port')`
- Added tests for `Fields` class to increase test coverage

## 3.5 August 14, 2017

- Impletmented `Pass.stream` that returns `Pass` as a readable stream. Useful for `Koa` responses, etc.

## 3.4 August 13, 2017

- Color values setters at `Template` (`backgroundColor`, `foregroundColor` and `labelColor`) now can accept any valid CSS color string (like 'purple', '#fff', etc) and converts them into `rgb(...)` format that is only acceptable by Apple Wallet pass
- `Pass.validate` enforces `rgb()` style values for color fields
- `Pass.validate` enforces `webServiceURL` and `authenticationToken` to be either both present or both missing
- Exporting `PASS_MIME_TYPE` from `contants`
- Added `expirationDate` and `relevantDate` setters and getter to the `Pass` class that accepts both, `Date` or a `string` and converts that to correct W3C date string (or throws if it's impossible)
- Added `Pass.addLocation` that accepts point value either as GeoJSON array, `{lat, lng}` or `{ longitude: number, latitude: number, altitude?: number }`

## 3.3 August 12, 2017

- implemented `Pass.transitType()` to set/get transit type for board passes (with values validation and constants)
- `Temlate` now loads/stores structure level values and passes them to Passes

## 3.1.0 August 9, 2017

- Added `Template.load` static method to load template, images and key from a folder (no localization support yet, but coming)
- Added blank templates for all possible images
- Increased test coverage

## 3.0.0 August 8, 2017

- Rewritten in ES6 Classes, targetting Node 8
- Moved tests to Jest
- Added some fields values validation
- Refactored deprecated calls
- Addes ESLint + prettier code style enforcement
- Moved to `@destinationstransfers` scoped package (original module seems to not merging any PR in last two years)

## 2.1.1 April 16, 2015

Update package.json with async dependency (tomasdev)

Emit error if it failed to sign the zip with manifest file (tomasdev)

## 2.1.0 March 2, 2015

Add support for Node.js 0.12 and io.js 1.4

Fix failing image tests on Node.js 0.12 and io.js 1.4

Fix failing signature check on Node.js 0.12 and io.js 1.4

Remove unused async dependency

## 2.0.1 November 14, 2012

Fix addImage not working with buffers.

## 2.0.0 November 1, 2012

New API for updating structure fields:

passbook.headerFields.add("time", "The Time", "10:00AM");
passbook.backFields.add({ key: "url", label: "Web site", value: "<http://example.com>" });
console.log(passbook.backFields.get("url"));
passbook.backFields.remove("url");
console.log(passbook.backFields.all());

The `pipe` method no longer accepts a callback, instead, register listener on
the `end` and `error` events.

For HTTP servers, you can use the `render` method.

New optimization to send completes resources first (useful when downloading
images from URLs).

Renamed `createPassbook` to `createPass`.

## 1.1.1 October 24, 2012

Fix piping support for files/HTTP resources.

## 1.1.0 October 24, 2012

API change: instead of generating passbook into a buffer, we pipe it into an
output stream. Like so:

fs = File.createWriteStream("demo.pkpass");
passbook.pipe(fs, function(error) {
. . .
});

You can now add images by specifing an HTTP/S URL.

You can now add images directly to the template, every passbook created from
that template will include these images.

New streaming zip implementation. Passbook is now able to acquire resources
(images) in paralle.

## 1.0.2 October 15, 2012

Should not fail on boardingPass.

Should be able to inspect pass.json: call getPassbookJSON().

## 1.0.1 October 9, 2012

First release. Yay!
