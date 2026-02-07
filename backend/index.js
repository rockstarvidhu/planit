require('dotenv').config();
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// RENAMED: 'genAI' -> 'aiBrain' (Easier to understand)
const aiBrain = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => res.send('✅ PlanIt Server (Readable Version)'));

// --- HELPER 1: Calculate Distance ---
function getDistanceFromLatLon(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI/180);
  const dLon = (lon2 - lon1) * (Math.PI/180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

// --- HELPER 2: Find Coordinates ---
async function findCoordinates(locationName) {
  if (/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/.test(locationName)) return locationName;
  
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationName)}&key=${process.env.GOOGLE_API_KEY}`;
  const response = await axios.get(url);
  
  if (response.data.status === 'OK' && response.data.results.length > 0) {
    const { lat, lng } = response.data.results[0].geometry.location;
    return `${lat},${lng}`;
  }
  throw new Error('Could not find that city.');
}

// --- HELPER 3: Read AI Response ---
function parseAIResponse(text) {
    try { return JSON.parse(text); } 
    catch (e) {
        const match = text.match(/\[.*\]/s);
        if (match) { try { return JSON.parse(match[0]); } catch (e2) { return null; } }
        return null;
    }
}

// --- HELPER 4: Create Activity List ---
function generateActivityList(placeData) {
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

// --- HELPER 5: FIND REAL PRICE (The "Most Mentioned" Logic) ---
// RENAMED: 'extractPriceMode' -> 'findMostCommonPrice'
function findMostCommonPrice(reviews) {
    if (!reviews || reviews.length === 0) return null;

    const pricesFound = [];
    const priceScanner = /(?:rs\.?|₹|inr)\s*(\d+(?:,\d+)*)|(\d+)\s*(?:rs|rupees)/gi;

    reviews.forEach(review => {
        const text = review.text || "";
        let match;
        while ((match = priceScanner.exec(text)) !== null) {
            const rawNum = (match[1] || match[2]).replace(/,/g, '');
            const price = parseInt(rawNum);
            // Ignore years (2024) or phone numbers
            if (price > 10 && price < 10000 && price !== 2023 && price !== 2024 && price !== 2025) {
                pricesFound.push(price);
            }
        }
    });

    if (pricesFound.length === 0) return null;

    // Logic: Find the price mentioned most often (The "Crowd Favorite")
    const priceBuckets = {};
    let highestCount = 0;
    let mostCommonPrice = null;

    pricesFound.forEach(p => {
        const roundedPrice = Math.round(p / 50) * 50; // Group similar prices (e.g., 180 & 200)
        priceBuckets[roundedPrice] = (priceBuckets[roundedPrice] || 0) + 1;
        
        if (priceBuckets[roundedPrice] > highestCount) {
            highestCount = priceBuckets[roundedPrice];
            mostCommonPrice = roundedPrice;
        }
    });

    return mostCommonPrice;
}

// --- HELPER 6: Get Google Details ---
async function getGoogleDetails(placeId) {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=editorial_summary,reviews,name&key=${process.env.GOOGLE_API_KEY}`;
        const response = await axios.get(url);
        return response.data.result; 
    } catch (e) {
        return null;
    }
}

