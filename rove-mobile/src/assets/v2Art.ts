// Screen artwork from the V2 design handoff. Approved masters remain in assets/.
// Metro requires literal asset paths, so keep each require explicit.
export const v2Art = {
  splash: {
    light: require('../../assets/splash/rove-explorer-misty-mountains-approved.png'),
    dark: require('../../design-handoff/ROVE_Complete_First_Launch_Assets_v2/splash/compositions/splash-dark-1440x3120.png'),
  },
  welcome: {
    light: require('../../design-handoff/ROVE_Complete_First_Launch_Assets_v2/welcome/welcome-scene-light-1440x1800.png'),
    dark: require('../../design-handoff/ROVE_Complete_First_Launch_Assets_v2/welcome/welcome-scene-dark-1440x1800.png'),
  },
  location: {
    light: require('../../design-handoff/ROVE_Complete_First_Launch_Assets_v2/onboarding/location/location-scene-light-1440x1250.png'),
    dark: require('../../design-handoff/ROVE_Complete_First_Launch_Assets_v2/onboarding/location/location-scene-dark-1440x1250.png'),
  },
  budget: {
    light: require('../../design-handoff/ROVE_Complete_First_Launch_Assets_v2/onboarding/budget/budget-scene-light-1440x900.png'),
    dark: require('../../design-handoff/ROVE_Complete_First_Launch_Assets_v2/onboarding/budget/budget-scene-dark-1440x900.png'),
  },
  mapMascot: require('../../design-handoff/ROVE_Complete_First_Launch_Assets_v2/mascot/composites/explorer-with-map-COMPOSITE.png'),
} as const;
