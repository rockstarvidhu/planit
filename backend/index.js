require('dotenv').config();
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Initialize AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Root route
app.get('/', (req, res) => {
  res.send('✅ Server is running! Use POST /api/itinerary to get data.');
});

// Helper: Smart Location Resolver
async function resolveLocation(location) {
  if (/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/.test(location)) {
    return location;
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.GOOGLE_API_KEY}`;
  const response = await axios.get(url);
  if (response.data.status === 'OK' && response.data.results.length > 0) {
    const { lat, lng } = response.data.results[0].geometry.location;
    return `${lat},${lng}`;
  }
  throw new Error('City not found');
}

app.post('/api/itinerary', async (req, res) => {
  console.log("\n🚀 AI Agent searching for:", req.body.location);
  let { budget, people = 2, location, radius = 5000, filters = [], hasPrivateVehicle } = req.body;

  try {
    const startLocation = await resolveLocation(location);
    const startCoords = startLocation; 

    // --- STEP 1: Ask AI for "Hidden Gems" ---
    console.log("   🤖 Consulting AI for best spots...");
    
    // FIX: Switched to 'gemini-pro' which is the stable standard model
    // You can also try 'gemini-1.5-flash-latest' if you want speed
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    
    const prompt = `
      Act as a local travel expert. I am in coordinates: ${startCoords} (Radius: ${parseInt(radius)/1000}km).
      I want 4 specific places matching these vibes: ${filters.join(", ")}.
      
      Rules:
      1. Give me ACTUAL place names (e.g. "Vilangan Hills", "Peechi Dam", "Cheppara").
      2. Prioritize "Hidden Gems", nature spots, or highly rated places nearby.
      3. Return ONLY a raw JSON array of strings. No markdown. 
      
      Example format: ["Place A", "Place B", "Place C", "Place D"]
    `;

    const aiResult = await model.generateContent(prompt);
    const aiText = aiResult.response.text().replace(/```json|```/g, '').trim(); 
    
    let placeNames = [];
    try {
        placeNames = JSON.parse(aiText);
    } catch (e) {
        console.error("AI JSON Parse Error:", aiText);
        // Fallback if AI chats instead of returning JSON
        placeNames = [filters[0] || "Park"]; 
    }
    
    console.log("   ✨ AI Suggested:", placeNames);

    let itinerary = [];
    let totalTripCost = 0;

    // --- STEP 2: Verify & Locate with Google Maps ---
    for (const placeName of placeNames) {
      console.log(`   📍 Locating "${placeName}"...`);
      
      const mapUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(placeName)}&location=${startCoords}&radius=${radius}&key=${process.env.GOOGLE_API_KEY}`;
      
      const response = await axios.get(mapUrl);
      const placeData = response.data.results[0];

      if (placeData) {
        let activityCost = 0;
        const multiplier = placeData.price_level ? (placeData.price_level + 1) * 300 : 150;
        activityCost = multiplier * people;

        itinerary.push({
          name: placeData.name,
          address: placeData.formatted_address,
          type: placeData.types[0], 
          location: placeData.geometry.location,
          rating: placeData.rating,
          userRatingsTotal: placeData.user_ratings_total,
          activityCost: activityCost,
          travelCost: 0,
          travelTime: '0 min'
        });
      }
    }

    // --- STEP 3: Route & Cab Costs ---
    if (itinerary.length > 0) {
      console.log("   🚖 Calculating Route...");
      
      const origin = startLocation;
      const destination = `${itinerary[itinerary.length - 1].location.lat},${itinerary[itinerary.length - 1].location.lng}`;
      const waypoints = itinerary.slice(0, -1).map(p => `${p.location.lat},${p.location.lng}`).join('|');

      const dirUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=${waypoints}&mode=driving&key=${process.env.GOOGLE_API_KEY}`;
      const dirResponse = await axios.get(dirUrl);
      
      if (dirResponse.data.routes.length > 0) {
        const legs = dirResponse.data.routes[0].legs;
        legs.forEach((leg, index) => {
          if (index < itinerary.length) {
            const distanceKm = leg.distance.value / 1000;
            const travelCost = hasPrivateVehicle ? Math.round(distanceKm * 8) : Math.round(50 + (distanceKm * 18));
            
            itinerary[index].travelCost = travelCost;
            itinerary[index].travelTime = leg.duration.text;
            totalTripCost += (travelCost + itinerary[index].activityCost);
          }
        });
      }
    }

    // --- STEP 4: The Narrative ---
    const finalNarrativePrompt = `
      Write a short, exciting 2-sentence intro for a trip to: ${itinerary.map(p => p.name).join(", ")}.
      Mention why these specific spots are great for a "${filters.join(", ")}" vibe.
    `;
    const narrativeResult = await model.generateContent(finalNarrativePrompt);
    const aiSummary = narrativeResult.response.text();

    res.json({ itinerary, totalCost: totalTripCost, budget, people, aiSummary });

  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});