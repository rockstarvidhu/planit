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

app.get('/', (req, res) => res.send('✅ PlanIt Server: Permissive Mode (No Budget Limit)'));

// --- HELPER 1: Strict Distance Calculation ---
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

// --- HELPER 3: Extract JSON ---
function extractJSON(text) {
    try { return JSON.parse(text); } 
    catch (e) {
        const match = text.match(/\[.*\]/s);
        if (match) { try { return JSON.parse(match[0]); } catch (e2) { return null; } }
        return null;
    }
}

// --- HELPER 4: SMART CATEGORY RULES ---
function getCategoryRules(types, name) {
    const t = types || [];
    const n = name.toLowerCase();

    // 1. Shopping Malls -> Variable/Free
    if (t.includes('shopping_mall')) {
        return { type: 'shopping', defaultCost: 0, note: "Free Entry (Variable Shopping)" };
    }
    
    // 2. Restaurants -> Fixed ₹200 (User Request)
    if (t.includes('restaurant') || t.includes('food') || t.includes('cafe') || t.includes('bakery') || t.includes('meal_takeaway')) {
        return { type: 'food', defaultCost: 200, note: "Standard Meal Estimate" };
    }

    // 3. Activities -> Specific Estimates if reviews fail
    if (n.includes('kart') || n.includes('racing')) return { type: 'activity', defaultCost: 600, note: "Est. Race Fee" };
    if (t.includes('bowling_alley')) return { type: 'activity', defaultCost: 450, note: "Est. Game Fee" };
    if (t.includes('movie_theater')) return { type: 'activity', defaultCost: 300, note: "Est. Ticket Price" };
    if (t.includes('amusement_park') || n.includes('wonderla')) return { type: 'ticket', defaultCost: 1200, note: "Est. Entry Ticket" };
    if (t.includes('zoo') || t.includes('aquarium')) return { type: 'ticket', defaultCost: 400, note: "Est. Entry Ticket" };
    
    // 4. Nature/Parks -> Cheap Entry
    if (t.includes('park') || t.includes('tourist_attraction')) return { type: 'nature', defaultCost: 50, note: "Est. Entry Fee" };

    // Default
    return { type: 'general', defaultCost: 100, note: "Estimated Cost" };
}

// --- HELPER 5: PRICE PARSER FROM REVIEWS ---
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
            // Strict filter: Reject years and phone numbers
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

