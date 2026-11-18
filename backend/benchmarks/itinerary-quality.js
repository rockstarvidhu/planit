const { performance } = require('node:perf_hooks');
const { generateItineraries } = require('../itinerary-engine');
const { normalizeCurrentHours } = require('../opening-hours');

const startAt = '2026-01-01T10:00:00+05:30';
const known = { status: 'known', windows: [{ opensAt: '2026-01-01T09:00:00+05:30', closesAt: '2026-01-01T20:00:00+05:30' }] };
const cost = (amount = 100) => ({ id: 'meal', category: 'activity', quantity: 1, unit: 'group',
  priceStatus: 'estimated', minimumCost: amount, expectedCost: amount, maximumCost: amount });
const unknownCost = { id: 'meal', category: 'activity', quantity: 1, unit: 'group',
  priceStatus: 'unknown', minimumCost: null, expectedCost: null, maximumCost: null };
const place = (id, category = 'Cafe', options = {}) => ({ id, name: `Fictional ${id}`, category,
  latitude: 12.97, longitude: 77.59, tags: ['Chill'], visitMinutes: 45,
  opening: known, source: { name: 'Synthetic fixture' }, expenses: [cost()], ...options });
const leg = (fromId, toId, durationMinutes = 8) => ({ fromId, toId, mode: 'walk', durationMinutes,
  confidence: 'verified', cost: { unit: 'group', priceStatus: 'estimated', minimumCost: 0,
    expectedCost: 0, maximumCost: 0 } });
const scenario = (name, candidates, minutes, options = {}) => {
  const ids = ['origin', ...candidates.map(candidate => candidate.id)];
  const travelLegs = ids.flatMap(fromId => candidates.filter(candidate => candidate.id !== fromId)
    .filter(candidate => !options.missing?.includes(`${fromId}->${candidate.id}`))
    .map(candidate => leg(fromId, candidate.id, options.travelMinutes ?? 8)));
  return { name, request: { preferences: { currency: 'INR', origin: { latitude: 12.97, longitude: 77.59 },
    startAt, availableMinutes: minutes, budgetAmount: options.budget ?? 2750, budgetMode: 'total',
    people: 2, mood: 'Chill', categories: options.categories ?? ['Cafe', 'Food'],
    transportMode: 'walk', maxStops: 3 }, candidates, travelLegs } };
};
const scenarios = [
  scenario('A short cafe', [place('a'), place('b'), place('c')], 120, { categories: ['Cafe'] }),
  scenario('B five-hour mixed', [place('a'), place('b'), place('c', 'Food', { visitMinutes: 75 }),
    place('d', 'Food', { visitMinutes: 75 })], 300),
  scenario('C tight budget', [place('a', 'Cafe', { expenses: [cost(350)] }),
    place('b', 'Food', { expenses: [cost(450)] }), place('c', 'Cafe', { expenses: [cost(100)] })], 240, { budget: 500 }),
  scenario('D unknown prices', [place('a', 'Cafe', { expenses: [unknownCost] }),
    place('b', 'Food', { expenses: [unknownCost] })], 240),
  scenario('E poor connectivity', [place('a'), place('b', 'Food')], 240,
    { missing: ['a->b', 'b->a', 'origin->b'] }),
  scenario('F similar cafes', [place('a'), place('b'), place('c'), place('d', 'Food', { visitMinutes: 75 })], 240),
  scenario('G limited time', [place('a', 'Cafe', { visitMinutes: 110 }),
    place('b', 'Food', { visitMinutes: 125 })], 120),
  scenario('H incomplete data', [place('a', 'Cafe', { opening: { status: 'unknown' }, expenses: [unknownCost] }),
    place('b', 'Food', { visitMinutes: 75, expenses: [unknownCost] })], 240),
];

