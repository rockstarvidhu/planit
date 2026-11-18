const request = require('supertest');
jest.mock('axios');
const axios = require('axios');
const app = require('../index');
const { discoverPlaces, validateInput, openingData, BASE_FIELDS, HOURS_FIELDS, URL } = require('./google-places');
const { generateItineraries } = require('../itinerary-engine');

const body = (overrides = {}) => ({ latitude: 12.97, longitude: 77.59, radiusMeters: 3000,
  categories: ['Cafe'], limit: 8, ...overrides });
const place = (overrides = {}) => ({ id: 'test-cafe', displayName: { text: 'Fictional Café' },
  location: { latitude: 12.97, longitude: 77.59 }, primaryType: 'cafe', types: ['cafe'],
  businessStatus: 'OPERATIONAL', attributions: [], ...overrides });
const context = () => ({ signal: new AbortController().signal, check: jest.fn(),
  run: jest.fn(operation => operation(new AbortController().signal)) });
const live = (response, overrides = {}) => {
  const transport = { post: jest.fn().mockResolvedValue({ status: 200, data: response }) };
  return { mode: 'live', liveEnabled: true, enterpriseEnabled: true, apiKey: 'synthetic-key',
    context: context(), transport, now: Date.parse('2026-01-01T08:00:00Z'), ...overrides };
};
const point = (year, month, day, hour, minute = 0) => ({ date: { year, month, day }, hour, minute });

