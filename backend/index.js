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

app.get('/', (req, res) => res.send('✅ PlanIt Server v14.0 (Final Production Build)'));

// --- HELPER 1: Haversine Distance (Strict Radius) ---
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI/180);
  const dLon = (lon2 - lon1) * (Math.PI/180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
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

// --- HELPER 3: Robust JSON Extractor ---
function extractJSON(text) {
    try { return JSON.parse(text); } 
    catch (e) {
        const match = text.match(/\[.*\]/s);
        if (match) { try { return JSON.parse(match[0]); } catch (e2) { return null; } }
        return null;
    }
}

// --- HELPER 4: Smart Activity Generator (The "Dropdown" Fix) ---
function getSmartDetails(placeData) {
    const name = placeData.name.toLowerCase();
    const types = placeData.types || [];
    
    // Default
    let activities = ["Standard Entry (~₹200)"];

    if (types.includes('amusement_park') || name.includes('wonderla') || name.includes('storm') || name.includes('park')) {
        activities = ["Entry Ticket (~₹1000)", "Fast Track Pass (~₹1500)", "Food & Snacks (~₹300)"];
    }
    else if (name.includes('kart') || name.includes('arena') || name.includes('paintball') || name.includes('sport')) {
        activities = ["Go-Karting (~₹400)", "Paintball (~₹350)", "Arcade Games (~₹200)"];
    }
    else if (types.includes('movie_theater') || types.includes('cinema') || name.includes('multiplex')) {
        activities = ["Movie Ticket (~₹250)", "Popcorn Combo (~₹300)", "Recliner Seats (~₹450)"];
    }
    else if (types.includes('shopping_mall') || name.includes('mall') || name.includes('plaza')) {
        activities = ["Gaming Arcade (~₹500)", "Food Court Meal (~₹300)", "Window Shopping (Free)"];
    }
    else if (types.includes('restaurant') || types.includes('cafe') || types.includes('food')) {
        activities = ["Main Course (~₹350)", "Beverages (~₹150)", "Dessert (~₹200)"];
    }
    else if (types.includes('park') || name.includes('dam') || name.includes('fall')) {
        activities = ["Entry Fee (~₹20)", "Boating/Trekking (~₹150)", "Photography (Free)"];
    }

    return { activities };
}

// --- HELPER 5: Fetch Real Reviews (The "Description" Fix) ---
async function fetchPlaceDetails(placeId) {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=editorial_summary,reviews&key=${process.env.GOOGLE_API_KEY}`;
        const response = await axios.get(url);
        const result = response.data.result;

        // 1. Try Official Google Summary
        if (result.editorial_summary && result.editorial_summary.overview) {
            return result.editorial_summary.overview;
        }
        // 2. Fallback to Top User Review (Truncated)
        if (result.reviews && result.reviews.length > 0) {
            const review = result.reviews[0].text;
            return review.length > 150 ? review.substring(0, 150) + "..." : review;
        }
        return null; // Return null so we can fall back to AI description
    } catch (e) {
        return null;
    }
}

// ==========================================
// 🚀 MAIN API ROUTE
// ==========================================
app.post('/api/itinerary', async (req, res) => {
  console.log("\n🌍 NEW REQUEST:", req.body.filters, "| Radius:", req.body.radius);
  let { budget, people = 2, location, radius = 5000, filters = [], hasPrivateVehicle, mileage = 15 } = req.body;
  const radiusKm = parseInt(radius) / 1000;

  try {
    const startLocationStr = await resolveLocation(location);
    const [startLat, startLng] = startLocationStr.split(',').map(Number);
    
    // --- STEP 1: DEFINE PARALLEL SEARCH QUERIES ---
    // We search for EACH selected vibe separately to ensure we get a mix.
    let searchQueries = [];

    if (filters.includes("adventure_sports")) searchQueries.push("adventure parks go karting paintball");
    if (filters.includes("entertainment")) searchQueries.push("video game arcades bowling malls cinemas");
    if (filters.includes("nature_park")) searchQueries.push("nature parks waterfalls viewpoints");
    if (filters.includes("restaurant")) searchQueries.push("popular restaurants cafes themed bistros");
    
    // Fallback if nothing selected
    if (searchQueries.length === 0) searchQueries.push("tourist attractions");

    // --- STEP 2: AI BRAINSTORMING ---
    const vibeString = searchQueries.join(", ");
    const prompt = `
      Recommend 15 distinct outings near ${startLat}, ${startLng}.
      Vibe keywords: ${vibeString}
      
      RETURN JSON ARRAY ONLY:
      [ { "name": "Exact Name", "description": "1 short sentence summary." } ]
      
      RULES:
      1. Provide a MIX: If "Nature" AND "Food" are selected, give Nature spots AND Restaurants.
      2. Use specific names (e.g. "Funcity", "Garron Play Arena").
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    let placeList = [];
    
    try {
        const aiResult = await model.generateContent(prompt);
        placeList = extractJSON(aiResult.response.text()) || [];
    } catch (e) {
        console.error("⚠️ AI Failed, skipping to Parallel Google Search...");
    }

    // --- STEP 3: GOOGLE PARALLEL SEARCH (The Variety Guarantee) ---
    // If AI failed OR returned few results, fetch directly from Google for EACH category
    if (placeList.length < 8) {
        console.log("⚠️ Fetching from Google to ensure variety...");
        const promises = searchQueries.map(async (query) => {
            const googleUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${startLat},${startLng}&radius=${radius}&key=${process.env.GOOGLE_API_KEY}`;
            const resp = await axios.get(googleUrl);
            // Take top 5 from EACH category
            return resp.data.results.slice(0, 5).map(p => ({ 
                name: p.name, 
                description: "A popular local spot matching your vibe." // Temporary placeholder
            })); 
        });

        const results = await Promise.all(promises);
        const googleList = results.flat();
        
        // Merge AI list + Google List
        placeList = [...placeList, ...googleList];
    }

    // --- STEP 4: FILTERING & MATH ---
    let itinerary = [];
    const PETROL_PRICE = 108; 
    const USER_MILEAGE = parseFloat(mileage) || 15;
    const CAB_BASE = 50; 
    const CAB_RATE = 22;
    let processedNames = new Set(); // To stop duplicates

    // Process function
    const processCandidate = async (placeItem) => {
        // Deduplication
        const normName = placeItem.name.toLowerCase().trim();
        if (Array.from(processedNames).some(n => n.includes(normName) || normName.includes(n))) return null;

        // 1. Get Details
        const placeUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(placeItem.name)}&location=${startLat},${startLng}&radius=${radius}&key=${process.env.GOOGLE_API_KEY}`;
        const placeResp = await axios.get(placeUrl);
        const placeData = placeResp.data.results[0];

        if (!placeData) return null;
        processedNames.add(normName);

        // 2. Strict Radius Check
        const placeLat = placeData.geometry.location.lat;
        const placeLng = placeData.geometry.location.lng;
        const exactDistance = calculateDistance(startLat, startLng, placeLat, placeLng);
        
        if (exactDistance > radiusKm) return null; // ❌ REJECT if outside radius

        // 3. Travel Cost
        const origin = `${startLat},${startLng}`;
        const dest = `${placeLat},${placeLng}`;
        const dirUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${dest}&mode=driving&key=${process.env.GOOGLE_API_KEY}`;
        const dirResp = await axios.get(dirUrl);
        
        let travelCost = 0;
        let travelTime = "20 mins";
        let distanceText = `${exactDistance.toFixed(1)} km`;

        if (dirResp.data.routes.length > 0) {
            const leg = dirResp.data.routes[0].legs[0];
            travelTime = leg.duration.text;
            distanceText = leg.distance.text;
            const distKm = leg.distance.value / 1000;

            if (hasPrivateVehicle) {
                const liters = distKm / USER_MILEAGE;
                travelCost = Math.round(liters * PETROL_PRICE) + 20; 
            } else {
                travelCost = Math.round(CAB_BASE + (distKm * CAB_RATE));
            }
        }

        // 4. Activity Cost Logic
        let level = placeData.price_level || 0;
        const nameLower = placeData.name.toLowerCase();
        
        // Force prices for known types
        if (level === 0) {
            if (nameLower.includes('kart') || nameLower.includes('fun') || nameLower.includes('cinema') || nameLower.includes('mall') || nameLower.includes('wonderla')) level = 2;
            if (nameLower.includes('cafe') || nameLower.includes('bistro')) level = 2;
        }
        const priceMap = [0, 200, 600, 1500, 2500]; 
        const activityCost = priceMap[level] * people;
        const totalOneWay = activityCost + travelCost;

        // 5. Budget Check
        if (totalOneWay <= budget) {
            const smartData = getSmartDetails(placeData);
            return {
                place_id: placeData.place_id,
                name: placeData.name,
                address: placeData.formatted_address,
                type: placeData.types[0],
                location: placeData.geometry.location,
                rating: placeData.rating,
                userRatingsTotal: placeData.user_ratings_total,
                photo_ref: placeData.photos?.[0]?.photo_reference || null,
                activityCost, travelCost, travelTime, distance: distanceText,
                totalOptionCost: totalOneWay,
                activities: smartData.activities,
                // Pass AI description as backup
                aiDescription: placeItem.description || "A recommended spot." 
            };
        }
        return null;
    };

    // Filter Candidates until we have 6
    for (const place of placeList) {
        if (itinerary.length >= 6) break;
        const result = await processCandidate(place);
        if (result) itinerary.push(result);
    }

    // --- STEP 5: FINAL POLISH (Fetch Real Reviews) ---
    console.log("   📝 Polishing descriptions for", itinerary.length, "places...");
    
    const enrichedItinerary = await Promise.all(itinerary.map(async (item) => {
        // Fetch real Google Review
        const realDescription = await fetchPlaceDetails(item.place_id);
        
        // Logic: Use Google Review if found, otherwise use AI description
        return { 
            ...item, 
            description: realDescription || item.aiDescription 
        };
    }));

    res.json({ 
        itinerary: enrichedItinerary, 
        totalCost: enrichedItinerary.length > 0 ? enrichedItinerary[0].totalOptionCost : 0, 
        budget, people, 
        aiSummary: enrichedItinerary.length > 0 ? "Options loaded." : "No options found within this radius/budget."
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});