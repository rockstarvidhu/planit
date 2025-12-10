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

app.get('/', (req, res) => res.send('✅ PlanIt Server v15.0 (Live Cost Analysis Build)'));

// --- HELPER 1: Haversine Distance ---
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

// --- HELPER 3: Robust JSON Extractor ---
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
    let activities = ["Standard Entry (~₹200)"];

    if (types.includes('amusement_park') || name.includes('wonderla')) activities = ["Entry Ticket (~₹1000)", "Fast Track (~₹1500)"];
    else if (name.includes('kart') || name.includes('arena')) activities = ["Go-Karting (~₹400)", "Paintball (~₹350)"];
    else if (types.includes('movie_theater')) activities = ["Movie Ticket (~₹250)", "Popcorn (~₹300)"];
    else if (types.includes('restaurant') || types.includes('food')) activities = ["Main Course (~₹350)", "Beverages (~₹150)"];
    else if (types.includes('park')) activities = ["Entry Fee (~₹20)", "Boating (~₹150)"];

    return { activities };
}

// --- HELPER 5: NEW PRICE LOGIC (The "Most Mentioned" Analyzer) ---
function extractPriceMode(reviews) {
    if (!reviews || reviews.length === 0) return null;

    const pricesFound = [];
    // Regex to find prices like "Rs 500", "₹200", "500rs", "INR 300"
    const priceRegex = /(?:rs\.?|₹|inr)\s*(\d+(?:,\d+)*)|(\d+)\s*(?:rs|rupees)/gi;

    reviews.forEach(r => {
        const text = r.text || "";
        let match;
        while ((match = priceRegex.exec(text)) !== null) {
            // Group 1 or Group 2 will contain the number (remove commas)
            const rawNum = (match[1] || match[2]).replace(/,/g, '');
            const price = parseInt(rawNum);
            // Filter crazy outliers (e.g. phone numbers or year 2023) and very small nums
            if (price > 10 && price < 10000 && price !== 2023 && price !== 2024 && price !== 2025) {
                pricesFound.push(price);
            }
        }
    });

    if (pricesFound.length === 0) return null;

    // LOGIC: Find the MODE (Most Mentioned Price Bucket)
    // We group by 50s (e.g. 180 and 220 both count towards the "200" bucket)
    const buckets = {};
    let maxCount = 0;
    let bestBucket = null;

    pricesFound.forEach(p => {
        const bucket = Math.round(p / 50) * 50; // Round to nearest 50
        buckets[bucket] = (buckets[bucket] || 0) + 1;
        if (buckets[bucket] > maxCount) {
            maxCount = buckets[bucket];
            bestBucket = bucket;
        }
    });

    // If we have a clear winner, that's our "Most Mentioned Activity Cost"
    return bestBucket;
}

