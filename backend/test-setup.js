// Never load real credentials or make live provider calls in tests.
process.env.NODE_ENV = 'test';
process.env.GOOGLE_API_KEY = 'test-google-placeholder';
process.env.GEMINI_API_KEY = '';
process.env.TRUSTED_PROXY_IPS = '';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://planit-v1.vercel.app';
process.env.ROVE_PLACES_MODE = 'disabled';
process.env.ROVE_PLACES_LIVE_ENABLED = 'false';
process.env.ROVE_PLACES_ENTERPRISE_FIELDS_ENABLED = 'false';
