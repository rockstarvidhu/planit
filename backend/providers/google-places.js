const axios = require('axios');
const { HttpError, invalid, numeric, bodyObject, providerError, LIMITS } = require('../security');
const { normalizeCurrentHours } = require('../opening-hours');

const URL = 'https://places.googleapis.com/v1/places:searchNearby';
const MAX_RESULTS = 12;
const MAX_RADIUS = 10000;
const BASE_FIELDS = 'places.id,places.displayName,places.location,places.primaryType,places.types,places.businessStatus,places.attributions';
const HOURS_FIELDS = ',places.timeZone,places.currentOpeningHours';
const CATEGORY_TYPES = Object.freeze({
  Cafe: ['cafe', 'coffee_shop', 'tea_store'],
  Food: ['restaurant', 'food_court'],
  Movies: ['movie_theater'],
  Outdoors: ['park', 'botanical_garden', 'garden', 'hiking_area', 'national_park'],
  Entertainment: ['amusement_park', 'museum', 'bowling_alley', 'video_arcade', 'art_gallery'],
  Shopping: ['shopping_mall', 'market', 'book_store'],
});
const TYPE_CATEGORY = Object.fromEntries(Object.entries(CATEGORY_TYPES).flatMap(([category, types]) => types.map(type => [type, category])));
const EXCLUDED_PRIMARY_TYPES = new Set(['school', 'hospital', 'bank', 'gas_station', 'corporate_office', 'airport']);
const FIXTURE_RESPONSE = Object.freeze({ places: [{
  id: 'fixture-cafe-1', displayName: { text: 'Fictional Test Café' },
  location: { latitude: 12.97, longitude: 77.59 }, primaryType: 'cafe', types: ['cafe'],
  businessStatus: 'OPERATIONAL', attributions: [],
}] });

const serviceError = (status, code, message) => new HttpError(status, code, message);
const validText = (value, max = 120) => typeof value === 'string' && value.trim().length > 0 && value.length <= max &&
  !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
const timeText = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));

function validateInput(body) {
  const request = bodyObject(body);
  const latitude = numeric(request.latitude, 'latitude', -90, 90);
  const longitude = numeric(request.longitude, 'longitude', -180, 180);
  const radiusMeters = numeric(request.radiusMeters, 'radiusMeters (100–10000)', 100, MAX_RADIUS, { integer: true });
  const limit = numeric(request.limit, 'limit (1–12)', 1, MAX_RESULTS, { integer: true, fallback: 8 });
  if (!Array.isArray(request.categories) || request.categories.length < 1 || request.categories.length > 3 ||
      request.categories.some(category => typeof category !== 'string' || !CATEGORY_TYPES[category]) ||
      new Set(request.categories).size !== request.categories.length) throw invalid('categories');
  if (request.includeOpeningHours !== undefined && typeof request.includeOpeningHours !== 'boolean') throw invalid('includeOpeningHours');
  const includeOpeningHours = request.includeOpeningHours === true;
  if (request.plannedAt !== undefined && !timeText(request.plannedAt)) throw invalid('plannedAt');
  if (includeOpeningHours && !request.plannedAt) throw invalid('plannedAt');
  return { latitude, longitude, radiusMeters, limit, categories: [...request.categories],
    includeOpeningHours, plannedAt: request.plannedAt ?? null };
}

function openingData(place, plannedAt, fetchedAt, provider) {
  const opening = normalizeCurrentHours(place, plannedAt, fetchedAt, provider);
  return { opening, ...(['known', 'closed'].includes(opening.status) ?
    { confidence: 'provider_current_hours' } : { reason: opening.reason }) };
}

function attributionData(raw, google) {
  if (!google) return { googleMapsRequired: false, thirdParty: [] };
  const thirdParty = Array.isArray(raw) ? raw.slice(0, 8).filter(item => item && validText(item.provider, 120)).map(item => {
    let uri;
    try {
      const parsed = new URL(item.providerUri);
      if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) uri = parsed.toString();
    } catch { /* Text attribution remains available without an unsafe link. */ }
    return { provider: item.provider, ...(uri ? { providerUri: uri } : {}) };
  }) : [];
  return { googleMapsRequired: true, thirdParty };
}

