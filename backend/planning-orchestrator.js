const { HttpError, invalid, bodyObject } = require('./security');
const { generateItineraries, ItineraryInputError } = require('./itinerary-engine');
const { evaluateBudget } = require('./budget-engine');
const { discoverPlaces, CATEGORY_TYPES } = require('./providers/google-places');
const { computeRouteMatrix } = require('./providers/google-routes');

const DISCOVERY_LIMIT = 8;
const SHORTLIST_LIMIT = 4;
const RADIUS_METERS = 3000;
const DEFAULT_DURATIONS = Object.freeze({ Cafe: 45, Food: 75, Outdoors: 60, Shopping: 60 });
const FIXED_SCHEDULE_CATEGORIES = new Set(['Movies']);
const validId = value => typeof value === 'string' && value.trim() && value.length <= 80 &&
  !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
const integer = (value, name, min, max) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw invalid(name);
  return value;
};

function validateInput(body, now = Date.now()) {
  const request = bodyObject(body);
  const allowed = new Set(['origin', 'startAt', 'availableMinutes', 'budgetAmount', 'budgetMode',
    'people', 'categories', 'transportMode', 'mood', 'contingencyPercent', 'maxStops',
    'returnToStart', 'excludedPlaceIds', 'visitDurations']);
  if (Object.keys(request).some(key => !allowed.has(key))) throw invalid('request field');
  if (!request.origin || typeof request.origin !== 'object' || Array.isArray(request.origin) ||
      typeof request.origin.latitude !== 'number' || !Number.isFinite(request.origin.latitude) ||
      Math.abs(request.origin.latitude) > 90 || typeof request.origin.longitude !== 'number' ||
      !Number.isFinite(request.origin.longitude) || Math.abs(request.origin.longitude) > 180) throw invalid('origin');
  if (typeof request.startAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(request.startAt)) throw invalid('startAt');
  const start = Date.parse(request.startAt);
  if (!Number.isFinite(start) || start < now || start > now + 7 * 86400000) throw invalid('startAt');
  if (!Array.isArray(request.categories) || request.categories.length < 1 || request.categories.length > 3 ||
      request.categories.some(category => typeof category !== 'string' || !CATEGORY_TYPES[category]) ||
      new Set(request.categories).size !== request.categories.length) throw invalid('categories');
  if (!['walk', 'drive'].includes(request.transportMode)) {
    throw new HttpError(400, 'UNSUPPORTED_MODE', 'Transportation mode is not supported');
  }
  const exclusions = request.excludedPlaceIds ?? [];
  if (!Array.isArray(exclusions) || exclusions.length > 8 ||
      exclusions.some(id => !validId(id)) || new Set(exclusions).size !== exclusions.length) throw invalid('excludedPlaceIds');
  const overrides = request.visitDurations ?? {};
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides) ||
      Object.keys(overrides).length > SHORTLIST_LIMIT ||
      Object.entries(overrides).some(([id, minutes]) => !validId(id) || !Number.isSafeInteger(minutes) || minutes < 15 || minutes > 360)) {
    throw invalid('visitDurations');
  }
  const preferences = { currency: 'INR', origin: { latitude: request.origin.latitude,
    longitude: request.origin.longitude }, startAt: request.startAt,
    availableMinutes: integer(request.availableMinutes, 'availableMinutes', 30, 720),
    budgetAmount: integer(request.budgetAmount, 'budgetAmount', 1, 10000000),
    budgetMode: request.budgetMode, people: integer(request.people, 'people', 1, 50),
    contingencyPercent: request.contingencyPercent ?? 0,
    categories: [...request.categories], transportMode: request.transportMode,
    mood: request.mood, excludedPlaceIds: [...exclusions],
    maxStops: request.maxStops ?? 3, returnToStart: request.returnToStart ?? false };
  try { generateItineraries({ preferences, candidates: [], travelLegs: [] }); }
  catch (error) {
    if (error instanceof ItineraryInputError) throw invalid(error.field);
    throw error;
  }
  return { preferences, visitDurations: { ...overrides } };
}

function durationFor(candidate, overrides, policy) {
  if (FIXED_SCHEDULE_CATEGORIES.has(candidate.category)) return { minutes: null, reason: 'FIXED_SCHEDULE_REQUIRED' };
  const supplied = Object.hasOwn(overrides, candidate.id) ? overrides[candidate.id] : undefined;
  if (supplied !== undefined) return { minutes: supplied, source: 'user_supplied_estimate' };
  const minutes = policy[candidate.category];
  return Number.isSafeInteger(minutes) && minutes >= 15 && minutes <= 360
    ? { minutes, source: 'rove_planning_assumption' } : { minutes: null, reason: 'VISIT_DURATION_UNKNOWN' };
}

