const request = require('supertest');
const axios = require('axios');
const app = require('./index');
const { generateItineraries, ItineraryInputError, LIMITS, DEFAULT_WEIGHTS } = require('./itinerary-engine');

jest.mock('axios');

const price = (minimumCost = 80, expectedCost = 100, maximumCost = 120, unit = 'person') => ({
  priceStatus: 'estimated', minimumCost, expectedCost, maximumCost, unit,
});
const place = (id, overrides = {}) => ({
  id, name: `Fictional ${id}`, latitude: 12.97, longitude: 77.59, category: 'Cafe',
  tags: ['Chill'], visitMinutes: 60,
  opening: { status: 'known', windows: [{ opensAt: '2026-01-01T09:00:00+05:30', closesAt: '2026-01-01T18:00:00+05:30' }] },
  expenses: [{ id: 'entry', category: 'activity', quantity: 1, unit: 'person', ...price() }],
  source: { name: 'Fictional test catalog' }, relevanceScore: 50, ...overrides,
});
const leg = (fromId, toId, durationMinutes = 10, overrides = {}) => ({
  fromId, toId, mode: 'walk', durationMinutes, distanceMeters: 800, confidence: 'estimated',
  cost: price(10, 20, 30, 'group'), source: { name: 'Fictional route fixture' }, ...overrides,
});
const requestBody = (overrides = {}) => ({
  preferences: { currency: 'INR', origin: { latitude: 12.97, longitude: 77.59 }, startAt: '2026-01-01T10:00:00+05:30',
    availableMinutes: 240, budgetAmount: 2750, budgetMode: 'total', people: 2,
    mood: 'Chill', categories: ['Cafe', 'Food', 'Movies'], maxStops: 3, transportMode: 'walk',
    ...(overrides.preferences || {}) },
  candidates: overrides.candidates ?? [place('a')],
  travelLegs: overrides.travelLegs ?? [leg('origin', 'a')],
  ...(overrides.weights ? { weights: overrides.weights } : {}),
});
const only = key => Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map(name => [name, name === key ? 10 : 0]));
const ids = plan => plan.stops.map(stop => stop.placeId);

