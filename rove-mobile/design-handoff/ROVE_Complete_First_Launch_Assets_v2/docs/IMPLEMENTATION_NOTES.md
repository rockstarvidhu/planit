# Rove v2 — Implementation handoff

This pack provides actual standalone PNG/SVG assets for Splash, Welcome, optional Location and Budget onboarding, and Discover's budget-first planning card. **Do not display contact sheets or reference screenshots as screen backgrounds.**

## Critical fidelity
- `mascot/approved/*` and `brand/rove-wordmark-approved.svg` are the unmodified approved originals.
- `mascot/composites/*` are **new, editable-composition raster assets** made by layering props over the unchanged approved explorer. They are **not genuinely redrawn character poses**, and require design approval. Use the original if rejected.
- `splash/compositions/*` are full-screen illustration concepts; they contain wordmark and tagline and are intended for an in-app branded splash/launch transition, **not** Expo native `splash.image` directly because device aspect ratios vary.
- `splash/native/native-wordmark-*-1024.png` are static transparent centered-wordmark assets for Expo's native splash. Configure native splash background colour for each theme. Expo native splash is not a full-screen responsive React view.
- `welcome/welcome-scene-*.png`, `onboarding/location/location-scene-*.png`, and `onboarding/budget/budget-scene-*.png` are **actual decorative art panels only**: render heading, forms, actions and labels in native UI above/beside them, not into images.
- `discover/planning-card-art-*` is a non-interactive image. Place the budget controls and primary CTA as accessible native UI on top or separately.
- SVG scenic layers in `illustrations/scene` offer more responsive compositions.
- All artwork that was absent from the approved originals should be explicitly reviewed; do not claim the character pose composites are approved originals.

## Assets for each screen
- Splash: `splash/native/native-wordmark-light-1024.png` / dark, and `splash/compositions/splash-*-1440x3120.png` for optional in-app intro
- Welcome: `welcome/welcome-scene-{mode}-1440x1800.png`
- Location: `onboarding/location/location-scene-{mode}-1440x1250.png`, `folded-map.svg`
- Budget: `onboarding/budget/budget-scene-{mode}-1440x900.png`, `wallet-coins.svg`
- Discover: `discover/planning-card-art-{mode}-1000x620.png`, `mascot/composites/explorer-with-map-COMPOSITE.png`, existing icons/wordmark

## Layout
Avoid setting fixed image heights as a percentage of entire phone height. Respect safe areas, use contain/crop intentionally, and pin bottom CTAs within a keyboard-aware safe-area container. Preserve working routes/state. On Android test 360×800, 393×852 and 430×932 dp.
