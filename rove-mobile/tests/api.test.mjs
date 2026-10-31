import assert from 'node:assert/strict';
import test from 'node:test';
import { readApiConfiguration } from '../src/config/api.ts';
import { ApiClientError, createApiClient } from '../src/services/api.ts';

const baseUrl = 'https://backend.example';
const errorResponse = (status, code, headers = {}) => new Response(
  JSON.stringify({ error: 'sensitive upstream detail', code }),
  { status, headers: { 'content-type': 'application/json', ...headers } },
);

test('configuration accepts an origin and rejects absent or malformed values', () => {
  assert.deepEqual(readApiConfiguration('https://backend.example/'), { state: 'ready', baseUrl });
  assert.equal(readApiConfiguration('').state, 'missing');
  for (const value of ['javascript:alert(1)', 'https://user:pass@backend.example',
    'https://backend.example/path', 'https://backend.example?key=secret',
    'http://backend.example']) {
    assert.equal(readApiConfiguration(value).state, 'invalid');
  }
  assert.throws(() => createApiClient({ baseUrl: 'not a URL' }), { kind: 'configuration' });
});

test('health check uses only GET / and consumes a successful response', async () => {
  const calls = [];
  const client = createApiClient({ baseUrl, fetchImpl: async (url, options) => {
    calls.push({ url, method: options.method });
    return new Response('PlanIt Server', { status: 200 });
  } });
  assert.deepEqual(await client.checkHealth(), { reachable: true });
  assert.deepEqual(calls, [{ url: `${baseUrl}/`, method: 'GET' }]);
});

test('typed POST paths serialize the supplied request without provider credentials', async () => {
  const calls = [];
  const client = createApiClient({ baseUrl, fetchImpl: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return Response.json(url.endsWith('reverse-geocode') ? { address: 'City' }
      : { itinerary: [], totalCost: 0, budget: 1000, people: 2, aiSummary: 'None' });
  } });
  assert.deepEqual(await client.reverseGeocode({ lat: 0, lng: 0 }), { address: 'City' });
  assert.equal((await client.getItinerary({ budget: 1000, location: 'City' })).itinerary.length, 0);
  assert.deepEqual(calls.map(call => call.url), [`${baseUrl}/api/reverse-geocode`, `${baseUrl}/api/itinerary`]);
  assert.deepEqual(calls[0].body, { lat: 0, lng: 0 });
});

test('400, 429 and 5xx errors are classified without reflecting provider text', async () => {
  for (const [status, kind] of [[400, 'invalid_request'], [429, 'rate_limited'],
    [502, 'upstream'], [503, 'upstream'], [504, 'timeout']]) {
    const client = createApiClient({ baseUrl, fetchImpl: async () => errorResponse(status, 'PROVIDER_UNAVAILABLE',
      status === 429 ? { 'retry-after': '60' } : {}) });
    await assert.rejects(client.checkHealth(), error => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.kind, kind);
      assert.equal(error.status, status);
      assert.ok(!error.message.includes('sensitive'));
      if (status === 429) assert.equal(error.retryAfterSeconds, 60);
      return true;
    });
  }
});

test('caller cancellation aborts transport and returns a safe cancellation error', async () => {
  const caller = new AbortController();
  let transportSignal;
  const client = createApiClient({ baseUrl, fetchImpl: async (_url, options) => {
    transportSignal = options.signal;
    return new Promise(() => {});
  } });
  const pending = client.checkHealth(caller.signal);
  await Promise.resolve();
  caller.abort();
  await assert.rejects(pending, { kind: 'cancelled' });
  assert.equal(transportSignal.aborted, true);
});

test('deadline finishes even if a transport ignores abort', async () => {
  let transportSignal;
  const client = createApiClient({ baseUrl, timeoutMs: 10, fetchImpl: async (_url, options) => {
    transportSignal = options.signal;
    return new Promise(() => {});
  } });
  await assert.rejects(client.checkHealth(), { kind: 'timeout' });
  assert.equal(transportSignal.aborted, true);
});

test('photo resolver accepts only the relative backend proxy path', () => {
  const client = createApiClient({ baseUrl });
  assert.equal(client.resolvePhotoUrl('/api/photo?ref=valid_reference_12345'),
    `${baseUrl}/api/photo?ref=valid_reference_12345`);
  assert.equal(client.resolvePhotoUrl(null), null);
  for (const value of ['https://maps.googleapis.com/photo?key=secret', '//evil.example/api/photo?ref=x',
    '/api/photo?ref=x&key=secret', '/api/other?ref=x']) {
    assert.throws(() => client.resolvePhotoUrl(value), { kind: 'unexpected' });
  }
});
