require('dotenv').config();
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// City to coordinates mapping
const cityCoordinates = {
  mumbai: "19.0760,72.8777",
  delhi: "28.6139,77.2090",
  bangalore: "12.9716,77.5946",
  thrissur: "10.5276,76.2144",
  chennai: "13.0827,80.2707",
  hyderabad: "17.3850,78.4867",
  // Add more cities as needed
};

// GET route for root
app.get('/', (req, res) => {
  res.send('Welcome to the Smart Itinerary API! Use POST /api/itinerary to generate an itinerary.');
});

// GET route for /api/itinerary
app.get('/api/itinerary', (req, res) => {
  res.json({ message: 'Please use POST to submit your itinerary request.' });
});

// Helper to get coordinates from map or geocoding API
async function resolveLocation(location) {
  // If already in lat,lng format, return as is
  if (/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/.test(location)) {
    return location;
  }
  // Try cityCoordinates map
  const mapped = cityCoordinates[location.trim().toLowerCase()];
  if (mapped) {
    return mapped;
  }
  // Use Geocoding API
  const apiKey = process.env.GOOGLE_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)},India&key=${apiKey}`;
  const response = await axios.get(url);
  if (response.data.results && response.data.results.length > 0) {
    const { lat, lng } = response.data.results[0].geometry.location;
    return `${lat},${lng}`;
  } else {
    throw new Error('City not found');
  }
}

// Example endpoint for itinerary generation (Google Places API)
app.post('/api/itinerary', async (req, res) => {
  let { budget, people = 2, location, radius = 5000, hasPrivateVehicle = false, filters = [] } = req.body;

  try {
    location = await resolveLocation(location);

    let allResults = [];
    // For each filter (e.g., 'restaurant', 'park'), fetch places from Google Places API
    for (const filter of filters) {
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: {
          location, // e.g., "19.0760,72.8777"
          radius,   // in meters
          type: filter, // e.g., "restaurant", "park", etc.
          key: process.env.GOOGLE_API_KEY
        }
      });
      if (response.data && response.data.results) {
        // Tag each result with its filter type
        const taggedResults = response.data.results.map(place => ({ ...place, filterType: filter }));
        allResults = allResults.concat(taggedResults);
      }
    }

    // Remove duplicates by place_id
    const uniqueResults = Object.values(
      allResults.reduce((acc, place) => {
        acc[place.place_id] = place;
        return acc;
      }, {})
    );

    // Estimate cost for each place (placeholder logic)
    const itinerary = uniqueResults.slice(0, 5).map(place => {
      let estimatedCost = 0;
      if (place.filterType === 'restaurant') {
        estimatedCost = 400 * people; // Example: 400 per person for food
      } else if (place.filterType === 'movie_theater') {
        estimatedCost = 250 * people; // Example: 250 per ticket
      } else {
        estimatedCost = 200 * people; // Example: 200 per person for other activities
      }
      return {
        name: place.name,
        address: place.vicinity,
        type: place.filterType,
        estimatedCost,
        location: place.geometry && place.geometry.location,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total
      };
    });

    // Calculate total cost
    const totalCost = itinerary.reduce((sum, item) => sum + item.estimatedCost, 0);

    // Return the itinerary
    res.json({ itinerary, totalCost, budget, people });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate itinerary', details: error.message });
  }
});

app.get('/api/places', async (req, res) => {
  let { location, radius = 5000, type = 'restaurant', keyword } = req.query;
  try {
    location = await resolveLocation(location);

    const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
      params: {
        location,
        radius,
        type,
        keyword,
        key: process.env.GOOGLE_API_KEY
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch places', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});