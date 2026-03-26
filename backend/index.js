require('dotenv').config();
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => res.send('PlanIt Server v16.0 - Photos + Smart Pricing'));

// --- REVERSE GEOCODE PROXY ---
app.post('/api/reverse-geocode', async (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_API_KEY}`;
    const response = await axios.get(url);
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const components = response.data.results[0].address_components;
      const locality = components.find(c => c.types.includes('locality'))?.long_name;
      const area = components.find(c => c.types.includes('sublocality'))?.long_name;
      const address = area ? `${area}, ${locality}` : locality || response.data.results[0].formatted_address;
      return res.json({ address });
    }
    res.status(404).json({ error: 'Address not found' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
async function resolveLocation(location) {
  if (/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/.test(location)) return location;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.GOOGLE_API_KEY}`;
  const response = await axios.get(url);
  if (response.data.status === 'OK' && response.data.results.length > 0) {
    const { lat, lng } = response.data.results[0].geometry.location;
    return `${lat},${lng}`;
  }
  throw new Error('City not found');
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
  const name = placeData.name.toLowerCase();
  const types = placeData.types || [];
  let activities = ["Standard Entry (~200)"];

  if (types.includes('amusement_park') || name.includes('wonderla')) activities = ["Entry Ticket (~1000)", "Fast Track (~1500)"];
  else if (name.includes('kart') || name.includes('arena')) activities = ["Go-Karting (~400)", "Paintball (~350)"];
  else if (types.includes('movie_theater')) activities = ["Movie Ticket (~250)", "Popcorn (~300)"];
  else if (types.includes('restaurant') || types.includes('food')) activities = ["Main Course (~350)", "Beverages (~150)"];
  else if (types.includes('park')) activities = ["Entry Fee (~20)", "Boating (~150)"];

  return { activities };
}

