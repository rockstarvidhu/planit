const axios = require('axios');
const { HttpError, invalid, numeric, bodyObject, providerError, LIMITS } = require('../security');

const URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
const FIELD_MASK = 'originIndex,destinationIndex,status,condition,distanceMeters,duration';
const MAX_WAYPOINTS = 6;
const MAX_ELEMENTS = 36;
const MAX_RESPONSE_BYTES = 128 * 1024;
const FIXTURE_RESPONSE = Object.freeze([{
  originIndex: 0, destinationIndex: 0, condition: 'ROUTE_EXISTS',
  distanceMeters: 800, duration: '600s',
}]);

const error = (status, code, message) => new HttpError(status, code, message);
const enabled = value => value === true || value === 'true';
const validId = value => typeof value === 'string' && value.trim() && value.length <= 80 &&
  !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);

function waypointList(value, field) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_WAYPOINTS) throw invalid(field);
  const ids = new Set();
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !validId(raw.id) || ids.has(raw.id)) {
      throw invalid(`${field}[${index}]`);
    }
    ids.add(raw.id);
    return { id: raw.id,
      latitude: numeric(raw.latitude, `${field}[${index}].latitude`, -90, 90),
      longitude: numeric(raw.longitude, `${field}[${index}].longitude`, -180, 180) };
  });
}

function timestamp(value, now) {
  const match = typeof value === 'string' &&
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) throw invalid('departureTime');
  const [, year, month, day, hour, minute, second, zone, offsetHour, offsetMinute] = match;
  const local = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  const date = new Date(local);
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 ||
      date.getUTCDate() !== Number(day) || date.getUTCHours() !== Number(hour) ||
      date.getUTCMinutes() !== Number(minute) || date.getUTCSeconds() !== Number(second) ||
      (zone !== 'Z' && (Number(offsetHour) > 14 || Number(offsetMinute) > 59 ||
      (Number(offsetHour) === 14 && Number(offsetMinute) !== 0)))) throw invalid('departureTime');
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || milliseconds < now || milliseconds > now + 7 * 86400000) throw invalid('departureTime');
  return new Date(milliseconds).toISOString();
}

function validateInput(body, options = {}) {
  const request = bodyObject(body);
  const origins = waypointList(request.origins, 'origins');
  const destinations = waypointList(request.destinations, 'destinations');
  if (origins.length * destinations.length > MAX_ELEMENTS) throw invalid('matrix element count');
  const positions = new Map();
  for (const point of [...origins, ...destinations]) {
    const previous = positions.get(point.id);
    if (previous && (previous.latitude !== point.latitude || previous.longitude !== point.longitude)) throw invalid('waypoint coordinates');
    positions.set(point.id, point);
  }
  if (!['walk', 'drive'].includes(request.mode)) {
    throw error(400, 'UNSUPPORTED_MODE', 'Transportation mode is not supported');
  }
  if (request.departureTime !== undefined && request.mode !== 'drive') throw invalid('departureTime for mode');
  const departureTime = request.departureTime === undefined ? null : timestamp(request.departureTime, options.now ?? Date.now());
  return { origins, destinations, mode: request.mode, departureTime,
    requestedElements: origins.length * destinations.length };
}

function parseResponse(data, expected) {
  if (typeof data === 'string') {
    if (Buffer.byteLength(data, 'utf8') > MAX_RESPONSE_BYTES) throw error(502, 'PROVIDER_INVALID_RESPONSE', 'Route provider returned invalid data');
    const trimmed = data.trim();
    try {
      if (trimmed.startsWith('[')) data = JSON.parse(trimmed);
      else {
        const lines = trimmed.split(/\r?\n/).filter(Boolean);
        if (lines.length > expected) throw new Error('too many elements');
        data = lines.map(line => JSON.parse(line));
      }
    } catch { throw error(502, 'PROVIDER_INVALID_RESPONSE', 'Route provider returned invalid data'); }
  }
  if (!Array.isArray(data) || data.length < 1 || data.length > expected) {
    throw error(502, 'PROVIDER_INVALID_RESPONSE', 'Route provider returned invalid data');
  }
  return data;
}

