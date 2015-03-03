## 2.1.0  March 2, 2015

Add support for Node.js 0.12 and io.js 1.4

Fix failing image tests on Node.js 0.12 and io.js 1.4

Fix failing signature check on Node.js 0.12 and io.js 1.4

Remove unused async dependency


## 2.0.1  November 14, 2012

Fix addImage not working with buffers.


## 2.0.0  November 1, 2012

New API for updating structure fields:

  passbook.headerFields.add("time", "The Time", "10:00AM");
  passbook.backFields.add({ key: "url", label: "Web site", value: "http://example.com" });
  console.log(passbook.backFields.get("url"));
  passbook.backFields.remove("url");
  console.log(passbook.backFields.all());

The `pipe` method no longer accepts a callback, instead, register listener on
the `end` and `error` events.

For HTTP servers, you can use the `render` method.

New optimization to send completes resources first (useful when downloading
images from URLs).

Renamed `createPassbook` to `createPass`.


## 1.1.1  October 24, 2012

Fix piping support for files/HTTP resources.


## 1.1.0  October 24, 2012

API change: instead of generating passbook into a buffer, we pipe it into an
output stream.  Like so:

  fs = File.createWriteStream("demo.pkpass");
  passbook.pipe(fs, function(error) {
    . . .
  });

You can now add images by specifing an HTTP/S URL.

You can now add images directly to the template, every passbook created from
that template will include these images.

New streaming zip implementation. Passbook is now able to acquire resources
(images) in paralle.


## 1.0.2  October 15, 2012

Should not fail on boardingPass.

Should be able to inspect pass.json: call getPassbookJSON().


## 1.0.1  October 9, 2012

First release.  Yay!
