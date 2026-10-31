const { isIP } = require('node:net');

const LIMITS = Object.freeze({
  requestMs: 30000, providerMs: 8000, callsPerRequest: 40,
  candidates: 10, results: 6, concurrentProviders: 8,
  callsPerWindow: 1000, windowMs: 15 * 60 * 1000,
  photoBytes: 4 * 1024 * 1024, jsonBytes: 1024 * 1024, redirects: 3,
});

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const invalid = name => new HttpError(400, 'INVALID_INPUT', `Invalid ${name}`);
const unavailable = () => new HttpError(502, 'PROVIDER_UNAVAILABLE', 'External provider unavailable');

function numeric(value, name, min, max, { fallback, integer = false } = {}) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'number' && typeof value !== 'string') throw invalid(name);
  if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) throw invalid(name);
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isInteger(result))) throw invalid(name);
  return result;
}

function bodyObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('JSON body');
  return body;
}

function proxyTrust(value = '') {
  const addresses = value.split(',').map(s => s.trim()).filter(Boolean);
  if (addresses.some(ip => !isIP(ip))) throw new Error('TRUSTED_PROXY_IPS must contain only exact IP addresses');
  // No hop counts or broad subnet aliases. Only explicitly verified ingress addresses.
  return address => addresses.includes(address) || addresses.includes(address.replace(/^::ffff:/, ''));
}

function providerError(error, signal) {
  if (signal?.aborted) return signal.reason;
  if (error instanceof HttpError) return error;
  const status = error?.response?.status || error?.status;
  if (['ETIMEDOUT', 'ECONNABORTED'].includes(error?.code) || error?.name === 'TimeoutError') {
    return new HttpError(504, 'PROVIDER_TIMEOUT', 'External provider timed out');
  }
  if (status === 429) return new HttpError(503, 'PROVIDER_QUOTA', 'External provider quota exhausted; try again later');
  if (status === 401 || status === 403) return new HttpError(502, 'PROVIDER_AUTH', 'External provider authentication failed');
  return unavailable();
}

function googleStatus(data) {
  if (!data || typeof data !== 'object') throw unavailable();
  switch (data.status) {
    case 'OK': return data;
    case 'ZERO_RESULTS': return data;
    case 'OVER_QUERY_LIMIT':
    case 'OVER_DAILY_LIMIT': throw new HttpError(503, 'PROVIDER_QUOTA', 'External provider quota exhausted; try again later');
    case 'REQUEST_DENIED': throw new HttpError(502, 'PROVIDER_AUTH', 'External provider authentication failed');
    // A rejected server-generated provider request is not necessarily the user's fault.
    case 'INVALID_REQUEST': throw new HttpError(502, 'PROVIDER_REQUEST', 'External provider rejected the request');
    default: throw unavailable();
  }
}

// Logs deliberately exclude raw error messages, request values, headers, URLs and response bodies.
function safeLog(event, error) {
  console.warn(JSON.stringify({ event, code: error instanceof HttpError ? error.code : 'INTERNAL_ERROR',
    status: error instanceof HttpError ? error.status : 500 }));
}

let active = 0;
let windowStart = Date.now();
let windowCalls = 0;
function createContext(req, res, maxCalls = LIMITS.callsPerRequest) {
  const controller = new AbortController();
  let calls = 0;
  const deadline = setTimeout(() => controller.abort(new HttpError(504, 'REQUEST_TIMEOUT', 'Request timed out')), LIMITS.requestMs);
  const disconnected = () => {
    if (!res.writableFinished) controller.abort(new HttpError(499, 'CLIENT_CLOSED', 'Client disconnected'));
  };
  req.once('aborted', disconnected);
  res.once('close', disconnected);
  const check = () => { if (controller.signal.aborted) throw controller.signal.reason; };
  const consume = () => {
    check();
    if (calls >= maxCalls) throw new HttpError(503, 'REQUEST_BUDGET', 'Request provider limit reached');
    if (Date.now() - windowStart >= LIMITS.windowMs) { windowStart = Date.now(); windowCalls = 0; }
    if (windowCalls >= LIMITS.callsPerWindow) throw new HttpError(503, 'SERVICE_BUDGET', 'Service request limit reached; try again later');
    calls += 1;
    windowCalls += 1;
  };
  return {
    signal: controller.signal, check, consume,
    async run(operation) {
      consume();
      if (active >= LIMITS.concurrentProviders) throw new HttpError(503, 'SERVICE_BUSY', 'Service busy; try again later');
      active += 1;
      const child = new AbortController();
      const parentAbort = () => child.abort(controller.signal.reason);
      controller.signal.addEventListener('abort', parentAbort, { once: true });
      const timer = setTimeout(() => child.abort(new HttpError(504, 'PROVIDER_TIMEOUT', 'External provider timed out')), LIMITS.providerMs);
      let onAbort;
      // A timed-out adapter that ignores abort must not free capacity for more live work.
      const work = Promise.resolve().then(() => { check(); return operation(child.signal); });
      const release = () => { active -= 1; };
      work.then(release, release);
      try {
        const aborted = new Promise((resolve, reject) => {
          onAbort = () => reject(child.signal.reason);
          child.signal.addEventListener('abort', onAbort, { once: true });
        });
        return await Promise.race([work, aborted]);
      } catch (error) {
        throw providerError(error, child.signal);
      } finally {
        clearTimeout(timer);
        child.signal.removeEventListener('abort', onAbort);
        controller.signal.removeEventListener('abort', parentAbort);
      }
    },
    close() {
      clearTimeout(deadline);
      req.removeListener('aborted', disconnected);
      res.removeListener('close', disconnected);
      controller.abort(new HttpError(499, 'REQUEST_FINISHED', 'Request finished'));
    },
  };
}

