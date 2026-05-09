# pass-js — maintainer notes for Claude Code

Apple Wallet pass (`.pkpass`) generator. Shipped as pure ESM. Published
to npm as `@walletpass/pass-js`. Repo lives at
`github.com/tinovyatkin/pass-js`; the owner is the same person for npm
and GitHub.

For human contributors, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Commands you'll use

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Build | `npm run build` (runs `tsgo --project tsconfig.json`) |
| Lint | `npm run lint` (runs `oxlint --type-aware && oxfmt --check`) |
| Auto-format | `npm run format` |
| Test | `npm test` (builds, then `node --enable-source-maps --test "__tests__/*.ts"`) |
| Coverage | `node --enable-source-maps --test --experimental-test-coverage --test-reporter=spec "__tests__/*.ts"` |
| Single test | `npm run build && node --enable-source-maps --test __tests__/pass.ts` |
| Pre-push check | `hk run pre-push` (or just push — hk fires automatically if installed) |

All three "quality gates" (build, lint, test) must stay green.

## Architecture at a glance

Items marked **🔓 public** are re-exported from `index.ts` — changes to
their signatures are breaking (need `feat!:` commit).

```
src/
  index.ts          — 🔓 public API surface: Template, Pass, constants, SemanticTag* types
  constants.ts      — 🔓 TOP_LEVEL_FIELDS map + barcode/transit/density enums
  interfaces.ts     — 🔓 all TypeScript types for the Apple PassKit schema
  pass.ts           — 🔓 Pass class; serializes a pass to a .pkpass Buffer
  template.ts       — 🔓 Template class; loads from folder / buffer, owns cert+key
  types.d.ts        — ambient declarations for color-name + imagesize (internal)
  lib/              — all internal; nothing below is re-exported
    base-pass.ts    — shared getter/setter layer (visual, dates, semantics)
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

- **The WWDR cert is inlined as a PEM string** in `src/lib/sign-manifest.ts`,
  not read from `keys/wwdr.pem` at runtime. That file is documentation
  only. To rotate (Apple rotates this roughly every decade):
  1. Download the new G-series cert from
     <https://www.apple.com/certificateauthority/> (verify the
     generation is for Pass Type ID signing — G4 currently, per Apple's
     own "features supported" table).
  2. Convert DER → PEM: `openssl x509 -inform DER -in AppleWWDRCAGN.cer -out keys/wwdr.pem`.
  3. In `sign-manifest.ts`, replace the whole `APPLE_WWDR_G4_PEM`
     constant (rename if the generation number changed), update the
     comment banner (valid-from / valid-to / SHA-256 fingerprint — get
     the fingerprint with `openssl x509 -in keys/wwdr.pem -noout -fingerprint -sha256`),
     and update the `parsePkiCertificate(APPLE_WWDR_G4_PEM)` call.
  4. Run `npm test` — the sign round-trip and image-hash tests catch
     most classes of breakage.
  - The `APPLE_WWDR_CERT_PEM` env var overrides at runtime for dev/test.
  - The library emits a `WALLETPASS_WWDR_EXPIRING` process warning when
    the bundled cert is within 90 days of expiry, and
    `WALLETPASS_WWDR_EXPIRED` once it's past. If a user reports either,
    the fix is to rotate via the steps above and cut a release.

- **Apple Pass Type ID cert (the SIGNING cert, different from WWDR)
  expires every 12 months.** You regenerate it, not me. Steps:
  1. Log into the [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/passTypeId)
     → Certificates → `+` → "Pass Type ID Certificate" → pick your
     Pass Type ID → upload a fresh CSR → download the issued `.cer`.
  2. Convert to PEM: `openssl x509 -inform DER -in pass.cer -out pass.pem`.
  3. For CI: `gh secret set APPLE_PASS_CERTIFICATE < pass.pem` and
     `gh secret set APPLE_PASS_PRIVATE_KEY < passkey.pem`. (The CI
     secrets that were in the repo since 2019 have been expired since
     2020; currently tests self-generate throwaway certs — see below.)

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
  back to classic `typescript`: `npm i -D typescript && npx tsc`.
  All current source compiles cleanly under both.

- **Line endings are pinned LF by `.gitattributes`.** Windows
  contributors whose editor auto-CRLFs will see files get LF-normalized
  on commit. This is deliberate — `oxfmt` and the localization tests
  both depend on LF-only line endings; see the fix in commit
  `f68a795` for the pre-existing cross-platform bug it plugged.

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
`feat:` → minor, `fix:`/`perf:` → patch, `feat!:` / `BREAKING CHANGE:` → major,
`chore:`/`docs:`/`refactor:`/`test:`/`ci:` → no release.

Breaking-change syntax is load-bearing. Two accepted forms:

```
feat!: drop Node < 24 support         # `!` before the colon
                                       # or

feat: drop Node < 24 support

BREAKING CHANGE: engines.node is now >=24.12.0.
```

Nothing else triggers a major bump — putting "breaking change" in
prose without the footer is silently ignored by release-please.

Merging the release PR creates a GitHub Release, which triggers
`publish.yml` to publish via npm trusted publishing (OIDC, no token
secret). One-time setup on npmjs.com: `@walletpass/pass-js` → Settings
→ Trusted Publisher → add the GitHub repo + workflow filename
`publish.yml`.

## Debugging a red CI build

- `gh run list --branch <branch> --limit 3` shows recent runs.
- `gh run view <id> --json jobs --jq '.jobs[] | "\(.name): \(.conclusion // .status)"'`
  gives per-shard pass/fail at a glance.
- `gh run view <id> --log-failed | tail -50` pulls the failed step tail.
- For bundle-smoke, Codecov, and mehen failures: those jobs run once
  each, so the only "shard" is Ubuntu.
- Coverage report: <https://app.codecov.io/github/tinovyatkin/pass-js>.
  The lcov reporter uses `src/*.ts` paths via `--enable-source-maps`;
  if Codecov complains about "path mismatch", that flag is the first
  thing to check.

## Manual QA that CI can't do

Before cutting a new release, generate a real `.pkpass` with your own
Pass Type ID cert and install it on a physical iPhone (iOS 18+).
Confirm Wallet opens it without "This pass cannot be read by Wallet"
errors. Automated tests verify the ZIP structure, signature validity,
and schema shape, but Apple's Wallet validator has heuristics only the
device can exercise.