describe('Google Places (New) adapter: offline, bounded and fail closed', () => {
  test('invalid request values are rejected before any provider call', () => {
    for (const invalidBody of [body({ latitude: 91 }), body({ longitude: {} }), body({ radiusMeters: 10001 }),
      body({ radiusMeters: 100.5 }), body({ limit: 13 }), body({ categories: [] }), body({ categories: ['Cafe', 'Cafe'] }),
      body({ categories: ['Healthcare'] }), body({ includeOpeningHours: 'true' }), body({ includeOpeningHours: true }),
      body({ plannedAt: 'tomorrow' })]) {
      expect(() => validateInput(invalidBody)).toThrow();
    }
  });

  test('disabled and missing live gates make no outbound request', async () => {
    const options = live({ places: [place()] });
    await expect(discoverPlaces(body(), { ...options, mode: 'disabled' })).rejects.toMatchObject({ status: 503, code: 'PLACES_DISABLED' });
    await expect(discoverPlaces(body(), { ...options, liveEnabled: false })).rejects.toMatchObject({ status: 503, code: 'PLACES_DISABLED' });
    await expect(discoverPlaces(body({ includeOpeningHours: true, plannedAt: '2026-01-01T10:00:00+05:30' }),
      { ...options, enterpriseEnabled: false })).rejects.toMatchObject({ status: 503, code: 'PLACES_HOURS_DISABLED' });
    expect(options.transport.post).not.toHaveBeenCalled();
  });

  test('fixture is fictional, has unknown price and duration, and is forbidden in production', async () => {
    const result = await discoverPlaces(body(), { mode: 'fixture', nodeEnv: 'test', now: 1 });
    expect(result).toMatchObject({ status: 'ok', provider: 'rove_fixture', attribution: { googleMapsRequired: false } });
    expect(result.candidates[0]).toMatchObject({ visitMinutes: null, opening: { status: 'unknown' },
      expenses: [{ priceStatus: 'unknown', expectedCost: null }],
      provenance: { provider: 'rove_fixture', priceDataStatus: 'unknown' } });
    expect(result.warnings.map(warning => warning.code)).toContain('FICTIONAL_FIXTURE_DATA');
    await expect(discoverPlaces(body(), { mode: 'fixture', nodeEnv: 'production' })).rejects.toMatchObject({ status: 503 });
  });

  test('normalized candidates validate in the deterministic engine without inventing routes or duration', async () => {
    const candidate = (await discoverPlaces(body(), { mode: 'fixture', nodeEnv: 'test', now: 1 })).candidates[0];
    const result = generateItineraries({ preferences: { currency: 'INR',
      origin: { latitude: 12.97, longitude: 77.59 }, startAt: '2026-01-01T10:00:00+05:30',
      availableMinutes: 180, budgetAmount: 2750, budgetMode: 'total', people: 2 },
    candidates: [candidate], travelLegs: [] });
    expect(result).toMatchObject({ status: 'no_feasible_plan', plans: [], search: { issues: { unknownDuration: 1 } } });
  });

  test('single fixed-endpoint call with explicit Pro fields, no Enterprise fields by default', async () => {
    const options = live({ places: [place({ priceLevel: 'PRICE_LEVEL_FREE', rating: 5 })] });
    const result = await discoverPlaces(body({ categories: ['Cafe', 'Food'] }), options);
    expect(options.transport.post).toHaveBeenCalledTimes(1);
    const [url, payload, config] = options.transport.post.mock.calls[0];
    expect(url).toBe(URL);
    expect(payload).toMatchObject({ maxResultCount: 8, rankPreference: 'DISTANCE',
      locationRestriction: { circle: { center: { latitude: 12.97, longitude: 77.59 }, radius: 3000 } } });
    expect(payload.includedTypes).toEqual(expect.arrayContaining(['cafe', 'restaurant']));
    expect(config.headers['X-Goog-FieldMask']).toBe(BASE_FIELDS);
    expect(config.headers['X-Goog-FieldMask']).not.toMatch(/price|rating|OpeningHours/);
    expect(config).toMatchObject({ maxRedirects: 0, timeout: 8000 });
    expect(result.candidates[0]).toMatchObject({ category: 'Cafe', visitMinutes: null,
      expenses: [{ priceStatus: 'unknown', expectedCost: null }], attribution: { googleMapsRequired: true } });
    expect(result.candidates[0].provenance.provider).toBe('google_places_new');
  });

  test('maps supported types, skips closed/irrelevant/malformed places and deduplicates IDs', async () => {
    const options = live({ places: [place(), place(), place({ id: 'food', primaryType: 'restaurant', types: ['restaurant'] }),
      place({ id: 'closed', businessStatus: 'CLOSED_PERMANENTLY' }),
      place({ id: 'hospital', primaryType: 'hospital', types: ['cafe'] }), place({ id: '' }),
      place({ id: 'missing-name', displayName: {} }), place({ id: 'missing-coordinates', location: {} })] });
    const result = await discoverPlaces(body({ categories: ['Cafe', 'Food'] }), options);
    expect(result.candidates.map(candidate => candidate.id)).toEqual(['test-cafe', 'food']);
    expect(result.skipped).toEqual({ malformed: 3, closed: 1, irrelevant: 1, duplicate: 1 });
  });

  test('valid empty 200 is distinct from malformed or failed provider responses', async () => {
    expect((await discoverPlaces(body(), live({}))).candidates).toEqual([]);
    for (const bad of [null, [], { error: { message: 'provider failed' } }, { places: null },
      { places: [place({ id: '' })] }]) {
      await expect(discoverPlaces(body(), live(bad))).rejects.toMatchObject({ status: 502, code: 'PROVIDER_INVALID_RESPONSE' });
    }
  });

  test.each([[429, 503, 'PROVIDER_QUOTA'], [401, 502, 'PROVIDER_AUTH'], [403, 502, 'PROVIDER_AUTH'],
    [503, 502, 'PROVIDER_UNAVAILABLE']])('HTTP %s maps safely to %s %s without retry', async (upstream, status, code) => {
    const options = live({});
    options.transport.post.mockRejectedValue({ response: { status: upstream, data: { message: 'private upstream text' } } });
    await expect(discoverPlaces(body(), options)).rejects.toMatchObject({ status, code });
    expect(options.transport.post).toHaveBeenCalledTimes(1);
  });

  test('timeout is a 504, abort is propagated, and there is no retry', async () => {
    const options = live({});
    options.transport.post.mockRejectedValue({ code: 'ETIMEDOUT' });
    await expect(discoverPlaces(body(), options)).rejects.toMatchObject({ status: 504, code: 'PROVIDER_TIMEOUT' });
    expect(options.transport.post).toHaveBeenCalledTimes(1);
    const cancelled = live({});
    const abortError = { status: 499, code: 'CLIENT_CLOSED' };
    cancelled.context.run.mockRejectedValue(abortError);
    cancelled.context.signal = { aborted: true, reason: abortError };
    await expect(discoverPlaces(body(), cancelled)).rejects.toBe(abortError);
    expect(cancelled.transport.post).not.toHaveBeenCalled();
  });

  test('opening hours use dated venue-local periods and gated Enterprise field mask', async () => {
    const options = live({ places: [place({ timeZone: { id: 'Asia/Kolkata' }, currentOpeningHours: { periods: [
      { open: point(2026, 1, 1, 22), close: point(2026, 1, 2, 2) } ] } })] });
    const result = await discoverPlaces(body({ includeOpeningHours: true, plannedAt: '2026-01-01T23:00:00+05:30' }), options);
    expect(options.transport.post.mock.calls[0][2].headers['X-Goog-FieldMask']).toBe(BASE_FIELDS + HOURS_FIELDS);
    expect(result.candidates[0].opening).toMatchObject({ status: 'known', windows: [
      { opensAt: '2026-01-01T16:30:00.000Z', closesAt: '2026-01-01T20:30:00.000Z' } ] });
    expect(result.candidates[0].provenance.openingConfidence).toBe('provider_current_hours');
    expect(result.candidates[0].opening).toMatchObject({ placeId: result.candidates[0].id,
      provider: 'google_places_new', source: 'current_opening_hours' });
  });

  test('special dated hours are used; absent, invalid-zone and out-of-window hours remain unknown', () => {
    const hours = { timeZone: { id: 'America/New_York' }, currentOpeningHours: { periods: [
      { open: point(2026, 3, 8, 1), close: point(2026, 3, 8, 3, 30) } ] } };
    const fetchedAt = Date.parse('2026-03-08T12:00:00Z');
    expect(openingData(hours, '2026-03-08T01:30:00-05:00', fetchedAt).opening).toMatchObject({ status: 'known', windows: [
      { opensAt: '2026-03-08T06:00:00.000Z', closesAt: '2026-03-08T07:30:00.000Z' } ] });
    expect(openingData(hours, '2026-03-16T12:00:00-04:00', fetchedAt).opening.status).toBe('unknown');
    expect(openingData({ ...hours, timeZone: { id: 'Not/AZone' } }, '2026-03-08T12:00:00Z', fetchedAt).opening.status).toBe('unknown');
    expect(openingData({ timeZone: hours.timeZone }, '2026-03-08T12:00:00Z', fetchedAt).opening.status).toBe('unknown');
  });

  test('endpoint validates requests, stays disabled by default, and fixture mode is explicit', async () => {
    expect((await request(app).post('/api/places/discover').send(body({ latitude: 91 }))).status).toBe(400);
    const disabled = await request(app).post('/api/places/discover').send(body());
    expect(disabled).toMatchObject({ status: 503, body: { code: 'PLACES_DISABLED' } });
    process.env.ROVE_PLACES_MODE = 'fixture';
    try {
      const result = await request(app).post('/api/places/discover').send(body());
      expect(result).toMatchObject({ status: 200, body: { provider: 'rove_fixture' } });
      expect(result.headers['cache-control']).toBe('no-store');
    } finally { process.env.ROVE_PLACES_MODE = 'disabled'; }
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('oversized discovery body is rejected before provider work', async () => {
    const result = await request(app).post('/api/places/discover').send({ ...body(), padding: 'x'.repeat(12000) });
    expect(result).toMatchObject({ status: 413, body: { code: 'BODY_TOO_LARGE' } });
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('dedicated limit ignores spoofed forwarding headers when proxy trust is disabled', async () => {
    let isolatedApp;
    jest.isolateModules(() => { isolatedApp = require('../index'); });
    process.env.ROVE_PLACES_MODE = 'fixture';
    try {
      for (let index = 0; index < 10; index++) {
        const result = await request(isolatedApp).post('/api/places/discover').set('X-Forwarded-For', `198.51.100.${index + 1}`).send(body());
        expect(result.status).toBe(200);
      }
      const limited = await request(isolatedApp).post('/api/places/discover').set('X-Forwarded-For', '203.0.113.99').send(body());
      expect(limited.status).toBe(429);
      expect(limited.body.error).toMatch(/Too many place discovery requests/);
    } finally { process.env.ROVE_PLACES_MODE = 'disabled'; }
    expect(axios.post).not.toHaveBeenCalled();
  });
});
