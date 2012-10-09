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

# Create your first Passbook

Coming ...

