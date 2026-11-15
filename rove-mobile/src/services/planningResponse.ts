import type { PlanCreateResponse, PlannedItinerary, PlanningStatus } from '../types/api.ts';

const statuses: PlanningStatus[] = ['ready', 'provisional', 'insufficient_data', 'no_feasible_plan', 'provider_unavailable'];
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === 'string';
const nullableNumber = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value));
const invalid = (): never => { throw new Error('Invalid planning response'); };

function validPlan(value: unknown): value is PlannedItinerary {
  if (!object(value) || !string(value.id) || !string(value.startAt) || !string(value.endAt) ||
      !Array.isArray(value.stops) || !Array.isArray(value.travelLegs) || !Array.isArray(value.warnings) ||
      !object(value.budgetSummary) || !object(value.dataQuality) || !object(value.estimatedSpendingRange) ||
      !nullableNumber(value.remainingBudget)) return false;
  const b = value.budgetSummary;
  const r = value.estimatedSpendingRange;
  const known = b.knownCostSubtotalRange;
  return value.stops.every(stop => object(stop) && string(stop.placeId) && string(stop.name) &&
      string(stop.category) && string(stop.arrivalAt) && string(stop.departureAt) &&
      string(stop.visitStartAt) && typeof stop.visitMinutes === 'number') &&
    value.travelLegs.every(leg => object(leg) && string(leg.fromId) && string(leg.toId) &&
      typeof leg.durationMinutes === 'number' && string(leg.departAt) && string(leg.arriveAt)) &&
    string(b.assessment) && object(known) && nullableNumber(known.minimum) &&
    nullableNumber(known.expected) && nullableNumber(known.maximum) &&
    Array.isArray(b.unknownExpenseCategories) && b.unknownExpenseCategories.every(string) &&
    nullableNumber(b.expectedRemaining) && nullableNumber(b.conservativeRemaining) &&
    nullableNumber(r.minimum) && nullableNumber(r.expected) && nullableNumber(r.maximum) &&
    (value.dataQuality.openingHours === 'known' || value.dataQuality.openingHours === 'unknown') &&
    (value.dataQuality.prices === 'known' || value.dataQuality.prices === 'unknown') &&
    value.warnings.every(w => object(w) && string(w.code));
}

export function parsePlanningResponse(value: unknown): PlanCreateResponse {
  if (!object(value)) throw new Error('Invalid planning response');
  if (!statuses.includes(value.status as PlanningStatus) || typeof value.demo !== 'boolean' ||
      !Array.isArray(value.plans) || !value.plans.every(validPlan) ||
      !Array.isArray(value.provisionalPlans) || !value.provisionalPlans.every(validPlan) ||
      !Array.isArray(value.suggestions) || !value.suggestions.every(s => object(s) && string(s.id) &&
        string(s.name) && string(s.category) && string(s.openingStatus) && string(s.priceDataStatus)) ||
      !Array.isArray(value.exclusions) || !value.exclusions.every(e => object(e) && string(e.reason)) ||
      !Array.isArray(value.warnings) || !value.warnings.every(w => object(w) && string(w.code)) ||
      !object(value.providers) || !string(value.providers.places) || !string(value.providers.routes) ||
      !object(value.attribution) || typeof value.attribution.googleMapsRequired !== 'boolean' ||
      typeof value.attribution.googleCopyrightRequired !== 'boolean' || !Array.isArray(value.attribution.thirdParty) ||
      !object(value.usage) || typeof value.usage.placesRequests !== 'number' ||
      typeof value.usage.routesRequests !== 'number' || typeof value.usage.routeElements !== 'number') invalid();
  if (value.status === 'provider_unavailable' &&
      (!object(value.providerFailure) || !['places', 'routes'].includes(String(value.providerFailure.stage)) ||
        !string(value.providerFailure.code))) invalid();
  const plans = value.plans as unknown[];
  const provisionalPlans = value.provisionalPlans as unknown[];
  if (value.status === 'ready' && plans.length === 0) invalid();
  if (value.status === 'provisional' && (provisionalPlans.length === 0 || plans.length > 0)) invalid();
  if (['insufficient_data', 'no_feasible_plan', 'provider_unavailable'].includes(String(value.status)) &&
      (plans.length > 0 || provisionalPlans.length > 0)) invalid();
  if (value.status === 'ready' && (value.demo || plans.some(plan => {
    const item = plan as PlannedItinerary;
    return item.dataQuality.openingHours !== 'known' || item.dataQuality.prices !== 'known' ||
      item.budgetSummary.assessment !== 'fits_conservatively';
  }))) invalid();
  return value as unknown as PlanCreateResponse;
}
