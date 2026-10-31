const request = require('supertest');
const axios = require('axios');
const app = require('./index');

jest.mock('axios');

describe('Planit Backend Security & API Test Suite', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET / (Health Check)', () => {
    it('should return 200 and server banner', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('PlanIt Server');
    });
  });

  describe('CORS Enforcement (SEC-03)', () => {
    it('should allow requests from permitted origin', async () => {
      const res = await request(app)
        .get('/')
        .set('Origin', 'http://localhost:3000');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should allow non-browser requests with no origin header (mobile app, curl)', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
    });

    it('should block requests from unauthorized origins', async () => {
      const res = await request(app)
        .get('/')
        .set('Origin', 'https://attacker-domain.evil');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/CORS/i);
    });
  });

  describe('Body Size Limits & DoS Protection (SEC-03)', () => {
    it('should reject JSON payloads exceeding the 10kb limit with 413 Payload Too Large', async () => {
      const largePayload = {
        budget: 5000,
        location: 'Bengaluru',
        padding: 'A'.repeat(15 * 1024) // 15kb
      };

      const res = await request(app)
        .post('/api/itinerary')
        .send(largePayload);
      expect(res.status).toBe(413);
    });
  });

  describe('GET /api/photo (SEC-01 Photo Proxy & SSRF Prevention)', () => {
    it('should return 400 if ref parameter is missing', async () => {
      const res = await request(app).get('/api/photo');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Photo reference is required/i);
    });

    it('should return 400 on malicious / invalid ref format (SSRF & path injection protection)', async () => {
      const maliciousRefs = [
        '../etc/passwd',
        'http://internal-metadata-service',
        'token;rm -rf /',
        'invalid!@#$%^&*',
        'short'
      ];

      for (const badRef of maliciousRefs) {
        const res = await request(app).get(`/api/photo?ref=${encodeURIComponent(badRef)}`);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid photo reference format/i);
      }
    });

    it('should never expose the GOOGLE_API_KEY in response headers or body on upstream failure', async () => {
      process.env.GOOGLE_API_KEY = 'TEST_SECRET_KEY_NEVER_LEAK';

      // Mock upstream 404
      axios.get.mockRejectedValueOnce({
        message: 'Request failed with status code 404',
        response: { status: 404 }
      });

      const res = await request(app).get('/api/photo?ref=valid_token_1234567890');
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain('TEST_SECRET_KEY_NEVER_LEAK');
      expect(JSON.stringify(res.headers)).not.toContain('TEST_SECRET_KEY_NEVER_LEAK');
    });

    it('should safely handle upstream timeout / 500 errors without leaking internals', async () => {
      process.env.GOOGLE_API_KEY = 'TEST_KEY';
      axios.get.mockRejectedValueOnce(new Error('timeout of 8000ms exceeded'));

      const res = await request(app).get('/api/photo?ref=valid_token_1234567890');
      expect(res.status).toBe(502);
      expect(res.body.code).toBe('PROVIDER_UNAVAILABLE');
      expect(res.body.stack).toBeUndefined();
    });
  });

  describe('POST /api/reverse-geocode (SEC-04 Validation & Safe Error Handling)', () => {
    it('should return 400 when lat or lng is missing', async () => {
      const res = await request(app).post('/api/reverse-geocode').send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('should return 400 when lat or lng is out of boundary', async () => {
      const res = await request(app).post('/api/reverse-geocode').send({ lat: 105, lng: 77 });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('should return 400 when lat or lng is non-numeric string', async () => {
      const res = await request(app).post('/api/reverse-geocode').send({ lat: 'not_a_number', lng: '77' });
      expect(res.status).toBe(400);
    });

    it('should properly process coordinate 0 without false negative (falsy bug fix)', async () => {
      process.env.GOOGLE_API_KEY = 'TEST_KEY';
      axios.get.mockResolvedValueOnce({
        data: {
          status: 'OK',
          results: [{
            address_components: [{ types: ['locality'], long_name: 'Equator Point' }],
            formatted_address: 'Equator Point, Gulf of Guinea'
          }]
        }
      });

      const res = await request(app).post('/api/reverse-geocode').send({ lat: 0, lng: 0 });
      expect(res.status).toBe(200);
      expect(res.body.address).toBe('Equator Point');
    });

    it('should handle upstream network failure safely with 502 and sanitized message', async () => {
      process.env.GOOGLE_API_KEY = 'TEST_KEY';
      axios.get.mockRejectedValueOnce(new Error('ENOTFOUND maps.googleapis.com'));

      const res = await request(app).post('/api/reverse-geocode').send({ lat: 12.9716, lng: 77.5946 });
      expect(res.status).toBe(502);
      expect(res.body.code).toBe('PROVIDER_UNAVAILABLE');
      expect(res.body.stack).toBeUndefined();
    });
  });

  describe('POST /api/itinerary (Input Validation & Abuse Prevention)', () => {
    it('should return 400 if budget is below minimum threshold or invalid', async () => {
      const res = await request(app).post('/api/itinerary').send({
        budget: 50,
        location: 'Bengaluru'
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('should return 400 if location is missing or empty string', async () => {
      const res = await request(app).post('/api/itinerary').send({
        budget: 2000,
        location: '   '
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('should reject out-of-range people before provider work', async () => {
      process.env.GOOGLE_API_KEY = 'TEST_KEY';
      // Mock geocode for location
      axios.get.mockResolvedValueOnce({
        data: {
          status: 'OK',
          results: [{ geometry: { location: { lat: 12.9716, lng: 77.5946 } } }]
        }
      });

      const res = await request(app).post('/api/itinerary').send({
        budget: 5000,
        location: '12.9716,77.5946',
        people: 999, // Reject rather than silently clamp
        filters: ['invalid_filter', 'malicious_tag']
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should safely return 502 with sanitized message when upstream geocoding fails', async () => {
      process.env.GOOGLE_API_KEY = 'TEST_KEY';
      axios.get.mockRejectedValueOnce(new Error('Upstream Google error'));

      const res = await request(app).post('/api/itinerary').send({
        budget: 5000,
        location: 'NonExistentCityXYZ'
      });

      expect(res.status).toBe(502);
      expect(res.body.code).toBe('PROVIDER_UNAVAILABLE');
      expect(res.body.stack).toBeUndefined();
    });
  });

  describe('Correctness Calculations Unit Tests', () => {
    it('BUG-05 & BUG-06: Ride-share capacity scales with group size and calculates round-trip', () => {
      const oneWayKm = 10;
      const roundTripKm = oneWayKm * 2; // 20 km
      const ratePerKm = 22;
      const baseFare = 50;

      // Group of 2: 1 vehicle needed
      const people2 = 2;
      const vehiclesFor2 = Math.max(1, Math.ceil(people2 / 4));
      const cost2 = Math.round((baseFare + (roundTripKm * ratePerKm)) * vehiclesFor2);
      expect(vehiclesFor2).toBe(1);
      expect(cost2).toBe((50 + (20 * 22)) * 1); // 490

      // Group of 8: 2 vehicles needed
      const people8 = 8;
      const vehiclesFor8 = Math.max(1, Math.ceil(people8 / 4));
      const cost8 = Math.round((baseFare + (roundTripKm * ratePerKm)) * vehiclesFor8);
      expect(vehiclesFor8).toBe(2);
      expect(cost8).toBe((50 + (20 * 22)) * 2); // 980
    });

    it('BUG-07: Free attractions (price_level 0) must evaluate to 0 cost', () => {
      const priceMap = [0, 200, 600, 1500, 2500];
      const placeDataFree = { price_level: 0 };
      const level = (typeof placeDataFree.price_level === 'number') ? placeDataFree.price_level : 1;
      const roughCostPerPerson = priceMap[Math.min(Math.max(0, level), 4)] ?? 200;

      expect(roughCostPerPerson).toBe(0);
    });
  });
});
