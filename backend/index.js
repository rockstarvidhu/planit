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

app.get('/', (req, res) => res.send('✅ PlanIt Server: Strict Mode Enabled'));

// --- HELPER 1: Strict Distance Calculation ---
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

// --- HELPER 3: Extract JSON ---
function extractJSON(text) {
    try { return JSON.parse(text); } 
    catch (e) {
        const match = text.match(/\[.*\]/s);
        if (match) { try { return JSON.parse(match[0]); } catch (e2) { return null; } }
        return null;
    }
}

// --- HELPER 4: Smart Activity Details ---
function getSmartDetails(placeData) {
    const name = placeData.name.toLowerCase();
    const types = placeData.types || [];
    let activities = ["Standard Entry (~₹200)"];

    if (types.includes('amusement_park') || name.includes('wonderla')) activities = ["Entry Ticket (~₹1000)", "Fast Track (~₹1500)"];
    else if (name.includes('kart') || name.includes('arena')) activities = ["Go-Karting (~₹400)", "Paintball (~₹350)"];
    else if (types.includes('movie_theater')) activities = ["Movie Ticket (~₹250)", "Popcorn (~₹300)"];
    else if (types.includes('restaurant') || types.includes('food')) activities = ["Main Course (~₹350)", "Beverages (~₹150)"];
    else if (types.includes('park')) activities = ["Entry Fee (~₹50)", "Boating (~₹150)"];

    return { activities };
}

// --- HELPER 5: ADVANCED PRICE PARSER (The Fix for Accuracy) ---
function extractPriceMode(reviews) {
    if (!reviews || reviews.length === 0) return null;

    const pricesFound = [];
    // Regex catches: "Rs. 500", "INR 500", "500/-", "500 rupees", "cost is 500"
    const priceRegex = /(?:rs\.?|₹|inr|cost|price)\s*[:\-\s]?\s*(\d+(?:,\d+)*)|(\d+)\s*(?:\/-|rs|rupees)/gi;

    reviews.forEach(r => {
        const text = r.text || "";
        let match;
        while ((match = priceRegex.exec(text)) !== null) {
            const rawNum = (match[1] || match[2]).replace(/,/g, '');
            const price = parseInt(rawNum);
            // Strict filter: Reject years (2020-2030) and phone-number-like values
            if (price > 10 && price < 15000 && (price < 2020 || price > 2030)) {
                pricesFound.push(price);
            }
        }
    });

    if (pricesFound.length === 0) return null;

    // Find MODE (Most Common Price Bucket)
    const buckets = {};
    let maxCount = 0;
    let bestBucket = null;

    pricesFound.forEach(p => {
        // Round to nearest 50 to group similar prices (480 -> 500, 520 -> 500)
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
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=editorial_summary,reviews,name,geometry&key=${process.env.GOOGLE_API_KEY}`;
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
  console.log("\n🌍 NEW REQUEST:", req.body.filters);
  let { budget, people = 2, location, radius = 5000, filters = [], hasPrivateVehicle, mileage = 15 } = req.body;
  
  // Ensure strict number types
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    
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

    // --- 4. PRE-FILTERING (Distance & Initial Cost) ---
    let candidates = [];
    const PETROL_PRICE = 108; 
    let processedNames = new Set();

    for (const placeItem of placeList) {
        if (candidates.length >= 8) break;
        const normName = placeItem.name.toLowerCase().trim();
        if (processedNames.has(normName)) continue;

        // Fetch Data
        const placeUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(placeItem.name)}&location=${startLat},${startLng}&radius=${radius}&key=${process.env.GOOGLE_API_KEY}`;
        const placeResp = await axios.get(placeUrl);
        const placeData = placeResp.data.results[0];

        if (!placeData) continue;
        processedNames.add(normName);

        // A. STRICT RADIUS CHECK
        const pLat = placeData.geometry.location.lat;
        const pLng = placeData.geometry.location.lng;
        const exactDist = calculateDistance(startLat, startLng, pLat, pLng);
        
        // 🛑 HARD STOP: If distance is even 0.1km over radius, drop it.
        if (exactDist > radiusKm) {
            console.log(`❌ Dropped ${placeItem.name}: ${exactDist.toFixed(1)}km is > ${radiusKm}km`);
            continue; 
        }

        // Travel Cost
        const distKm = exactDist * 1.3; // Estimate road distance as 30% more than straight line
        let travelCost = hasPrivateVehicle 
            ? Math.round((distKm / parseFloat(mileage)) * PETROL_PRICE)
            : Math.round(50 + (distKm * 22));

        // Initial Price Estimate
        let level = placeData.price_level || 1;
        const priceMap = [0, 200, 600, 1500, 2500];
        let estimatedActivityCost = priceMap[level] * people;

        candidates.push({
            ...placeItem,
            place_id: placeData.place_id,
            formatted_address: placeData.formatted_address,
            location: placeData.geometry.location,
            rating: placeData.rating,
            photo_ref: placeData.photos?.[0]?.photo_reference,
            travelCost,
            travelTime: `${Math.round(distKm * 2)} mins`, // Rough estimate
            distanceStr: `${exactDist.toFixed(1)} km`,
            estimatedActivityCost,
            types: placeData.types
        });
    }

    // --- 5. REAL PRICE CHECK & FINAL BUDGET FILTER ---
    console.log(" 📝 Verifying prices...");
    
    const finalItinerary = [];

    await Promise.all(candidates.map(async (item) => {
        const details = await fetchPlaceDetails(item.place_id);
        
        let finalDesc = item.description;
        if (details?.editorial_summary?.overview) finalDesc = details.editorial_summary.overview;
        else if (details?.reviews?.[0]?.text) finalDesc = details.reviews[0].text.substring(0, 150) + "...";

        // 🔍 EXTRACT REAL PRICE
        let verifiedActivityCost = item.estimatedActivityCost;
        let costNote = "Estimated";

        if (details?.reviews) {
            const modePrice = extractPriceMode(details.reviews);
            if (modePrice) {
                verifiedActivityCost = modePrice * people;
                costNote = `Verified from Reviews (~₹${modePrice}/person)`;
                console.log(`   💰 Found REAL price for ${item.name}: ₹${modePrice}`);
            }
        }

        const totalTripCost = verifiedActivityCost + item.travelCost;

        // 🛑 FINAL STRICT BUDGET CHECK
        // We only add it to the final list if the REAL price fits the budget
        if (totalTripCost <= userBudget) {
            const smartData = getSmartDetails({ name: item.name, types: item.types });
            finalItinerary.push({
                ...item,
                description: finalDesc,
                totalOptionCost: totalTripCost,
                activityCost: verifiedActivityCost,
                costNote: costNote,
                activities: smartData.activities
            });
        } else {
            console.log(`❌ Dropped ${item.name}: Total ₹${totalTripCost} > Budget ₹${userBudget}`);
        }
    }));

    res.json({ 
        itinerary: finalItinerary, 
        totalCost: finalItinerary.length > 0 ? finalItinerary[0].totalOptionCost : 0, 
        budget: userBudget,
        aiSummary: finalItinerary.length > 0 ? "Optimized Plan" : "No places found matching strictly within budget/radius."
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});