// --- HELPER 5: Review Price Extractor ---
function extractPriceMode(reviews) {
  if (!reviews || reviews.length === 0) return null;
  const pricesFound = [];
  const priceRegex = /(?:rs\.?|inr)\s*(\d+(?:,\d+)*)|(\d+)\s*(?:rs|rupees)/gi;

  reviews.forEach(r => {
    const text = r.text || "";
    let match;
    while ((match = priceRegex.exec(text)) !== null) {
      const rawNum = (match[1] || match[2]).replace(/,/g, '');
      const price = parseInt(rawNum);
      if (price > 10 && price < 10000 && price !== 2023 && price !== 2024 && price !== 2025 && price !== 2026) {
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
async function fetchPlaceDetails(placeId) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=editorial_summary,reviews,name&key=${process.env.GOOGLE_API_KEY}`;
    const response = await axios.get(url);
    return response.data.result;
  } catch (e) {
    return null;
  }
}

// --- HELPER 7: Gemini Price Oracle ---
async function getGeminiPrice(placeName, city) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `What is the typical entry fee or cost per person in INR for "${placeName}" in or near "${city}"? Return ONLY a raw JSON object with no markdown formatting: { "cost": 300, "confidence": "high", "note": "Entry ticket" }. Confidence must be high, medium, or low. If unknown return { "cost": null, "confidence": "low", "note": "Unknown" }.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    if (parsed.cost && parsed.cost > 0 && parsed.cost < 10000) return parsed;
    return null;
  } catch (e) {
    return null;
  }
}

// --- HELPER 8: Build Photo URL ---
function buildPhotoUrl(photoRef) {
  if (!photoRef) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${process.env.GOOGLE_API_KEY}`;
}

// ==========================================
// MAIN API ROUTE
// ==========================================
app.post('/api/itinerary', async (req, res) => {
  console.log("\nNEW REQUEST:", req.body.filters);
  let { budget, people = 2, location, radius = 5000, filters = [], hasPrivateVehicle, mileage = 15 } = req.body;
  const radiusKm = parseInt(radius) / 1000;
  const cityName = location;

  try {
    const startLocationStr = await resolveLocation(location);
    const [startLat, startLng] = startLocationStr.split(',').map(Number);

    // STEP 1: Search queries from filters
    let searchQueries = [];
    if (filters.includes("adventure_sports")) searchQueries.push("adventure parks go karting");
    if (filters.includes("entertainment")) searchQueries.push("arcades bowling malls");
    if (filters.includes("nature_park")) searchQueries.push("waterfalls viewpoints nature");
    if (filters.includes("restaurant")) searchQueries.push("restaurants cafes");
    if (searchQueries.length === 0) searchQueries.push("tourist attractions");

    // STEP 2: Gemini brainstorm
    const vibeString = searchQueries.join(", ");
    const prompt = `Recommend 10 distinct outings near ${startLat}, ${startLng} matching keywords: ${vibeString}. Return a JSON array only: [{ "name": "Place Name", "description": "Short summary" }]`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    let placeList = [];
    try {
      const aiResult = await model.generateContent(prompt);
      placeList = extractJSON(aiResult.response.text()) || [];
    } catch (e) { console.log("AI brainstorm fallback"); }

    // STEP 3: Google Places fallback
    if (placeList.length < 5) {
      const promises = searchQueries.map(async (q) => {
        const gUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&location=${startLat},${startLng}&radius=${radius}&key=${process.env.GOOGLE_API_KEY}`;
        const resp = await axios.get(gUrl);
        return resp.data.results.slice(0, 3).map(p => ({ name: p.name, description: "Popular spot." }));
      });
      const gRes = await Promise.all(promises);
      placeList = [...placeList, ...gRes.flat()];
    }

    // STEP 4: Process each candidate
    let itinerary = [];
    const PETROL_PRICE = 108;
    const USER_MILEAGE = parseFloat(mileage) || 15;
    let processedNames = new Set();

    const processCandidate = async (placeItem) => {
      const normName = placeItem.name.toLowerCase().trim();
      if (processedNames.has(normName)) return null;

      const placeUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(placeItem.name)}&location=${startLat},${startLng}&radius=${radius}&key=${process.env.GOOGLE_API_KEY}`;
      const placeResp = await axios.get(placeUrl);
      const placeData = placeResp.data.results[0];
      if (!placeData) return null;
      processedNames.add(normName);

      const pLat = placeData.geometry.location.lat;
      const pLng = placeData.geometry.location.lng;
      const exactDist = calculateDistance(startLat, startLng, pLat, pLng);
      if (exactDist > radiusKm) return null;

      const origin = `${startLat},${startLng}`;
      const dest = `${pLat},${pLng}`;
      const dirUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${dest}&mode=driving&key=${process.env.GOOGLE_API_KEY}`;
      const dirResp = await axios.get(dirUrl);

      let travelCost = 0;
      let travelTime = "20 mins";
      let distText = `${exactDist.toFixed(1)} km`;

      if (dirResp.data.routes.length > 0) {
        const leg = dirResp.data.routes[0].legs[0];
        travelTime = leg.duration.text;
        distText = leg.distance.text;
        const distKm = leg.distance.value / 1000;
        if (hasPrivateVehicle) travelCost = Math.round((distKm / USER_MILEAGE) * PETROL_PRICE);
        else travelCost = Math.round(50 + (distKm * 22));
      }

      // Rough pre-check with price_level
      const level = placeData.price_level || 1;
      const priceMap = [0, 200, 600, 1500, 2500];
      const roughCostPerPerson = priceMap[level];
      const roughTotal = (roughCostPerPerson * people) + travelCost;

      if (roughTotal <= budget) {
        const smartData = getSmartDetails(placeData);
        return {
          place_id: placeData.place_id,
          name: placeData.name,
          address: placeData.formatted_address,
          rating: placeData.rating,
          photoUrl: buildPhotoUrl(placeData.photos?.[0]?.photo_reference),
          travelCost,
          travelTime,
          distance: distText,
          activities: smartData.activities,
          aiDescription: placeItem.description,
          roughCostPerPerson,
        };
      }
      return null;
    };

    for (const place of placeList) {
      if (itinerary.length >= 6) break;
      const result = await processCandidate(place);
      if (result) itinerary.push(result);
    }

    // STEP 5: Smart pricing — Reviews then Gemini then fallback
    console.log("Running smart pricing...");

    const enrichedItinerary = await Promise.all(itinerary.map(async (item) => {
      const details = await fetchPlaceDetails(item.place_id);

      let finalDesc = item.aiDescription;
      if (details?.editorial_summary?.overview) finalDesc = details.editorial_summary.overview;
      else if (details?.reviews?.[0]?.text) finalDesc = details.reviews[0].text.substring(0, 150) + "...";

      let costPerPerson = item.roughCostPerPerson;
      let costConfidence = "low";
      let costNote = "Estimated";

      // Layer 1: Reviews
      if (details?.reviews) {
        const reviewPrice = extractPriceMode(details.reviews);
        if (reviewPrice) {
          costPerPerson = reviewPrice;
          costConfidence = "medium";
          costNote = "Based on user reviews";
        }
      }

      // Layer 2: Gemini (only if reviews gave nothing)
      if (costConfidence === "low") {
        const geminiPrice = await getGeminiPrice(item.name, cityName);
        if (geminiPrice) {
          costPerPerson = geminiPrice.cost;
          costConfidence = geminiPrice.confidence;
          costNote = geminiPrice.note;
        }
      }

      const activityCost = costPerPerson * people;
      const totalOptionCost = activityCost + item.travelCost;

      // Final budget check with real price
      if (totalOptionCost > budget) return null;

      return {
        ...item,
        description: finalDesc,
        costPerPerson,
        activityCost,
        totalOptionCost,
        costConfidence,
        costNote,
      };
    }));

    const finalItinerary = enrichedItinerary.filter(Boolean);

    res.json({
      itinerary: finalItinerary,
      totalCost: finalItinerary.length > 0 ? finalItinerary[0].totalOptionCost : 0,
      budget,
      people,
      aiSummary: "Itinerary generated with real-time cost analysis.",
    });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
