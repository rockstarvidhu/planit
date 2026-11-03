# V2 first-launch asset integration

Source archive: `/Users/vidhu/Downloads/ROVE_Complete_First_Launch_Assets_v2.zip` (SHA-256 `104c07d32b487058b8a6abf6288e9418d688b24a99eaa9992b9797f406239c34`). Archive integrity passed; its 80 entries were extracted unchanged to `ROVE_Complete_First_Launch_Assets_v2/`. The ZIP in Downloads and the V1 handoff remain untouched.

| Screen | V2 file used | Role and status |
|---|---|---|
| Native splash | `splash/native/native-wordmark-light-1024.png`, `native-wordmark-dark-1024.png` | Centered static native image; new export, pending final visual approval. |
| In-app launch bridge | `splash/compositions/splash-light-1440x3120.png`, dark variant | Full illustrated screen shown during route handoff without a timed delay; concept composition. |
| Welcome | `welcome/welcome-scene-light-1440x1800.png`, dark variant | Decorative scenery with approved explorer embedded; new composition pending approval. |
| Optional location | `onboarding/location/location-scene-light-1440x1250.png`, dark variant | Decorative folded-map scene; new composition pending approval. |
| Optional budget | `onboarding/budget/budget-scene-light-1440x900.png`, dark variant | Decorative wallet landscape; new composition pending approval. |
| Discover planning card | `mascot/composites/explorer-with-map-COMPOSITE.png`, `illustrations/scene/layered-hills-light.svg`, dark variant | Map prop over unchanged explorer and hill geometry; implementation candidates, not approved new character pose. Hill geometry is rendered as `react-native-svg` paths. |

The existing `assets/branding/rove-wordmark-traced.svg` and `assets/mascot/explorer-walking-original.png` remain the approved masters. Their V2 counterparts have identical SHA-256 digests and were not copied into active `assets/`. V2 icons and token values are not promoted; the currently used icon paths remain provisional.

`discover/planning-card-art-*.png` was inspected but not used: its opaque ivory/black background would replace the muted-green card surface in the approved Discover reference. The transparent map composite and responsive hill paths fit the card without obscuring accessible controls. The folded-map and wallet standalone PNG/SVG assets remain available but are not needed alongside the complete scenes. Contact sheets and reference screenshots are not rendered in the app.

All newly composed artwork needs final design review. The mascot composites layer props over the original approved explorer; they are not independently illustrated, approved poses. The V2 package contains no licensed venue photos matching the Discover screenshot, so the existing labelled demo photos remain.