function budgetView(plan, preferences) {
  const unknown = plan.expenses.filter(expense => expense.priceStatus === 'unknown');
  const known = plan.expenses.filter(expense => expense.priceStatus !== 'unknown');
  const subtotal = evaluateBudget({ currency: 'INR', budgetAmount: preferences.budgetAmount,
    budgetMode: preferences.budgetMode, people: preferences.people,
    contingencyPercent: preferences.contingencyPercent, expenses: known });
  return { assessment: plan.budget.affordability,
    knownCostSubtotalRange: known.length ? { minimum: subtotal.totalMinimumCost, expected: subtotal.totalExpectedCost,
      maximum: subtotal.totalMaximumCost } : { minimum: null, expected: null, maximum: null },
    unknownExpenseCategories: [...new Set(unknown.map(expense => expense.category))].sort(),
    expectedRemaining: plan.budget.remainingBudget,
    conservativeRemaining: plan.budget.totalMaximumCost === null ? null :
      plan.budget.spendableBudget - plan.budget.totalMaximumCost };
}

function emptyResponse(status, warning, stage, code) {
  return { status, demo: false, plans: [], provisionalPlans: [], suggestions: [], exclusions: [],
    warnings: [{ code: warning }], providers: { places: stage === 'places' ? 'unavailable' : 'not_requested',
      routes: stage === 'routes' ? 'unavailable' : 'not_requested' },
    attribution: { googleMapsRequired: false, googleCopyrightRequired: false, thirdParty: [] },
    usage: { placesRequests: 0, routesRequests: 0, routeElements: 0 },
    ...(code ? { providerFailure: { stage, code } } : {}) };
}

