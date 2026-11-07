const { createHash } = require('node:crypto');
const { evaluateBudget, BudgetInputError } = require('./budget-engine');

const LIMITS = Object.freeze({ candidates: 12, stops: 4, expansions: 300, results: 6,
  expensesPerPlace: 5, windowsPerPlace: 14, legs: 180, availableMinutes: 720 });
const DEFAULT_WEIGHTS = Object.freeze({ relevance: 4, mood: 2, category: 2, preferred: 2,
  travel: 2, budget: 2, schedule: 1, variety: 3, coverage: 2 });
const WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS);

class ItineraryInputError extends Error {
  constructor(field) { super(`Invalid ${field}`); this.field = field; }
}
const fail = field => { throw new ItineraryInputError(field); };
const obj = (value, field) => value && typeof value === 'object' && !Array.isArray(value) ? value : fail(field);
const int = (value, field, min, max) => Number.isSafeInteger(value) && value >= min && value <= max ? value : fail(field);
const text = (value, field, max = 100) => typeof value === 'string' && value.trim() && value.length <= max &&
  !Array.from(value).some(ch => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127) ? value : fail(field);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const stableId = (prefix, values) => `${prefix}:${createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0, 24)}`;
const coordinate = (value, field, max) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max ? value : fail(field);
const list = (value, field, max) => Array.isArray(value) && value.length <= max ? value : fail(field);

function instant(value, field) {
  if (typeof value !== 'string') fail(field);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) fail(field);
  const [, ys, ms, ds, hs, mins, ss, milli = '000', zone, sign, oh, om] = match;
  const [year, month, day, hour, minute, second] = [ys, ms, ds, hs, mins, ss].map(Number);
  const offsetHours = zone === 'Z' ? 0 : Number(oh);
  const offsetMins = zone === 'Z' ? 0 : Number(om);
  if (year < 2000 || year > 2100 || offsetHours > 14 || offsetMins > 59 || (offsetHours === 14 && offsetMins)) fail(field);
  const local = Date.UTC(year, month - 1, day, hour, minute, second, Number(milli));
  const date = new Date(local);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day ||
      date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) fail(field);
  const offset = (sign === '-' ? -1 : 1) * (offsetHours * 60 + offsetMins);
  return local - offset * 60000;
}

function strings(value, field, max) {
  if (value === undefined) return [];
  const items = list(value, field, max).map((item, index) => text(item, `${field}[${index}]`, 80));
  if (new Set(items).size !== items.length) fail(field);
  return items;
}

function metadata(value, field) {
  obj(value, field);
  return { name: text(value.name, `${field}.name`),
    ...(value.reference === undefined ? {} : { reference: text(value.reference, `${field}.reference`, 200) }) };
}

function opening(value, field) {
  obj(value, field);
  if (value.status === 'unknown') {
    if (value.windows !== undefined) fail(`${field}.windows`);
    return { status: 'unknown' };
  }
  if (value.status !== 'known') fail(`${field}.status`);
  const windows = list(value.windows, `${field}.windows`, LIMITS.windowsPerPlace).map((window, index) => {
    const key = `${field}.windows[${index}]`;
    obj(window, key);
    const opens = instant(window.opensAt, `${key}.opensAt`);
    const closes = instant(window.closesAt, `${key}.closesAt`);
    if (closes <= opens || closes - opens > 48 * 60 * 60000) fail(key);
    return { opens, closes };
  }).sort((a, b) => a.opens - b.opens || a.closes - b.closes);
  for (let i = 1; i < windows.length; i++) if (windows[i].opens < windows[i - 1].closes) fail(`${field}.windows`);
  return { status: 'known', windows };
}