function durationSeconds(raw) {
  if (typeof raw !== 'string') return null;
  const match = /^(\d{1,6})(?:\.(\d{1,9}))?s$/.exec(raw);
  if (!match) return null;
  const seconds = Number(match[1]) + (match[2] ? Number(`0.${match[2]}`) : 0);
  const rounded = Math.ceil(seconds);
  return rounded >= 1 && rounded <= 10800 ? rounded : null;
}

function normalizeMatrix(data, input, sourceKind, calculatedAt, providerRequests) {
  const seen = new Map();
  let unexpected = 0;
  for (const element of data) {
    if (!element || typeof element !== 'object' || Array.isArray(element) ||
        !Number.isInteger(element.originIndex) || !Number.isInteger(element.destinationIndex) ||
        element.originIndex < 0 || element.originIndex >= input.origins.length ||
        element.destinationIndex < 0 || element.destinationIndex >= input.destinations.length) { unexpected++; continue; }
    const key = `${element.originIndex}:${element.destinationIndex}`;
    if (seen.has(key)) seen.set(key, { duplicate: true });
    else seen.set(key, element);
  }
  if (unexpected === data.length) throw error(502, 'PROVIDER_INVALID_RESPONSE', 'Route provider returned invalid data');
  const legs = [];
  const failed = [];
  const warnings = [];
  if (unexpected) warnings.push({ code: 'UNEXPECTED_MATRIX_ELEMENT', count: unexpected });
  if (input.mode === 'walk') warnings.push({ code: 'WALKING_ROUTE_BETA' });
  for (let originIndex = 0; originIndex < input.origins.length; originIndex++) {
    for (let destinationIndex = 0; destinationIndex < input.destinations.length; destinationIndex++) {
      const fromId = input.origins[originIndex].id;
      const toId = input.destinations[destinationIndex].id;
      const element = seen.get(`${originIndex}:${destinationIndex}`);
      let reason;
      if (fromId === toId) reason = 'SELF_ROUTE_IGNORED';
      else if (!element) reason = 'MISSING_ELEMENT';
      else if (element.duplicate) reason = 'DUPLICATE_ELEMENT';
      else if (element.status !== undefined &&
          (!element.status || typeof element.status !== 'object' ||
          (element.status.code !== undefined && element.status.code !== 0))) reason = 'PROVIDER_ELEMENT_ERROR';
      else if (element.condition === 'ROUTE_NOT_FOUND') reason = 'ROUTE_NOT_FOUND';
      else if (element.condition !== 'ROUTE_EXISTS') reason = 'MALFORMED_ELEMENT';
      const seconds = reason ? null : durationSeconds(element.duration);
      if (!reason && (seconds === null || !Number.isSafeInteger(element.distanceMeters) ||
          element.distanceMeters < 0 || element.distanceMeters > 1000000)) reason = 'MALFORMED_ELEMENT';
      if (reason) { failed.push({ fromId, toId, mode: input.mode, reason }); continue; }
      legs.push({ fromId, toId, mode: input.mode, durationSeconds: seconds,
        durationMinutes: Math.ceil(seconds / 60), distanceMeters: element.distanceMeters,
        confidence: 'estimated', cost: { unit: 'group', priceStatus: 'unknown',
          minimumCost: null, expectedCost: null, maximumCost: null },
        source: { name: sourceKind === 'google_routes_new' ? 'Google Routes API (New)' : 'Rove fictional route fixture' },
        providerStatus: 'ROUTE_EXISTS', calculatedAt: new Date(calculatedAt).toISOString(),
        departureTime: input.departureTime,
        provenance: { provider: sourceKind, routingPreference: input.departureTime ? 'TRAFFIC_AWARE' :
          input.mode === 'drive' ? 'TRAFFIC_UNAWARE' : 'NOT_APPLICABLE' } });
    }
  }
  if (failed.length) warnings.push({ code: 'ROUTES_UNAVAILABLE', count: failed.length });
  return { status: legs.length === 0 ? 'unavailable' : failed.length ? 'partial' : 'ok',
    provider: sourceKind, mode: input.mode, legs, failed, warnings,
    attribution: { googleCopyrightRequired: sourceKind === 'google_routes_new' },
    usage: { requestedElements: input.requestedElements, successfulElements: legs.length,
      failedElements: failed.length, providerRequests, billableElements: sourceKind === 'google_routes_new' ? input.requestedElements : 0,
      routingMode: input.mode, providerMode: sourceKind, trafficAware: Boolean(input.departureTime) } };
}