async function createPlan(body, options = {}) {
  const now = options.now ?? Date.now();
  const { preferences, visitDurations } = validateInput(body, now);
  const deps = { discoverPlaces, computeRouteMatrix, generateItineraries, ...options.deps };
  const context = options.context;
  const hoursEnabled = options.hoursEnabled ?? process.env.ROVE_PLACES_ENTERPRISE_FIELDS_ENABLED === 'true';
  let places;
  try {
    places = await deps.discoverPlaces({ latitude: preferences.origin.latitude,
      longitude: preferences.origin.longitude, radiusMeters: RADIUS_METERS,
      categories: preferences.categories, limit: DISCOVERY_LIMIT,
      includeOpeningHours: hoursEnabled, plannedAt: preferences.startAt }, { context, now });
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    return { httpStatus: error.status, ...emptyResponse('provider_unavailable', 'PLACES_UNAVAILABLE', 'places', error.code) };
  }
  if (!places || !Array.isArray(places.candidates) || places.candidates.length > DISCOVERY_LIMIT ||
      !['google_places_new', 'rove_fixture'].includes(places.provider)) {
    throw new HttpError(502, 'PROVIDER_INVALID_RESPONSE', 'Place provider returned invalid data');
  }
  let demo = places.provider === 'rove_fixture';
  const usage = { placesRequests: demo ? 0 : 1, routesRequests: 0, routeElements: 0 };
  const warnings = [...(Array.isArray(places.warnings) ? places.warnings : [])];
  const exclusions = [];
  const seen = new Set();
  const policy = options.durationPolicy ?? DEFAULT_DURATIONS;
  const candidates = [];
  for (const candidate of places.candidates) {
    if (!candidate || !validId(candidate.id) || seen.has(candidate.id)) {
      exclusions.push({ placeId: candidate?.id ?? null, reason: 'DUPLICATE_OR_INVALID_PLACE' }); continue;
    }
    seen.add(candidate.id);
    if (candidate.id === 'origin' || preferences.excludedPlaceIds.includes(candidate.id)) {
      exclusions.push({ placeId: candidate.id, reason: 'USER_EXCLUDED' }); continue;
    }
    const duration = durationFor(candidate, visitDurations, policy);
    if (duration.minutes === null) { exclusions.push({ placeId: candidate.id, reason: duration.reason }); continue; }
    candidates.push({ ...candidate, visitMinutes: duration.minutes,
      planningDuration: { source: duration.source, minutes: duration.minutes } });
    warnings.push({ code: duration.source === 'rove_planning_assumption' ? 'ASSUMED_VISIT_DURATION' : 'USER_ESTIMATED_VISIT_DURATION',
      placeId: candidate.id });
  }
  const categoryOrder = new Map(preferences.categories.map((category, index) => [category, index]));
  candidates.sort((a, b) => (categoryOrder.get(a.category) ?? 99) - (categoryOrder.get(b.category) ?? 99) ||
    a.id.localeCompare(b.id));
  for (const candidate of candidates.slice(SHORTLIST_LIMIT)) exclusions.push({ placeId: candidate.id, reason: 'SHORTLIST_LIMIT' });
  const shortlist = candidates.slice(0, SHORTLIST_LIMIT);
  const attribution = { googleMapsRequired: places.attribution?.googleMapsRequired === true,
    googleCopyrightRequired: false,
    thirdParty: shortlist.flatMap(candidate => candidate.attribution?.thirdParty ?? []) };
  const suggestions = shortlist.map(candidate => ({ id: candidate.id, name: candidate.name,
    category: candidate.category, openingStatus: candidate.opening?.status ?? 'unknown',
    priceDataStatus: candidate.provenance?.priceDataStatus ?? 'unknown',
    planningDuration: candidate.planningDuration, source: candidate.source,
    attribution: candidate.attribution }));
  const providers = { places: places.provider, routes: 'not_requested' };
  if (shortlist.length === 0) {
    warnings.push({ code: places.candidates.length ? 'NO_SCHEDULABLE_CANDIDATES' : 'NO_CANDIDATES' });
    return { status: 'insufficient_data', demo, plans: [], provisionalPlans: [], suggestions,
      exclusions, warnings, providers, attribution, usage };
  }
  const points = [{ id: 'origin', ...preferences.origin },
    ...shortlist.map(candidate => ({ id: candidate.id, latitude: candidate.latitude, longitude: candidate.longitude }))];
  const matrixInput = { origins: points, destinations: preferences.returnToStart ? points : points.slice(1),
    mode: preferences.transportMode };
  // One matrix call; no per-leg retries or follow-up lookups.
  let routes;
  try { routes = await deps.computeRouteMatrix(matrixInput, { context, now }); }
  catch (error) {
    if (!(error instanceof HttpError)) throw error;
    return { httpStatus: error.status, status: 'provider_unavailable', demo, plans: [], provisionalPlans: [],
      suggestions, exclusions, warnings: [...warnings, { code: 'ROUTES_UNAVAILABLE' }],
      providers: { ...providers, routes: 'unavailable' }, attribution, usage,
      providerFailure: { stage: 'routes', code: error.code } };
  }
  if (!routes || !Array.isArray(routes.legs) || !Array.isArray(routes.failed) ||
      !['google_routes_new', 'rove_fixture'].includes(routes.provider) ||
      !routes.usage || routes.usage.requestedElements !== points.length * matrixInput.destinations.length ||
      routes.usage.providerRequests > 1) {
    throw new HttpError(502, 'PROVIDER_INVALID_RESPONSE', 'Route provider returned invalid data');
  }
  usage.routesRequests = routes.usage.providerRequests;
  usage.routeElements = routes.usage.requestedElements;
  providers.routes = routes.provider;
  if (routes.provider === 'rove_fixture') {
    demo = true;
    if (!warnings.some(warning => warning.code === 'FICTIONAL_FIXTURE_DATA')) warnings.push({ code: 'FICTIONAL_FIXTURE_DATA' });
  }
  attribution.googleCopyrightRequired = routes.attribution?.googleCopyrightRequired === true;
  warnings.push(...(Array.isArray(routes.warnings) ? routes.warnings : []));
  if (routes.failed.length) exclusions.push(...routes.failed.map(item => ({ fromId: item.fromId,
    toId: item.toId, reason: item.reason })));
  const generated = deps.generateItineraries({ preferences, candidates: shortlist, travelLegs: routes.legs });
  warnings.push(...generated.warnings);
  const plans = [];
  const provisionalPlans = [];
  for (const plan of generated.plans) {
    const unknownHours = plan.stops.some(stop => shortlist.find(candidate => candidate.id === stop.placeId)?.opening?.status !== 'known');
    const budget = budgetView(plan, preferences);
    const enriched = { ...plan, budgetSummary: budget,
      planningDurations: plan.stops.map(stop => ({ placeId: stop.placeId,
        ...shortlist.find(candidate => candidate.id === stop.placeId).planningDuration })),
      dataQuality: { openingHours: unknownHours ? 'unknown' : 'known',
        prices: budget.unknownExpenseCategories.length ? 'unknown' : 'known' } };
    if (demo || unknownHours || budget.assessment !== 'fits_conservatively') {
      provisionalPlans.push(enriched);
    } else plans.push(enriched);
  }
  if (provisionalPlans.length) warnings.push({ code: 'PROVISIONAL_PLANS_REQUIRE_VERIFICATION' });
  if (!routes.legs.length) warnings.push({ code: 'NO_USABLE_ROUTES' });
  const status = plans.length ? 'ready' : provisionalPlans.length ? 'provisional' :
    !routes.legs.length ? 'insufficient_data' : 'no_feasible_plan';
  return { status, demo, plans, provisionalPlans, suggestions, exclusions, warnings,
    providers, attribution, usage, search: generated.search };
}

module.exports = { createPlan, validateInput, durationFor, DEFAULT_DURATIONS,
  DISCOVERY_LIMIT, SHORTLIST_LIMIT, RADIUS_METERS };
