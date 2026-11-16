const request = require('supertest');
jest.mock('axios');
const axios = require('axios');
const app = require('./index');
const { createPlan, validateInput, SHORTLIST_LIMIT } = require('./planning-orchestrator');
const { discoverPlaces } = require('./providers/google-places');
const { computeRouteMatrix } = require('./providers/google-routes');
const { HttpError } = require('./security');

const NOW = Date.parse('2026-01-01T03:00:00Z');
const START = '2026-01-01T10:00:00+05:30';
const input = (overrides = {}) => ({ origin: { latitude: 12.97, longitude: 77.59 }, startAt: START,
  availableMinutes: 240, budgetAmount: 2750, budgetMode: 'total', people: 2,
  categories: ['Cafe', 'Food'], transportMode: 'walk', ...overrides });
const point = (hour, minute = 0) => ({ date: { year: 2026, month: 1, day: 1 }, hour, minute });
const rawPlace = (id, primaryType, latitude, overrides = {}) => ({ id,
  displayName: { text: `Fictional ${id}` }, location: { latitude, longitude: 77.59 },
  primaryType, types: [primaryType], businessStatus: 'OPERATIONAL', attributions: [],
  timeZone: { id: 'Asia/Kolkata' }, currentOpeningHours: { periods: [{ open: point(9), close: point(18) }] },
  ...overrides });
const rawPlaces = () => [rawPlace('cafe', 'cafe', 12.971), rawPlace('food', 'restaurant', 12.972)];
const matrixFixture = matrix => matrix.origins.flatMap((origin, originIndex) =>
  matrix.destinations.map((destination, destinationIndex) => ({ originIndex, destinationIndex,
    condition: origin.id === destination.id ? 'ROUTE_NOT_FOUND' : 'ROUTE_EXISTS',
    ...(origin.id === destination.id ? {} : { distanceMeters: 800, duration: '600s' }) })));

function dependencies(places = rawPlaces(), routeRows = matrixFixture) {
  const discover = jest.fn((body, options) => discoverPlaces(body, { ...options, mode: 'fixture', nodeEnv: 'test',
    fixtureResponse: { places }, now: NOW }));
  const routes = jest.fn((body, options) => computeRouteMatrix(body, { ...options, mode: 'fixture', nodeEnv: 'test',
    fixtureResponse: routeRows(body), now: NOW }));
  return { discoverPlaces: discover, computeRouteMatrix: routes };
}

