// The v3 handoff supplies approved light compositions only. Keep the existing dark scenes.
export const onboardingArt = {
  splash: {
    light: require('../../design-handoff/ROVE_Approved_Onboarding_Production_Handoff_v3/approved/splash/rove-splash-full-approved-941x1672.png'),
    dark: require('../../design-handoff/ROVE_Complete_First_Launch_Assets_v2/splash/compositions/splash-dark-1440x3120.png'),
  },
  welcome: {
    light: require('../../design-handoff/ROVE_Approved_Onboarding_Production_Handoff_v3/artwork/welcome/welcome-waving-mascot-SOFT-EDGE.png'),
    dark: require('../../design-handoff/ROVE_Complete_First_Launch_Assets_v2/welcome/welcome-scene-dark-1440x1800.png'),
  },
  location: {
    light: require('../../design-handoff/ROVE_Approved_Onboarding_Production_Handoff_v3/artwork/location/location-map-mascot-SOFT-EDGE.png'),
    dark: require('../../design-handoff/ROVE_Complete_First_Launch_Assets_v2/onboarding/location/location-scene-dark-1440x1250.png'),
  },
  budget: {
    light: require('../../design-handoff/ROVE_Approved_Onboarding_Production_Handoff_v3/artwork/budget/budget-wallet-mascot-SOFT-EDGE.png'),
    dark: require('../../design-handoff/ROVE_Complete_First_Launch_Assets_v2/onboarding/budget/budget-scene-dark-1440x900.png'),
  },
} as const;
