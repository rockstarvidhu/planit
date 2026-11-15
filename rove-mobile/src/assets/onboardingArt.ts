// The approved v3 light compositions are used for first launch in both themes.
// Older dark files remain in the handoff for reference but are not loaded by this flow.
export const onboardingArt = {
  splash: {
    light: require('../../design-handoff/ROVE_Approved_Onboarding_Production_Handoff_v3/approved/splash/rove-splash-full-approved-941x1672.png'),
  },
  welcome: {
    light: require('../../design-handoff/ROVE_Approved_Onboarding_Production_Handoff_v3/artwork/welcome/welcome-waving-mascot-SOFT-EDGE.png'),
  },
  location: {
    light: require('../../design-handoff/ROVE_Approved_Onboarding_Production_Handoff_v3/artwork/location/location-map-mascot-SOFT-EDGE.png'),
  },
  budget: {
    light: require('../../design-handoff/ROVE_Approved_Onboarding_Production_Handoff_v3/artwork/budget/budget-wallet-mascot-SOFT-EDGE.png'),
  },
} as const;
