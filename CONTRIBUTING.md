# Contributing to `@walletpass/pass-js`

Thanks for wanting to help. This is a small library with a tight scope —
generating valid Apple Wallet `.pkpass` files — so contributions that stay
inside that scope and keep the dependency footprint minimal are most likely
to land quickly.

## Setup

```sh
# Prereqs: Node 24.12+ (see .nvmrc), npm 11+
nvm use   # or: mise use
npm ci
npm run build && npm test
```

One-time Git hook wiring (optional but recommended — matches what CI runs):

```sh
# Install hk (https://hk.jdx.dev) — Rust binary, no npm footprint
brew install hk           # or: cargo install hk, or: mise use hk
hk install                # one-time wires native Git 2.53 hooks
```

Now `git commit` runs oxfmt + oxlint (auto-fix), and `git push` runs the
test suite.

## Commits: Conventional Commits are required

Release automation (`release-please`) bumps the version and generates the
changelog directly from commit messages. **Breaking the format breaks the
release pipeline**, so please follow it:

| Prefix | Bump | Changelog section | Example |
|---|---|---|---|
| `feat:` | minor | Features | `feat: add appLaunchURL mapping` |
| `fix:` | patch | Bug Fixes | `fix: reject invalid Date in semantics` |
| `perf:` | patch | Performance | `perf: cache CRC table at module load` |
| `feat!:` or `BREAKING CHANGE:` footer | **major** | Features + BREAKING note | `feat!: drop Node < 24` |
| `deps:` | patch | Dependencies | `deps: bump pkijs 3.4 → 3.5` |
| `docs:`, `refactor:`, `test:`, `ci:`, `chore:`, `build:`, `style:` | — | hidden | `docs: clarify WWDR rotation flow` |

Scopes are optional (`feat(nfc): ...`). Keep the subject line ≤ 72 chars.
Body is free-form; put the "why" there, not the "what".

## Before opening a PR

All three quality gates must be green. They'll run in CI regardless; running
them locally first saves a round-trip:

```sh
npm run build     # tsgo, must emit cleanly
npm run lint      # oxlint (type-aware) + oxfmt --check
npm test          # builds, then runs __tests__/ against dist/
```

If you touch cryptographic code in `src/lib/sign-manifest.ts`, also manually
verify the round-trip on a real pkpass with a test cert — CLAUDE.md has the
recipe under "Manual QA."

## Scope

Welcome:
- Bug fixes (especially around Apple spec compliance or edge-case passes).
- Schema additions that track current Apple Wallet documentation.
- Documentation clarifications.
- Test coverage expansion.

Think twice or open an issue first:
- New runtime dependencies — the v7 goal was to minimize these. We dropped
  6 deps in the rewrite; please don't re-add surface area without a clear
  case.
- Order tracking (Wallet Orders / `order.json`) — a whole second package
  format with its own certificate flow; out of scope for this library.
- Features that require writing to the filesystem — the library should stay
  bundler-friendly for Lambda / edge runtimes. Use Buffer/string APIs.

## Architecture notes

See [CLAUDE.md](./CLAUDE.md) for the non-obvious bits — why SHA-1 is
deliberate in manifest hashing, how the WWDR cert is inlined for bundle
safety, why tests import from `dist/` rather than `src/`, etc.
