# Rove Asset Library v2 integration review

Date: 31 October 2026. Milestone 1 checkpoint: `48c41474d24957ea7bcaea97a9bb7de7f7328e23`.
The asset library was imported in Milestone 1 and reviewed for this Milestone 2
checkpoint. Discover renders only the approved original mascot; no other
imported artwork is used by a screen or app configuration.

## Archive validation

- Source: supplied `ROVE_Asset_Library_v2.zip` outside the repository. SHA-256:
  `70851f7017c6316f770ca64f9a8dfebd980738c29f032d11405dc4f3522ebe07`.
- `unzip -t` passed. The archive has 34 entries, 5,913,385 uncompressed bytes:
  5 PNGs, 25 SVGs, two Markdown files, and two JSON files. No absolute/traversal
  paths, symlinks, or duplicate file names or content hashes were found.
- All 30 graphic paths listed in the supplied `ASSET_INVENTORY.json` exist and
  match their SHA-256 hashes. No referenced graphic is absent. PNGs decoded
  successfully and matched the manifest dimensions. The original mascot,
  trimmed mascot, and wordmark preview contain transparent pixels; the two
  flattened references are opaque. The trimmed mascot pixels are exactly the
  alpha-bounding-box crop of the original, with no recoloring or redraw.
- All 25 SVGs parse as XML and contain an SVG root plus path geometry; the
  wordmark has one path and viewBox `340 184 1483 419`. No script,
  `foreignObject`, external link, DTD, or entity declaration was found. These
  structural checks do not constitute visual approval of the wordmark trace.
- Archive Markdown was read as provenance data only. No script or instruction
  from the archive was executed.

## Imported files and approval

Thirty graphic files were copied byte-for-byte with original filenames:

| Destination | Count | Classification |
|---|---:|---|
| `assets/mascot/` | 2 PNG | Original: **APPROVED**. Exact trimmed crop: **PROVISIONAL** for production use. |
| `assets/branding/` | 1 SVG, 1 PNG | Traced wordmark: **PROVISIONAL** pending silhouette check. Preview: **REFERENCE**. |
| `assets/references/` | 2 PNG | **REFERENCE** flattened UI/splash compositions only. |
| `assets/icons/provisional/` | 24 SVG | **PROVISIONAL** candidate icons, not used by the app. |
| `assets/tokens/` | 1 JSON | **PROVISIONAL** design values, not applied to screens. |

Thus the 30 graphics are **1 APPROVED, 26 PROVISIONAL, 3 REFERENCE**; the one
token file is also PROVISIONAL. Full per-file dimensions, paths, intended uses,
and limitations are in `ASSET_INVENTORY.md`. No imported file was renamed;
only parent folders changed. The original ZIP and its metadata were not
imported into Git.

The archive labels the wordmark `TRACED_VERIFY` despite placing it under
`approved/`. Its supplied geometry is untouched, but approval of this trace
against the master wordmark is not documented. The original explorer PNG is
the sole unambiguous approved production artwork in this archive.

## SVG and Expo integration

React Native does not treat source SVG paths as ordinary PNG image files.
Preserve the original wordmark SVG as the master supplied file. When a screen
needs it, select an Expo-compatible SVG rendering path, such as `react-native-svg`
with a reviewed build-time transform, and verify the rendered silhouette at
Android screen densities. The PNG preview is for comparison only. Do not
replace the path with a font approximation or rasterize the master in place.
The provisional icon SVGs must not be wired into navigation until approved.

The two reference PNGs include flattened device UI and imagery. They are
design guidance, not native screens, splash assets, or sources of extractable
individual icons and illustrations. The current Expo `app.json` intentionally
does not point to them as an app icon or splash image.

## Proposed tokens

The supplied `assets/tokens/design-tokens.proposed.json` describes seven
approximate colors: forest `#193829`, muted forest `#365E4C`, ivory `#F5F2E9`,
sage `#DDE4D8`, ink `#172B24`, muted text `#65766E`, and line `#D8DDD4`.
It proposes spacing `4, 8, 12, 16, 20, 24, 32, 40, 48, 64` and radii `8,
14, 22, 999` px. Typography is described only as an editorial serif display
face and clean sans-serif body face, with no family names or licenses.

`src/design/tokens.provisional.ts` mirrors these values in a typed structure.
Milestone 2's `src/design/tokens.ts` uses them as working values and adds a
provisional paper color and layout measurements. The archive calls the values reference-sampled and
approximate but supplies no pixel coordinates, color profile, sampling tool,
or measurement record. **No independent resampling was performed.** Every
value remains provisional; the four tab shells use these working values while
the development-only backend check retains its Milestone 1 colors. No styling
library was installed.

## Missing production assets and owner decisions

1. Final approved Android launcher icon, adaptive foreground/background, and
   monochrome layer, with required sizes and safe zones.
2. Standalone splash scenery free of embedded status bar, wordmark, or UI.
3. Verified master wordmark vector and alternate lockups if required; confirm
   whether the supplied trace matches the approved mark.
4. Additional approved mascot poses and empty-state illustrations if those
   planned screens require them. The supplied original has one walking pose.
5. Exact typefaces, distribution licenses, and approved color/spacing/radius
   measurements. Confirm the derivative mascot crop and candidate icon set
   separately before production use.

These are production/design gaps, not missing archive entries. Milestone 2 uses
native layout and local input state, without treating provisional icons or
tokens as final brand standards. Asset approval should precede visual
finalization and release.
