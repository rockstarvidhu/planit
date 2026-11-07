if (process.env.NODE_ENV !== 'test') require('dotenv').config({ quiet: true });
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const { LIMITS, HttpError, invalid, unavailable, numeric, bodyObject, proxyTrust,
  safeLog, route, googleJSON, photoImage } = require('./security');
const { evaluateBudget, BudgetInputError } = require('./budget-engine');

const app = express();
const PORT = process.env.PORT || 5000;

// Fail closed until exact ingress addresses and header sanitization are verified.
app.set('trust proxy', proxyTrust(process.env.TRUSTED_PROXY_IPS));
app.disable('x-powered-by');

// --- CORS CONFIGURATION (SEC-03) ---
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'http://localhost:5000', 'https://planit-v1.vercel.app'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, server-to-server, curl) or allowed web origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new HttpError(403, 'CORS_ORIGIN', 'Origin not allowed by CORS policy'));
    }
  },
  credentials: true
}));


// --- RATE LIMITERS (SEC-03) ---
// req.ip uses only socket identity unless an explicitly trusted ingress is configured.
const makeLimiter = options => rateLimit({
  ...options, keyGenerator: req => ipKeyGenerator(req.ip),
});
const generalLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

const itineraryLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many itinerary requests from this IP, please try again after 15 minutes.' }
});

const budgetLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many budget requests from this IP, please try again after 15 minutes.' }
});

const reverseGeocodeLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many geocode requests, please try again later.' }
});

const photoLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many photo requests, please try again later.' }
});

app.use(generalLimiter);
app.use(express.json({ limit: '10kb' }));

// Safe initialization of Google Generative AI
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

app.get('/', (req, res) => res.send('PlanIt Server v16.1 - Secured Photos + Smart Pricing'));

app.post('/api/budget/evaluate', budgetLimiter, route((req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(evaluateBudget(req.body));
  } catch (error) {
    if (error instanceof BudgetInputError) throw invalid(error.field);
    throw error;
  }
}, 0));

// --- PHOTO PROXY ENDPOINT ---
app.get('/api/photo', photoLimiter, route(async (req, res, context) => {
  const { ref, maxwidth } = req.query;
  if (!ref || typeof ref !== 'string') throw new HttpError(400, 'INVALID_INPUT', 'Photo reference is required');
  if (!/^[\w\-.~+]{10,800}$/.test(ref)) throw new HttpError(400, 'INVALID_INPUT', 'Invalid photo reference format');
  const width = numeric(maxwidth, 'photo width (100–1600)', 100, 1600, { fallback: 800, integer: true });
  requireMapsKey();
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${width}&photo_reference=${encodeURIComponent(ref)}&key=${process.env.GOOGLE_API_KEY}`;
  const image = await photoImage(axios, url, context);
  context.check();
  res.set('Content-Type', image.type);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'private, max-age=300');
  res.send(image.bytes);
}, 4));

function requireMapsKey() {
  if (!process.env.GOOGLE_API_KEY) throw new HttpError(503, 'SERVICE_UNCONFIGURED', 'Google Maps service is not configured');
}

function providerCoordinates(location) {
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number' ||
      !Number.isFinite(location.lat) || !Number.isFinite(location.lng) ||
      Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) throw unavailable();
  return location;
}

app.post('/api/reverse-geocode', reverseGeocodeLimiter, route(async (req, res, context) => {
  const { lat, lng } = bodyObject(req.body);
  const latNum = numeric(lat, 'latitude (-90 to 90)', -90, 90);
  const lngNum = numeric(lng, 'longitude (-180 to 180)', -180, 180);
  requireMapsKey();
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latNum},${lngNum}&key=${process.env.GOOGLE_API_KEY}`;
  const data = await googleJSON(axios, url, context);
  if (data.status === 'ZERO_RESULTS') throw new HttpError(404, 'NO_RESULTS', 'Address not found');
  const result = data.results?.[0];
  if (!result || !Array.isArray(result.address_components)) throw unavailable();
  const locality = result.address_components.find(c => c.types?.includes('locality'))?.long_name;
  const area = result.address_components.find(c => c.types?.includes('sublocality'))?.long_name;
  const address = area && locality ? `${area}, ${locality}` : locality || result.formatted_address;
  if (typeof address !== 'string') throw unavailable();
  res.json({ address });
}, 1));