function evaluate(item) {
  const begun = performance.now();
  const result = generateItineraries(item.request);
  const milliseconds = Math.round((performance.now() - begun) * 1000) / 1000;
  const plan = result.plans[0];
  const visits = plan?.stops.reduce((sum, stop) => sum + stop.visitMinutes, 0) ?? 0;
  const travel = plan?.travelLegs.reduce((sum, route) => sum + route.durationMinutes, 0) ?? 0;
  const waiting = plan?.stops.reduce((sum, stop) => sum + stop.waitMinutes, 0) ?? 0;
  const span = plan ? (Date.parse(plan.endAt) - Date.parse(plan.startAt)) / 60000 : 0;
  const categories = [...new Set(plan?.stops.map(stop => stop.category) ?? [])];
  return { scenario: item.name, stops: plan?.stops.map(stop => stop.placeId) ?? [], categories,
    categoryCoverage: categories.filter(category => item.request.preferences.categories.includes(category)).length,
    preferenceRelevance: plan?.score.components.relevance ?? null,
    visitMinutes: visits, travelMinutes: travel, waitingMinutes: waiting, spanMinutes: span,
    availableMinutes: item.request.preferences.availableMinutes, unusedMinutes: item.request.preferences.availableMinutes - span,
    usefulUtilization: Math.round((visits + travel) * 100 / item.request.preferences.availableMinutes) / 100,
    affordability: plan?.budget.affordability ?? null, warnings: plan?.warnings.map(w => w.code) ?? [],
    ranking: result.plans.map(p => p.stops.map(stop => stop.placeId).join('>')),
    expansions: result.search.expansions, feasibleOptions: result.search.plansEvaluated,
    noResultReason: plan ? null : result.search.issues, milliseconds };
}

function evaluateHours() {
  const base = scenarios[1].request;
  const fetchedAt = Date.parse('2026-01-01T04:00:00Z');
  const point = (hour, minute = 0) => ({ date: { year: 2026, month: 1, day: 1 }, hour, minute });
  const hours = periods => normalizeCurrentHours({ timeZone: { id: 'Asia/Kolkata' },
    currentOpeningHours: { periods } }, base.preferences.startAt, fetchedAt);
  const current = [
    hours([{ open: point(9), close: point(19) }]),
    hours([]),
    { status: 'unknown', reason: 'HOURS_UNAVAILABLE' },
    hours([{ open: point(9), close: point(19) }]),
  ];
  const compare = opening => {
    const request = { ...base, candidates: base.candidates.map((candidate, index) =>
      ({ ...candidate, opening: opening[index] })) };
    const begun = performance.now();
    const result = generateItineraries(request);
    const milliseconds = Math.round((performance.now() - begun) * 1000) / 1000;
    const confirmed = result.plans.filter(plan => plan.budget.affordability === 'fits_conservatively' &&
      plan.stops.every(stop => stop.hoursValidation.status === 'open'));
    return { candidateHours: opening.map(item => item.status),
      supportedStops: result.plans[0]?.stops.filter(stop => stop.hoursValidation.status === 'open').length ?? 0,
      excludedClosedStops: opening.filter(item => item.status === 'closed').length,
      unknownStops: result.plans[0]?.stops.filter(stop => stop.hoursValidation.status === 'unknown').length ?? 0,
      validPlans: result.plans.length, provisionalPlans: result.plans.length - confirmed.length,
      confirmedPlans: confirmed.length, expansions: result.search.expansions,
      usefulUtilization: result.plans[0]?.quality.usefulTimeUtilization ?? 0,
      categoryCoverage: result.plans[0]?.quality.categoryCoverage.length ?? 0,
      topStopIds: result.plans[0]?.stops.map(stop => stop.placeId) ?? [], milliseconds };
  };
  return { baseline: compare(base.candidates.map(() => ({ status: 'unknown', reason: 'HOURS_UNAVAILABLE' }))),
    hoursAware: compare(current) };
}

if (require.main === module) process.stdout.write(`${JSON.stringify(process.argv.includes('--hours') ?
  evaluateHours() : scenarios.map(evaluate), null, 2)}\n`);
module.exports = { scenarios, evaluate, evaluateHours };
