# ROVE — First launch through budget planning | Asset handoff v1

This ZIP contains **real reusable asset files**, not only a showcase mockup.

## Approved source assets
- `brand/rove-wordmark-approved.svg`: user-approved lowercase wordmark.
- `mascot/approved/explorer-walking-original.png`: original approved mascot, copied without alteration.
- `mascot/approved/explorer-walking-trimmed.png`: previously verified trim.
- `references/`: original approved visual reference images, not assets to render as app screens.

## New, PROVISIONAL assets
- `icons/provisional/`: 29 coherent 24×24 editable SVG icons; design candidates, not formally approved.
- `illustrations/`: standalone SVG hill/splash scenes, concept art requiring review.
- `brand/rove-wordmark-light-ON-DARK-PROPOSED.svg`: proposed contrast treatment; the approved source is untouched.
- `tokens/rove-theme.json`: theme/type proposals.

## Not included / not falsely claimed
- New original mascot poses: holding map, resting, celebrating are NOT production-ready; see `mascot/concepts/README.md`.
- Real venue photography: must be licensed and accurately linked to venues.
- Font binaries: not redistributed; see `fonts/FONT_SETUP.md`.
- Final Android adaptive launcher icon: requires a separate approval and platform-specific export.

## Use
Import only approved source assets automatically. Treat all new SVGs as candidate art requiring visual review. Use SVGs with `react-native-svg` or a compatible bundling strategy. Keep references separate from production UI.

See `docs/SCREEN_ASSET_MAP.md` for mapping from Splash to budget planning.
