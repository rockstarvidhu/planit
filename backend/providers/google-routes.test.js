const request = require('supertest');
jest.mock('axios');
const axios = require('axios');
const app = require('../index');
const { computeRouteMatrix, validateInput, parseResponse, durationSeconds, URL, FIELD_MASK } = require('./google-routes');
const { discoverPlaces } = require('./google-places');
const { generateItineraries } = require('../itinerary-engine');

const point = (id, latitude = 12.97, longitude = 77.59) => ({ id, latitude, longitude });
const body = (overrides = {}) => ({ origins: [point('origin')],
  destinations: [point('cafe', 12.971, 77.591)], mode: 'walk', ...overrides });
const element = (originIndex, destinationIndex, overrides = {}) => ({ originIndex, destinationIndex,
  condition: 'ROUTE_EXISTS', distanceMeters: 800, duration: '600s', ...overrides });
const context = () => ({ signal: new AbortController().signal, check: jest.fn(),
  run: jest.fn(operation => operation(new AbortController().signal)) });
const live = (data, overrides = {}) => {
  const transport = { post: jest.fn().mockResolvedValue({ status: 200, data }) };
  return { mode: 'live', liveEnabled: true, apiKey: 'synthetic-route-key',
    context: context(), transport, now: Date.parse('2026-11-07T10:00:00Z'), ...overrides };
};

