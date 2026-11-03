# Rove FTUE → budget planning asset integration map

Reviewed 3 November 2026. This is an inspection and implementation handoff, not screen implementation. The ZIP remains at `/Users/vidhu/Downloads/ROVE_FTUE_to_Budget_Planning_Assets_v1.zip` (SHA-256 `bb43fcf43a249c52e8736a5108806221f12104b0b4dff9dffaccf65879f69a81`). Its 53 files were extracted byte-for-byte under `ROVE_FTUE_to_Budget_Planning_Assets_v1/` in this directory. No existing `assets/` file was replaced. Paths in the tables below are relative to that extracted folder unless stated otherwise.

## Source of truth and status

- **Discover:** `references/Rove Discover App Light and Dark Modes.png`, copied unaltered from Downloads (1536×1024). This latest approved light/dark screenshot supersedes the older eight-screen UI reference **for Discover**. It shows a budget-first planning card above the category chips and popular places, with light and dark treatments. This screenshot is a visual reference only; no UI elements or mascot artwork should be cropped from it.
- **Approved source art:** `brand/rove-wordmark-approved.svg` (byte-identical to existing `assets/branding/rove-wordmark-traced.svg`) and `mascot/approved/explorer-walking-original.png` (byte-identical to existing original). These are the source files to reuse in implementation.
- **Approval conflict:** The package labels `mascot/approved/explorer-walking-trimmed.png` approved and says the trim was verified, while the repository's `BRAND_VERIFICATION.md` still calls the derivative pending production approval. Its bytes match the existing trimmed PNG. Use the original until that status is reconciled.
- **Reference/derived:** `brand/rove-wordmark-approved-preview.png`, `references/approved-eight-screen-ui.png`, and `references/approved-splash-composition.png`. All duplicate existing files. The older Discover frame is superseded by the new screenshot; the splash reference remains useful for Splash.
- **Provisional:** `brand/rove-wordmark-light-ON-DARK-PROPOSED.svg`; all 37 `icons/provisional/*.svg`; all four `illustrations/*-PROPOSED.svg`; `tokens/rove-theme.json`. The latest screenshot depicts a light wordmark on dark, but the supplied contrast variant is explicitly proposed and needs source-art approval.
- **Documentation only:** `README.md`, `docs/SCREEN_ASSET_MAP.md`, `fonts/FONT_SETUP.md`, `mascot/concepts/README.md`. The font binaries are not included. These files inform implementation but do not themselves approve provisional artwork.

The package README says there are 29 coherent 24×24 icons. Inspection found **37 icons**: 32 have `0 0 24 24` viewBoxes and five (`back`, `calendar`, `home`, `menu`, `plans`) retain `0 0 128 128` viewBoxes. Review scale and stroke consistency before using the set together.

## Screen mapping