describe('deterministic itinerary engine', () => {
  test('one stop has exact arrival, departure, transport expense and budget evaluation', () => {
    const result = generateItineraries(requestBody());
    expect(result.status).toBe('plans_found');
    expect(result.plans).toHaveLength(1);
    const plan = result.plans[0];
    expect(ids(plan)).toEqual(['a']);
    expect(plan.stops[0]).toMatchObject({ arrivalAt: '2026-01-01T04:40:00.000Z',
      visitStartAt: '2026-01-01T04:40:00.000Z', departureAt: '2026-01-01T05:40:00.000Z', waitMinutes: 0 });
    expect(plan.travelLegs[0]).toMatchObject({ fromId: 'origin', toId: 'a', durationMinutes: 10 });
    expect(plan.budget).toMatchObject({ effectiveTotalBudget: 2750, totalMinimumCost: 170,
      totalExpectedCost: 220, totalMaximumCost: 270, remainingBudget: 2530,
      affordability: 'fits_conservatively' });
    expect(plan.estimatedSpendingRange).toEqual({ minimum: 170, expected: 220, maximum: 270 });
    expect(plan.warnings.map(w => w.code)).toContain('ESTIMATED_PRICES');
  });

  test('two and three stops account for each route and visit without repeated IDs', () => {
    const body = requestBody({ candidates: [place('a'), place('b', { category: 'Food' }), place('c', { category: 'Movies' })],
      travelLegs: [leg('origin', 'a'), leg('a', 'b', 15), leg('b', 'c', 20)] });
    const result = generateItineraries(body);
    expect(result.plans.map(ids)).toEqual(expect.arrayContaining([['a'], ['a', 'b'], ['a', 'b', 'c']]));
    const three = result.plans.find(plan => plan.stops.length === 3);
    expect(three.endAt).toBe('2026-01-01T08:15:00.000Z');
    expect(three.travelLegs.map(item => item.durationMinutes)).toEqual([10, 15, 20]);
    expect(three.budget.totalExpectedCost).toBe(660);
    expect(new Set(ids(three)).size).toBe(3);
  });

  test('multiple plans rank stably, including ties, with identical output on repeat', () => {
    const body = requestBody({ candidates: [place('b'), place('a')], travelLegs: [leg('origin', 'a'), leg('origin', 'b')] });
    const first = generateItineraries(body);
    expect(first.plans).toHaveLength(2);
    expect(first).toEqual(generateItineraries(body));
    expect(first.plans.map(plan => plan.id)).toEqual([...first.plans.map(plan => plan.id)].sort());
  });

  test('total versus per-person budget, group costs and contingency change affordability', () => {
    const expensive = place('a', { expenses: [{ id: 'entry', category: 'activity', quantity: 1, ...price(1100, 1200, 1250) }] });
    const total = generateItineraries(requestBody({ candidates: [expensive], preferences: { contingencyPercent: 10 } }));
    expect(total.plans[0].budget).toMatchObject({ effectiveTotalBudget: 2750, contingencyReserve: 275,
      totalExpectedCost: 2420, totalMaximumCost: 2530, affordability: 'potentially_fits' });
    const perPerson = generateItineraries(requestBody({ candidates: [expensive], preferences: { budgetMode: 'perPerson', contingencyPercent: 10 } }));
    expect(perPerson.plans[0].budget).toMatchObject({ effectiveTotalBudget: 5500, contingencyReserve: 550,
      totalExpectedCost: 2420, affordability: 'fits_conservatively' });
  });

  test('budget exceeded is excluded; changing a candidate price recalculates the plan', () => {
    const costly = place('a', { expenses: [{ id: 'entry', category: 'activity', quantity: 1, ...price(1500, 1500, 1500) }] });
    expect(generateItineraries(requestBody({ candidates: [costly] })).status).toBe('no_feasible_plan');
    expect(generateItineraries(requestBody({ candidates: [place('a')] })).plans[0].budget.totalExpectedCost).toBe(220);
  });

  test('unknown prices are explicit and never conservatively affordable', () => {
    const unknown = place('a', { expenses: [{ id: 'entry', category: 'activity', quantity: 1, unit: 'group',
      priceStatus: 'unknown', minimumCost: null, expectedCost: null, maximumCost: null }] });
    const plan = generateItineraries(requestBody({ candidates: [unknown] })).plans[0];
    expect(plan.budget).toMatchObject({ totalExpectedCost: null, totalMaximumCost: null,
      remainingBudget: null, affordability: 'cannot_determine' });
    expect(plan.warnings.map(w => w.code)).toContain('MISSING_PRICES');
  });

  test('unknown transport cost also makes the entire plan cost indeterminate', () => {
    const unknownCost = { unit: 'group', priceStatus: 'unknown', minimumCost: null,
      expectedCost: null, maximumCost: null };
    const plan = generateItineraries(requestBody({ travelLegs: [leg('origin', 'a', 10, { cost: unknownCost })] })).plans[0];
    expect(plan.budget.totalExpectedCost).toBeNull();
    expect(plan.budget.affordability).toBe('cannot_determine');
    expect(plan.estimatedSpendingRange.maximum).toBeNull();
  });

  test('time and travel constraints reject trips that exceed available duration', () => {
    const long = place('a', { visitMinutes: 180 });
    expect(generateItineraries(requestBody({ candidates: [long], travelLegs: [leg('origin', 'a', 70)],
      preferences: { availableMinutes: 240 } })).status).toBe('no_feasible_plan');
    expect(generateItineraries(requestBody({ travelLegs: [leg('origin', 'a', 70)],
      preferences: { maxTravelMinutesPerLeg: 30 } })).search.issues.travelLimit).toBe(1);
  });

  test('closed upon arrival and closing before visit completion are rejected', () => {
    const closed = place('a', { opening: { status: 'known', windows: [{ opensAt: '2026-01-01T06:00:00+05:30',
      closesAt: '2026-01-01T09:00:00+05:30' }] } });
    const closesEarly = place('a', { opening: { status: 'known', windows: [{ opensAt: '2026-01-01T09:00:00+05:30',
      closesAt: '2026-01-01T10:30:00+05:30' }] } });
    expect(generateItineraries(requestBody({ candidates: [closed] })).search.issues.closed).toBe(1);
    expect(generateItineraries(requestBody({ candidates: [closesEarly] })).status).toBe('no_feasible_plan');
  });

  test('waits for opening and counts waiting against available time', () => {
    const later = place('a', { opening: { status: 'known', windows: [{ opensAt: '2026-01-01T11:00:00+05:30',
      closesAt: '2026-01-01T13:00:00+05:30' }] } });
    const plan = generateItineraries(requestBody({ candidates: [later] })).plans[0];
    expect(plan.stops[0]).toMatchObject({ arrivalAt: '2026-01-01T04:40:00.000Z',
      visitStartAt: '2026-01-01T05:30:00.000Z', waitMinutes: 50 });
    expect(generateItineraries(requestBody({ candidates: [later], preferences: { maxWaitMinutes: 30 } })).status).toBe('no_feasible_plan');
  });

  test('overnight window, offsets and daylight-saving transition use absolute instants', () => {
    const overnight = place('a', { opening: { status: 'known', windows: [{ opensAt: '2026-01-01T22:00:00+05:30',
      closesAt: '2026-01-02T02:00:00+05:30' }] } });
    const night = generateItineraries(requestBody({ candidates: [overnight], preferences: { startAt: '2026-01-01T23:20:00+05:30' } })).plans[0];
    expect(night.endAt).toBe('2026-01-01T19:00:00.000Z');
    const differentZone = place('a', { opening: { status: 'known', windows: [{ opensAt: '2026-01-01T04:30:00Z',
      closesAt: '2026-01-01T08:00:00Z' }] } });
    expect(generateItineraries(requestBody({ candidates: [differentZone] })).plans[0].stops[0].arrivalAt).toBe('2026-01-01T04:40:00.000Z');
    const dst = place('a', { visitMinutes: 40, opening: { status: 'known', windows: [{ opensAt: '2026-03-08T01:30:00-05:00',
      closesAt: '2026-03-08T03:30:00-04:00' }] } });
    const dstPlan = generateItineraries(requestBody({ candidates: [dst], preferences: { startAt: '2026-03-08T01:40:00-05:00',
      availableMinutes: 90 } })).plans[0];
    expect(dstPlan.endAt).toBe('2026-03-08T07:30:00.000Z');
  });

  test('missing and return routes never become zero-minute travel', () => {
    const missing = generateItineraries(requestBody({ travelLegs: [] }));
    expect(missing).toMatchObject({ status: 'no_feasible_plan', plans: [], search: { issues: { missingRoute: 1 } } });
    const returnMissing = generateItineraries(requestBody({ preferences: { returnToStart: true } }));
    expect(returnMissing.status).toBe('no_feasible_plan');
    const returned = generateItineraries(requestBody({ preferences: { returnToStart: true },
      travelLegs: [leg('origin', 'a'), leg('a', 'origin', 12)] })).plans[0];
    expect(returned.travelLegs).toHaveLength(2);
    expect(returned.endAt).toBe('2026-01-01T05:52:00.000Z');
    expect(returned.budget.totalExpectedCost).toBe(240);
  });

  test('category, mood, preferred and excluded places change selection or ranking', () => {
    const a = place('a', { tags: ['Lively'], category: 'Cafe' });
    const b = place('b', { tags: ['Chill'], category: 'Food' });
    const routes = [leg('origin', 'a'), leg('origin', 'b')];
    expect(generateItineraries(requestBody({ candidates: [a, b], travelLegs: routes,
      preferences: { categories: ['Food'] } })).plans.map(ids)).toEqual([['b']]);
    expect(generateItineraries(requestBody({ candidates: [a, b], travelLegs: routes,
      weights: only('mood') })).plans[0].stops[0].placeId).toBe('b');
    expect(generateItineraries(requestBody({ candidates: [a, b], travelLegs: routes,
      preferences: { preferredPlaceIds: ['a'] }, weights: only('preferred') })).plans[0].stops[0].placeId).toBe('a');
    expect(generateItineraries(requestBody({ candidates: [a, b], travelLegs: routes,
      preferences: { excludedPlaceIds: ['b'] } })).plans.map(ids)).toEqual([['a']]);
  });

  test('variety weight favors distinct categories over repeated destinations', () => {
    const result = generateItineraries(requestBody({ candidates: [place('a'), place('b'), place('c', { category: 'Food' })],
      travelLegs: [leg('origin', 'a'), leg('a', 'b'), leg('a', 'c')],
      preferences: { maxStops: 2 }, weights: only('variety') }));
    expect(ids(result.plans[0])).toEqual(['a', 'c']);
  });

  test('unknown opening hours are warning-bearing, and empty candidate list is explicit', () => {
    const unknownHours = place('a', { opening: { status: 'unknown' } });
    expect(generateItineraries(requestBody({ candidates: [unknownHours] })).plans[0].warnings.map(w => w.code)).toContain('UNKNOWN_OPENING_HOURS');
    expect(generateItineraries(requestBody({ candidates: [], travelLegs: [] }))).toMatchObject({ status: 'no_feasible_plan', plans: [] });
  });

  test('search caps expansions and returned plans with twelve reachable candidates', () => {
    const candidates = Array.from({ length: LIMITS.candidates }, (_, i) => place(String(i)));
    const allIds = ['origin', ...candidates.map(candidate => candidate.id)];
    const travelLegs = allIds.flatMap(fromId => candidates.filter(candidate => candidate.id !== fromId)
      .map(candidate => leg(fromId, candidate.id, 1)));
    const result = generateItineraries(requestBody({ candidates, travelLegs, preferences: { maxStops: 4, categories: [] } }));
    expect(result.search).toMatchObject({ expansions: LIMITS.expansions, limitReached: true });
    expect(result.plans.length).toBeLessThanOrEqual(LIMITS.results);
    expect(result.warnings).toEqual([{ code: 'SEARCH_LIMIT_REACHED' }]);
  });

  test.each([
    ['malformed root', null], ['invalid coordinate', requestBody({ preferences: { origin: { latitude: 91, longitude: 77.59 } } })],
    ['duplicate place IDs', requestBody({ candidates: [place('a'), place('a')] })],
    ['invalid visit duration', requestBody({ candidates: [place('a', { visitMinutes: -5 })] })],
    ['missing price bound', requestBody({ candidates: [place('a', { expenses: [{ id: 'x', category: 'activity', quantity: 1,
      unit: 'person', priceStatus: 'estimated', minimumCost: 10, expectedCost: 20 }] })] })],
    ['too many candidates', requestBody({ candidates: Array.from({ length: 13 }, (_, i) => place(String(i))) })],
    ['impossible window', requestBody({ candidates: [place('a', { opening: { status: 'known', windows: [{ opensAt: '2026-01-01T12:00:00Z', closesAt: '2026-01-01T11:00:00Z' }] } })] })],
    ['invalid offset', requestBody({ preferences: { startAt: '2026-01-01T10:00:00+25:00' } })],
    ['unsupported currency', requestBody({ preferences: { currency: 'USD' } })],
  ])('rejects %s', (_name, body) => expect(() => generateItineraries(body)).toThrow(ItineraryInputError));

  test('caller inputs stay unchanged and result is identical on repeat', () => {
    const body = requestBody();
    const before = JSON.stringify(body);
    expect(generateItineraries(body)).toEqual(generateItineraries(body));
    expect(JSON.stringify(body)).toBe(before);
  });
});

describe('POST /api/plans/generate', () => {
  test('generates a deterministic plan without a paid provider call', async () => {
    axios.get.mockClear();
    const response = await request(app).post('/api/plans/generate').send(requestBody());
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.plans[0].budget.totalExpectedCost).toBe(220);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test.each([{}, { ...requestBody(), candidates: 'bad' }, requestBody({ preferences: { availableMinutes: -1 } })])('rejects malformed input safely', async body => {
    const response = await request(app).post('/api/plans/generate').send(body);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_INPUT');
    expect(response.body.stack).toBeUndefined();
  });

  test('its own 20-request limit cannot be reset with spoofed forwarding headers', async () => {
    const statuses = [];
    for (let i = 0; i < 21; i++) {
      const response = await request(app).post('/api/plans/generate')
        .set('X-Forwarded-For', `198.51.100.${i + 1}`).send(requestBody());
      statuses.push(response.status);
    }
    expect(statuses).toContain(429);
    expect(statuses.at(-1)).toBe(429);
  });
});
