async function getCoordinates(city) {
  const apiKey = 'YOUR_GOOGLE_API_KEY';
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)},India&key=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.results && data.results.length > 0) {
    return data.results[0].geometry.location; // { lat, lng }
  } else {
    throw new Error('City not found');
  }
}

async function handleUserInput(city, type) {
  try {
    const coords = await getCoordinates(city);
    const places = await getNearbyPlaces(coords.lat, coords.lng, type);
    // ...rest of your logic...
  } catch (err) {
    console.error(err);
    // Show error to user
  }
}