// --- HELPER 1: Haversine Distance ---
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- HELPER 2: Geocoding ---
async function resolveLocation(location, context) {
  if (/^[+\-\d.\s]+,[+\-\d.\s]+$/.test(location)) {
    const parts = location.split(',');
    return `${numeric(parts[0], 'latitude', -90, 90)},${numeric(parts[1], 'longitude', -180, 180)}`;
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.GOOGLE_API_KEY}`;
  const data = await googleJSON(axios, url, context);
  if (data.status === 'ZERO_RESULTS') throw new HttpError(404, 'NO_RESULTS', 'Location not found');
  const { lat, lng } = providerCoordinates(data.results?.[0]?.geometry?.location);
  return `${lat},${lng}`;
}

// --- HELPER 3: JSON Extractor ---
function extractJSON(text) {
  try { return JSON.parse(text); }
  catch (e) {
    const match = text.match(/\[.*\]/s);
    if (match) { try { return JSON.parse(match[0]); } catch (e2) { return null; } }
    return null;
  }
}

// --- HELPER 4: Smart Activity Generator ---
function getSmartDetails(placeData) {
  const name = (placeData.name || "").toLowerCase();
  const types = placeData.types || [];
  let activities = ["Standard Entry (~₹200)"];

  if (types.includes('amusement_park') || name.includes('wonderla')) activities = ["Entry Ticket (~₹1000)", "Fast Track (~₹1500)"];
  else if (name.includes('kart') || name.includes('arena')) activities = ["Go-Karting (~₹400)", "Paintball (~₹350)"];
  else if (types.includes('movie_theater')) activities = ["Movie Ticket (~₹250)", "Popcorn (~₹300)"];
  else if (types.includes('restaurant') || types.includes('food')) activities = ["Main Course (~₹350)", "Beverages (~₹150)"];
  else if (types.includes('park')) activities = ["Entry Fee (~₹20)", "Boating (~₹150)"];

  return { activities };
}

// --- HELPER 5: Review Price Extractor ---
function extractPriceMode(reviews) {
  if (!reviews || reviews.length === 0) return null;
  const pricesFound = [];
  const currentYear = new Date().getFullYear();
  const priceRegex = /(?:rs\.?|inr)\s*(\d+(?:,\d+)*)|(\d+)\s*(?:rs|rupees)/gi;

  reviews.forEach(r => {
    const text = r.text || "";
    let match;
    while ((match = priceRegex.exec(text)) !== null) {
      const rawNum = (match[1] || match[2]).replace(/,/g, '');
      const price = parseInt(rawNum, 10);
      // Filter out years (from 2020 through current year + 2) and unrealistic price boundaries
      const isLikelyYear = price >= 2020 && price <= (currentYear + 2);
      if (price > 10 && price < 10000 && !isLikelyYear) {
        pricesFound.push(price);
      }
    }
  });

  if (pricesFound.length === 0) return null;

  const buckets = {};
  let maxCount = 0;
  let bestBucket = null;

  pricesFound.forEach(p => {
    const bucket = Math.round(p / 50) * 50;
    buckets[bucket] = (buckets[bucket] || 0) + 1;
    if (buckets[bucket] > maxCount) {
      maxCount = buckets[bucket];
      bestBucket = bucket;
    }
  });

  return bestBucket;
}

// --- HELPER 6: Fetch Place Details ---
async function fetchPlaceDetails(placeId, context) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=editorial_summary,reviews,name&key=${process.env.GOOGLE_API_KEY}`;
  const data = await googleJSON(axios, url, context);
  if (data.status === 'ZERO_RESULTS') return null;
  if (!data.result || typeof data.result !== 'object') throw unavailable();
  return data.result;
}

async function generateAI(prompt, context) {
  return context.run(async signal => {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      generationConfig: { maxOutputTokens: 2048 },
    });
    const result = await model.generateContent(prompt, { signal, timeout: LIMITS.providerMs });
    const text = result.response.text();
    if (typeof text !== 'string' || text.length > 32768) throw unavailable();
    return text;
  });
}

