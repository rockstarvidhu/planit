import type { PlanCreateResponse, PlannedItinerary, PlanWarning } from '../types/api';

export const formatTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

export const warningText = (warning: PlanWarning) => ({
  UNKNOWN_OPENING_HOURS: 'Opening hours have not been verified.',
  UNKNOWN_PRICES: 'Some prices are not known.',
  PROVISIONAL_PLANS_REQUIRE_VERIFICATION: 'Check venue hours, costs and availability before you go.',
  ASSUMED_VISIT_DURATION: 'Rove estimated this visit duration.',
  USER_ESTIMATED_VISIT_DURATION: 'Visit duration was entered by you and is not provider verified.',
  FICTIONAL_FIXTURE_DATA: 'This is fictional test data, not a real destination.',
  NO_CANDIDATES: 'No places matched this area and activity.',
  NO_SCHEDULABLE_CANDIDATES: 'Places were found, but none can be scheduled yet.',
  NO_USABLE_ROUTES: 'Routes were unavailable for these places.',
  PLACES_UNAVAILABLE: 'Places are temporarily unavailable.',
  ROUTES_UNAVAILABLE: 'Some routes could not be used.',
  PRICE_UNKNOWN: 'Prices have not been verified.',
  HOURS_NOT_REQUESTED: 'Current opening hours were not requested.',
  VISIT_DURATION_UNKNOWN: 'A place was skipped because its visit time is unknown.',
  WALKING_ROUTE_BETA: 'Walking route estimates may need checking.',
  SKIPPED_IRRELEVANT: 'Some places did not match these choices.',
} as Record<string, string>)[warning.code] ?? 'Some planning details need verification.';

export function findPlan(response: PlanCreateResponse | null, id: string | undefined): {
  plan: PlannedItinerary; provisional: boolean;
} | null {
  if (!response || !id) return null;
  const confirmed = response.plans.find(plan => plan.id === id);
  if (confirmed) return { plan: confirmed, provisional: false };
  const tentative = response.provisionalPlans.find(plan => plan.id === id);
  return tentative ? { plan: tentative, provisional: true } : null;
}

export function canSaveFixture(response: PlanCreateResponse, plan: PlannedItinerary) {
  return response.demo && response.status === 'provisional' &&
    response.providers.places === 'rove_fixture' && response.providers.routes === 'rove_fixture' &&
    response.provisionalPlans.some(item => item.id === plan.id);
}