| Screen or shared UI | Assets to use or evaluate | Status and integration note |
|---|---|---|
| Splash | Approved wordmark SVG; original mascot; `illustrations/splash-landscape-light-PROPOSED.svg`, `splash-landscape-dark-PROPOSED.svg`; `references/approved-splash-composition.png` | Source wordmark and mascot approved. Scenery is a concept and requires visual sign-off; reference PNG is not a splash asset. |
| Welcome | Approved wordmark SVG and original mascot; `illustrations/hero-hills-light-PROPOSED.svg`, `hero-hills-dark-PROPOSED.svg` | Hills and a Welcome-specific composition need approval. |
| Optional onboarding: location | `icons/provisional/map-pin.svg`, `location.svg`, `search.svg`, `map.svg`, `arrow-right.svg`, `back.svg` | All icon candidates; no location permission or screen behavior implied by the assets. |
| Optional onboarding: budget and group | `icons/provisional/wallet.svg`, `users.svg`, `plus.svg`, `minus.svg`, `arrow-right.svg` | Icon candidates. Budget/group values and flow require product specification. |
| Discover header and search | Approved wordmark SVG and original mascot; `icons/provisional/user.svg`, `search.svg`; latest Discover light/dark screenshot | The screenshot is the current visual source of truth. Its map-holding mascot appearance has no standalone approved asset; do not crop it from the screenshot. Greeting should use a real known name only when available. |
| Discover budget-first planning card | `icons/provisional/wallet.svg`, `users.svg`, `clock.svg`, `arrow-right.svg`; proposed hero hills and theme JSON; original mascot only if composition permits | New card is authoritative in the latest screenshot. The holding-map mascot pose is missing. Do not substitute a crop or represent the proposed hills as approved. |
| Discover category chips | `icons/provisional/coffee.svg`, `utensils.svg`, `mountain.svg`, `calendar-heart.svg` | Candidate icons for Cafe, Food, Nature, Date ideas. |
| Discover popular places | `icons/provisional/bookmark.svg`, `bookmark-filled.svg`; `rove-mobile/assets/demo/*.jpg` (outside this package) | New ZIP contains **no venue photographs**. Existing CC0 photos are local demo data and are not the screenshot's venue imagery or verified listings. |
| Four-tab navigation | `icons/provisional/compass.svg`, `map.svg`, `bookmark.svg`, `user.svg`; existing 128×128 `plans.svg` may be compared | All candidates. The screenshot shows Discover, Plans, Saved, You; review inconsistent viewBoxes and active-state treatments. |
| Planning constraints | `icons/provisional/wallet.svg`, `users.svg`, `clock.svg`, `map-pin.svg`, `edit.svg`, `arrow-left.svg`, `arrow-right.svg`, `chevron-down.svg` | Candidate controls only; final measurements and interaction details remain open. |
| Mood/activity preferences | `icons/provisional/coffee.svg`, `utensils.svg`, `mountain.svg`, `calendar-heart.svg`, `heart.svg` | Candidate icons. Photo tiles or final category art are absent. |
| Light/dark shared theme | `tokens/rove-theme.json`; proposed light-on-dark wordmark and light/dark scenery SVGs; `icons/provisional/sun.svg`, `moon.svg` | Theme values and dark wordmark treatment are proposals. Use screenshot to assess visual fidelity, but confirm dark brand asset and theme values before release. |
| Other shared actions | Remaining provisional icons: `bookmark-filled`, `calendar`, `check`, `close`, `filter`, `home`, `info`, `menu`, `refresh`, `route`, `settings`, `share` | Keep in handoff for future review; do not add decorative controls without behavior. |
| Typography | `fonts/FONT_SETUP.md` proposes DM Serif Display and Inter | No font files bundled. Obtain licensed binaries from the official distributors before installation or continue with system-font fallback. |

## Existing assets and duplication policy

Eleven handoff files are byte-identical to current `rove-mobile/assets/` files: both wordmark files (`.svg` and preview `.png`), both mascot PNGs, both older reference PNGs, and `back.svg`, `calendar.svg`, `home.svg`, `menu.svg`, `plans.svg`. They remain in the extracted handoff to preserve archive provenance; implementation should reference the existing approved source copies where possible and should not copy these into active assets again.

Of the 37 icon names, 13 are new to the repository (`arrow-left`, `bookmark-filled`, `calendar-heart`, `chevron-down`, `coffee`, `compass`, `map`, `minus`, `moon`, `mountain`, `sun`, `users`, `utensils`); five are byte-identical as listed above; and 19 share an existing name but have **different bytes**. Do not overwrite existing candidate icons by filename. Review each changed candidate before any explicit promotion into active app assets.

## Gaps before screen work

1. A standalone approved map-holding mascot is absent, although the new budget card depicts one. `mascot/concepts/README.md` confirms this gap.
2. The light-on-dark wordmark, scenery variants, icon family, and theme tokens remain provisional.
3. Real venue imagery matching the latest Discover screenshot is absent; existing demo photos are separately licensed sample assets.
4. Approved font binaries and final Android adaptive icon assets are absent.
5. The package docs' icon count and size claim differs from the archive; use the verified inventory above.