async function getGeminiPrice(placeName, city, context) {
  if (!genAI) return null;
  const prompt = `What is the typical entry fee or cost per person in INR for "${placeName}" in or near "${city}"? Return ONLY JSON: { "cost": 300, "confidence": "high", "note": "Entry ticket" }. Confidence must be high, medium, or low. If unknown return { "cost": null, "confidence": "low", "note": "Unknown" }.`;
  const text = await generateAI(prompt, context);
  let parsed;
  try { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch { return null; }
  if (!parsed || typeof parsed.cost !== 'number' || !Number.isFinite(parsed.cost) || parsed.cost < 0 || parsed.cost >= 10000) return null;
  return { cost: parsed.cost, confidence: ['high','medium','low'].includes(parsed.confidence) ? parsed.confidence : 'low',
    note: typeof parsed.note === 'string' ? parsed.note.slice(0, 200) : 'AI price estimate' };
}

// --- HELPER 8: Build Secure Photo URL (SEC-01) ---
function buildPhotoUrl(photoRef) {
  if (!photoRef) return null;
  return `/api/photo?ref=${encodeURIComponent(photoRef)}`;
}

// ==========================================
// MAIN API ROUTE (SEC-03, SEC-04, BUG-01 to BUG-07)
// ==========================================
app.post('/api/itinerary', itineraryLimiter, route(async (req, res, context) => {
  const { budget, people, location, radius, filters = [], hasPrivateVehicle = false, mileage } = bodyObject(req.body);
  const budgetNum = numeric(budget, 'budget (100–10000000)', 100, 10000000, { integer: true });
  if (typeof location !== 'string' || !location.trim() || location.length > 200) throw invalid('location');
  const peopleNum = numeric(people, 'people (1–50)', 1, 50, { fallback: 2, integer: true });
  const radiusNum = numeric(radius, 'radius (1000–50000)', 1000, 50000, { fallback: 5000, integer: true });
  if (typeof hasPrivateVehicle !== 'boolean') throw invalid('hasPrivateVehicle');
  // The current web client sends null when no private vehicle is selected.
  const USER_MILEAGE = numeric(mileage === null && !hasPrivateVehicle ? undefined : mileage,
    'mileage (5–60)', 5, 60, { fallback: 15 });
  const hasVehicle = hasPrivateVehicle;
  if (!Array.isArray(filters) || filters.length > 4 || filters.some(f => typeof f !== 'string')) throw invalid('filters');
  const validFilters = ['adventure_sports', 'entertainment', 'nature_park', 'restaurant'];
  const safeFilters = [...new Set(filters.filter(f => validFilters.includes(f)))];
  const radiusKm = radiusNum / 1000;
  const cityName = location.trim();
  requireMapsKey();
  const startLocationStr = await resolveLocation(cityName, context);
  const [startLat, startLng] = startLocationStr.split(',').map(Number);

  // STEP 1: Search queries from sanitized filters
  let searchQueries = [];
  if (safeFilters.includes("adventure_sports")) searchQueries.push("adventure parks go karting");
  if (safeFilters.includes("entertainment")) searchQueries.push("arcades bowling malls");
  if (safeFilters.includes("nature_park")) searchQueries.push("waterfalls viewpoints nature");
  if (safeFilters.includes("restaurant")) searchQueries.push("restaurants cafes");
  if (searchQueries.length === 0) searchQueries.push("tourist attractions");

  // STEP 2: Gemini brainstorm
  const vibeString = searchQueries.join(", ");
  const prompt = `Recommend 10 distinct outings near ${startLat}, ${startLng} matching keywords: ${vibeString}. Return a JSON array only: [{ "name": "Place Name", "description": "Short summary" }]`;

  let placeList = [];
  let aiFailure = null;
  const warnings = [];
  if (genAI) {
    try {
      const candidates = extractJSON(await generateAI(prompt, context));
      if (!Array.isArray(candidates)) throw unavailable();
      placeList = candidates.slice(0, LIMITS.candidates).filter(p => p && typeof p.name === 'string' &&
        p.name.trim() && p.name.length <= 200).map(p => ({ name: p.name.trim(),
        description: typeof p.description === 'string' ? p.description.slice(0, 500) : '' }));
    } catch (error) {
      context.check();
      aiFailure = error;
      safeLog('ai_fallback', error);
      warnings.push({ code: error.code || 'AI_UNAVAILABLE', message: 'AI suggestions unavailable; using Google Places.' });
    }
  }

  // Fallback is sequential: bounded concurrency, no speculative requests after failure.
  if (placeList.length < 5) {
    for (const query of searchQueries) {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${startLat},${startLng}&radius=${radiusNum}&key=${process.env.GOOGLE_API_KEY}`;
      const data = await googleJSON(axios, url, context);
      if (data.status === 'ZERO_RESULTS') continue;
      if (!Array.isArray(data.results)) throw unavailable();
      for (const place of data.results.slice(0, 3)) {
        if (typeof place.name === 'string' && place.name.length <= 200) placeList.push({ name: place.name, description: 'Popular outing spot.' });
      }
    }
  }
  placeList = [...new Map(placeList.map(p => [p.name.toLowerCase(), p])).values()].slice(0, LIMITS.candidates);

  // STEP 4: Process candidate places
  let itinerary = [];
  const PETROL_PRICE = 108; // Average INR / Litre
  let processedNames = new Set();

  const processCandidate = async (placeItem) => {
    const normName = (placeItem.name || '').toLowerCase().trim();
    if (!normName || processedNames.has(normName)) return null;

    const placeUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(placeItem.name)}&location=${startLat},${startLng}&radius=${radiusNum}&key=${process.env.GOOGLE_API_KEY}`;
    const placeResponse = await googleJSON(axios, placeUrl, context);
    if (placeResponse.status === 'ZERO_RESULTS') return null;
    const placeData = placeResponse.results?.[0];
    if (!placeData || typeof placeData.name !== 'string' || typeof placeData.place_id !== 'string') throw unavailable();
    processedNames.add(normName);

    const { lat: pLat, lng: pLng } = providerCoordinates(placeData.geometry?.location);
    const exactDist = calculateDistance(startLat, startLng, pLat, pLng);
    if (exactDist > radiusKm) return null;

    const origin = `${startLat},${startLng}`;
    const dest = `${pLat},${pLng}`;
    const dirUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${dest}&mode=driving&key=${process.env.GOOGLE_API_KEY}`;
    const directions = await googleJSON(axios, dirUrl, context);

    let travelCost = 0;
    let travelTime = "20 mins (est.)";
    let distText = `${exactDist.toFixed(1)} km`;
    let oneWayDistKm = exactDist;

    if (directions.routes && directions.routes.length > 0) {
      const leg = directions.routes[0].legs[0];
      if (!leg || !Number.isFinite(leg.distance?.value) || leg.distance.value < 0 || leg.distance.value > 1000000 ||
          typeof leg.duration?.text !== 'string' || typeof leg.distance.text !== 'string') throw unavailable();
      travelTime = `${leg.duration.text} (one-way)`;
      distText = leg.distance.text;
      oneWayDistKm = leg.distance.value / 1000;
    }

    // --- ROUND-TRIP TRAVEL COST CALCULATION (BUG-05, BUG-06) ---
    const roundTripDistKm = oneWayDistKm * 2;
    if (hasVehicle) {
      travelCost = Math.round((roundTripDistKm / USER_MILEAGE) * PETROL_PRICE);
    } else {
      // Ride-share calculation scaled by vehicles needed (4 people per standard cab/auto)
      const vehiclesNeeded = Math.max(1, Math.ceil(peopleNum / 4));
      travelCost = Math.round((50 + (roundTripDistKm * 22)) * vehiclesNeeded);
    }

    // --- SAFE PRICE LEVEL PRE-CHECK (BUG-07) ---
    // Accurately respect price_level === 0 as Free (0 cost)
    const level = (typeof placeData.price_level === 'number') ? placeData.price_level : 1;
    const priceMap = [0, 200, 600, 1500, 2500];
    const roughCostPerPerson = priceMap[Math.min(Math.max(0, level), 4)] ?? 200;
    const roughTotal = (roughCostPerPerson * peopleNum) + travelCost;

    if (roughTotal <= budgetNum) {
      const smartData = getSmartDetails(placeData);
      return {
        place_id: placeData.place_id,
        name: placeData.name,
        address: placeData.formatted_address,
        rating: typeof placeData.rating === 'number' ? placeData.rating : null,
        photoUrl: buildPhotoUrl(placeData.photos?.[0]?.photo_reference),
        latitude: pLat, // Real coordinates (BUG-01)
        longitude: pLng, // Real coordinates (BUG-01)
        type: placeData.types?.[0] || 'tourist_attraction', // Real type (BUG-04)
        people: peopleNum, // Group size (BUG-03)
        travelCost,
        travelTime,
        distance: distText,
        roundTripDistKm: Math.round(roundTripDistKm * 10) / 10,
        activities: smartData.activities,
        aiDescription: placeItem.description || "Exciting outing spot.",
        roughCostPerPerson,
      };
    }
    return null;
  };

  for (const place of placeList) {
    if (itinerary.length >= LIMITS.results) break;
    const result = await processCandidate(place);
    if (result) itinerary.push(result);
  }

  // STEP 5: Smart pricing with Reviews & Gemini
  const enrichedItinerary = [];
  for (const item of itinerary) {
    const details = await fetchPlaceDetails(item.place_id, context);

    let finalDesc = item.aiDescription;
    if (details?.editorial_summary?.overview) {
      finalDesc = details.editorial_summary.overview;
    } else if (details?.reviews?.[0]?.text) {
      finalDesc = details.reviews[0].text.substring(0, 150) + "...";
    }

    let costPerPerson = item.roughCostPerPerson;
    let costConfidence = "low";
    let costNote = "Estimated";

    // Layer 1: Reviews
    if (details?.reviews) {
      const reviewPrice = extractPriceMode(details.reviews);
      if (reviewPrice !== null) {
        costPerPerson = reviewPrice;
        costConfidence = "medium";
        costNote = "Based on user reviews";
      }
    }

    // Layer 2: Gemini Price Oracle (if reviews yielded nothing and Gemini is configured)
    if (costConfidence === "low" && genAI) {
      let geminiPrice = null;
      try {
        geminiPrice = await getGeminiPrice(item.name, cityName, context);
      } catch (error) {
        context.check();
        // Optional AI pricing may fall back only with an explicit degraded-response warning.
        aiFailure = error;
        safeLog('ai_price_fallback', error);
        warnings.push({ code: error.code || 'AI_UNAVAILABLE', message: 'AI pricing unavailable; costs are estimates.' });
      }
      if (geminiPrice && typeof geminiPrice.cost === 'number') {
        costPerPerson = geminiPrice.cost;
        costConfidence = geminiPrice.confidence || "medium";
        costNote = geminiPrice.note || "AI price estimate";
      }
    }

    const activityCost = costPerPerson * peopleNum;
    const totalOptionCost = activityCost + item.travelCost;

    // Final budget verification
    if (totalOptionCost > budgetNum) continue;

    enrichedItinerary.push({
      ...item,
      description: finalDesc,
      costPerPerson,
      activityCost,
      totalOptionCost,
      costConfidence,
      costNote,
      people: peopleNum, // Explicitly ensure people is populated (BUG-03)
    });
  }

  const finalItinerary = enrichedItinerary;
  if (aiFailure && finalItinerary.length === 0) throw aiFailure;
  context.check();

  res.json({
    itinerary: finalItinerary,
    totalCost: finalItinerary.length > 0 ? finalItinerary[0].totalOptionCost : 0,
    budget: budgetNum,
    people: peopleNum,
    ...(warnings.length ? { warnings: [...new Map(warnings.map(w => [w.message, w])).values()] } : {}),
    aiSummary: finalItinerary.length > 0
      ? `Found ${finalItinerary.length} outing options within your ₹${budgetNum} budget.`
      : `No outing options found within your ₹${budgetNum} budget. Try expanding your search radius or budget.`,
  });

}));

// Only known application errors may provide client messages. Never reflect parser/provider text.
app.use((error, req, res, next) => {
  safeLog('request_failed', error);
  if (res.headersSent) return next(error);
  if (res.destroyed || error.code === 'CLIENT_CLOSED') return;
  res.set('Cache-Control', 'no-store');
  if (error instanceof HttpError) {
    if (error.status === 503) res.set('Retry-After', '60');
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large', code: 'BODY_TOO_LARGE' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body', code: 'INVALID_JSON' });
  return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

// Start server only when run directly (enables supertest integration testing)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
