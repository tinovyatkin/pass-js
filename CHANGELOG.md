## 1.2.0  October 26, 2012

New API for updating structure fields:

  passbook.headerFields.add("time", "The Time", "10:00AM");
  passbook.backFields.add("url", "Web site", "http://example.com");
  console.log(passbook.backFields.get("url"));
  passbook.backFields.remove("url");
  console.log(passbook.backFields.all());

passbook.pipe is now passbook.writeToOutputStream, which better reflects what it
does.

Added passbook.render to render a Passbook to an HTTP response.

Should send complete bufferred resources first.


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