// --- HELPER 6: Fetch Details ---
async function fetchPlaceDetails(placeId) {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=editorial_summary,reviews,name,geometry,types&key=${process.env.GOOGLE_API_KEY}`;
        const response = await axios.get(url);
        return response.data.result; 
    } catch (e) {
        return null;
    }
}

// ==========================================
// 🚀 MAIN API ROUTE
// ==========================================
app.post('/api/itinerary', async (req, res) => {
  console.log("\n🌍 NEW REQUEST:", req.body);
  let { budget, people = 2, location, radius = 5000, filters = [], hasPrivateVehicle, mileage = 15 } = req.body;
  
  const radiusKm = parseFloat(radius) / 1000;
  const userBudget = parseFloat(budget);

  try {
    const startLocationStr = await resolveLocation(location);
    const [startLat, startLng] = startLocationStr.split(',').map(Number);
    
    // --- 1. KEYWORD GENERATION ---
    let searchQueries = [];
    if (filters.includes("adventure_sports")) searchQueries.push("adventure park go karting paintball");
    if (filters.includes("entertainment")) searchQueries.push("bowling arcade mall cinema");
    if (filters.includes("nature_park")) searchQueries.push("waterfalls lake view park nature");
    if (filters.includes("restaurant")) searchQueries.push("popular restaurants cafes dining");
    if (searchQueries.length === 0) searchQueries.push("tourist attractions");

    // --- 2. AI BRAINSTORMING ---
    const prompt = `Recommend 8 distinct outings near ${startLat}, ${startLng} matching keywords: ${searchQueries.join(", ")}. Return JSON: [{ "name": "Place Name", "description": "Short summary" }]`;
    const model = genAI.getGenerativeModel({ model: "gemini-3.0-pro-preview" });
    
    let placeList = [];
    try {
        const aiResult = await model.generateContent(prompt);
        placeList = extractJSON(aiResult.response.text()) || [];
    } catch (e) { console.log("AI Fallback"); }

    // --- 3. GOOGLE SEARCH (Backup) ---
    if (placeList.length < 5) {
        const promises = searchQueries.map(async (q) => {
            const gUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&location=${startLat},${startLng}&radius=${radius}&key=${process.env.GOOGLE_API_KEY}`;
            const resp = await axios.get(gUrl);
            return resp.data.results.slice(0, 3).map(p => ({ name: p.name, description: "Popular spot." }));
        });
        const gRes = await Promise.all(promises);
        placeList = [...placeList, ...gRes.flat()];
    }

    // --- 4. PRE-FILTERING ---
    let candidates = [];
    const PETROL_PRICE = 108; 
    let processedNames = new Set();

    for (const placeItem of placeList) {
        if (candidates.length >= 10) break;
        const normName = placeItem.name.toLowerCase().trim();
        if (processedNames.has(normName)) continue;

        // Fetch Basic Data
        const placeUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(placeItem.name)}&location=${startLat},${startLng}&radius=${radius}&key=${process.env.GOOGLE_API_KEY}`;
        const placeResp = await axios.get(placeUrl);
        const placeData = placeResp.data.results[0];

        if (!placeData) continue;
        processedNames.add(normName);

        // Strict Radius Check
        const pLat = placeData.geometry.location.lat;
        const pLng = placeData.geometry.location.lng;
        const exactDist = calculateDistance(startLat, startLng, pLat, pLng);
        
        if (exactDist > radiusKm) continue; 

        // Travel Cost
        const distKm = exactDist * 1.3; 
        let travelCost = hasPrivateVehicle 
            ? Math.round((distKm / parseFloat(mileage)) * PETROL_PRICE)
            : Math.round(50 + (distKm * 22));

        candidates.push({
            ...placeItem,
            place_id: placeData.place_id,
            location: placeData.geometry.location,
            rating: placeData.rating,
            photo_ref: placeData.photos?.[0]?.photo_reference,
            travelCost,
            travelTime: `${Math.round(distKm * 2)} mins`,
            distanceStr: `${exactDist.toFixed(1)} km`,
            types: placeData.types
        });
    }

    // --- 5. SMART PRICING LOGIC ---
    console.log(" 📝 Verifying prices...");
    const finalItinerary = [];

    await Promise.all(candidates.map(async (item) => {
        const details = await fetchPlaceDetails(item.place_id);
        
        let finalDesc = item.description;
        if (details?.editorial_summary?.overview) finalDesc = details.editorial_summary.overview;
        else if (details?.reviews?.[0]?.text) finalDesc = details.reviews[0].text.substring(0, 150) + "...";

        // --- 🟢 APPLYING USER RULES HERE ---
        const category = getCategoryRules(item.types, item.name);
        let verifiedActivityCost = 0;
        let costNote = "";

        // Rule 1: Food -> Fixed
        if (category.type === 'food') {
            verifiedActivityCost = category.defaultCost * people;
            costNote = `Est. Meal (~₹${category.defaultCost}/p)`;
        } 
        // Rule 2: Shopping -> Free
        else if (category.type === 'shopping') {
            verifiedActivityCost = 0;
            costNote = "Free Entry (Shopping Variable)";
        }
        // Rule 3: Activities -> Try Reviews, then Smart Fallback
        else {
            let foundReviewPrice = false;
            if (details?.reviews) {
                const modePrice = extractPriceMode(details.reviews);
                if (modePrice) {
                    verifiedActivityCost = modePrice * people;
                    costNote = `Verified: ₹${modePrice}/p`;
                    foundReviewPrice = true;
                }
            }
            
            if (!foundReviewPrice) {
                verifiedActivityCost = category.defaultCost * people;
                costNote = category.note;
            }
        }

        const totalTripCost = verifiedActivityCost + item.travelCost;
        
        // --- 🟢 NO BUDGET FILTER (All results included) ---
        // Generate Activity Tags based on category
        let acts = [];
        if (category.type === 'food') acts = ["Dining", "Cafe"];
        else if (category.type === 'shopping') acts = ["Shopping", "Window Shopping"];
        else if (category.type === 'activity') acts = ["Game", "Fun"];
        else acts = ["Sightseeing"];

        finalItinerary.push({
            ...item,
            description: finalDesc,
            totalOptionCost: totalTripCost,
            activityCost: verifiedActivityCost,
            costNote: costNote,
            activities: acts
        });
    }));

    // Sort by price (Cheapest first)
    finalItinerary.sort((a, b) => a.totalOptionCost - b.totalOptionCost);

    res.json({ 
        itinerary: finalItinerary, 
        totalCost: finalItinerary.length > 0 ? finalItinerary[0].totalOptionCost : 0, 
        budget: userBudget,
        aiSummary: finalItinerary.length > 0 
            ? "Here are the best spots found near you!" 
            : "No places found. Try increasing your radius."
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});