function localityKm(a, b) {
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLng = (b.longitude - a.longitude) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function budgetCheck(preferences, expenses) {
  try {
    return evaluateBudget({ currency: preferences.currency, budgetAmount: preferences.budgetAmount,
      budgetMode: preferences.budgetMode, people: preferences.people,
      contingencyPercent: preferences.contingencyPercent, expenses });
  } catch (error) {
    if (error instanceof BudgetInputError) fail(`budget.${error.field}`);
    throw error;
  }
}

function prepare(input) {
  obj(input, 'request');
  const p = obj(input.preferences, 'preferences');
  const origin = obj(p.origin, 'preferences.origin');
  if (p.currency !== 'INR') fail('preferences.currency');
  const preferences = {
    currency: 'INR',
    origin: { latitude: coordinate(origin.latitude, 'preferences.origin.latitude', 90),
      longitude: coordinate(origin.longitude, 'preferences.origin.longitude', 180) },
    start: instant(p.startAt, 'preferences.startAt'),
    availableMinutes: int(p.availableMinutes, 'preferences.availableMinutes', 30, LIMITS.availableMinutes),
    budgetAmount: p.budgetAmount, budgetMode: p.budgetMode, people: p.people,
    contingencyPercent: p.contingencyPercent ?? 0,
    mood: p.mood === undefined ? null : text(p.mood, 'preferences.mood', 40),
    categories: strings(p.categories, 'preferences.categories', 8),
    excludedPlaceIds: strings(p.excludedPlaceIds, 'preferences.excludedPlaceIds', LIMITS.candidates),
    preferredPlaceIds: strings(p.preferredPlaceIds, 'preferences.preferredPlaceIds', LIMITS.candidates),
    transportMode: p.transportMode ?? 'walk',
    maxTravelMinutesPerLeg: p.maxTravelMinutesPerLeg === undefined ? 180 : int(p.maxTravelMinutesPerLeg, 'preferences.maxTravelMinutesPerLeg', 1, 180),
    maxStops: p.maxStops === undefined ? 3 : int(p.maxStops, 'preferences.maxStops', 1, LIMITS.stops),
    maxWaitMinutes: p.maxWaitMinutes === undefined ? 60 : int(p.maxWaitMinutes, 'preferences.maxWaitMinutes', 0, 120),
    returnToStart: p.returnToStart ?? false,
  };
  if (!['walk', 'drive', 'transit'].includes(preferences.transportMode)) fail('preferences.transportMode');
  if (typeof preferences.returnToStart !== 'boolean') fail('preferences.returnToStart');
  budgetCheck(preferences, []);
  const weights = input.weights === undefined ? DEFAULT_WEIGHTS : obj(input.weights, 'weights');
  if (Object.keys(weights).some(key => !WEIGHT_KEYS.includes(key))) fail('weights');
  const normalizedWeights = Object.fromEntries(WEIGHT_KEYS.map(key => [key, int(weights[key] ?? DEFAULT_WEIGHTS[key], `weights.${key}`, 0, 10)]));
  if (Object.values(normalizedWeights).every(weight => weight === 0)) fail('weights');

  const candidates = list(input.candidates, 'candidates', LIMITS.candidates).map((raw, index) => {
    const field = `candidates[${index}]`;
    obj(raw, field);
    const candidate = { id: text(raw.id, `${field}.id`, 80), name: text(raw.name, `${field}.name`, 120),
      latitude: coordinate(raw.latitude, `${field}.latitude`, 90), longitude: coordinate(raw.longitude, `${field}.longitude`, 180),
      category: text(raw.category, `${field}.category`, 60), tags: strings(raw.tags, `${field}.tags`, 12),
      visitMinutes: int(raw.visitMinutes, `${field}.visitMinutes`, 15, 360),
      opening: opening(raw.opening, `${field}.opening`),
      source: metadata(raw.source, `${field}.source`),
      relevanceScore: raw.relevanceScore === undefined ? 50 : int(raw.relevanceScore, `${field}.relevanceScore`, 0, 100),
      expenses: list(raw.expenses, `${field}.expenses`, LIMITS.expensesPerPlace),
    };
    if (candidate.id === 'origin' || localityKm(preferences.origin, candidate) > 100) fail(`${field}.location`);
    const expenseIds = new Set();
    candidate.expenses = candidate.expenses.map((expense, i) => {
      obj(expense, `${field}.expenses[${i}]`);
      const id = text(expense.id, `${field}.expenses[${i}].id`, 80);
      if (expenseIds.has(id)) fail(`${field}.expenses[${i}].id`);
      expenseIds.add(id);
      return { ...expense, id: stableId('place', [candidate.id, id]) };
    });
    budgetCheck(preferences, candidate.expenses);
    return candidate;
  });
  if (new Set(candidates.map(candidate => candidate.id)).size !== candidates.length) fail('candidates.id');
  const ids = new Set(['origin', ...candidates.map(candidate => candidate.id)]);
  const routes = new Map();
  list(input.travelLegs, 'travelLegs', LIMITS.legs).forEach((raw, index) => {
    const field = `travelLegs[${index}]`;
    obj(raw, field);
    const fromId = text(raw.fromId, `${field}.fromId`, 80);
    const toId = text(raw.toId, `${field}.toId`, 80);
    if (!ids.has(fromId) || !ids.has(toId) || fromId === toId) fail(field);
    if (!['walk', 'drive', 'transit'].includes(raw.mode)) fail(`${field}.mode`);
    const durationMinutes = int(raw.durationMinutes, `${field}.durationMinutes`, 1, 180);
    const confidence = raw.confidence;
    if (!['verified', 'estimated'].includes(confidence)) fail(`${field}.confidence`);
    const cost = obj(raw.cost, `${field}.cost`);
    const expense = { ...cost, id: stableId('travel', [fromId, toId, raw.mode]),
      category: 'transport', quantity: 1 };
    budgetCheck(preferences, [expense]);
    const route = { fromId, toId, mode: raw.mode, durationMinutes, confidence,
      ...(raw.distanceMeters === undefined ? {} : { distanceMeters: int(raw.distanceMeters, `${field}.distanceMeters`, 0, 1000000) }),
      ...(raw.source === undefined ? {} : { source: metadata(raw.source, `${field}.source`) }), expense };
    const key = `${fromId}\u0000${toId}\u0000${raw.mode}`;
    if (routes.has(key)) fail(`${field}.route`);
    routes.set(key, route);
  });
  return { preferences, weights: normalizedWeights, candidates: candidates.sort((a, b) => compare(a.id, b.id)), routes };
}

function availability(candidate, arrival, preferences) {
  if (candidate.opening.status === 'unknown') return { visitStart: arrival, waitMinutes: 0, unknown: true };
  for (const window of candidate.opening.windows) {
    const visitStart = Math.max(arrival, window.opens);
    const waitMinutes = (visitStart - arrival) / 60000;
    if (waitMinutes <= preferences.maxWaitMinutes && visitStart + candidate.visitMinutes * 60000 <= window.closes) {
      return { visitStart, waitMinutes, unknown: false };
    }
  }
  return null;
}

function scorePlan(stops, travelMinutes, end, budget, preferences, weights) {
  const n = stops.length;
  const distinct = new Set(stops.map(stop => stop.category)).size;
  const components = {
    relevance: Math.floor(stops.reduce((sum, stop) => sum + stop.relevanceScore, 0) / n),
    mood: preferences.mood ? Math.floor(stops.filter(stop => stop.tags.includes(preferences.mood)).length * 100 / n) : 50,
    category: preferences.categories.length ? Math.floor(new Set(stops.map(stop => stop.category)).size * 100 / preferences.categories.length) : 50,
    preferred: Math.floor(stops.filter(stop => preferences.preferredPlaceIds.includes(stop.placeId)).length * 100 / n),
    travel: Math.max(0, 100 - Math.floor(travelMinutes * 100 / preferences.availableMinutes)),
    budget: budget.remainingBudget === null ? 0 : Math.max(0, Math.min(100, Math.floor(budget.remainingBudget * 100 / Math.max(1, budget.spendableBudget)))),
    schedule: Math.max(0, 100 - Math.floor((end - preferences.start) / 60000 * 100 / preferences.availableMinutes)),
    variety: Math.floor(distinct * 100 / n),
    coverage: Math.floor(n * 100 / preferences.maxStops),
  };
  const weighted = WEIGHT_KEYS.reduce((sum, key) => sum + components[key] * weights[key], 0);
  const denominator = WEIGHT_KEYS.reduce((sum, key) => sum + weights[key], 0);
  return { value: Math.floor(weighted / denominator), components };
}

function generateItineraries(input) {
  const { preferences: p, weights, candidates, routes } = prepare(input);
  const eligible = candidates.filter(candidate => !p.excludedPlaceIds.includes(candidate.id) &&
    (!p.categories.length || p.categories.includes(candidate.category)));
  const route = (from, to) => routes.get(`${from}\u0000${to}\u0000${p.transportMode}`);
  const endLimit = p.start + p.availableMinutes * 60000;
  const plans = [];
  const issues = { missingRoute: 0, closed: 0, timeExceeded: 0, travelLimit: 0, budgetExceeded: 0, excluded: candidates.length - eligible.length };
  let expansions = 0;
  let limitReached = false;
  const pushPlan = state => {
    let legs = state.legs;
    let expenses = state.expenses;
    let end = state.time;
    let travelMinutes = state.travelMinutes;
    if (p.returnToStart) {
      const back = route(state.lastId, 'origin');
      if (!back) { issues.missingRoute++; return; }
      if (back.durationMinutes > p.maxTravelMinutesPerLeg) { issues.travelLimit++; return; }
      end += back.durationMinutes * 60000;
      if (end > endLimit) { issues.timeExceeded++; return; }
      legs = [...legs, { fromId: back.fromId, toId: back.toId, mode: back.mode,
        durationMinutes: back.durationMinutes, confidence: back.confidence,
        ...(back.distanceMeters === undefined ? {} : { distanceMeters: back.distanceMeters }),
        ...(back.source ? { source: back.source } : {}),
        departAt: new Date(state.time).toISOString(), arriveAt: new Date(end).toISOString() }];
      expenses = [...expenses, back.expense];
      travelMinutes += back.durationMinutes;
    }
    const budget = budgetCheck(p, expenses);
    if (budget.affordability === 'exceeds') { issues.budgetExceeded++; return; }
    const warnings = [...state.warnings, ...budget.warnings];
    if (p.returnToStart && legs.at(-1).confidence === 'estimated') warnings.push({ code: 'ESTIMATED_TRAVEL_TIME', leg: `${state.lastId}->origin` });
    const score = scorePlan(state.stops, travelMinutes, end, budget, p, weights);
    const ids = state.stops.map(stop => stop.placeId);
    plans.push({ id: stableId('plan', [p.start, ids, p.budgetAmount, p.budgetMode, p.people, p.transportMode, p.returnToStart]),
      startAt: new Date(p.start).toISOString(), endAt: new Date(end).toISOString(),
      stops: state.stops, travelLegs: legs, expenses, budget,
      estimatedSpendingRange: { minimum: budget.totalMinimumCost, expected: budget.totalExpectedCost, maximum: budget.totalMaximumCost },
      remainingBudget: budget.remainingBudget, score, warnings });
  };
  const expand = state => {
    if (state.stops.length) pushPlan(state);
    if (state.stops.length >= p.maxStops) return;
    for (const candidate of eligible) {
      if (state.used.has(candidate.id)) continue;
      if (expansions >= LIMITS.expansions) { limitReached = true; break; }
      expansions++;
      const leg = route(state.lastId, candidate.id);
      if (!leg) { issues.missingRoute++; continue; }
      if (leg.durationMinutes > p.maxTravelMinutesPerLeg) { issues.travelLimit++; continue; }
      const arrival = state.time + leg.durationMinutes * 60000;
      const available = availability(candidate, arrival, p);
      if (!available) { issues.closed++; continue; }
      const departure = available.visitStart + candidate.visitMinutes * 60000;
      if (departure > endLimit) { issues.timeExceeded++; continue; }
      const expenses = [...state.expenses, leg.expense, ...candidate.expenses];
      const budget = budgetCheck(p, expenses);
      if (budget.affordability === 'exceeds') { issues.budgetExceeded++; continue; }
      const warnings = [...state.warnings];
      if (available.unknown) warnings.push({ code: 'UNKNOWN_OPENING_HOURS', placeId: candidate.id });
      if (leg.confidence === 'estimated') warnings.push({ code: 'ESTIMATED_TRAVEL_TIME', leg: `${state.lastId}->${candidate.id}` });
      const stop = { placeId: candidate.id, name: candidate.name, category: candidate.category,
        relevanceScore: candidate.relevanceScore, tags: candidate.tags, visitMinutes: candidate.visitMinutes,
        arrivalAt: new Date(arrival).toISOString(), visitStartAt: new Date(available.visitStart).toISOString(),
        departureAt: new Date(departure).toISOString(), waitMinutes: available.waitMinutes };
      const travelLeg = { fromId: leg.fromId, toId: leg.toId, mode: leg.mode, durationMinutes: leg.durationMinutes,
        confidence: leg.confidence, ...(leg.distanceMeters === undefined ? {} : { distanceMeters: leg.distanceMeters }),
        ...(leg.source ? { source: leg.source } : {}),
        departAt: new Date(state.time).toISOString(), arriveAt: new Date(arrival).toISOString() };
      expand({ lastId: candidate.id, time: departure, stops: [...state.stops, stop],
        legs: [...state.legs, travelLeg], expenses, travelMinutes: state.travelMinutes + leg.durationMinutes,
        warnings, used: new Set([...state.used, candidate.id]) });
    }
  };
  expand({ lastId: 'origin', time: p.start, stops: [], legs: [], expenses: [], travelMinutes: 0,
    warnings: [], used: new Set() });
  const affordabilityRank = { fits_conservatively: 0, potentially_fits: 1, cannot_determine: 2 };
  plans.sort((a, b) => affordabilityRank[a.budget.affordability] - affordabilityRank[b.budget.affordability] ||
    b.score.value - a.score.value || b.stops.length - a.stops.length || compare(a.id, b.id));
  return { status: plans.length ? 'plans_found' : 'no_feasible_plan', plans: plans.slice(0, LIMITS.results),
    search: { expansions, expansionLimit: LIMITS.expansions, limitReached, candidatesConsidered: eligible.length,
      plansEvaluated: plans.length, issues },
    warnings: limitReached ? [{ code: 'SEARCH_LIMIT_REACHED' }] : [] };
}

module.exports = { generateItineraries, ItineraryInputError, LIMITS, DEFAULT_WEIGHTS };
