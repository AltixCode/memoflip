# Memoflip — handoff

What was actually run, and what is still unknown. **Unverified is `UNKNOWN`,
never a pass** — a green build is not a verification.

Last updated: 2026-09-15

## Verification state

| Gate | State | Evidence |
|---|---|---|
| Lint | ✅ | `npm run verify` 2026-09-15 |
| Typecheck | ✅ | `npm run verify` 2026-09-15 |
| Unit tests | ✅ | `npm run verify` 2026-09-15 |
| i18n completeness (14 locales) | ✅ | `npm run check:i18n`, 14 locales complete |
| UI rules (colour tokens, `t()`) | ✅ | `npm run check:ui` |
| iOS + Android bundle export | ✅ | `expo export` both platforms, 2026-09-15 |
| CI green on a self-hosted runner | ✅ | success — run 34975880786, 2026-09-15 |
| `check:release` with real identifiers | ✅ | passed in CI with the real identifiers (same run) |
| Builds, installs, launches on the iOS simulator | ⬜ | not run here; device passes belong to dev-7b |
| Renders in light **and** dark on device | ⬜ | not run here |
| Every feature driven on the Android emulator | ⬜ | not run here |
| Purchase flow exercised against a real offering | ⬜ | needs a build on hardware |
| Ads served under real consent | ⬜ | needs a build on hardware |

`check:release` fails in a normal shell on purpose: the identifiers are GitHub
Actions secrets, never files in the repo. A local failure means "this shell has
no secrets", not "the app is misconfigured". CI is where that gate means
something, because CI is where the values are.

## Store and service state

| | State | Id |
|---|---|---|
| Bundle id registered | ✅ | `com.altixcode.memoflip` |
| App Store Connect record | ✅ | `6812380663` — store name "Memoflip Memory Match" |
| App Store category | ✅ | GAMES / ENTERTAINMENT |
| Reviewer contact and notes | ✅ | set 2026-09-15, notes written for this app |
| App Store availability (territories) | ✅ | all 175 territories |
| iOS IAP created and priced | ✅ | remove-ads non-consumable, $3.99, localised |
| Play Console app | ⛔ | blocked: account quota, `429 RESOURCE_EXHAUSTED` at 15 apps; support request filed |
| AdMob app — iOS | ✅ | `ca-app-pub-2504845459806550~9661554900` |
| AdMob app — Android | ✅ | `ca-app-pub-2504845459806550~7699315555` |
| AdMob ad units (6) | ✅ | iOS banner/interstitial/rewarded `3956792925` / `3134665841` / `3376927169`; Android `6303754663` / `2521431482` / `2643711256` |
| AdMob ids wired into CI | ✅ | all ten secrets present on the repo |
| AdMob GDPR + US-states messages published | ✅ | published account-wide, covers every app |
| App Store content rights declaration | ✅ | DOES_NOT_USE_THIRD_PARTY_CONTENT |
| App Store listing copy | ✅ | description, keywords and promotional text, written for this app |
| App Store screenshots | ❌ | **none** — needs the app running on hardware |
| RevenueCat project, apps, entitlement, offering | ✅ | project `projee497d76`, entitlement `entlefe4d4fc83`, offering `ofrng0d0f31d423` |
| RevenueCat In-App Purchase Key | ❌ | missing account-wide — see below |

## Decisions the owner owns

- Publish on altixcode.com and itsata.com? **Not yet asked.**

## Known UNKNOWNs

- **Nothing on this app has run on real hardware.** Launch, the core flow, the
  purchase and the ads are unverified, and the rows above say so.
- **RevenueCat has no In-App Purchase Key**, account-wide across all 44 apps.
  Without it StoreKit 2 validation is degraded, which shows up as a purchase
  that succeeds on device and never grants the entitlement — the user pays and
  the ads stay. Being handled by dev-3a.
- **The iOS record now needs only two things: a build, and screenshots.**
  Both require the app running on real hardware, which is also what keeps
  the IAP at MISSING_METADATA — its review screenshot must show the real
  paywall. Everything else on the App Store side is done.
