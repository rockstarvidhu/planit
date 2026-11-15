import { parsePlanningResponse } from './planningResponse.ts';
import type { PlanCreateRequest, PlannedItinerary } from '../types/api.ts';

export type SavedPlan = {
  id: string; name: string; savedAt: string; area: string;
  preferences: Pick<PlanCreateRequest, 'budgetAmount' | 'budgetMode' | 'people' | 'availableMinutes' | 'categories' | 'transportMode' | 'mood'>;
  plan: PlannedItinerary; demo: true; provisional: true;
};

export function snapshotFixturePlan(plan: PlannedItinerary): PlannedItinerary {
  return {
    id: plan.id, startAt: plan.startAt, endAt: plan.endAt,
    stops: plan.stops.map(({ placeId, name, category, arrivalAt, visitStartAt, departureAt, visitMinutes, waitMinutes }) =>
      ({ placeId, name, category, arrivalAt, visitStartAt, departureAt, visitMinutes, waitMinutes })),
    travelLegs: plan.travelLegs.map(({ fromId, toId, mode, durationMinutes, departAt, arriveAt }) =>
      ({ fromId, toId, mode, durationMinutes, departAt, arriveAt })),
    estimatedSpendingRange: { ...plan.estimatedSpendingRange }, remainingBudget: plan.remainingBudget,
    budgetSummary: { ...plan.budgetSummary,
      knownCostSubtotalRange: { ...plan.budgetSummary.knownCostSubtotalRange },
      unknownExpenseCategories: [...plan.budgetSummary.unknownExpenseCategories] },
    dataQuality: { ...plan.dataQuality },
    warnings: plan.warnings.map(({ code, placeId }) => ({ code, ...(placeId ? { placeId } : {}) })),
    ...(plan.planningDurations ? { planningDurations: plan.planningDurations.map(({ placeId, source, minutes }) =>
      ({ placeId, source, minutes })) } : {}),
  };
}

const validationEnvelope = (plan: unknown) => ({
  status: 'provisional', demo: true, plans: [], provisionalPlans: [plan], suggestions: [],
  exclusions: [], warnings: [], providers: { places: 'rove_fixture', routes: 'rove_fixture' },
  attribution: { googleMapsRequired: false, googleCopyrightRequired: false, thirdParty: [] },
  usage: { placesRequests: 0, routesRequests: 0, routeElements: 0 },
});

export function parseSavedPlans(raw: string | null): SavedPlan[] {
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || data.length > 50) throw new Error('Saved plans need repair.');
  return data.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Saved plan is incomplete.');
    const item = entry as Partial<SavedPlan>;
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(item.id) ||
        typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80 ||
        typeof item.savedAt !== 'string' || !Number.isFinite(Date.parse(item.savedAt)) ||
        typeof item.area !== 'string' || item.area.length > 100 ||
        item.demo !== true || item.provisional !== true || !item.preferences ||
        !Number.isSafeInteger(item.preferences.budgetAmount) ||
        !Number.isSafeInteger(item.preferences.people) ||
        !Number.isSafeInteger(item.preferences.availableMinutes) ||
        !Array.isArray(item.preferences.categories) || !item.preferences.categories.length ||
        (item.preferences.budgetMode !== 'total' && item.preferences.budgetMode !== 'perPerson') ||
        (item.preferences.transportMode !== 'walk' && item.preferences.transportMode !== 'drive')) {
      throw new Error('Saved plan is incomplete.');
    }
    parsePlanningResponse(validationEnvelope(item.plan));
    return { ...item, plan: snapshotFixturePlan(item.plan as PlannedItinerary) } as SavedPlan;
  });
}

export async function persistSavedPlans(storage: { setItem: (key: string, value: string) => Promise<unknown> },
  plans: SavedPlan[]): Promise<SavedPlan[]> {
  const limited = parseSavedPlans(JSON.stringify(plans));
  const serialized = JSON.stringify(limited);
  await storage.setItem('rove:saved-plans:v1', serialized);
  return limited;
}