// ==========================================
// 🚀 MAIN ROUTE (Readable Version)
// ==========================================
app.post('/api/itinerary', async (req, res) => {
  console.log("\n🌍 New Trip Request:", req.body.filters);
  
  let { budget, people = 2, location, radius = 5000, filters = [], hasPrivateVehicle, mileage = 15 } = req.body;
  const maxDistanceKm = parseInt(radius) / 1000;

  try {
    const startCoords = await findCoordinates(location);
    const [startLat, startLng] = startCoords.split(',').map(Number);
    
    // --- 1. PREPARE SEARCH WORDS ---
    let searchKeywords = [];
    if (filters.includes("adventure_sports")) searchKeywords.push("adventure parks go karting");
    if (filters.includes("entertainment")) searchKeywords.push("arcades bowling malls");
    if (filters.includes("nature_park")) searchKeywords.push("waterfalls viewpoints nature");
    if (filters.includes("restaurant")) searchKeywords.push("restaurants cafes");
    if (searchKeywords.length === 0) searchKeywords.push("tourist attractions");

    // --- 2. ASK AI BRAIN FOR IDEAS ---
    const prompt = `Recommend 10 distinct outings near ${startLat}, ${startLng} matching keywords: ${searchKeywords.join(", ")}. Return JSON: [{ "name": "Place Name", "description": "Short summary" }]`;

    const model = aiBrain.getGenerativeModel({ model: "gemini-3.0-pro-preview" });
    let listOfPlaces = [];
    
    try {
        const aiResult = await model.generateContent(prompt);
        listOfPlaces = parseAIResponse(aiResult.response.text()) || [];
    } catch (e) { console.log("AI Brain skipped, using Google Search directly."); }

    // --- 3. GOOGLE SEARCH BACKUP ---
    if (listOfPlaces.length < 5) {
        const promises = searchKeywords.map(async (word) => {
            const gUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(word)}&location=${startLat},${startLng}&radius=${radius}&key=${process.env.GOOGLE_API_KEY}`;
            const resp = await axios.get(gUrl);
            return resp.data.results.slice(0, 3).map(p => ({ name: p.name, description: "Popular spot." }));
        });
        const googleResults = await Promise.all(promises);
        listOfPlaces = [...listOfPlaces, ...googleResults.flat()];
    }

    // --- 4. CHECK EACH PLACE (Filtering) ---
    let finalItinerary = [];
    const PETROL_PRICE = 108; 
    const VEHICLE_MILEAGE = parseFloat(mileage) || 15;
    let checkedNames = new Set();

    // RENAMED: 'processCandidate' -> 'checkIfPlaceFitsBudget'
    const checkIfPlaceFitsBudget = async (potentialPlace) => {
        const cleanName = potentialPlace.name.toLowerCase().trim();
        if (checkedNames.has(cleanName)) return null;
        
        // Fetch Location Data
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(potentialPlace.name)}&location=${startLat},${startLng}&radius=${radius}&key=${process.env.GOOGLE_API_KEY}`;
        const searchResp = await axios.get(searchUrl);
        const placeData = searchResp.data.results[0];

        if (!placeData) return null;
        checkedNames.add(cleanName);

        // Distance Check
        const placeLat = placeData.geometry.location.lat;
        const placeLng = placeData.geometry.location.lng;
        const actualDist = getDistanceFromLatLon(startLat, startLng, placeLat, placeLng);
        
        if (actualDist > maxDistanceKm) return null; // Too far

        // Calculate Travel Cost
        const startPoint = `${startLat},${startLng}`;
        const endPoint = `${placeLat},${placeLng}`; // RENAMED from 'dest'
        const mapUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${startPoint}&destination=${endPoint}&mode=driving&key=${process.env.GOOGLE_API_KEY}`;
        const mapResp = await axios.get(mapUrl);
        
        let travelCost = 0;
        let travelTime = "20 mins";
        let distanceText = `${actualDist.toFixed(1)} km`;

        if (mapResp.data.routes.length > 0) {
            const trip = mapResp.data.routes[0].legs[0];
            travelTime = trip.duration.text;
            distanceText = trip.distance.text;
            const distInKm = trip.distance.value / 1000;
            
            if (hasPrivateVehicle) travelCost = Math.round((distInKm / VEHICLE_MILEAGE) * PETROL_PRICE);
            else travelCost = Math.round(50 + (distInKm * 22)); // Cab fare
        }

        // Quick Price Estimate (Google Symbol)
        let priceLevel = placeData.price_level || 1;
        const estimateTable = [0, 200, 600, 1500, 2500];
        let ticketPrice = estimateTable[priceLevel] * people;

        // Does it fit the budget?
        if ((ticketPrice + travelCost) <= budget) {
             const smartDetails = generateActivityList(placeData);
             return {
                place_id: placeData.place_id,
                name: placeData.name,
                address: placeData.formatted_address,
                rating: placeData.rating,
                photo_ref: placeData.photos?.[0]?.photo_reference,
                activityCost: ticketPrice,
                travelCost, 
                travelTime, 
                distance: distanceText,
                totalOptionCost: ticketPrice + travelCost,
                activities: smartDetails.activities,
                aiDescription: potentialPlace.description
             };
        }
        return null;
    };

    // Run the checks
    for (const place of listOfPlaces) {
        if (finalItinerary.length >= 6) break;
        const validPlace = await checkIfPlaceFitsBudget(place);
        if (validPlace) finalItinerary.push(validPlace);
    }

    // --- 5. FINAL POLISH (Review Analysis) ---
    console.log(" 📝 Reading reviews to find real prices...");
    
    const polishedItinerary = await Promise.all(finalItinerary.map(async (item) => {
        const googleDetails = await getGoogleDetails(item.place_id);
        
        // 1. Better Description
        let bestDescription = item.aiDescription;
        if (googleDetails?.editorial_summary?.overview) bestDescription = googleDetails.editorial_summary.overview;
        else if (googleDetails?.reviews?.[0]?.text) bestDescription = googleDetails.reviews[0].text.substring(0, 150) + "...";

        // 2. REAL PRICE CHECK
        let finalTicketPrice = item.activityCost; 
        let priceSource = "Estimated (Google)";

        if (googleDetails?.reviews) {
            const commonPrice = findMostCommonPrice(googleDetails.reviews);
            if (commonPrice) {
                finalTicketPrice = commonPrice * people;
                priceSource = `Verified from Reviews (~₹${commonPrice}/person)`;
                console.log(`   💰 Updated price for ${item.name}: ₹${commonPrice}`);
            }
        }

        return { 
            ...item, 
            description: bestDescription,
            activityCost: finalTicketPrice,
            totalOptionCost: finalTicketPrice + item.travelCost,
            costNote: priceSource
        };
    }));

    res.json({ 
        itinerary: polishedItinerary, 
        totalCost: polishedItinerary.length > 0 ? polishedItinerary[0].totalOptionCost : 0, 
        budget, 
        people,
        aiSummary: "Trip options generated." 
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});