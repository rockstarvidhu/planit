# Milestone 2 brand verification

The supplied `assets/references/approved-eight-screen-ui.png` and
`assets/references/approved-splash-composition.png` are flattened raster
references. Asset source files were not edited.

## Wordmark

The repository owner explicitly approved the existing lowercase
`assets/branding/rove-wordmark-traced.svg` for Rove UI use in Milestone 3A.
Its original geometry, proportions, paths, and forest-green fill are locked.
`src/components/BrandWordmark.tsx` renders the exact SVG path and viewBox via
`react-native-svg` on Android and web; the source SVG remains the master for
future splash and onboarding work. The PNG preview remains a reference only.
This approval supersedes the earlier `TRACED_VERIFY` status in the archive.

## Mascot

The supplied trimmed PNG is a pixel-identical alpha-bounding-box crop of the
approved original: original 1312×1199, crop `(0, 10, 1284, 1175)`, result
1284×1165. There is no changed color or redrawn pixel. Its tighter framing is
the only difference. Production approval of that derivative is still pending;
Milestone 2 renders only `explorer-walking-original.png`.

## Other assets

All candidate icons and the supplied token JSON remain provisional. Milestone
2.1 uses exact path geometry from five candidate icons (`home`, `plans`,
`bookmark`, `user`, and `search`) in `src/components/LineIcon.tsx`; their
original SVGs are unchanged and this use does not grant final visual approval.
Screen typography uses Android system serif/sans-serif families and web system
Georgia/Arial until approved, licensed fonts are supplied. Active token values
are working interpretations of the references and are not final brand
specifications.
