# Changelog

## [7.0.0](https://github.com/tinovyatkin/pass-js/compare/v6.9.8...v7.0.0) (2026-05-10)


### ⚠ BREAKING CHANGES

* Drops support for Node < 24.12 and switches to ESM-only. Library now ships as pure ESM; CommonJS consumers must use dynamic import(). Engines pin: ">=24.12.0".

### v7.0.0

* revive the library, ESM + Node 24 + modern toolchain ([#658](https://github.com/tinovyatkin/pass-js/issues/658)) ([7ae5873](https://github.com/tinovyatkin/pass-js/commit/7ae58737408e89c759b06750321ee8dd84e9d9c7))
