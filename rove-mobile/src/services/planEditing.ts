import type { PlanCreateRequest, PlanCreateResponse, PlannedItinerary } from '../types/api';

export type PlanEdits = { excludedPlaceIds: string[]; visitDurations: Record<string, number> };

export function editedRequest(request: PlanCreateRequest, response: PlanCreateResponse,
  plan: PlannedItinerary, edits: PlanEdits, now = Date.now()): PlanCreateRequest {
  if (!response.demo || response.providers.places !== 'rove_fixture' || response.providers.routes !== 'rove_fixture')
    throw new Error('Editing live provider plans requires a separately approved revalidation flow.');
  if (!Number.isFinite(Date.parse(request.startAt))) throw new Error('This plan has an invalid start time. Start a new search.');
  const known = new Set(plan.stops.map(stop => stop.placeId));
  if (edits.excludedPlaceIds.some(id => !known.has(id)) || new Set(edits.excludedPlaceIds).size !== edits.excludedPlaceIds.length)
    throw new Error('One removed stop is no longer in this plan.');
  if (edits.excludedPlaceIds.length >= plan.stops.length) throw new Error('Keep at least one stop in the plan.');
  if (Object.entries(edits.visitDurations).some(([id, minutes]) => !known.has(id) ||
      !Number.isInteger(minutes) || minutes < 15 || minutes > 360)) throw new Error('Visit time must be 15 to 360 minutes.');
  // "Starting soon" is a relative choice. Revalidation receives a fresh future start
  // when the original window has passed; the backend recomputes every scheduled time.
  const startAt = Date.parse(request.startAt) <= now + 60000 ? new Date(now + 120000).toISOString() : request.startAt;
  return { ...request, startAt, excludedPlaceIds: edits.excludedPlaceIds, visitDurations: edits.visitDurations };
}

export function validatedEditedResponse(response: PlanCreateResponse): PlannedItinerary {
  const plan = response.provisionalPlans[0];
  if (!response.demo || response.status !== 'provisional' || !plan)
    throw new Error(response.status === 'no_feasible_plan' || response.status === 'insufficient_data'
      ? 'These changes do not produce a feasible plan. Adjust the edits or start a new search.'
      : 'The updated plan could not be verified. Your original plan is unchanged.');
  return plan;
}
