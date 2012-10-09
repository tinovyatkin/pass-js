# Get your certificates

To start with, you'll need a certificate issued by [the iOS Provisioning
Portal](https://developer.apple.com/ios/manage/passtypeids/index.action).  You
need one certificate per Passbook Type ID.

After adding this certificate to your Keychain, you need to export it as a
`.p12` file and copy it into the keys directory.

You will also need the 'Apple Worldwide Developer Relations Certification
Authority' certificate and to conver the `.p12` files into `.pem` files.  You
can do both using the `node-passbook prepare-keys` command:

```
node-passbook prepare-keys -p keys
```

This is the same directory into which you placet the `.p12` files.


# Start with a template

Start with a template.  A template has all the common data fields that will be
shared between your passbook, and also defines the keys to use for signing it.

```
var createTemplate = require("passbook");

var template = createTemplate("coupon", {
  passTypeIdentifier: "pass.com.example.passbook",
  teamIdentifier:     "MXL",
  "backgroundColor":   "rgb(255,255,255)"
});
template.keys("/etc/passbook/keys", "secret");
```

The first argument is the Passbook style (`coupon`, `eventTicket`, etc), and the
second optional argument has any fields you want to set on th template.

You can access template fields directly, or from chained accessor methods, e.g:

```
template.fields.passTypeIdentifier = "pass.com.example.passbook";
console.log(template.passTypeIdentifier());
template.teamIdentifier("MXL").
  passTypeIdentifier("pass.com.example.passbook")
```

The template fields are `passTypeIdentifier`, `teamIdentifier`,
`backgroundColor`, `foregroundColor`, `labelColor`, `logoText`,
`organizationName`, `suppressStripShine` and `webServiceURL`.

The first two are required: `passTypeIdentifier` is the Passbook Type ID, begins
with "pass." and has to be registered with Apple.  The `teamIdentifier` may
contain an I.

All other fields can be set on either template or passbook.


# Create your passbook

To create a new passbook from a template:

```
var passbook = template.createPassbook({
  serialNumber:  "123456",
  description:   "20% off"
});
```

Just like template, you can access Passbook fields directly, or from chained
accessor methods, e.g:

```
passbook.fields.serialNumber = "12345";
console.log(passbook.serialNumber());
passbook.serialNumber("12345").
  description("20% off");
```

You can also access structure fields directly, or from chained accessor methods.
The following three are equivalent:

```
passbook.fields.coupon.headerFields = header;
passbook.structure.headerFields = header;
passbook.headerFields(header);
```

Same drill when it comes to adding images to your Passbook:

```
passbook.images.icon = iconFilename;
passbook.icon(iconFilename);
```

You can add the image itself (`Buffer`), the name of a file containing the image
(`String`), or a function that will be called to load the image, and should pass
an error, or `null` and a `Buffer` to its callback.

Finally, to generate a Passbook file:

```
passbook.generate(function(error, buffer) {
  if (error) {
    console.log(error);
  } else {
    File.writeFile("passbook.pkpass", buffer);
  }
});
```