function normalizePlace(place, input, sourceKind, fetchedAt) {
  if (!place || typeof place !== 'object' || !validText(place.id, 80) ||
      !validText(place.displayName?.text, 120) ||
      typeof place.location?.latitude !== 'number' || !Number.isFinite(place.location.latitude) ||
      Math.abs(place.location.latitude) > 90 || typeof place.location?.longitude !== 'number' ||
      !Number.isFinite(place.location.longitude) || Math.abs(place.location.longitude) > 180) return { reason: 'MALFORMED_PLACE' };
  if (place.businessStatus && !['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY', 'FUTURE_OPENING'].includes(place.businessStatus)) {
    return { reason: 'MALFORMED_PLACE' };
  }
  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') return { reason: 'CLOSED_BUSINESS' };
  if (EXCLUDED_PRIMARY_TYPES.has(place.primaryType)) return { reason: 'IRRELEVANT_TYPE' };
  const types = [place.primaryType, ...(Array.isArray(place.types) ? place.types : [])];
  const category = types.map(type => TYPE_CATEGORY[type]).find(Boolean);
  if (!category || !input.categories.includes(category)) return { reason: 'IRRELEVANT_TYPE' };
  const hours = input.includeOpeningHours ? openingData(place, input.plannedAt, fetchedAt, sourceKind) :
    { opening: { status: 'unknown' }, reason: 'HOURS_NOT_REQUESTED' };
  const warnings = [{ code: 'PRICE_UNKNOWN', placeId: place.id }, { code: 'VISIT_DURATION_UNKNOWN', placeId: place.id }];
  if (hours.reason) warnings.push({ code: hours.reason, placeId: place.id });
  if (!place.businessStatus) warnings.push({ code: 'BUSINESS_STATUS_UNKNOWN', placeId: place.id });
  const google = sourceKind === 'google_places_new';
  const candidate = {
    id: place.id, name: place.displayName.text, latitude: place.location.latitude,
    longitude: place.location.longitude, category, tags: [], visitMinutes: null,
    opening: hours.opening,
    expenses: [{ id: 'activity-cost', category: 'activity', quantity: 1, unit: 'group',
      priceStatus: 'unknown', minimumCost: null, expectedCost: null, maximumCost: null }],
    source: { name: google ? 'Google Places (New)' : 'Rove fictional fixture', reference: place.id },
    provenance: { provider: sourceKind, fetchedAt: new Date(fetchedAt).toISOString(),
      placeId: place.id, openingConfidence: hours.confidence ?? 'unknown', priceDataStatus: 'unknown' },
    businessStatus: place.businessStatus ?? 'UNKNOWN',
    attribution: attributionData(place.attributions, google),
  };
  return { candidate, warnings };
}

