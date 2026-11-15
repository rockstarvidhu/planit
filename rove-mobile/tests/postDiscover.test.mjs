import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { editedRequest, validatedEditedResponse } from '../src/services/planEditing.ts';
import { canSaveFixture, findPlan, warningText } from '../src/services/planPresentation.ts';
import { parseSavedPlans, persistSavedPlans, snapshotFixturePlan } from '../src/services/savedPlans.ts';

const require = createRequire(import.meta.url);
const { createPlan } = require('../../backend/planning-orchestrator.js');
const request = () => ({ origin: { latitude: 12.9716, longitude: 77.5946 },
  startAt: new Date(Date.now() + 120000).toISOString(), availableMinutes: 300,
  budgetAmount: 2750, budgetMode: 'perPerson', people: 2,
  categories: ['Cafe', 'Food'], transportMode: 'walk', mood: 'Chill' });

async function fixture() {
  const before = { places: process.env.ROVE_PLACES_MODE, routes: process.env.ROVE_ROUTES_MODE };
  process.env.ROVE_PLACES_MODE = 'fixture'; process.env.ROVE_ROUTES_MODE = 'fixture';
  try {
    const input = request();
    return { input, response: await createPlan(input) };
  } finally {
    if (before.places === undefined) delete process.env.ROVE_PLACES_MODE; else process.env.ROVE_PLACES_MODE = before.places;
    if (before.routes === undefined) delete process.env.ROVE_ROUTES_MODE; else process.env.ROVE_ROUTES_MODE = before.routes;
  }
}

test('provisional fixture remains truthful and supports validated visit edits', async () => {
  const { input, response } = await fixture();
  const plan = response.provisionalPlans[0];
  assert.equal('unsolicited' in snapshotFixturePlan({ ...plan, unsolicited: 'drop me' }), false);
  assert.equal(response.status, 'provisional');
  assert.equal(canSaveFixture(response, plan), true);
  assert.equal(findPlan(response, plan.id).provisional, true);
  assert.equal(warningText({ code: 'FICTIONAL_FIXTURE_DATA' }), 'This is fictional test data, not a real destination.');
  assert.equal(plan.budgetSummary.assessment, 'cannot_determine');
  assert.equal(plan.estimatedSpendingRange.expected, null);
  const changed = editedRequest(input, response, plan, { excludedPlaceIds: [], visitDurations: { [plan.stops[0].placeId]: 90 } });
  assert.equal(changed.visitDurations[plan.stops[0].placeId], 90);
  const rebased = editedRequest({ ...input, startAt: '2026-01-01T00:00:00Z' }, response, plan,
    { excludedPlaceIds: [], visitDurations: {} }, Date.parse('2026-11-14T00:00:00Z'));
  assert.equal(rebased.startAt, '2026-11-14T00:02:00.000Z');
  const before = { places: process.env.ROVE_PLACES_MODE, routes: process.env.ROVE_ROUTES_MODE };
  process.env.ROVE_PLACES_MODE = 'fixture'; process.env.ROVE_ROUTES_MODE = 'fixture';
  try {
    const result = await createPlan(changed);
    assert.equal(validatedEditedResponse(result).stops[0].visitMinutes, 90);
    assert.equal(result.provisionalPlans[0].budgetSummary.assessment, 'cannot_determine');
  } finally {
    if (before.places === undefined) delete process.env.ROVE_PLACES_MODE; else process.env.ROVE_PLACES_MODE = before.places;
    if (before.routes === undefined) delete process.env.ROVE_ROUTES_MODE; else process.env.ROVE_ROUTES_MODE = before.routes;
  }
  assert.throws(() => editedRequest(input, response, plan, { excludedPlaceIds: [plan.stops[0].placeId], visitDurations: {} }), /Keep at least one/);
  assert.throws(() => editedRequest(input, response, plan, { excludedPlaceIds: [], visitDurations: { [plan.stops[0].placeId]: 0 } }), /15 to 360/);
  assert.throws(() => editedRequest(input, { ...response, demo: false }, plan, { excludedPlaceIds: [], visitDurations: {} }), /Editing live/);
});

test('saved fictional plan snapshots parse, reopen and reject incomplete records', async () => {
  const { input, response } = await fixture();
  const plan = response.provisionalPlans[0];
  const saved = { id: 'rove_test_123', name: 'My day out', savedAt: new Date().toISOString(), area: 'Bengaluru',
    preferences: { budgetAmount: input.budgetAmount, budgetMode: input.budgetMode,
      people: input.people, availableMinutes: input.availableMinutes, categories: input.categories,
      transportMode: input.transportMode, mood: input.mood }, plan, demo: true, provisional: true };
  assert.deepEqual(parseSavedPlans(JSON.stringify([saved]))[0].plan.stops[0].name, plan.stops[0].name);
  assert.throws(() => parseSavedPlans(JSON.stringify([{ ...saved, demo: false }])), /incomplete/);
  assert.throws(() => parseSavedPlans(JSON.stringify([{ ...saved, plan: { ...plan, stops: [] , estimatedSpendingRange: {} } }])), /Invalid planning response/);
  assert.deepEqual(parseSavedPlans(null), []);
  let persisted = null;
  await persistSavedPlans({ setItem: async (_key, value) => { persisted = value; } }, [saved]);
  assert.equal(parseSavedPlans(persisted)[0].name, 'My day out');
  await assert.rejects(persistSavedPlans({ setItem: async () => { throw new Error('disk unavailable'); } }, [saved]), /disk unavailable/);
});