describe('Google Routes (New) matrix adapter: offline behavior', () => {
  test('single walking route converts seconds conservatively and preserves unknown fare', async () => {
    const options = live([element(0, 0, { duration: '600.5s', distanceMeters: 875 })]);
    const result = await computeRouteMatrix(body(), options);
    expect(result).toMatchObject({ status: 'ok', mode: 'walk', provider: 'google_routes_new',
      legs: [{ fromId: 'origin', toId: 'cafe', durationSeconds: 601, durationMinutes: 11,
        distanceMeters: 875, confidence: 'estimated', providerStatus: 'ROUTE_EXISTS',
        cost: { priceStatus: 'unknown', expectedCost: null },
        provenance: { provider: 'google_routes_new' } }],
      usage: { requestedElements: 1, successfulElements: 1, failedElements: 0, providerRequests: 1,
        billableElements: 1, routingMode: 'walk', trafficAware: false },
      attribution: { googleCopyrightRequired: true } });
    expect(result.warnings.map(warning => warning.code)).toContain('WALKING_ROUTE_BETA');
    expect(options.transport.post).toHaveBeenCalledTimes(1);
    const [url, payload, config] = options.transport.post.mock.calls[0];
    expect(url).toBe(URL);
    expect(payload).toMatchObject({ travelMode: 'WALK', origins: [{ waypoint: { location: { latLng: { latitude: 12.97, longitude: 77.59 } } } }] });
    expect(payload.routingPreference).toBeUndefined();
    expect(config.headers['X-Goog-FieldMask']).toBe(FIELD_MASK);
    expect(config).toMatchObject({ timeout: 8000, maxRedirects: 0, responseType: 'text' });
    expect(JSON.stringify(result)).not.toContain('synthetic-route-key');
  });

  test('unordered 2x2 matrix maps by indices and retains both directed routes', async () => {
    const input = body({ origins: [point('a'), point('b', 12.98, 77.6)],
      destinations: [point('b', 12.98, 77.6), point('a')] , mode: 'drive' });
    const options = live([element(1, 1, { duration: '30s' }), element(1, 0, { duration: '0s' }),
      element(0, 1, { duration: '0s' }), element(0, 0, { duration: '410s', distanceMeters: 1500 })]);
    const result = await computeRouteMatrix(input, options);
    expect(result.status).toBe('partial');
    expect(result.legs).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromId: 'a', toId: 'b', durationSeconds: 410, durationMinutes: 7 }),
      expect.objectContaining({ fromId: 'b', toId: 'a', durationSeconds: 30, durationMinutes: 1 })]));
    expect(result.failed).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromId: 'a', toId: 'a', reason: 'SELF_ROUTE_IGNORED' }),
      expect.objectContaining({ fromId: 'b', toId: 'b', reason: 'SELF_ROUTE_IGNORED' })]));
    expect(result.usage).toMatchObject({ requestedElements: 4, successfulElements: 2, failedElements: 2 });
    expect(options.transport.post.mock.calls[0][1]).toMatchObject({ travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE' });
  });

  test('missing, failed and not-found elements stay unavailable rather than zero-minute routes', async () => {
    const input = body({ destinations: [point('a'), point('b', 12.98, 77.6), point('c', 12.99, 77.61)] });
    const options = live([element(0, 1, { condition: 'ROUTE_NOT_FOUND', duration: undefined, distanceMeters: undefined }),
      element(0, 0, { status: { code: 7, message: 'private upstream detail' } })]);
    const result = await computeRouteMatrix(input, options);
    expect(result).toMatchObject({ status: 'unavailable', legs: [], usage: { requestedElements: 3,
      successfulElements: 0, failedElements: 3 } });
    expect(result.failed.map(item => item.reason)).toEqual(['PROVIDER_ELEMENT_ERROR', 'ROUTE_NOT_FOUND', 'MISSING_ELEMENT']);
    expect(JSON.stringify(result)).not.toContain('private upstream detail');
  });

  test('duplicate indices invalidate only their pair; unexpected indices do not reorder valid legs', async () => {
    const input = body({ destinations: [point('a'), point('b', 12.98, 77.6)] });
    const options = live([element(0, 1), element(0, 0), element(0, 0, { duration: '999s' }), element(9, 9)]);
    // Four raw elements exceed the two requested elements, so the entire malformed envelope fails closed.
    await expect(computeRouteMatrix(input, options)).rejects.toMatchObject({ status: 502, code: 'PROVIDER_INVALID_RESPONSE' });
    const partiallyBad = live([element(0, 0), element(0, 0, { duration: '999s' })]);
    const result = await computeRouteMatrix(input, partiallyBad);
    expect(result).toMatchObject({ status: 'unavailable', legs: [], failed: [
      { fromId: 'origin', toId: 'a', mode: 'walk', reason: 'DUPLICATE_ELEMENT' },
      { fromId: 'origin', toId: 'b', mode: 'walk', reason: 'MISSING_ELEMENT' }] });
    const unexpected = live([element(0, 0), element(9, 9)]);
    const retained = await computeRouteMatrix(input, unexpected);
    expect(retained).toMatchObject({ status: 'partial', legs: [expect.objectContaining({ toId: 'a' })],
      warnings: expect.arrayContaining([{ code: 'UNEXPECTED_MATRIX_ELEMENT', count: 1 }]) });
  });

  test('JSON array and line-delimited JSON payloads normalize identically', async () => {
    const rows = [element(0, 0)];
    expect(parseResponse(JSON.stringify(rows), 1)).toEqual(rows);
    expect(parseResponse(JSON.stringify(rows[0]) + '\n', 1)).toEqual(rows);
    expect((await computeRouteMatrix(body(), live(JSON.stringify(rows)))).legs)
      .toEqual((await computeRouteMatrix(body(), live(JSON.stringify(rows[0]) + '\n'))).legs);
  });

  test.each(['', 'ten minutes', '-2s', '0s', '10801s', '1e3s'])('invalid duration %s is not normalized', raw => {
    expect(durationSeconds(raw)).toBeNull();
  });

  test.each([[{}, 'INVALID_INPUT'], [{ ...body(), origins: [] }, 'INVALID_INPUT'],
    [{ ...body(), origins: Array.from({ length: 7 }, (_, i) => point(String(i))) }, 'INVALID_INPUT'],
    [{ ...body(), origins: [point('a'), point('a')] }, 'INVALID_INPUT'],
    [{ ...body(), origins: [point('a', 91)] }, 'INVALID_INPUT'],
    [{ ...body(), destinations: [point('x', 0, 181)] }, 'INVALID_INPUT'],
    [{ ...body(), mode: 'taxi' }, 'UNSUPPORTED_MODE'], [{ ...body(), mode: 'transit' }, 'UNSUPPORTED_MODE'],
    [{ ...body(), mode: 'bicycle' }, 'UNSUPPORTED_MODE'],
    [{ ...body(), departureTime: '2026-11-08T10:00:00Z' }, 'INVALID_INPUT'],
    [{ ...body(), mode: 'drive', departureTime: 'yesterday' }, 'INVALID_INPUT'],
    [{ ...body(), mode: 'drive', departureTime: '2026-02-30T10:00:00Z' }, 'INVALID_INPUT'],
    [{ ...body(), mode: 'drive', departureTime: '2026-11-06T10:00:00Z' }, 'INVALID_INPUT'],
    [{ ...body(), mode: 'drive', departureTime: '2026-11-20T10:00:00Z' }, 'INVALID_INPUT']])('rejects invalid or unsupported input with %s', (input, code) => {
    expect(() => validateInput(input, { now: Date.parse('2026-11-07T10:00:00Z') })).toThrow(expect.objectContaining({ code }));
  });

  test('36 elements allowed, 6x7 and contradictory shared IDs rejected before billing', () => {
    const six = Array.from({ length: 6 }, (_, index) => point(String(index)));
    expect(validateInput(body({ origins: six, destinations: six }), { now: 0 }).requestedElements).toBe(36);
    expect(() => validateInput(body({ origins: six, destinations: [...six, point('extra')] }))).toThrow();
    expect(() => validateInput(body({ origins: [point('same')], destinations: [point('same', 12, 77)] }))).toThrow();
  });

  test('default disabled, live gate, traffic gate and production fixture restriction make no call', async () => {
    const options = live([element(0, 0)]);
    await expect(computeRouteMatrix(body(), { ...options, mode: 'disabled' })).rejects.toMatchObject({ code: 'ROUTES_DISABLED' });
    await expect(computeRouteMatrix(body(), { ...options, liveEnabled: false })).rejects.toMatchObject({ code: 'ROUTES_DISABLED' });
    await expect(computeRouteMatrix(body({ mode: 'drive', departureTime: '2026-11-08T10:00:00Z' }),
      { ...options, trafficEnabled: false })).rejects.toMatchObject({ code: 'ROUTES_TRAFFIC_DISABLED' });
    await expect(computeRouteMatrix(body(), { ...options, mode: 'fixture', nodeEnv: 'production' })).rejects.toMatchObject({ code: 'ROUTES_DISABLED' });
    expect(options.transport.post).not.toHaveBeenCalled();
  });

  test('time-aware driving uses an explicit Pro option, while walking rejects departure time', async () => {
    const options = live([element(0, 0)], { trafficEnabled: true });
    const input = body({ mode: 'drive', departureTime: '2026-11-08T10:00:00Z' });
    const result = await computeRouteMatrix(input, options);
    expect(options.transport.post.mock.calls[0][1]).toMatchObject({ travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE', departureTime: '2026-11-08T10:00:00.000Z' });
    expect(result.usage.trafficAware).toBe(true);
    expect(result.legs[0].departureTime).toBe('2026-11-08T10:00:00.000Z');
  });

  test.each([[429, 503, 'PROVIDER_QUOTA'], [401, 502, 'PROVIDER_AUTH'], [403, 502, 'PROVIDER_AUTH'],
    [503, 502, 'PROVIDER_UNAVAILABLE']])('HTTP %s maps to safe %s %s without retry', async (upstream, status, code) => {
    const options = live([]);
    options.transport.post.mockRejectedValue({ response: { status: upstream, data: { message: 'private provider text' } } });
    await expect(computeRouteMatrix(body(), options)).rejects.toMatchObject({ status, code });
    expect(options.transport.post).toHaveBeenCalledTimes(1);
  });

  test('timeout, cancellation and malformed top-level payloads fail closed', async () => {
    const timed = live([]);
    timed.transport.post.mockRejectedValue({ code: 'ETIMEDOUT' });
    await expect(computeRouteMatrix(body(), timed)).rejects.toMatchObject({ status: 504, code: 'PROVIDER_TIMEOUT' });
    const cancelled = live([]);
    const abort = { status: 499, code: 'CLIENT_CLOSED' };
    cancelled.context.run.mockRejectedValue(abort);
    cancelled.context.signal = { aborted: true, reason: abort };
    await expect(computeRouteMatrix(body(), cancelled)).rejects.toBe(abort);
    for (const bad of [null, {}, [], 'not-json', [element(8, 8)], [element(0, 0, { duration: 'bad' }), element(0, 0)]]) {
      await expect(computeRouteMatrix(body(), live(bad))).rejects.toMatchObject({ status: 502, code: 'PROVIDER_INVALID_RESPONSE' });
    }
  });

  test('Places candidate and directed route require explicit visit duration before a plan can be made', async () => {
    const candidate = (await discoverPlaces({ latitude: 12.97, longitude: 77.59, radiusMeters: 1000,
      categories: ['Cafe'] }, { mode: 'fixture', nodeEnv: 'test', now: 1 })).candidates[0];
    const route = (await computeRouteMatrix(body({ destinations: [point(candidate.id, candidate.latitude, candidate.longitude)] }),
      { mode: 'fixture', nodeEnv: 'test', now: 1 })).legs[0];
    const requestBody = { preferences: { currency: 'INR', origin: { latitude: 12.97, longitude: 77.59 },
      startAt: '2026-01-01T10:00:00+05:30', availableMinutes: 180, budgetAmount: 2750,
      budgetMode: 'total', people: 2 }, candidates: [candidate], travelLegs: [route] };
    expect(generateItineraries(requestBody)).toMatchObject({ status: 'no_feasible_plan',
      search: { issues: { unknownDuration: 1 } } });
    const withExplicitFictionalEstimate = { ...requestBody, candidates: [{ ...candidate, visitMinutes: 60 }] };
    expect(generateItineraries(withExplicitFictionalEstimate)).toMatchObject({ status: 'plans_found',
      plans: [expect.objectContaining({ budget: expect.objectContaining({ affordability: 'cannot_determine' }) })] });
  });

  test('endpoint is disabled by default, validates input, serves only fictional fixture and never calls axios', async () => {
    expect((await request(app).post('/api/routes/matrix').send(body({ mode: 'auto' }))).body.code).toBe('UNSUPPORTED_MODE');
    expect((await request(app).post('/api/routes/matrix').send(body())).body.code).toBe('ROUTES_DISABLED');
    process.env.ROVE_ROUTES_MODE = 'fixture';
    try {
      const result = await request(app).post('/api/routes/matrix').send(body());
      expect(result).toMatchObject({ status: 200, body: { provider: 'rove_fixture' } });
      expect(result.headers['cache-control']).toBe('no-store');
    } finally { process.env.ROVE_ROUTES_MODE = 'disabled'; }
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('oversized JSON and dedicated spoof-resistant rate limit stop endpoint abuse', async () => {
    expect((await request(app).post('/api/routes/matrix').send({ ...body(), padding: 'x'.repeat(12000) })).status).toBe(413);
    let isolatedApp;
    jest.isolateModules(() => { isolatedApp = require('../index'); });
    process.env.ROVE_ROUTES_MODE = 'fixture';
    try {
      for (let i = 0; i < 8; i++) {
        expect((await request(isolatedApp).post('/api/routes/matrix')
          .set('X-Forwarded-For', `198.51.100.${i + 1}`).send(body())).status).toBe(200);
      }
      expect((await request(isolatedApp).post('/api/routes/matrix')
        .set('X-Forwarded-For', '203.0.113.77').send(body())).status).toBe(429);
    } finally { process.env.ROVE_ROUTES_MODE = 'disabled'; }
    expect(axios.post).not.toHaveBeenCalled();
  });
});