async function discoverPlaces(body, options = {}) {
  const input = validateInput(body);
  const mode = options.mode ?? process.env.ROVE_PLACES_MODE ?? 'disabled';
  const fetchedAt = options.now ?? Date.now();
  if (!Number.isFinite(fetchedAt)) throw serviceError(500, 'INTERNAL_ERROR', 'Internal server error');
  let data;
  let sourceKind;
  if (mode === 'fixture') {
    if ((options.nodeEnv ?? process.env.NODE_ENV) === 'production') throw serviceError(503, 'PLACES_DISABLED', 'Place discovery is not enabled');
    data = options.fixtureResponse ?? FIXTURE_RESPONSE;
    sourceKind = 'rove_fixture';
  } else if (mode === 'live') {
    if ((options.liveEnabled ?? process.env.ROVE_PLACES_LIVE_ENABLED) !== true &&
        (options.liveEnabled ?? process.env.ROVE_PLACES_LIVE_ENABLED) !== 'true') {
      throw serviceError(503, 'PLACES_DISABLED', 'Place discovery is not enabled');
    }
    if (input.includeOpeningHours && (options.enterpriseEnabled ?? process.env.ROVE_PLACES_ENTERPRISE_FIELDS_ENABLED) !== true &&
        (options.enterpriseEnabled ?? process.env.ROVE_PLACES_ENTERPRISE_FIELDS_ENABLED) !== 'true') {
      throw serviceError(503, 'PLACES_HOURS_DISABLED', 'Opening-hours lookup is not enabled');
    }
    const key = options.apiKey ?? process.env.GOOGLE_API_KEY;
    if (!key) throw serviceError(503, 'SERVICE_UNCONFIGURED', 'Google Places service is not configured');
    if (!options.context || typeof options.context.run !== 'function') throw serviceError(500, 'INTERNAL_ERROR', 'Internal server error');
    const includedTypes = [...new Set(input.categories.flatMap(category => CATEGORY_TYPES[category]))];
    const fieldMask = BASE_FIELDS + (input.includeOpeningHours ? HOURS_FIELDS : '');
    const payload = { includedTypes, maxResultCount: input.limit, rankPreference: 'DISTANCE',
      locationRestriction: { circle: { center: { latitude: input.latitude, longitude: input.longitude },
        radius: input.radiusMeters } } };
    try {
      const response = await options.context.run(signal => (options.transport ?? axios).post(URL, payload, {
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fieldMask },
        signal, timeout: LIMITS.providerMs, maxRedirects: 0,
        maxContentLength: LIMITS.jsonBytes, maxBodyLength: LIMITS.jsonBytes,
      }));
      if (response.status !== 200) throw { response: { status: response.status } };
      options.context.check();
      data = response.data;
    } catch (error) { throw providerError(error, options.context.signal); }
    sourceKind = 'google_places_new';
  } else if (mode === 'disabled') {
    throw serviceError(503, 'PLACES_DISABLED', 'Place discovery is not enabled');
  } else {
    throw serviceError(503, 'SERVICE_UNCONFIGURED', 'Place discovery is not configured');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.error !== undefined ||
      (data.places === undefined && Object.keys(data).length !== 0) ||
      (data.places !== undefined && !Array.isArray(data.places)) || (data.places?.length ?? 0) > 20) {
    throw serviceError(502, 'PROVIDER_INVALID_RESPONSE', 'Place provider returned invalid data');
  }
  const places = data.places ?? [];
  const candidates = [];
  const warnings = sourceKind === 'rove_fixture' ? [{ code: 'FICTIONAL_FIXTURE_DATA' }] : [];
  const skipped = { malformed: 0, closed: 0, irrelevant: 0, duplicate: 0 };
  const seen = new Set();
  for (const place of places) {
    const result = normalizePlace(place, input, sourceKind, fetchedAt);
    if (!result.candidate) {
      if (result.reason === 'MALFORMED_PLACE') skipped.malformed++;
      else if (result.reason === 'CLOSED_BUSINESS') skipped.closed++;
      else skipped.irrelevant++;
      continue;
    }
    if (seen.has(result.candidate.id)) { skipped.duplicate++; continue; }
    seen.add(result.candidate.id);
    candidates.push(result.candidate);
    warnings.push(...result.warnings);
    if (candidates.length >= input.limit) break;
  }
  if (places.length && skipped.malformed === places.length) {
    throw serviceError(502, 'PROVIDER_INVALID_RESPONSE', 'Place provider returned invalid data');
  }
  for (const [kind, count] of Object.entries(skipped)) if (count) warnings.push({ code: `SKIPPED_${kind.toUpperCase()}`, count });
  return { status: 'ok', provider: sourceKind, candidates,
    attribution: { googleMapsRequired: sourceKind === 'google_places_new' },
    warnings, skipped };
}

module.exports = { discoverPlaces, validateInput, normalizePlace, openingData, CATEGORY_TYPES,
  BASE_FIELDS, HOURS_FIELDS, URL };
