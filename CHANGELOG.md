# Changelog

## [7.1.0](https://github.com/tinovyatkin/pass-js/compare/v7.0.0...v7.1.0) (2026-05-11)


### Features

* add iOS 18 / iOS 26 pass keys and typed SemanticTags ([#664](https://github.com/tinovyatkin/pass-js/issues/664)) ([ebcfb99](https://github.com/tinovyatkin/pass-js/commit/ebcfb99de0d81dab46df067522d87c5bf9bdc18b))
* AGPL ([20c9190](https://github.com/tinovyatkin/pass-js/commit/20c9190bb0f1dd68fcc065a64fb356fbb855a1cd))
* replace pkijs CMS signer ([#666](https://github.com/tinovyatkin/pass-js/issues/666)) ([a8b0bf4](https://github.com/tinovyatkin/pass-js/commit/a8b0bf478593bf0af994f0b5778f9c35433fc536))


### Performance

* optimize zip read/write paths ([#669](https://github.com/tinovyatkin/pass-js/issues/669)) ([12f57ad](https://github.com/tinovyatkin/pass-js/commit/12f57ad1d29df821932f6609106d4b960ad8c1c7))


### Code Refactoring

* PNG dimension file reads ([#670](https://github.com/tinovyatkin/pass-js/issues/670)) ([63d0463](https://github.com/tinovyatkin/pass-js/commit/63d046395dfd84c3ecc3167bfa95f27610b0d20e))

## [7.0.0](https://github.com/tinovyatkin/pass-js/compare/v6.9.8...v7.0.0) (2026-05-10)


### ⚠ BREAKING CHANGES

* Drops support for Node < 24.12 and switches to ESM-only. Library now ships as pure ESM; CommonJS consumers must use dynamic import(). Engines pin: ">=24.12.0".

### v7.0.0

* revive the library, ESM + Node 24 + modern toolchain ([#658](https://github.com/tinovyatkin/pass-js/issues/658)) ([7ae5873](https://github.com/tinovyatkin/pass-js/commit/7ae58737408e89c759b06750321ee8dd84e9d9c7))
