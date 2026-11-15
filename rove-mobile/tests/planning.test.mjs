import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { createApiClient, ApiClientError } from '../src/services/api.ts';
import { buildPlanningRequest, initialActivities, mapActivities, newPlanningKey, planningOrigin } from '../src/services/planningFlow.ts';
import { parsePlanningResponse } from '../src/services/planningResponse.ts';

const location = { kind: 'demo', id: 'bengaluru', label: 'Bengaluru' };
const input = { location, budgetAmount: 2750, budgetMode: 'total', people: 2, duration: '4–6 hours',
  mood: 'Chill', activities: ['Cafés', 'Food'] };
const request = buildPlanningRequest(input, new Date('2026-11-09T06:00:00Z'));
const empty = status => ({ status, demo: false, plans: [], provisionalPlans: [], suggestions: [],
  exclusions: [], warnings: [], providers: { places: 'not_requested', routes: 'not_requested' },
  attribution: { googleMapsRequired: false, googleCopyrightRequired: false, thirdParty: [] },
  usage: { placesRequests: 0, routesRequests: 0, routeElements: 0 } });
const plan = { id: 'p1', startAt: request.startAt, endAt: '2026-11-09T08:00:00Z',
  stops: [{ placeId: 'cafe', name: 'Test Café', category: 'Cafe', arrivalAt: request.startAt,
    visitStartAt: request.startAt, departureAt: '2026-11-09T07:00:00Z', visitMinutes: 45, waitMinutes: 0 }],
  travelLegs: [], estimatedSpendingRange: { minimum: null, expected: null, maximum: null },
  remainingBudget: null, budgetSummary: { assessment: 'cannot_determine',
    knownCostSubtotalRange: { minimum: null, expected: null, maximum: null },
    unknownExpenseCategories: ['activity', 'transport'], expectedRemaining: null, conservativeRemaining: null },
  dataQuality: { openingHours: 'unknown', prices: 'unknown' }, warnings: [{ code: 'UNKNOWN_OPENING_HOURS' }] };

test('Discover handoff preserves budget mode, party, duration, category and area', () => {
  assert.deepEqual(initialActivities('Nature'), ['Parks']);
  assert.deepEqual(mapActivities(['Parks', 'Food']), ['Outdoors', 'Food']);
  assert.deepEqual(request.origin, planningOrigin(location));
  assert.equal(request.availableMinutes, 300);
  assert.equal(request.budgetAmount, 2750);
  assert.equal(request.people, 2);
  assert.deepEqual(request.categories, ['Cafe', 'Food']);
  assert.equal(request.startAt, '2026-11-09T06:02:00.000Z');
  const perPerson = buildPlanningRequest({ ...input, budgetMode: 'perPerson' });
  assert.equal(perPerson.budgetAmount, 2750);
  assert.equal(perPerson.budgetMode, 'perPerson');
  assert.equal(perPerson.people, 2);
  assert.equal(buildPlanningRequest({ ...input, mood: 'Explore' }).mood, 'Adventurous');
  assert.equal(buildPlanningRequest({ ...input, mood: 'Date' }).mood, 'Romantic');
  assert.equal(buildPlanningRequest({ ...input, mood: 'Hangout' }).mood, 'Fun');
});

test('missing origin, duration, invalid budget and unsupported activities block submission', () => {
  for (const patch of [{ location: null }, { duration: null }, { budgetAmount: 0 },
    { activities: ['Movies'] }, { activities: ['Activities'] }, { mood: 'Creative' }, { mood: 'Solo' }]) {
    assert.throws(() => buildPlanningRequest({ ...input, ...patch }));
  }
  assert.deepEqual(mapActivities(['Cafés', 'Cafés', 'Shopping']), ['Cafe', 'Shopping']);
});