describe('bounded planning orchestrator', () => {
  test('fictional multi-stop itinerary has calculated schedule, separate provisional plans and unknown cost', async () => {
    const deps = dependencies();
    const result = await createPlan(input(), { deps, now: NOW, hoursEnabled: true });
    expect(result).toMatchObject({ status: 'provisional', demo: true, plans: [],
      providers: { places: 'rove_fixture', routes: 'rove_fixture' },
      usage: { placesRequests: 0, routesRequests: 0, routeElements: 6 } });
    const two = result.provisionalPlans.find(plan => plan.stops.length === 2);
    expect(two).toBeDefined();
    expect(two.stops.map(stop => stop.placeId)).toEqual(['cafe', 'food']);
    expect(two.stops.map(stop => stop.visitMinutes)).toEqual([45, 75]);
    expect(two.startAt).toBe('2026-01-01T04:30:00.000Z');
    expect(two.endAt).toBe('2026-01-01T06:50:00.000Z');
    expect(two.budgetSummary).toMatchObject({ assessment: 'cannot_determine',
      knownCostSubtotalRange: { minimum: null, expected: null, maximum: null },
      unknownExpenseCategories: ['activity', 'transport'], expectedRemaining: null, conservativeRemaining: null });
    expect(two.planningDurations).toEqual([{ placeId: 'cafe', source: 'rove_planning_assumption', minutes: 45 },
      { placeId: 'food', source: 'rove_planning_assumption', minutes: 75 }]);
    expect(deps.discoverPlaces).toHaveBeenCalledTimes(1);
    expect(deps.computeRouteMatrix).toHaveBeenCalledTimes(1);
    expect(deps.computeRouteMatrix.mock.calls[0][0]).toMatchObject({ origins: [
      { id: 'origin' }, { id: 'cafe' }, { id: 'food' }], destinations: [{ id: 'cafe' }, { id: 'food' }] });
  });

  test('single-stop result uses explicit user duration and does not claim provider verification', async () => {
    const result = await createPlan(input({ categories: ['Cafe'], visitDurations: { cafe: 90 } }),
      { deps: dependencies([rawPlace('cafe', 'cafe', 12.971)]), now: NOW, hoursEnabled: true });
    expect(result.status).toBe('provisional');
    expect(result.provisionalPlans[0].stops).toHaveLength(1);
    expect(result.provisionalPlans[0].stops[0]).toMatchObject({ visitMinutes: 90,
      arrivalAt: '2026-01-01T04:40:00.000Z', departureAt: '2026-01-01T06:10:00.000Z' });
    expect(result.provisionalPlans[0].planningDurations[0].source).toBe('user_supplied_estimate');
  });

  test('unknown opening hours stay outside confirmed plans', async () => {
    const result = await createPlan(input({ categories: ['Cafe'] }),
      { deps: dependencies([rawPlace('cafe', 'cafe', 12.971)]), now: NOW, hoursEnabled: false });
    expect(result).toMatchObject({ status: 'provisional', plans: [],
      provisionalPlans: [expect.objectContaining({ dataQuality: { openingHours: 'unknown', prices: 'unknown' } })] });
    expect(result.provisionalPlans[0].warnings.map(item => item.code)).toContain('UNKNOWN_OPENING_HOURS');
  });

  test('no candidates and fixed-schedule movies do not trigger Routes or fictional fallback', async () => {
    const empty = dependencies([]);
    const absent = await createPlan(input(), { deps: empty, now: NOW });
    expect(absent).toMatchObject({ status: 'insufficient_data', plans: [], provisionalPlans: [],
      warnings: expect.arrayContaining([{ code: 'NO_CANDIDATES' }]) });
    expect(empty.computeRouteMatrix).not.toHaveBeenCalled();
    const movie = dependencies([rawPlace('movie', 'movie_theater', 12.971)]);
    const fixed = await createPlan(input({ categories: ['Movies'], visitDurations: { movie: 120 } }),
      { deps: movie, now: NOW });
    expect(fixed).toMatchObject({ status: 'insufficient_data', plans: [],
      exclusions: [{ placeId: 'movie', reason: 'FIXED_SCHEDULE_REQUIRED' }] });
    expect(movie.computeRouteMatrix).not.toHaveBeenCalled();
  });

  test('closed hours or over-budget known minimum produce no feasible plan', async () => {
    const closed = rawPlace('cafe', 'cafe', 12.971, { currentOpeningHours: { periods: [
      { open: point(15), close: point(18) }] } });
    const result = await createPlan(input({ categories: ['Cafe'], availableMinutes: 120 }),
      { deps: dependencies([closed]), now: NOW, hoursEnabled: true });
    expect(result).toMatchObject({ status: 'no_feasible_plan', plans: [], provisionalPlans: [] });
    expect(result.search.issues.closed).toBeGreaterThan(0);
  });

  test('missing route produces insufficient data, partial routes retain usable suggestions', async () => {
    const missing = dependencies([rawPlace('cafe', 'cafe', 12.971)], () => [
      { originIndex: 0, destinationIndex: 0, condition: 'ROUTE_NOT_FOUND' }]);
    const unavailable = await createPlan(input({ categories: ['Cafe'] }), { deps: missing, now: NOW });
    expect(unavailable).toMatchObject({ status: 'insufficient_data', plans: [], provisionalPlans: [],
      suggestions: [expect.objectContaining({ id: 'cafe' })] });
    expect(unavailable.exclusions).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'ROUTE_NOT_FOUND' })]));
    const partial = dependencies(rawPlaces(), matrix => matrixFixture(matrix).filter(row =>
      !(row.originIndex === 0 && row.destinationIndex === 1)));
    const result = await createPlan(input(), { deps: partial, now: NOW });
    expect(result.provisionalPlans.some(plan => plan.stops[0].placeId === 'cafe')).toBe(true);
    expect(result.exclusions).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'MISSING_ELEMENT' })]));
  });

  test('shortlist is deterministic, excludes extras and caps the matrix at 20/25 elements', async () => {
    const places = ['z', 'a', 'c', 'b', 'e', 'd', 'f', 'g'].map((id, index) =>
      rawPlace(id, 'cafe', 12.971 + index * 0.0001));
    const deps = dependencies(places);
    const result = await createPlan(input({ categories: ['Cafe'] }), { deps, now: NOW });
    expect(result.suggestions.map(item => item.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(result.suggestions).toHaveLength(SHORTLIST_LIMIT);
    expect(result.usage.routeElements).toBe(20);
    expect(result.exclusions.filter(item => item.reason === 'SHORTLIST_LIMIT')).toHaveLength(4);
    const returning = await createPlan(input({ categories: ['Cafe'], returnToStart: true }),
      { deps: dependencies(places), now: NOW });
    expect(returning.usage.routeElements).toBe(25);
  });

  test('shortlist represents both selected categories despite a cafe-heavy response', async () => {
    const places = [...['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) =>
      rawPlace(id, 'cafe', 12.971 + index * 0.0001)),
    rawPlace('food', 'restaurant', 12.972)];
    const deps = dependencies(places);
    const result = await createPlan(input(), { deps, now: NOW });
    expect(result.suggestions.map(item => item.id)).toEqual(['a', 'food', 'b', 'c']);
    expect(result.usage.routeElements).toBe(20);
    expect(deps.discoverPlaces).toHaveBeenCalledTimes(1);
    expect(deps.computeRouteMatrix).toHaveBeenCalledTimes(1);
  });

  test('within-category selection is local and duplicate IDs do not consume slots', async () => {
    const places = [rawPlace('a-far', 'cafe', 12.99), rawPlace('b-near', 'cafe', 12.971),
      rawPlace('b-near', 'cafe', 12.971), rawPlace('food', 'restaurant', 12.972)];
    const result = await createPlan(input(), { deps: dependencies(places), now: NOW });
    expect(result.suggestions.map(item => item.id)).toEqual(['b-near', 'food', 'a-far']);
    expect(new Set(result.suggestions.map(item => item.id)).size).toBe(result.suggestions.length);
    expect(result.usage.routeElements).toBe(12);
  });

  test('provider-disabled, timeout and quota are explicit non-success statuses', async () => {
    const disabled = await createPlan(input(), { now: NOW });
    expect(disabled).toMatchObject({ status: 'provider_unavailable', httpStatus: 503,
      providerFailure: { stage: 'places', code: 'PLACES_DISABLED' }, plans: [] });
    const placesFailure = { discoverPlaces: jest.fn().mockRejectedValue(new HttpError(504, 'PROVIDER_TIMEOUT', 'private')) };
    const timeout = await createPlan(input(), { deps: placesFailure, now: NOW });
    expect(timeout).toMatchObject({ status: 'provider_unavailable', httpStatus: 504,
      providerFailure: { stage: 'places', code: 'PROVIDER_TIMEOUT' } });
    expect(JSON.stringify(timeout)).not.toContain('private');
    const deps = dependencies();
    deps.computeRouteMatrix.mockRejectedValue(new HttpError(503, 'PROVIDER_QUOTA', 'private'));
    const quota = await createPlan(input(), { deps, now: NOW });
    expect(quota).toMatchObject({ status: 'provider_unavailable', httpStatus: 503,
      providerFailure: { stage: 'routes', code: 'PROVIDER_QUOTA' } });
    expect(deps.computeRouteMatrix).toHaveBeenCalledTimes(1);
  });

  test.each([
    { ...input(), origin: { latitude: 91, longitude: 77 } },
    { ...input(), startAt: '2026-01-01T10:00:00' },
    { ...input(), budgetAmount: -1 }, { ...input(), budgetMode: 'hourly' },
    { ...input(), people: 0 }, { ...input(), availableMinutes: 10 },
    { ...input(), categories: ['Cafe', 'Cafe'] }, { ...input(), transportMode: 'taxi' },
    { ...input(), visitDurations: { cafe: 0 } }, { ...input(), maxStops: 5 },
    { ...input(), providerUrl: 'https://example.invalid' },
  ])('invalid preferences reject before provider calls', bad => {
    expect(() => validateInput(bad, NOW)).toThrow();
  });

  test('per-person and group size are passed through to the existing Budget Engine', async () => {
    const base = dependencies([rawPlace('cafe', 'cafe', 12.971)]);
    const total = await createPlan(input({ categories: ['Cafe'], budgetAmount: 1000, people: 3 }),
      { deps: base, now: NOW });
    const perPerson = await createPlan(input({ categories: ['Cafe'], budgetAmount: 1000,
      budgetMode: 'perPerson', people: 3 }), { deps: dependencies([rawPlace('cafe', 'cafe', 12.971)]), now: NOW });
    expect(total.provisionalPlans[0].budget.effectiveTotalBudget).toBe(1000);
    expect(perPerson.provisionalPlans[0].budget.effectiveTotalBudget).toBe(3000);
    expect(perPerson.provisionalPlans[0].budgetSummary.expectedRemaining).toBeNull();
  });

  test('source attribution survives suggestions and provider metadata', async () => {
    const withAttribution = rawPlace('cafe', 'cafe', 12.971, { attributions: [
      { provider: 'Fictional photographer', providerUri: 'https://example.org/photo' }] });
    const deps = dependencies([withAttribution]);
    const result = await createPlan(input({ categories: ['Cafe'] }), { deps, now: NOW });
    expect(result.demo).toBe(true);
    expect(result.suggestions[0].source.name).toBe('Rove fictional fixture');
    expect(result.attribution.googleMapsRequired).toBe(false);
    expect(result.usage.placesRequests).toBe(0);
  });

  test('Google attribution propagates and known costs plus hours are required for ready', async () => {
    const discovered = await discoverPlaces({ latitude: 12.97, longitude: 77.59,
      radiusMeters: 3000, categories: ['Cafe'], limit: 8 },
    { mode: 'fixture', nodeEnv: 'test', fixtureResponse: { places: [rawPlace('cafe', 'cafe', 12.971)] }, now: NOW });
    const candidate = { ...discovered.candidates[0], opening: { status: 'known', windows: [
      { opensAt: '2026-01-01T03:30:00.000Z', closesAt: '2026-01-01T12:30:00.000Z' }] },
    expenses: [{ id: 'fictional-drink', category: 'food', quantity: 1, unit: 'person',
      priceStatus: 'verified', minimumCost: 100, expectedCost: 100, maximumCost: 100,
      source: { name: 'Fictional test receipt', verifiedAt: '2026-01-01T00:00:00Z' } }],
    attribution: { googleMapsRequired: true, thirdParty: [{ provider: 'Fictional contributor' }] } };
    const deps = { discoverPlaces: jest.fn().mockResolvedValue({ provider: 'google_places_new',
      candidates: [candidate], attribution: { googleMapsRequired: true }, warnings: [] }),
    computeRouteMatrix: jest.fn().mockResolvedValue({ provider: 'google_routes_new',
      legs: [{ fromId: 'origin', toId: 'cafe', mode: 'walk', durationMinutes: 10,
        distanceMeters: 800, confidence: 'estimated', source: { name: 'Fictional route test' },
        cost: { unit: 'group', priceStatus: 'verified', minimumCost: 20, expectedCost: 20,
          maximumCost: 20, source: { name: 'Fictional test receipt', verifiedAt: '2026-01-01T00:00:00Z' } } }],
      failed: [], usage: { requestedElements: 2, providerRequests: 1 },
      attribution: { googleCopyrightRequired: true }, warnings: [] }) };
    const result = await createPlan(input({ categories: ['Cafe'] }), { deps, now: NOW });
    expect(result).toMatchObject({ status: 'ready', demo: false, provisionalPlans: [],
      attribution: { googleMapsRequired: true, googleCopyrightRequired: true,
        thirdParty: [{ provider: 'Fictional contributor' }] },
      usage: { placesRequests: 1, routesRequests: 1, routeElements: 2 },
      plans: [expect.objectContaining({ budgetSummary: { assessment: 'fits_conservatively',
        knownCostSubtotalRange: { minimum: 220, expected: 220, maximum: 220 },
        unknownExpenseCategories: [], expectedRemaining: 2530, conservativeRemaining: 2530 } })] });
  });

  test('endpoint fixture flow returns provisional demo plans and no paid calls', async () => {
    process.env.ROVE_PLACES_MODE = 'fixture';
    process.env.ROVE_ROUTES_MODE = 'fixture';
    try {
      const result = await request(app).post('/api/plans/create').send(input({ startAt:
        new Date(Date.now() + 60000).toISOString(), categories: ['Cafe'] }));
      expect(result).toMatchObject({ status: 200, body: { status: 'provisional', demo: true,
        plans: [], provisionalPlans: [expect.objectContaining({ budgetSummary: {
          assessment: 'cannot_determine', expectedRemaining: null, conservativeRemaining: null,
          knownCostSubtotalRange: expect.any(Object), unknownExpenseCategories: expect.any(Array) } })] } });
      expect(result.headers['cache-control']).toBe('no-store');
    } finally {
      process.env.ROVE_PLACES_MODE = 'disabled'; process.env.ROVE_ROUTES_MODE = 'disabled';
    }
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('endpoint blocks oversized body and live retries by idempotency key', async () => {
    expect((await request(app).post('/api/plans/create').send({ ...input(), padding: 'x'.repeat(12000) })).status).toBe(413);
    process.env.ROVE_PLACES_MODE = 'live';
    try {
      const payload = input({ startAt: new Date(Date.now() + 60000).toISOString() });
      const first = await request(app).post('/api/plans/create').set('Idempotency-Key', 'synthetic-run-1').send(payload);
      expect(first.status).toBe(503);
      expect(first.body).toMatchObject({ status: 'provider_unavailable', providerFailure: { stage: 'places' } });
      const replay = await request(app).post('/api/plans/create').set('Idempotency-Key', 'synthetic-run-1').send(payload);
      expect(replay).toMatchObject({ status: 409, body: { code: 'REQUEST_ALREADY_ATTEMPTED' } });
      const missingKey = await request(app).post('/api/plans/create').send(payload);
      expect(missingKey).toMatchObject({ status: 400, body: { code: 'INVALID_INPUT' } });
    } finally { process.env.ROVE_PLACES_MODE = 'disabled'; }
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('mocked live endpoint uses exactly one Places call and one 2-element Routes matrix', async () => {
    axios.post.mockReset();
    axios.post.mockImplementation(async url => url.includes('searchNearby')
      ? { status: 200, data: { places: [rawPlace('live-cafe', 'cafe', 12.971)] } }
      : { status: 200, data: [
        { originIndex: 0, destinationIndex: 0, condition: 'ROUTE_EXISTS', distanceMeters: 800, duration: '600s' },
        { originIndex: 1, destinationIndex: 0, condition: 'ROUTE_NOT_FOUND' }] });
    process.env.ROVE_PLACES_MODE = 'live'; process.env.ROVE_ROUTES_MODE = 'live';
    process.env.ROVE_PLACES_LIVE_ENABLED = 'true'; process.env.ROVE_ROUTES_LIVE_ENABLED = 'true';
    try {
      const result = await request(app).post('/api/plans/create').set('Idempotency-Key', 'synthetic-run-2')
        .send(input({ startAt: new Date(Date.now() + 60000).toISOString(), categories: ['Cafe'] }));
      expect(result).toMatchObject({ status: 200, body: { status: 'provisional', demo: false,
        providers: { places: 'google_places_new', routes: 'google_routes_new' },
        attribution: { googleMapsRequired: true, googleCopyrightRequired: true },
        usage: { placesRequests: 1, routesRequests: 1, routeElements: 2 } } });
      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(axios.post.mock.calls[0][0]).toContain('places:searchNearby');
      expect(axios.post.mock.calls[1][0]).toContain('computeRouteMatrix');
    } finally {
      process.env.ROVE_PLACES_MODE = 'disabled'; process.env.ROVE_ROUTES_MODE = 'disabled';
      process.env.ROVE_PLACES_LIVE_ENABLED = 'false'; process.env.ROVE_ROUTES_LIVE_ENABLED = 'false';
      axios.post.mockReset();
    }
  });

  test('dedicated planning rate limit ignores spoofed forwarding headers', async () => {
    let isolatedApp;
    jest.isolateModules(() => { isolatedApp = require('./index'); });
    process.env.ROVE_PLACES_MODE = 'fixture'; process.env.ROVE_ROUTES_MODE = 'fixture';
    try {
      const payload = input({ startAt: new Date(Date.now() + 60000).toISOString(), categories: ['Cafe'] });
      for (let index = 0; index < 5; index++) {
        const result = await request(isolatedApp).post('/api/plans/create')
          .set('X-Forwarded-For', `198.51.100.${index + 1}`).send(payload);
        expect(result.status).toBe(200);
      }
      const limited = await request(isolatedApp).post('/api/plans/create')
        .set('X-Forwarded-For', '203.0.113.99').send(payload);
      expect(limited.status).toBe(429);
    } finally {
      process.env.ROVE_PLACES_MODE = 'disabled'; process.env.ROVE_ROUTES_MODE = 'disabled';
    }
  });
});
