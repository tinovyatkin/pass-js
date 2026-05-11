# `Add to Apple Wallet` badge assets

This directory holds the localized SVG badge files served by
`getAddToWalletButton({ locale })` (exported from
`@walletpass/pass-js`).

## What you are looking at

**Only a placeholder ships in this repo.** `en-US.svg` is a dashed
rectangle labeled "PLACEHOLDER" — it exists so the tests and the public
API surface are real, but it is NOT Apple's badge and must not be used
in any shipped product.

## Before publishing a minor release

Apple's "Add to Apple Wallet" marks are Apple trademarks. Their use is
governed by the Apple Marketing Guidelines and the Apple Wallet
branding rules:

https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/

The maintainer of this repo must:

1.  Read and agree to the linked guidelines. They cover clearspace,
    minimum size, color variants, disallowed edits, and contexts in
    which the mark may appear.
2.  Download the official localized badge bundle from Apple's
    Marketing Resources page linked above. Apple publishes SVG sources.
3.  Drop each locale file into this directory with the filename
    convention `<locale>.svg`, where `<locale>` is a normalized IETF
    BCP-47 tag that matches one of the values in `AddToWalletLocale`
    in `src/add-to-wallet-button.ts`. Examples:

        en-US.svg
        en-GB.svg
        es-ES.svg
        es-MX.svg
        fr-FR.svg
        fr-CA.svg
        de-DE.svg
        ...

    (The full supported list lives in `AddToWalletLocale`. Keep the
    two in sync.)

## Why the real assets are not in the repo

The author of this library is not Apple and cannot grant a
sub-license for Apple's marks. Committing the branded SVGs to a
public GitHub repo would distribute Apple's trademarked artwork
without Apple's permission and could put downstream consumers in an
unclear licensing position. Each maintainer / fork owner should
fetch the assets directly from Apple's guidelines page under their
own Apple Developer account, keeping the license chain clean.

## Packaging

The build step copies this directory to `dist/assets/add-to-wallet/`
so bundled consumers get the SVGs alongside the compiled JS. The
`package.json` `files` array publishes `dist/**/*.svg`; don't rename
the SVGs without updating that glob.

Bundler integration: the helper uses
`new URL('./assets/add-to-wallet/<locale>.svg', import.meta.url)` +
`readFileSync`, which is the esbuild-recognized pattern for
statically traced assets. Consumers bundling for Lambda / edge
runtimes should enable their bundler's file-asset handling.