function route(handler, maxCalls) {
  return (req, res, next) => {
    const context = createContext(req, res, maxCalls);
    Promise.resolve().then(() => handler(req, res, context)).catch(next).finally(() => context.close());
  };
}

async function googleJSON(axios, url, context) {
  return context.run(async signal => {
    const response = await axios.get(url, {
      signal, timeout: LIMITS.providerMs, maxRedirects: 0,
      maxContentLength: LIMITS.jsonBytes, maxBodyLength: LIMITS.jsonBytes,
    });
    return googleStatus(response.data);
  });
}

function photoDestination(value, base) {
  let url;
  try { url = new URL(value, base); } catch { throw unavailable(); }
  const allowed = url.hostname === 'maps.googleapis.com' || /^lh[3-6]\.googleusercontent\.com$/.test(url.hostname);
  if (url.protocol !== 'https:' || !allowed || url.username || url.password || (url.port && url.port !== '443')) throw unavailable();
  return url;
}

function imageMatches(buffer, type) {
  if (type === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString());
  if (type === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  return false;
}

async function photoImage(axios, initialUrl, context) {
  return context.run(async signal => {
    let url = photoDestination(initialUrl);
    for (let redirects = 0; redirects <= LIMITS.redirects; redirects += 1) {
      context.check();
      if (signal.aborted) throw signal.reason;
      const response = await axios.get(url.toString(), {
        responseType: 'stream', signal, timeout: LIMITS.providerMs,
        maxRedirects: 0, maxContentLength: LIMITS.photoBytes,
        validateStatus: status => status >= 200 && status < 400,
      }).catch(error => {
        const failedStream = error?.response?.data;
        if (typeof failedStream?.destroy === 'function') {
          failedStream.on('error', () => {});
          failedStream.destroy();
        }
        if (error?.response?.status === 404) throw new HttpError(404, 'NO_RESULTS', 'Photo not found');
        throw error;
      });
      const stream = response.data;
      // Install the listener immediately, including redirect and rejected-content paths.
      const streamError = () => {};
      stream.on('error', streamError);
      const stop = () => stream.destroy();
      signal.addEventListener('abort', stop, { once: true });
      try {
        if (signal.aborted) throw signal.reason;
        if ([301,302,303,307,308].includes(response.status)) {
          if (redirects === LIMITS.redirects || !response.headers.location) throw unavailable();
          const destination = photoDestination(response.headers.location, url);
          // A redirected URL must not carry our API credential, even to an allowed CDN.
          if (destination.searchParams.has('key') || destination.toString().includes(process.env.GOOGLE_API_KEY)) throw unavailable();
          context.consume();
          url = destination;
          continue;
        }
        if (response.status !== 200) throw unavailable();
        const type = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (!['image/jpeg','image/png','image/webp','image/gif'].includes(type)) throw unavailable();
        const length = response.headers['content-length'];
        if (length !== undefined && (!/^\d+$/.test(String(length)) || Number(length) > LIMITS.photoBytes)) throw unavailable();
        let size = 0;
        const chunks = [];
        // Buffer only up to 4 MiB before sending: no partial/error content is cached or served.
        for await (const chunk of stream) {
          if (signal.aborted) throw signal.reason;
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += bytes.length;
          if (size > LIMITS.photoBytes) throw unavailable();
          chunks.push(bytes);
        }
        if (signal.aborted) throw signal.reason;
        if (length !== undefined && Number(length) !== size) throw unavailable();
        const bytes = Buffer.concat(chunks);
        if (!imageMatches(bytes, type)) throw unavailable();
        return { bytes, type };
      } finally {
        signal.removeEventListener('abort', stop);
        // Keep the error listener until close; destroy may emit asynchronously.
        stream.once('close', () => stream.removeListener('error', streamError));
        stream.destroy();
      }
    }
    throw unavailable();
  });
}

module.exports = { LIMITS, HttpError, invalid, unavailable, numeric, bodyObject, proxyTrust,
  providerError, googleStatus, safeLog, createContext, route, googleJSON, photoImage, photoDestination };