test('planning response distinguishes provisional, empty, provider outage and unknown costs', () => {
  const provisional = parsePlanningResponse({ ...empty('provisional'), demo: true, provisionalPlans: [plan] });
  assert.equal(provisional.plans.length, 0);
  assert.equal(provisional.provisionalPlans[0].estimatedSpendingRange.expected, null);
  assert.deepEqual(provisional.provisionalPlans[0].budgetSummary.unknownExpenseCategories, ['activity', 'transport']);
  assert.equal(parsePlanningResponse(empty('insufficient_data')).status, 'insufficient_data');
  assert.equal(parsePlanningResponse(empty('no_feasible_plan')).status, 'no_feasible_plan');
  const confirmed = { ...plan, dataQuality: { openingHours: 'known', prices: 'known' },
    budgetSummary: { ...plan.budgetSummary, assessment: 'fits_conservatively',
      knownCostSubtotalRange: { minimum: 300, expected: 400, maximum: 500 },
      unknownExpenseCategories: [], expectedRemaining: 2350, conservativeRemaining: 2250 },
    estimatedSpendingRange: { minimum: 300, expected: 400, maximum: 500 }, remainingBudget: 2350 };
  assert.equal(parsePlanningResponse({ ...empty('ready'), plans: [confirmed] }).status, 'ready');
  assert.equal(parsePlanningResponse({ ...empty('provider_unavailable'), providerFailure: { stage: 'places', code: 'PROVIDER_DISABLED' } }).status, 'provider_unavailable');
  assert.throws(() => parsePlanningResponse({ ...empty('ready') }));
  assert.throws(() => parsePlanningResponse({ ...empty('provisional'), provisionalPlans: [{ ...plan, estimatedSpendingRange: { expected: 0 } }] }));
});

test('planning client sends one typed POST, preserves retry key, and safely parses outage', async () => {
  const calls = [];
  const client = createApiClient({ baseUrl: 'https://backend.example', fetchImpl: async (url, options) => {
    calls.push({ url, key: options.headers['Idempotency-Key'], body: JSON.parse(options.body) });
    return Response.json({ ...empty('provider_unavailable'), providerFailure: { stage: 'places', code: 'PROVIDER_DISABLED' } }, { status: 503 });
  } });
  const key = newPlanningKey();
  assert.match(key, /^[A-Za-z0-9_-]{8,64}$/);
  assert.equal((await client.createPlan(request, key)).status, 'provider_unavailable');
  assert.equal((await client.createPlan(request, key)).status, 'provider_unavailable');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://backend.example/api/plans/create');
  assert.equal(calls[0].key, calls[1].key);
  assert.deepEqual(calls[0].body, request);
  assert.notEqual(newPlanningKey(), key);
});

test('network, timeout, rate limit and replay errors are safe', async () => {
  for (const [response, kind, status] of [
    [new Response('private', { status: 429, headers: { 'retry-after': '90' } }), 'rate_limited', 429],
    [Response.json({ code: 'REQUEST_ALREADY_ATTEMPTED', error: 'private' }, { status: 409 }), 'unexpected', 409],
    [new Response('private', { status: 504 }), 'timeout', 504],
  ]) {
    const client = createApiClient({ baseUrl: 'https://backend.example', fetchImpl: async () => response });
    await assert.rejects(client.createPlan(request, 'stable_key_123'), error => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.kind, kind);
      assert.equal(error.status, status);
      assert.ok(!error.message.includes('private'));
      return true;
    });
  }
  const offline = createApiClient({ baseUrl: 'https://backend.example', fetchImpl: async () => { throw new Error('private'); } });
  await assert.rejects(offline.createPlan(request, 'stable_key_123'), { kind: 'network' });
});

test('planning cancellation aborts the pending provider request', async () => {
  const caller = new AbortController();
  let transport;
  const client = createApiClient({ baseUrl: 'https://backend.example', fetchImpl: async (_url, options) => {
    transport = options.signal;
    return new Promise(() => {});
  } });
  const pending = client.createPlan(request, 'stable_key_123', caller.signal);
  await Promise.resolve();
  caller.abort();
  await assert.rejects(pending, { kind: 'cancelled' });
  assert.equal(transport.aborted, true);
});

test('the current backend fixture response parses without inventing a confirmed plan', async () => {
  const require = createRequire(import.meta.url);
  const { createPlan } = require('../../backend/planning-orchestrator.js');
  const before = { places: process.env.ROVE_PLACES_MODE, routes: process.env.ROVE_ROUTES_MODE };
  process.env.ROVE_PLACES_MODE = 'fixture';
  process.env.ROVE_ROUTES_MODE = 'fixture';
  try {
    const actual = await createPlan({ ...request, startAt: new Date(Date.now() + 120000).toISOString() });
    const parsed = parsePlanningResponse(actual);
    assert.equal(parsed.status, 'provisional');
    assert.equal(parsed.demo, true);
    assert.equal(parsed.plans.length, 0);
    assert.ok(parsed.provisionalPlans.length > 0);
    assert.equal(parsed.provisionalPlans[0].estimatedSpendingRange.expected, null);
  } finally {
    if (before.places === undefined) delete process.env.ROVE_PLACES_MODE; else process.env.ROVE_PLACES_MODE = before.places;
    if (before.routes === undefined) delete process.env.ROVE_ROUTES_MODE; else process.env.ROVE_ROUTES_MODE = before.routes;
  }
});
