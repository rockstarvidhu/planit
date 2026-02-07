require('dotenv').config();
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => res.send('✅ PlanIt Server: Fail-Safe Mode (v2)'));

// --- HELPER 1: Distance Calculation ---
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI/180);
  const dLon = (lon2 - lon1) * (Math.PI/180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

// --- HELPER 2: Smart Categories ---
function getCategoryRules(types, name) {
    const t = types || [];
    const n = name.toLowerCase();

    if (t.includes('shopping_mall')) return { type: 'shopping', defaultCost: 0, note: "Free Entry" };
    if (t.includes('restaurant') || t.includes('food') || t.includes('cafe')) return { type: 'food', defaultCost: 200, note: "Est. Meal" };
    if (n.includes('kart') || n.includes('racing')) return { type: 'activity', defaultCost: 600, note: "Est. Race" };
    if (t.includes('bowling_alley')) return { type: 'activity', defaultCost: 450, note: "Est. Game" };
    if (t.includes('amusement_park')) return { type: 'ticket', defaultCost: 1200, note: "Est. Ticket" };
    if (t.includes('park')) return { type: 'nature', defaultCost: 50, note: "Est. Entry" };

    return { type: 'general', defaultCost: 100, note: "Estimated" };
}

// --- HELPER 3: Price Mode from Reviews ---
function extractPriceMode(reviews) {
    if (!reviews || reviews.length === 0) return null;
    const pricesFound = [];
    const priceRegex = /(?:rs\.?|₹|inr|cost|price|entry)\s*[:\-\s]?\s*(\d+(?:,\d+)*)|(\d+)\s*(?:\/-|rs|rupees)/gi;

    reviews.forEach(r => {
        const text = r.text || "";
        let match;
        while ((match = priceRegex.exec(text)) !== null) {
            const rawNum = (match[1] || match[2]).replace(/,/g, '');
            const price = parseInt(rawNum);
            if (price > 20 && price < 10000 && (price < 2020 || price > 2030)) {
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

// --- HELPER 4: Fetch Details ---
async function fetchPlaceDetails(placeId) {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=editorial_summary,reviews,name,geometry,types&key=${process.env.GOOGLE_API_KEY}`;
        const response = await axios.get(url);
        return response.data.result; 
    } catch (e) { return null; }
}

// ==========================================
// 🚀 MAIN API ROUTE
// ==========================================
app.post('/api/itinerary', async (req, res) => {
  console.log("\n🌍 NEW REQUEST:", req.body.location);
  let { people = 2, location, radius = 5000, filters = [], hasPrivateVehicle, mileage = 15 } = req.body;
  
  people = Number(people) || 2;
  const radiusKm = parseFloat(radius) / 1000;
  const PETROL_PRICE = 108;

  try {
    // 1. Resolve Location
    let lat, lng;
    if (/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/.test(location)) {
        [lat, lng] = location.split(',').map(Number);
    } else {
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.GOOGLE_API_KEY}`;
        const geoRes = await axios.get(geoUrl);
        if (!geoRes.data.results.length) throw new Error('Location not found');
        const loc = geoRes.data.results[0].geometry.location;
        lat = loc.lat;
        lng = loc.lng;
    }

    // 2. Build Search Queries
    let searchQueries = ["tourist attraction", "point of interest"];
    if (filters.includes("adventure_sports")) searchQueries.push("adventure sports");
    if (filters.includes("entertainment")) searchQueries.push("entertainment center");
    if (filters.includes("nature_park")) searchQueries.push("park nature");
    if (filters.includes("restaurant")) searchQueries.push("restaurant");

    // 3. AI Helper (Uses standard Flash model)
    // We use this just to log what AI thinks, but rely on Google Maps for data to ensure accuracy
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // <--- CHANGED HERE

    // 4. Search Google Maps (Broad Search)
    let allResults = [];
    const promises = searchQueries.map(async (q) => {
        // We remove radius from API call to get MORE results, then filter manually
        const gUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&location=${lat},${lng}&key=${process.env.GOOGLE_API_KEY}`;
        const resp = await axios.get(gUrl);
        return resp.data.results || [];
    });
    
    const resultsArrays = await Promise.all(promises);
    
    // De-duplicate
    const seen = new Set();
    let candidates = [];
    resultsArrays.flat().forEach(place => {
        if (!seen.has(place.place_id)) {
            seen.add(place.place_id);
            candidates.push(place);
        }
    });

    // 5. Sort Candidates by Distance
    candidates = candidates.map(place => {
        const pLat = place.geometry.location.lat;
        const pLng = place.geometry.location.lng;
        const dist = calculateDistance(lat, lng, pLat, pLng);
        return { ...place, distKm: dist };
    }).sort((a, b) => a.distKm - b.distKm);

    // 6. Apply "Fail-Safe" Radius Filter
    // Try to find items inside radius. If none, grab the closest 8 regardless of radius.
    let validCandidates = candidates.filter(c => c.distKm <= radiusKm);
    
    let isFallback = false;
    if (validCandidates.length === 0) {
        console.log("⚠️ No results in radius. Using closest fallback options.");
        validCandidates = candidates.slice(0, 8); // Fallback: Top 8 closest
        isFallback = true;
    } else {
        validCandidates = validCandidates.slice(0, 10); // Standard: Top 10 valid
    }

    // 7. Process Details & Costs
    const finalItinerary = [];
    console.log(` 📝 Processing ${validCandidates.length} places...`);

    await Promise.all(validCandidates.map(async (place) => {
        const details = await fetchPlaceDetails(place.place_id);
        
        // Cost Logic
        const category = getCategoryRules(place.types, place.name);
        let activityCost = category.defaultCost;
        let costNote = category.note;

        // Try Reviews
        if (category.type !== 'shopping' && category.type !== 'food' && details?.reviews) {
            const realPrice = extractPriceMode(details.reviews);
            if (realPrice) {
                activityCost = realPrice;
                costNote = `Verified: ₹${realPrice}`;
            }
        }

        // Travel Cost
        let travelCost = hasPrivateVehicle 
            ? Math.round((place.distKm * 2 / mileage) * PETROL_PRICE)
            : Math.round(40 + (place.distKm * 20));

        const totalOptionCost = (activityCost * people) + travelCost;

        // Add Note if fallback
        if (isFallback) {
            costNote = `⚠️ Outside Radius (${costNote})`;
        }

        finalItinerary.push({
            place_id: place.place_id,
            name: place.name,
            location: place.geometry.location,
            rating: place.rating,
            photo_ref: place.photos ? place.photos[0].photo_reference : null,
            description: details?.editorial_summary?.overview || place.formatted_address,
            travelTime: `${Math.round(place.distKm * 3)} mins`,
            distance: `${place.distKm.toFixed(1)} km`,
            travelCost,
            activityCost: activityCost * people,
            totalOptionCost,
            costNote,
            activities: place.types ? place.types.slice(0, 2) : ["Visit"]
        });
    }));

    // Sort by Total Cost
    finalItinerary.sort((a, b) => a.totalOptionCost - b.totalOptionCost);

    res.json({ 
        itinerary: finalItinerary, 
        totalCost: finalItinerary.length > 0 ? finalItinerary[0].totalOptionCost : 0, 
        aiSummary: isFallback 
            ? "We couldn't find spots strictly in your radius, so here are the closest popular options!" 
            : "Here are the best places matching your plan!"
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});