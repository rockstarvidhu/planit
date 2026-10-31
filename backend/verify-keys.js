require('dotenv').config();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

function sanitize(str) {
  if (!str) return '';
  let s = String(str);
  if (process.env.GOOGLE_API_KEY) s = s.split(process.env.GOOGLE_API_KEY).join('[REDACTED_GOOGLE_KEY]');
  if (process.env.GEMINI_API_KEY) s = s.split(process.env.GEMINI_API_KEY).join('[REDACTED_GEMINI_KEY]');
  return s;
}

async function verifyGemini() {
  console.log('\n--- 1. Testing Gemini API Key ---');
  if (!process.env.GEMINI_API_KEY) {
    console.log('❌ GEMINI_API_KEY is not defined in backend/.env');
    return false;
  }
  console.log('🔑 Key detected (length: ' + process.env.GEMINI_API_KEY.length + ' chars)');

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const start = Date.now();
    const result = await model.generateContent("Respond with the single word 'CONNECTED'.", { timeout: 8000 });
    result.response.text();
    const elapsed = Date.now() - start;
    console.log(`✅ Gemini 1.5 Flash: Connected successfully in ${elapsed}ms (response received)`);
    return true;
  } catch (err) {
    console.log('❌ Gemini connection failed: ' + sanitize(err.message));
    return false;
  }
}

async function verifyGoogleMaps() {
  console.log('\n--- 2. Testing Google Cloud API Key (Places, Geocoding, Directions) ---');
  if (!process.env.GOOGLE_API_KEY) {
    console.log('❌ GOOGLE_API_KEY is not defined in backend/.env');
    return false;
  }
  console.log('🔑 Key detected (length: ' + process.env.GOOGLE_API_KEY.length + ' chars)');

  let allOk = true;

  // A. Geocoding API
  try {
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=Bengaluru&key=${process.env.GOOGLE_API_KEY}`;
    const geoResp = await axios.get(geoUrl, { timeout: 8000 });
    if (geoResp.data.status === 'OK') {
      console.log('✅ Geocoding API: Working (status: OK)');
    } else {
      console.log(`❌ Geocoding API: Failed (status: ${geoResp.data.status}, message: ${sanitize(geoResp.data.error_message || 'N/A')})`);
      allOk = false;
    }
  } catch (e) {
    console.log('❌ Geocoding API network error: ' + sanitize(e.message));
    allOk = false;
  }

  // B. Places API (Text Search)
  try {
    const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=park&location=12.9716,77.5946&radius=5000&key=${process.env.GOOGLE_API_KEY}`;
    const placesResp = await axios.get(placesUrl, { timeout: 8000 });
    if (placesResp.data.status === 'OK' || placesResp.data.status === 'ZERO_RESULTS') {
      console.log('✅ Places API: Working (status: ' + placesResp.data.status + ', found ' + (placesResp.data.results?.length || 0) + ' places)');
    } else {
      console.log(`❌ Places API: Failed (status: ${placesResp.data.status}, message: ${sanitize(placesResp.data.error_message || 'N/A')})`);
      allOk = false;
    }
  } catch (e) {
    console.log('❌ Places API network error: ' + sanitize(e.message));
    allOk = false;
  }

  // C. Directions API
  try {
    const dirUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=12.9716,77.5946&destination=12.9507,77.5848&mode=driving&key=${process.env.GOOGLE_API_KEY}`;
    const dirResp = await axios.get(dirUrl, { timeout: 8000 });
    if (dirResp.data.status === 'OK') {
      const leg = dirResp.data.routes[0]?.legs[0];
      console.log(`✅ Directions API: Working (status: OK, distance: ${leg?.distance?.text}, duration: ${leg?.duration?.text})`);
    } else {
      console.log(`❌ Directions API: Failed (status: ${dirResp.data.status}, message: ${sanitize(dirResp.data.error_message || 'N/A')})`);
      allOk = false;
    }
  } catch (e) {
    console.log('❌ Directions API network error: ' + sanitize(e.message));
    allOk = false;
  }

  return allOk;
}

async function runVerification() {
  console.log('==============================================');
  console.log('  Planit API Key Verification Tool');
  console.log('==============================================');

  const geminiOk = await verifyGemini();
  const mapsOk = await verifyGoogleMaps();

  console.log('\n==============================================');
  console.log('  SUMMARY');
  console.log('==============================================');
  console.log('Gemini API:      ' + (geminiOk ? '✅ READY' : '❌ NEEDS ATTENTION'));
  console.log('Google Maps API: ' + (mapsOk ? '✅ READY' : '❌ NEEDS ATTENTION'));

  if (geminiOk && mapsOk) {
    console.log('\n🎉 Configured keys responded successfully; this does not verify revocation of old keys.');
  } else {
    console.log('\n⚠️  One or more APIs encountered errors. Check permissions in Cloud Console / AI Studio.');
  }
}

runVerification();
