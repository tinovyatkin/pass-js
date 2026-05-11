# Gap analysis: `@walletpass/pass-js` vs. `passkit-generator`

> **📌 Historical baseline (pre-PR #664).** This document describes the
> gap between pass-js (7.0.1) and passkit-generator v3.5.7 **as of
> 2026-05-10, before any implementation work landed**. P0, P1, P2, and
> P3 (iOS 18 event-ticket keys, iOS 26 enhanced boarding-pass keys,
> typed `SemanticTags`, `upcomingPassInformation`, and Personalization)
> are **implemented in this PR** — see the PR description for the
> current state. The
> matrix and priority plan below are preserved as the rationale for
> the change; do not use them to assess current coverage.

**Prepared:** 2026-05-10 · **Compared against:** `passkit-generator` v3.5.7
(`c31332b`, released 2025-12-25) · **Scope:** Apple Wallet pass-generation
feature coverage only. Build/runtime/crypto differences are noted but are
not the focus.

## 1. Executive summary

`pass-js` has a tighter, more modern runtime core (minimal in-repo CMS
writer + `node:crypto` instead of `node-forge`, in-repo ZIP reader/writer
instead of `yauzl`+`do-not-zip`, full ESM, PNG dimension validation,
APN push via `http2`, WWDR cert rotation warnings). `passkit-generator`
has broader **schema coverage** — particularly for iOS 18 event ticket
extensions, iOS 26 enhanced boarding passes, and the new
`upcomingPassInformation` structure — and exposes a few packaging
primitives (`.pkpasses` multi-pass bundles, `getAsRaw()` / `getAsStream()`
output modes, `from()` clone) that `pass-js` lacks.

The largest functional gaps, in decreasing priority:

1. **iOS 18 event-ticket layout** top-level keys (Event Guide URLs,
   color/styling flags, auxiliary app identifiers, `additionalInfoFields`,
   `eventLogoText`).
2. **iOS 26 enhanced/semantic boarding pass** top-level keys (flight
   entertainment, baggage, lounge, service URLs + transit provider
   contact fields).
3. **iOS 26 `upcomingPassInformation`** (poster event tickets, chained
   upcoming events with remote images + `dateInformation`).
4. **Semantic-tag schema drift** — `pass-js` accepts *any* object under
   `semantics` without type-level hints for the ~35 iOS 18 and ~20
   iOS 26 additions (admissionLevel, eventStartDateInfo, boardingZone,
   passengerCapabilities, etc.).
5. **Personalization** (`personalization.json` + personalization logo,
   for NFC reward cards) — not implemented at all.
6. **Packaging primitives** — `.pkpasses` multi-pass bundle, raw-files
   output, stream output, clone-from-pass.
7. **Validation depth** — global field-key uniqueness, `preferredStyleSchemes`/
   pass-type cross-validation, transitType-required-on-close for
   `boardingPass`, NFC allowed on non-storeCard styles.

`pass-js` strengths that `passkit-generator` does **not** have, and
which should be preserved while closing the gaps:

- No `node-forge` dependency (CVE-prone historically); signature chain
  is a minimal in-repo CMS writer + `node:crypto`. If Node adds native
  CMS/PKCS#7 signing support, replace the internal writer with that API.
- Bundled WWDR G4 with `process.emitWarning` 90 days before expiry.
- Own ZIP reader/writer (works with Lambda / Cloudflare Workers without
  native modules).
- PNG dimension validation per image type and density.
- UTF-16 LE `pass.strings` writer/reader with BOM (Apple-spec compliant;
  `passkit-generator` writes UTF-8 which Wallet tolerates but doesn't
  match the doc).
- APN push updates via HTTP/2.

---

## 2. Side-by-side feature matrix

Legend: ✅ present · ⚠️ partial · ❌ missing

### 2.1 Top-level `pass.json` keys

| Key | Spec origin | `pass-js` | `passkit-generator` |
|---|---|---|---|
| `formatVersion`, `description`, `organizationName`, `passTypeIdentifier`, `teamIdentifier`, `serialNumber` | base | ✅ | ✅ |
| `sharingProhibited` | iOS 11 | ✅ | ✅ |
| `appLaunchURL`, `associatedStoreIdentifiers` | base | ✅ | ✅ |
| `userInfo` | base | ⚠️ passes through in `toJSON`, no setter | ✅ (validated) |
| `groupingIdentifier` | base | ✅ | ✅ |
| `suppressStripShine`, `logoText` | base | ✅ | ✅ |
| `maxDistance`, `beacons`, `locations` | base | ✅ | ✅ |
| `relevantDate` (deprecated iOS 18) | base | ✅ | ✅ |
| `relevantDates` (iOS 18) | new | ✅ | ✅ |
| `expirationDate`, `voided` | base | ✅ | ✅ |
| `barcodes` / `barcode` (deprecated) | base | ✅ (`barcodes`) / ⚠️ keeps `barcode` in typings but no setter | ✅ (auto-fill helper from string) |
| `backgroundColor`, `foregroundColor`, `labelColor` | base | ✅ (rich `PassColor` class, accepts rgb()/hex/named/tuple) | ✅ (hex string only) |
| `stripColor` | undocumented | ✅ | ✅ |
| `nfc` | base (storeCard) | ⚠️ restricted to `storeCard` only | ✅ (any style) |
| `semantics` | base + iOS 18 + iOS 26 | ⚠️ passthrough, no type safety, no validation | ✅ full Joi schema (see §2.4) |
| `webServiceURL` + `authenticationToken` | base | ✅ | ✅ |
| `preferredStyleSchemes` | iOS 18 / 26 | ⚠️ only `'posterEventTicket' \| 'eventTicket'` (missing `'boardingPass' \| 'semanticBoardingPass'`) | ✅ all four values |
| **Event Guide URLs (iOS 18, posterEventTicket)** | | | |
| `bagPolicyURL`, `orderFoodURL`, `parkingInformationURL`, `directionsInformationURL`, `purchaseParkingURL`, `merchandiseURL`, `transitInformationURL`, `accessibilityURL`, `addOnURL`, `contactVenueEmail`, `contactVenuePhoneNumber`, `contactVenueWebsite`, `transferURL`, `sellURL` | iOS 18 | ❌ all missing | ✅ all present |
| `suppressHeaderDarkening` | iOS 18 | ❌ | ✅ |
| `footerBackgroundColor` | iOS 18 | ❌ | ✅ |
| `useAutomaticColors` | iOS 18 | ❌ | ✅ |
| `auxiliaryStoreIdentifiers` | iOS 18 | ❌ | ✅ |
| `eventLogoText` | iOS 18.1 | ❌ | ✅ |
| `upcomingPassInformation` | iOS 26 | ❌ | ✅ |
| **Enhanced/Semantic Boarding Pass URLs (iOS 26)** | | | |
| `changeSeatURL`, `entertainmentURL`, `purchaseAdditionalBaggageURL`, `purchaseLoungeAccessURL`, `purchaseWifiURL`, `upgradeURL`, `managementURL`, `registerServiceAnimalURL`, `reportLostBagURL`, `requestWheelchairURL`, `transitProviderEmail`, `transitProviderPhoneNumber`, `transitProviderWebsiteURL` | iOS 26 | ❌ all missing | ✅ all present |

### 2.2 Pass-structure fields (per style)

| Field | `pass-js` | `passkit-generator` |
|---|---|---|
| `headerFields`, `primaryFields`, `secondaryFields`, `auxiliaryFields`, `backFields` | ✅ (`FieldsMap` helper) | ✅ (`FieldsArray` helper) |
| `transitType` (boardingPass) | ✅ (ref error if accessed on non-boardingPass) | ✅ (validated on close) |
| `auxiliaryFields.row` (0 \| 1, eventTicket only) | ⚠️ allowed but not restricted to eventTicket | ✅ restricted via `PassFieldContentWithRow` |
| `additionalInfoFields` (eventTicket, iOS 18) | ❌ | ✅ |
| Global key-uniqueness across all field groups | ❌ (each `FieldsMap` is independent) | ✅ (`sharedKeysPool`) |
| Sets pass style resets previous style's fields | ⚠️ `style` setter deletes other styles but keeps current structure | ✅ explicit reset |

### 2.3 `PassFieldContent` (single field) keys

| Key | `pass-js` | `passkit-generator` |
|---|---|---|
| `key`, `value`, `label` | ✅ | ✅ |
| `attributedValue` | ✅ (typed `string \| number`) | ✅ (typed `string \| number \| Date`) |
| `changeMessage` | ✅ | ✅ |
| `dataDetectorTypes` | ✅ | ✅ |
| `textAlignment` | ✅ | ✅ |
| `dateStyle`, `timeStyle`, `ignoresTimeZone`, `isRelative` | ✅ | ✅ |
| `numberStyle`, `currencyCode` | ✅ | ✅ |
| `semantics` (per-field) | ✅ (passthrough) | ✅ (Joi-validated) |

### 2.4 Semantic tags (iOS 18 / iOS 26 additions)

`passkit-generator` ships a 960-line Joi schema
(`src/schemas/Semantics.ts`) covering everything Apple has published.
`pass-js` treats `semantics` as an opaque `SemanticTagObject`; only the
Date-to-W3C normalization runs, so invalid payloads reach Wallet and are
silently discarded.

Tags **only** in `passkit-generator`'s typed surface:

**iOS 18 (event ticket, new layout):**
`admissionLevel`, `admissionLevelAbbreviation`, `albumIDs`, `airplay`,
`attendeeName`, `additionalTicketAttributes`, `entranceDescription`,
`eventLiveMessage`, `eventStartDateInfo` (with `EventDateInfo.unannounced`/
`undetermined` in iOS 18.1), `playlistIDs`, `tailgatingAllowed`,
`venueGatesOpenDate`, `venueParkingLotsOpenDate`, `venueBoxOfficeOpenDate`,
`venueDoorsOpenDate`, `venueFanZoneOpenDate`, `venueOpenDate`,
`venueCloseDate`, `venueRegionName`, `venueEntranceGate`,
`venueEntranceDoor`, `venueEntrancePortal`, `seatAisle`, `seatLevel`,
`seatSectionColor`.

**iOS 26 (enhanced boarding pass):**
`boardingZone`, `departureCityName`, `departureLocationSecurityPrograms`,
`departureLocationTimeZone`, `destinationCityName`,
`destinationLocationSecurityPrograms`, `destinationLocationTimeZone`,
`internationalDocumentsAreVerified`,
`internationalDocumentsVerifiedDeclarationName`, `loungePlaceIDs`,
`membershipProgramStatus`, `passengerAirlineSSRs`,
`passengerCapabilities`, `passengerEligibleSecurityPrograms`,
`passengerInformationSSRs`, `passengerServiceSSRs`, `ticketFareClass`.

Because `pass-js`'s `SemanticTags = SemanticTagObject` is typed as
`{ [key: string]: SemanticTagValue }`, users can still write any of these
today — they're just undiscoverable, untyped, and uncaught when
misspelled.

### 2.5 Secondary structures

| Structure | `pass-js` | `passkit-generator` |
|---|---|---|
| `Beacon` | ✅ minimal (proximityUUID) | ✅ + `major`/`minor` 0–65535 validation |
| `Location` | ✅ | ✅ |
| `Barcode` | ✅ (messageEncoding **required**) | ✅ (messageEncoding defaults to `iso-8859-1`) |
| `NFC` | ✅ (with `setPublicKey(pem)` helper + P-256 enforcement) | ✅ (plain validation only) |
| `Personalize` (`personalization.json`) | ❌ | ✅ |
| `SemanticTagType.CurrencyAmount`, `Location`, `PersonNameComponents`, `Seat`, `WifiNetwork`, `EventDateInfo` | ❌ (untyped passthrough) | ✅ |

### 2.6 Packaging / export

| Capability | `pass-js` | `passkit-generator` |
|---|---|---|
| `.pkpass` Buffer output | ✅ `pass.asBuffer()` | ✅ `pass.getAsBuffer()` |
| `.pkpass` stream output | ❌ | ✅ `pass.getAsStream()` |
| `.pkpass` raw (path → buffer) output | ❌ | ✅ `pass.getAsRaw()` |
| `.pkpasses` multi-pass bundle (zip-of-pkpass, MIME `application/vnd.apple.pkpasses`) | ❌ | ✅ `PKPass.pack(...passes)` |
| Clone pass → pass with prop overrides | ⚠️ via `Template.fromBuffer(await src.asBuffer())` | ✅ `PKPass.from(src, overrides)` |
| Load template from folder | ✅ `Template.load(path)` | ✅ (via `from()` with `{ model, certificates }`) |
| Reconstruct template from buffer (e.g. S3-fetched pkpass) | ✅ `Template.fromBuffer(buf)` | ⚠️ `PKPass.from(PKPass)` only clones, not raw zip |
| Localization from folder, `.lproj/pass.strings` | ✅ (UTF-16 LE + BOM) | ✅ (UTF-8) |
| Localized images (`<lang>.lproj/icon@2x.png`) | ✅ (per-density, per-lang) | ✅ |

### 2.7 Signing & crypto

| Capability | `pass-js` | `passkit-generator` |
|---|---|---|
| PKCS#7 detached SignedData over `manifest.json` | ✅ minimal in-repo CMS writer + `node:crypto` | ✅ `node-forge` |
| WWDR bundled | ✅ G4, PEM inlined with rotation warning hooked into `process.emitWarning` at 90-day window | ❌ — caller must supply every time |
| WWDR override for dev | ✅ `APPLE_WWDR_CERT_PEM` env var | n/a |
| Encrypted private key handling | ✅ via `createPrivateKey({ passphrase })` | ✅ via forge's `decryptRsaPrivateKey` |
| SHA-1 manifest hash (per Apple spec) | ✅ | ✅ |
| APN push notification | ✅ `http2` native | ❌ |
| Browser/Cloudflare Workers friendly | ✅ (bundle-clean, no `__dirname`) | ⚠️ — `PKPass` pulls `node:stream` + `node:path`; `Joi.binary` has fallback |

### 2.8 Image handling

| Capability | `pass-js` | `passkit-generator` |
|---|---|---|
| PNG signature check | ✅ | ❌ (trusts caller) |
| PNG dimension validation per image type + density | ✅ | ❌ |
| Densities: `1x`/`2x`/`3x` | ✅ | ✅ |
| Localized images per lang | ✅ | ✅ |
| Personalization logo | ❌ | ✅ (auto-strip if not used) |

---

## 3. Priority plan

### P0 — iOS 18 event-ticket parity (ship within current minor cycle)

The largest user-visible surface. Everything here is already live in the
field (iOS 18 GA'd 2024-09-16) and Wallet silently ignores unknown keys,
so "it still works" masks the gap — users building event tickets with
`pass-js` cannot opt into the new layout at all.

1. **Top-level event-ticket URL keys.** Add typed setters on
   `PassBase` (or a new `EventTicketKeys` mixin) for
   `bagPolicyURL`, `orderFoodURL`, `parkingInformationURL`,
   `directionsInformationURL`, `purchaseParkingURL`, `merchandiseURL`,
   `transitInformationURL`, `accessibilityURL`, `addOnURL`,
   `contactVenueEmail`, `contactVenuePhoneNumber`, `contactVenueWebsite`,
   `transferURL`, `sellURL`.
   *Cost:* ~14 setter pairs following the existing pattern in
   `src/lib/base-pass.ts:160-250`. One test fixture asserting they
   round-trip into `pass.json`.

2. **Event-ticket styling flags.** `suppressHeaderDarkening` (bool),
   `footerBackgroundColor` (PassColor), `useAutomaticColors` (bool),
   `auxiliaryStoreIdentifiers` (number[]), `eventLogoText` (string).
   *Cost:* 5 setters, 1 test.

3. **`additionalInfoFields`** on event-ticket pass structure.
   Extend `src/interfaces.ts:339` `PassCommonStructure` with an optional
   `additionalInfoFields?: Field[] | FieldsMap`, extend
   `src/lib/pass-structure.ts` the same way the other field groups are
   wired (but only instantiate if `style === 'eventTicket'`). Add to
   `STRUCTURE_FIELDS` in `src/constants.ts:237`.
   *Cost:* ~30 LOC + test.

4. **Extend `preferredStyleSchemes`** union to include
   `'boardingPass' | 'semanticBoardingPass'` (iOS 26; cheap to add
   now). `src/interfaces.ts:433`.

5. **Semantic-tag type hints.** Replace the
   `SemanticTags = SemanticTagObject` passthrough with a discriminated,
   mostly-optional interface covering the ~35 iOS 18 fields listed in
   §2.4. Keep the fallback to the generic record so users can write
   future fields before we type them. *Cost:* 1 interface file, no
   runtime change.

**Total P0 effort:** ~1.5 engineer-days including tests and CHANGELOG.
No breaking changes — pure additive `feat:` commits.

### P1 — iOS 26 boarding pass parity

Ships with iOS 26 (GA'd autumn 2025 per Apple's pass spec); the
semantic boarding pass template is opt-in via `preferredStyleSchemes`
so absent keys silently no-op, but anyone targeting airlines/rail in
2026+ will want these.

1. **Transit provider / service URL keys.** Add setters for
   `changeSeatURL`, `entertainmentURL`, `purchaseAdditionalBaggageURL`,
   `purchaseLoungeAccessURL`, `purchaseWifiURL`, `upgradeURL`,
   `managementURL`, `registerServiceAnimalURL`, `reportLostBagURL`,
   `requestWheelchairURL`, `transitProviderEmail`,
   `transitProviderPhoneNumber`, `transitProviderWebsiteURL`.
   Same pattern as P0 #1. *Cost:* 13 setters, 1 test.

2. **iOS 26 semantic tags.** Add to the typed interface from P0 #5:
   `boardingZone`, `passengerCapabilities` (enum array),
   `passengerEligibleSecurityPrograms` (enum array),
   `departureLocationSecurityPrograms`,
   `destinationLocationSecurityPrograms`, `ticketFareClass`,
   `membershipProgramStatus`, `loungePlaceIDs`, `departureCityName`,
   `destinationCityName`, `departureLocationTimeZone`,
   `destinationLocationTimeZone`,
   `internationalDocumentsAreVerified`,
   `internationalDocumentsVerifiedDeclarationName`,
   `passengerAirlineSSRs`, `passengerInformationSSRs`,
   `passengerServiceSSRs`. *Cost:* interface extension only.

**Total P1 effort:** ~1 day.

### P2 — `upcomingPassInformation` (iOS 26)

This is the largest new structure in the 2025-2026 Wallet cycle — it
lets a pass declare future related events (multi-day concerts, season
passes, chained flights) with remote imagery fetched over HTTPS
against a SHA256 allowlist.

Full shape lives at
`/tmp/passkit-generator/src/schemas/UpcomingPassInformation.ts:190-261`
and pulls in nested `Image` (`URLs: [{ SHA256, URL, scale, size }]`,
`reuseExisting`), `Images` (headerImage, venueMap), `URLs` (14 event
guide URLs mirroring P0 #1), `DateInformation` (date, `timeZone`,
`ignoreTimeComponents`, `isAllDay`, `isUnannounced`, `isUndetermined`),
plus the required `identifier`/`name`/`type: "event"` contract.

*Cost:* ~200 LOC schema types + 1 setter that cross-validates
against `preferredStyleSchemes.includes('posterEventTicket')` + 1
pass fixture + test. **1–2 engineer-days.**

Validation to mirror from `passkit-generator`:

- `type` must be `'event'`
- `identifier` + `name` required
- Image `SHA256` required; `size` ≤ 2 MiB
- Only valid when `style === 'eventTicket'` and
  `preferredStyleSchemes` includes `'posterEventTicket'`

### P3 — Personalization (`personalization.json` + logo)

Apple's PassKit Personalization flow for NFC reward cards. Rarely
used but blocks anyone migrating an existing passkit-generator
integration that depends on it.

Files involved in a personalized pass:

- `personalization.json` with `description`, `requiredPersonalizationFields`
  (`PKPassPersonalizationFieldName` / `…PostalCode` / `…EmailAddress` /
  `…PhoneNumber`), optional `termsAndConditions`.
- `personalizationLogo.png` + `@2x` / `@3x`.

Requirements for shipping (per Apple doc + passkit-generator's behavior):
the bundle needs BOTH `nfc` set AND a personalization logo AND
`personalization.json` — if any is absent, strip silently. Match that
defensive behavior.

*Cost:* new `src/lib/personalization.ts` (~80 LOC), update
`src/lib/images.ts` to accept `personalizationLogo` as an image type,
update `src/pass.ts:asBuffer` to strip conditionally. Test with a
self-signed personalized storeCard round-trip. **~1 day.**

### P4 — Packaging primitives

1. **`.pkpasses` bundle** (`application/vnd.apple.pkpasses`) — a zip of
   `.pkpass` files. `passkit-generator` exposes `PKPass.pack(...passes)`.
   Useful for airline boarding-pass batches, family tickets, etc.
   *Implementation:* re-use `src/lib/zip.ts` `writeZip`, outer filename
   pattern `packed-pass-N.pkpass`, return `Buffer`. Add a static
   `Pass.pack(...passes)` on the `Pass` class. *Cost:* ~40 LOC + test.

2. **`asStream()`** — wrap the Buffer in a `Readable.from()` for
   streaming upload to S3 / CloudFront. *Cost:* 5 LOC + test.

3. **`asRaw()`** — return `{ [filePath]: Buffer }`, letting the caller
   choose their own zipper. Useful for serverless environments that
   already do streaming compression. *Cost:* ~20 LOC (would refactor
   `asBuffer` to derive from it) + test.

**Total P4 effort:** ~half day.

### P5 — Validation depth

These are safety nets that catch mistakes on the developer's side.
Not strictly necessary (Wallet tolerates unknown keys and duplicate
keys silently), but prevent subtle bugs.

1. **Global field-key uniqueness** across header/primary/secondary/aux/back.
   Mirror passkit-generator's `sharedKeysPool` pattern in
   `src/lib/pass-structure.ts`. Throw or warn on collision. *Cost:* ~30 LOC + test.

2. **Close-time validation** — when building the pass:
   - `boardingPass` without `transitType` → throw (currently no check).
   - `upcomingPassInformation` without `'posterEventTicket'` in
     `preferredStyleSchemes` → throw.
   - `useAutomaticColors` + explicit `foregroundColor`/`labelColor` →
     warn (Apple ignores the explicit ones).
3. **Allow NFC on any pass style** — Apple spec allows it on any style,
   not just `storeCard`. `src/lib/pass-structure.ts:131-137` currently
   throws for non-storeCard. Relax the guard.

**Total P5 effort:** ~1 day.

### P6 — Deprecations & nice-to-haves

- Keep `relevantDate` singular setter but emit a `process.emitWarning`
  on first use, pointing at `relevantDates`.
- Add `EventDateInfo.unannounced` / `undetermined` typings once
  `eventStartDateInfo` is exposed.
- Barcode auto-fill helper: `pass.setBarcodes('payload')` expands into
  four `BarcodeFormat` fallbacks (QR, PDF417, Aztec, Code128), matching
  `passkit-generator`'s convenience signature.
- Accept PEM for NFC `encryptionPublicKey` in the top-level setter too
  (pass-js already has `NFCField.setPublicKey`, but not at the pass
  level).

---

## 4. Recommended release cadence

| Release | Contents | Breaking? |
|---|---|---|
| 7.1.0 | P0 (iOS 18 event ticket parity) | no |
| 7.2.0 | P1 (iOS 26 boarding pass URLs + semantic tags) | no |
| 7.3.0 | P2 (`upcomingPassInformation`) | no |
| 7.4.0 | P4 (`pack`, `asStream`, `asRaw`) + P5 (validation) | P5 #3 could be an edge case — current throws become silent passes; probably non-breaking since nobody was hitting it on purpose |
| 7.5.0 | P3 (personalization) | no |
| 7.x.0 | P6 (polish) | no |

Everything is additive — no `feat!:` commits required. Only P5 #3
(NFC on non-storeCard) crosses into silently-now-accepts territory, and
that's a capability expansion rather than a removal.

---

## 5. Things `pass-js` does better — preserve when closing gaps

Before touching the P0–P6 work, keep these advantages intact:

1. **`PassColor` accepts hex, `rgb(...)`, named colors, and
   `[r, g, b]` tuples.** Don't shrink to plain hex strings like
   `passkit-generator` does.
2. **PNG dimension validation per image type and density** catches
   sizing bugs at `template.load()` time, before Wallet rejects the
   pass on device. Keep the check in the new
   `personalizationLogo` path too (P3).
3. **APN push via HTTP/2** — no plans to rip out. `Template.pushUpdates`
   is a `pass-js` exclusive; document it more loudly.
4. **Native WWDR rotation warning** — keep `WALLETPASS_WWDR_EXPIRING`/
   `…_EXPIRED`. If we rotate to G5, bump the constant name in
   `src/lib/sign-manifest.ts:38` but keep the warning wiring.
5. **UTF-16 LE `pass.strings` with BOM** — correct per Apple's docs.
   `passkit-generator` writes UTF-8 which Wallet tolerates but the
   spec says otherwise.
6. **Own zip reader/writer in `src/lib/zip.ts`** — removed `yauzl`
   and `do-not-zip` deps, works in Lambda/Workers. Any new packaging
   primitives (P4) should layer on this, not pull in a new dependency.
7. **No `node-forge` dependency** — last rotated out in v7; don't
   regress. `node-forge` has had a steady CVE cadence (most recently
   CVE-2025-12816 hit passkit-generator's 3.5.6).

---

## 6. Appendix: line-level references

passkit-generator source examined (all paths relative to the cloned
repo at `/tmp/passkit-generator`):

- `src/PKPass.ts:32-1212` — main class, setters, getters, manifest
  assembly, close-time validation.
- `src/schemas/index.ts:105-574` — `PassProps` interface; single source
  of truth for iOS 18 / iOS 26 top-level key inventory.
- `src/schemas/index.ts:599-1037` — Joi validators for same.
- `src/schemas/Semantics.ts:1-962` — semantic-tag schema.
- `src/schemas/SemanticTagType.ts:1-203` — `EventDateInfo`,
  `CurrencyAmount`, `Seat` (with iOS 18 additions `seatAisle`,
  `seatLevel`, `seatSectionColor`), `PersonNameComponents`,
  `WifiNetwork`, `Location`.
- `src/schemas/PassFields.ts:1-52` — structure fields incl.
  `additionalInfoFields`.
- `src/schemas/PassFieldContent.ts:33-115` — field dictionary.
- `src/schemas/UpcomingPassInformation.ts:1-261` — iOS 26 upcoming pass
  info (the biggest single new structure).
- `src/schemas/Personalize.ts:1-30` — personalization schema.
- `src/schemas/NFC.ts`, `Beacon.ts`, `Location.ts`, `Barcode.ts`,
  `Certificates.ts` — leaf validators.
- `src/Bundle.ts:1-178` — Bundle class with `getAsBuffer`,
  `getAsStream`, `getAsRaw`, `freezable`.
- `src/FieldsArray.ts:1-117` — shared-keys-pool logic.
- `src/Signature.ts:1-130` — PKCS#7 via node-forge (reference only).
- `src/StringsUtils.ts` — UTF-8 pass.strings parser.

pass-js source examined:

- `src/interfaces.ts:517-525` — `ApplePass` composition (missing
  iOS 18 / iOS 26 key mixins).
- `src/interfaces.ts:339-362` — `PassCommonStructure` (missing
  `additionalInfoFields`).
- `src/lib/base-pass.ts:196-203` — `preferredStyleSchemes` setter
  (needs union extension).
- `src/lib/pass-structure.ts:131-137` — NFC storeCard restriction to
  relax.
- `src/lib/semantic-tags.ts:48-50` — `SemanticTags` passthrough
  (needs interface).
- `src/constants.ts:237-243` — `STRUCTURE_FIELDS` (append
  `additionalInfoFields`).
- `src/constants.ts:70-99` — `IMAGES` (append
  `personalizationLogo` in P3).
- `src/pass.ts:63-96` — `asBuffer` (wrap with `asRaw` / `asStream`
  in P4, branch for personalization stripping in P3).
- `src/lib/zip.ts` — reused for `.pkpasses` bundle.

End of report.