async function computeRouteMatrix(body, options = {}) {
  const now = options.now ?? Date.now();
  const input = validateInput(body, { now });
  const mode = options.mode ?? process.env.ROVE_ROUTES_MODE ?? 'disabled';
  if (input.departureTime && !enabled(options.trafficEnabled ?? process.env.ROVE_ROUTES_TRAFFIC_ENABLED)) {
    throw error(503, 'ROUTES_TRAFFIC_DISABLED', 'Traffic-aware routing is not enabled');
  }
  let data;
  let sourceKind;
  let providerRequests = 0;
  if (mode === 'fixture') {
    if ((options.nodeEnv ?? process.env.NODE_ENV) === 'production') throw error(503, 'ROUTES_DISABLED', 'Route calculation is not enabled');
    data = options.fixtureResponse ?? FIXTURE_RESPONSE;
    sourceKind = 'rove_fixture';
  } else if (mode === 'live') {
    if (!enabled(options.liveEnabled ?? process.env.ROVE_ROUTES_LIVE_ENABLED)) {
      throw error(503, 'ROUTES_DISABLED', 'Route calculation is not enabled');
    }
    const key = options.apiKey ?? process.env.GOOGLE_API_KEY;
    if (!key) throw error(503, 'SERVICE_UNCONFIGURED', 'Google Routes service is not configured');
    if (!options.context || typeof options.context.run !== 'function') throw error(500, 'INTERNAL_ERROR', 'Internal server error');
    const waypoint = point => ({ waypoint: { location: { latLng: { latitude: point.latitude, longitude: point.longitude } } } });
    const payload = { origins: input.origins.map(waypoint), destinations: input.destinations.map(waypoint),
      travelMode: input.mode === 'drive' ? 'DRIVE' : 'WALK',
      ...(input.mode === 'drive' ? { routingPreference: input.departureTime ? 'TRAFFIC_AWARE' : 'TRAFFIC_UNAWARE' } : {}),
      ...(input.departureTime ? { departureTime: input.departureTime } : {}) };
    providerRequests = 1;
    try {
      const response = await options.context.run(signal => (options.transport ?? axios).post(URL, payload, {
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK },
        signal, timeout: LIMITS.providerMs, maxRedirects: 0, responseType: 'text',
        maxContentLength: MAX_RESPONSE_BYTES, maxBodyLength: LIMITS.jsonBytes,
      }));
      if (response.status !== 200) throw { response: { status: response.status } };
      options.context.check();
      data = response.data;
    } catch (cause) { throw providerError(cause, options.context.signal); }
    sourceKind = 'google_routes_new';
  } else if (mode === 'disabled') throw error(503, 'ROUTES_DISABLED', 'Route calculation is not enabled');
  else throw error(503, 'SERVICE_UNCONFIGURED', 'Route calculation is not configured');
  return normalizeMatrix(parseResponse(data, input.requestedElements), input, sourceKind, now, providerRequests);
}

module.exports = { computeRouteMatrix, validateInput, normalizeMatrix, parseResponse,
  durationSeconds, URL, FIELD_MASK, MAX_ELEMENTS };
