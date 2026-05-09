# pass-js — maintainer notes for Claude Code

Apple Wallet pass (`.pkpass`) generator. Shipped as pure ESM. Published
to npm as `@walletpass/pass-js`. Repo lives at
`github.com/tinovyatkin/pass-js`; the owner is the same person for npm
and GitHub.

## Commands you'll use

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Build | `npm run build` (runs `tsgo --project tsconfig.json`) |
| Lint | `npm run lint` (runs `oxlint --type-aware && oxfmt --check`) |
| Auto-format | `npm run format` |
| Test | `npm test` (builds, then `node --test "__tests__/*.ts"`) |
| Coverage | `node --test --experimental-test-coverage --test-reporter=spec "__tests__/*.ts"` |

All three "quality gates" (build, lint, test) must stay green.

## Architecture at a glance

```
src/
  index.ts          — public API (Template, Pass, constants, SemanticTags types)
  constants.ts      — TOP_LEVEL_FIELDS map + barcode/transit/density enums
  interfaces.ts     — all TypeScript types for the Apple PassKit schema
  pass.ts           — Pass class; serializes a pass to a .pkpass Buffer
  template.ts       — Template class; loads from folder / buffer, owns cert+key
  types.d.ts        — ambient declarations for color-name + imagesize
  lib/
    base-pass.ts    — Shared getter/setter layer (visual, dates, semantics)
    pass-structure.ts — headerFields / primaryFields / ... per-style containers
    fieldsMap.ts    — ordered Map<string, FieldDescriptor>
    images.ts       — image validation + localized variants
    localizations.ts — .lproj strings + UTF-16 LE serialization
    zip.ts          — in-repo ZIP reader + STORE writer (replaces yauzl + do-not-zip)
    sign-manifest.ts — PKCS#7 SignedData via pkijs + node:crypto; WWDR G4 inlined
    nfc-fields.ts   — NFC dictionary helpers
    semantic-tags.ts — recursive Date→W3C normalization for iOS 18 semantics
    pass-color.ts   — parse 'rgb(...)', '#FFF', named colors into triplets
    get-geo-point.ts, normalize-locale.ts, get-buffer-hash.ts, w3cdate.ts
```

## Non-obvious things

- **The WWDR cert is inlined as a base64 string** in `src/lib/sign-manifest.ts`,
  not read from `keys/wwdr.pem` at runtime. That file is documentation only.
  To rotate: download the new G-series cert from
  `https://www.apple.com/certificateauthority/`, extract the base64 between
  `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`, replace the
  `APPLE_WWDR_G4_PEM` constant, update the comment banner, run
  `openssl x509 -in keys/wwdr.pem -noout -dates` against the updated
  `keys/wwdr.pem` to sanity-check. The `APPLE_WWDR_CERT_PEM` env var
  overrides at runtime for dev/test.

- **Apple's manifest hash is SHA-1.** `src/lib/get-buffer-hash.ts` is
  deliberately SHA-1; Apple's pkpass spec requires it. Don't bump to
  SHA-256. The PKCS#7 signature over `manifest.json` is what carries
  authenticity.

- **Tests import from `dist/`, not `src/`.** Node's native TS strip mode
  doesn't rewrite internal `.js` import specifiers, so `npm test` builds
  first. This also exercises the exact artifact that gets published.

- **Bundle-friendliness is a requirement.** No `__dirname`, no
  `require.resolve()`, no dynamic imports of user-controlled strings in
  `src/`. The library must work under esbuild / ncc for Lambda. The
  filesystem APIs (`Template.load(path)`, `loadCertificate(path)`) are
  opt-in — bundled consumers should use `new Template()` +
  `setCertificate(pem)` + `images.add('icon', buffer)`.

- **`tsgo` is preview.** If emit ever fails on a d.ts edge case, fall
  back to classic `typescript`: `npm i -D typescript && npx tsc -p tsconfig.json`.
  All current source compiles cleanly under both.

- **Test signing uses self-generated certs.** The `APPLE_PASS_*` env
  vars that were in CI since 2019 have been expired for years.
  `__tests__/signManifest.ts` and `__tests__/pass.ts` now shell out to
  `openssl req -x509` to generate throwaway Pass Type ID certs. For
  live APN push testing, set `APPLE_PASS_CERTIFICATE`,
  `APPLE_PASS_PRIVATE_KEY`, `APPLE_PASS_KEY_PASSWORD`, and
  `APPLE_PUSH_TOKEN` — the `template.ts#push updates` test will then
  run.

## Git hooks (optional)

We use `hk` (jdx/hk) — a Rust-native Git 2.53 hook manager. It's a
system binary, not an npm dep:

```
brew install hk        # or: cargo install hk, mise use hk
hk install             # one-time, wires up native Git hooks
```

`hk.pkl` configures pre-commit (oxlint + oxfmt) and pre-push (tests).
Contributors without `hk` can still commit/push; CI is the enforcement.

## Release process

Use Conventional Commits. `release-please` observes pushes to `master`
and opens a PR bumping the version + CHANGELOG based on commit types:
`feat:` → minor, `fix:`/`perf:` → patch, `feat!:`/`BREAKING CHANGE:` → major,
`chore:`/`docs:`/`refactor:`/`test:`/`ci:` → no release.

Merging that PR creates a GitHub Release, which triggers `publish.yml`
to publish via npm trusted publishing (OIDC, no token secret). One-time
setup on npmjs.com: `@walletpass/pass-js` → Settings → Trusted
Publisher → add the GitHub repo + workflow filename `publish.yml`.

## Manual QA that CI can't do

Before cutting a new release, generate a real `.pkpass` with your own
Pass Type ID cert and install it on a physical iPhone (iOS 18+).
Confirm Wallet opens it without "This pass cannot be read by Wallet"
errors. Automated tests verify the ZIP structure, signature validity,
and schema shape, but Apple's Wallet validator has heuristics only the
device can exercise.