// --- HELPER 6: Fetch Details & Reviews ---
async function fetchPlaceDetails(placeId) {
    try {
        // Fetching 5 reviews to analyze prices
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=editorial_summary,reviews,name&key=${process.env.GOOGLE_API_KEY}`;
        const response = await axios.get(url);
        const result = response.data.result;
        return result; 
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
  const radiusKm = parseInt(radius) / 1000;

  try {
    const startLocationStr = await resolveLocation(location);
    const [startLat, startLng] = startLocationStr.split(',').map(Number);
    
    // --- STEP 1: SEARCH QUERIES ---
    let searchQueries = [];
    if (filters.includes("adventure_sports")) searchQueries.push("adventure parks go karting");
    if (filters.includes("entertainment")) searchQueries.push("arcades bowling malls");
    if (filters.includes("nature_park")) searchQueries.push("waterfalls viewpoints nature");
    if (filters.includes("restaurant")) searchQueries.push("restaurants cafes");
    if (searchQueries.length === 0) searchQueries.push("tourist attractions");

    // --- STEP 2: AI BRAINSTORMING ---
    const vibeString = searchQueries.join(", ");
    const prompt = `Recommend 10 distinct outings near ${startLat}, ${startLng} matching keywords: ${vibeString}. Return JSON: [{ "name": "Place Name", "description": "Short summary" }]`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    let placeList = [];
    try {
        const aiResult = await model.generateContent(prompt);
        placeList = extractJSON(aiResult.response.text()) || [];
    } catch (e) { console.log("AI Fallback"); }

    // --- STEP 3: GOOGLE FALLBACK ---
    if (placeList.length < 5) {
        const promises = searchQueries.map(async (q) => {
            const gUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&location=${startLat},${startLng}&radius=${radius}&key=${process.env.GOOGLE_API_KEY}`;
            const resp = await axios.get(gUrl);
            return resp.data.results.slice(0, 3).map(p => ({ name: p.name, description: "Popular spot." }));
        });
        const gRes = await Promise.all(promises);
        placeList = [...placeList, ...gRes.flat()];
    }

    // --- STEP 4: FILTERING ---
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

        // Distance Check
        const pLat = placeData.geometry.location.lat;
        const pLng = placeData.geometry.location.lng;
        const exactDist = calculateDistance(startLat, startLng, pLat, pLng);
        if (exactDist > radiusKm) return null;

        // Travel Cost Calc
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

        // ESTIMATED Cost (Placeholder) - We refine this in Step 5
        let level = placeData.price_level || 1;
        const priceMap = [0, 200, 600, 1500, 2500];
        let activityCost = priceMap[level] * people;

        if ((activityCost + travelCost) <= budget) {
             const smartData = getSmartDetails(placeData);
             return {
                place_id: placeData.place_id,
                name: placeData.name,
                address: placeData.formatted_address,
                rating: placeData.rating,
                photo_ref: placeData.photos?.[0]?.photo_reference,
                activityCost, travelCost, travelTime, distance: distText,
                totalOptionCost: activityCost + travelCost,
                activities: smartData.activities,
                aiDescription: placeItem.description
             };
        }
        return null;
    };

    for (const place of placeList) {
        if (itinerary.length >= 6) break;
        const res = await processCandidate(place);
        if (res) itinerary.push(res);
    }

    // --- STEP 5: FINAL POLISH & REAL COST ANALYSIS ---
    // This is where we apply the "Most Mentioned" Logic
    console.log(" 📝 Analyzing reviews for real costs...");
    
    const enrichedItinerary = await Promise.all(itinerary.map(async (item) => {
        const details = await fetchPlaceDetails(item.place_id);
        
        // 1. Get Description
        let finalDesc = item.aiDescription;
        if (details?.editorial_summary?.overview) finalDesc = details.editorial_summary.overview;
        else if (details?.reviews?.[0]?.text) finalDesc = details.reviews[0].text.substring(0, 150) + "...";

        // 2. RE-CALCULATE COST BASED ON REVIEWS (The PlanIt Feature)
        let realActivityCost = item.activityCost; // Default to old estimate
        let costSource = "Estimated (Google Price Level)";

        if (details?.reviews) {
            const modePrice = extractPriceMode(details.reviews);
            if (modePrice) {
                // If we found a "Most Mentioned" price, use it!
                realActivityCost = modePrice * people;
                costSource = `Based on User Reviews (~₹${modePrice}/person)`;
                console.log(`   💰 Corrected cost for ${item.name}: ₹${modePrice} (was ₹${item.activityCost/people})`);
            }
        }

        return { 
            ...item, 
            description: finalDesc,
            activityCost: realActivityCost,
            totalOptionCost: realActivityCost + item.travelCost,
            costNote: costSource
        };
    }));

    res.json({ 
        itinerary: enrichedItinerary, 
        totalCost: enrichedItinerary.length > 0 ? enrichedItinerary[0].totalOptionCost : 0, 
        budget, people,
        aiSummary: "Itinerary generated with real-time cost analysis." 
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});