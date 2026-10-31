const request = require('supertest');
const http = require('node:http');
const { Readable, PassThrough } = require('node:stream');
const { EventEmitter } = require('node:events');
jest.mock('axios');
jest.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: jest.fn() }));

const basic = { budget: 5000, location: '12.97,77.59' };
const photoPath = '/api/photo?ref=valid_reference_12345';
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const response = (data, status = 200) => ({ status, data });
const photoResponse = (data = jpeg, type = 'image/jpeg', extra = {}) => ({
  status: 200, headers: { 'content-type': type, ...extra }, data: Readable.from([data]),
});
const place = { name: 'Free Park', place_id: 'p1', geometry: { location: { lat: 12.971, lng: 77.591 } },
  price_level: 0, types: ['park'], photos: [{ photo_reference: 'valid_reference_12345' }] };
let app, axios, security, generate;
function appWithAI() {
  process.env.GEMINI_API_KEY = 'synthetic-ai-placeholder';
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  GoogleGenerativeAI.mockImplementation(() => ({ getGenerativeModel: () => ({ generateContent: generate }) }));
  delete require.cache[require.resolve('./index')];
  return require('./index');
}
function happyGoogle(url) {
  if (url.includes('/directions/')) return response({ status: 'OK', routes: [{ legs: [{ distance: { value: 10000, text: '10 km' }, duration: { text: '20 mins' } }] }] });
  if (url.includes('/details/')) return response({ status: 'OK', result: {} });
  if (url.includes('/geocode/')) return response({ status: 'OK', results: [{ geometry: { location: { lat: 12.97, lng: 77.59 } }, address_components: [], formatted_address: 'Mock City' }] });
  return response({ status: 'OK', results: [place] });
}
beforeEach(() => {
  jest.resetModules();
  app = null;
  process.env.GEMINI_API_KEY = '';
  process.env.GOOGLE_API_KEY = 'synthetic-google-placeholder';
  process.env.TRUSTED_PROXY_IPS = '';
  axios = require('axios');
  axios.get.mockReset();
  generate = jest.fn();
  security = require('./security');
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
function load() { app = require('./index'); return app; }

describe('strict request validation and process survival', () => {
  test.each([{}, [], null, true, '', '1x', 'NaN', 'Infinity', '1e999', { toString: null }])('rejects malformed budget %j', async budget => {
    const res = await request(load()).post('/api/itinerary').send({ ...basic, budget });
    expect(res.status).toBe(400);
    expect(axios.get).not.toHaveBeenCalled();
    expect((await request(app).get('/')).status).toBe(200);
  });
  test.each([['budget', 99], ['budget',10000001], ['budget',1.1], ['people',0], ['people',51], ['people',1.5],
    ['radius',999], ['radius',50001], ['radius',1000.5], ['mileage',4], ['mileage',61], ['mileage',{}],
    ['hasPrivateVehicle','false'], ['filters',{}]])('rejects invalid %s=%j', async (key, value) => {
    expect((await request(load()).post('/api/itinerary').send({ ...basic, [key]: value })).status).toBe(400);
    expect(axios.get).not.toHaveBeenCalled();
  });
  test.each(['lat','lng'])('rejects missing or malformed %s', async field => {
    for (const value of [undefined, null, [1], { toString: null }, '12junk', 'Infinity', field === 'lat' ? 91 : 181]) {
      const res = await request(app || load()).post('/api/reverse-geocode').send({ lat:0,lng:0,[field]:value });
      expect(res.status).toBe(400);
    }
    expect(axios.get).not.toHaveBeenCalled();
  });
  test.each(['maxwidth[toString]=x','maxwidth[]=800','maxwidth=abc','maxwidth=99','maxwidth=1601','maxwidth=1.5','maxwidth=Infinity'])('rejects photo width %s', async query => {
    expect((await request(load()).get(`${photoPath}&${query}`)).status).toBe(400);
    expect(axios.get).not.toHaveBeenCalled();
  });
  test('numeric helper rejects non-finite JavaScript values', () => {
    for (const value of [Infinity,-Infinity,NaN]) expect(() => security.numeric(value,'number',0,100)).toThrow();
  });
  test('missing mandatory fields and invalid coordinate location reject without provider calls', async () => {
    load();
    for (const body of [{}, { budget:1000 }, { location:'City' }, { ...basic,location:'91,181' }]) {
      expect((await request(app).post('/api/itinerary').send(body)).status).toBe(400);
    }
    expect(axios.get).not.toHaveBeenCalled();
  });
  test('malformed JSON and oversized body return safe parser errors', async () => {
    const a=await request(load()).post('/api/itinerary').set('Content-Type','application/json').send('{"sensitive":');
    expect(a.status).toBe(400);expect(a.text).not.toContain('sensitive');
    expect((await request(app).post('/api/itinerary').send({ text:'x'.repeat(12000) })).status).toBe(413);
  });
});

describe('photo proxy', () => {
  test('valid bounded image is served without provider headers or credentials', async () => {
    axios.get.mockResolvedValue(photoResponse());
    const res=await request(load()).get(photoPath);
    expect(res.status).toBe(200);expect(res.body).toEqual(jpeg);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('private, max-age=300');
    expect(JSON.stringify(res.headers)).not.toContain(process.env.GOOGLE_API_KEY);
    expect(axios.get.mock.calls[0][1].maxRedirects).toBe(0);
  });
  test.each(['text/html','image/svg+xml','application/octet-stream'])('rejects content type %s', async type => {
    const upstream=photoResponse('<script>marker</script>',type);axios.get.mockResolvedValue(upstream);
    const res=await request(load()).get(photoPath);
    expect(res.status).toBe(502);expect(res.text).not.toContain('marker');expect(upstream.data.destroyed).toBe(true);
    expect(res.headers['cache-control']).toBe('no-store');
  });
  test('rejects HTML disguised as JPEG',async()=>{
    axios.get.mockResolvedValue(photoResponse('<script>bad</script>'));
    expect((await request(load()).get(photoPath)).status).toBe(502);
  });
  test.each([true,false])('rejects oversized image with content-length=%s',async declared=>{
    const data=Buffer.alloc(security.LIMITS.photoBytes+1);
    axios.get.mockResolvedValue(photoResponse(data,'image/jpeg',declared?{'content-length':String(data.length)}:{}));
    expect((await request(load()).get(photoPath)).status).toBe(502);
  });
  test('stream failure after chunks is handled before sending headers',async()=>{
    const upstream=new Readable({read(){this.push(jpeg);this.destroy(new Error('sensitive upstream failure'));}});
    axios.get.mockResolvedValue({status:200,headers:{'content-type':'image/jpeg'},data:upstream});
    const res=await request(load()).get(photoPath);
    expect(res.status).toBe(502);expect(res.text).not.toContain('sensitive');
    expect((await request(app).get('/')).status).toBe(200);
  });
  test.each(['http://lh3.googleusercontent.com/image','https://127.0.0.1/image','https://lh3.googleusercontent.com.evil.test/image',
    'https://user:pass@lh3.googleusercontent.com/image','https://lh3.googleusercontent.com:444/image',
    'https://lh3.googleusercontent.com/image?key=secret'])('rejects unsafe redirect %s',async location=>{
    const stream=Readable.from('redirect');axios.get.mockResolvedValue({status:302,headers:{location},data:stream});
    expect((await request(load()).get(photoPath)).status).toBe(502);
    expect(axios.get).toHaveBeenCalledTimes(1);expect(stream.destroyed).toBe(true);
  });
  test('follows only allowed HTTPS photo redirects, without credential forwarding',async()=>{
    axios.get.mockResolvedValueOnce({status:302,headers:{location:'https://lh3.googleusercontent.com/places/image'},data:Readable.from('')})
      .mockResolvedValueOnce(photoResponse());
    expect((await request(load()).get(photoPath)).status).toBe(200);
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(axios.get.mock.calls[1][0]).not.toContain(process.env.GOOGLE_API_KEY);
  });
  test('redirect loop is capped at four requests',async()=>{
    axios.get.mockImplementation(()=>Promise.resolve({status:302,headers:{location:'https://lh3.googleusercontent.com/image'},data:Readable.from('')}));
    expect((await request(load()).get(photoPath)).status).toBe(502);
    expect(axios.get).toHaveBeenCalledTimes(4);
  });
  test('client disconnect aborts upstream signal and destroys stalled stream',async()=>{
    const stream=new PassThrough();let signal;let started;
    const start=new Promise(resolve=>{started=resolve;});
    axios.get.mockImplementation((url,options)=>{signal=options.signal;started();return Promise.resolve({status:200,headers:{'content-type':'image/jpeg'},data:stream});});
    const server=load().listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const client=http.get({host:'127.0.0.1',port:server.address().port,path:photoPath});client.on('error',()=>{});
    try {
      await start;const aborted=new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
      client.destroy();await aborted;await new Promise(resolve=>setImmediate(resolve));
      expect(signal.aborted).toBe(true);expect(stream.destroyed).toBe(true);expect(axios.get).toHaveBeenCalledTimes(1);
    } finally {client.destroy();await new Promise(resolve=>server.close(resolve));}
  });
});

describe('rate limits and CORS independently',()=>{
  test('spoofed forwarding headers cannot reset the itinerary allowance',async()=>{
    load();
    for(let i=0;i<25;i++)expect((await request(app).post('/api/itinerary').set('X-Forwarded-For',`198.51.100.${i+1}`).send({})).status).toBe(400);
    const res=await request(app).post('/api/itinerary').set('X-Forwarded-For','203.0.113.8').send({});
    expect(res.status).toBe(429);expect(res.headers['retry-after']).toBeDefined();
    expect((await request(app).post('/api/itinerary').send({})).status).toBe(429);
  });
  test('general and geocode limits are enforced independently',async()=>{
    load();for(let i=0;i<50;i++)await request(app).post('/api/reverse-geocode').send({});
    expect((await request(app).post('/api/reverse-geocode').send({})).status).toBe(429);
    for(let i=0;i<99;i++)await request(app).get('/');
    expect((await request(app).get('/')).status).toBe(429);
  });
  test('only exact configured proxy IPs are trusted',()=>{
    const trust=security.proxyTrust('192.0.2.20');
    expect(trust('192.0.2.20')).toBe(true);expect(trust('::ffff:192.0.2.20')).toBe(true);expect(trust('127.0.0.1')).toBe(false);
    for(const config of ['1','true','loopback','0.0.0.0/0'])expect(()=>security.proxyTrust(config)).toThrow();
  });
  test.each([['http://localhost:3000',200],['https://attacker.test',403],['null',403]])('CORS %s -> %s',async(origin,status)=>{
    const res=await request(load()).get('/').set('Origin',origin);expect(res.status).toBe(status);
    expect(res.headers['access-control-allow-origin']).toBe(status===200?origin:undefined);
  });
  test('native/no-Origin requests and permitted preflights work',async()=>{
    expect((await request(load()).get('/')).status).toBe(200);
    expect((await request(app).options('/api/itinerary').set('Origin','http://localhost:3000').set('Access-Control-Request-Method','POST')).status).toBe(204);
  });
});

describe('provider outcomes, budgets and actual route calculations',()=>{
  test.each([['REQUEST_DENIED',502,'PROVIDER_AUTH'],['OVER_QUERY_LIMIT',503,'PROVIDER_QUOTA'],['UNKNOWN_ERROR',502,'PROVIDER_UNAVAILABLE'],['INVALID_REQUEST',502,'PROVIDER_REQUEST']])('classifies %s',async(status,httpStatus,code)=>{
    axios.get.mockResolvedValue(response({status,results:[],error_message:'synthetic-sensitive-detail'}));
    const res=await request(load()).post('/api/itinerary').send(basic);
    expect(res.status).toBe(httpStatus);expect(res.body.code).toBe(code);expect(res.text).not.toContain('sensitive');
  });
  test.each([[429,503,'PROVIDER_QUOTA'],[401,502,'PROVIDER_AUTH'],[403,502,'PROVIDER_AUTH'],[500,502,'PROVIDER_UNAVAILABLE']])('classifies HTTP %s',async(status,expected,code)=>{
    axios.get.mockRejectedValue({response:{status},message:'private-url-with-key'});
    const res=await request(load()).post('/api/reverse-geocode').send({lat:0,lng:0});
    expect(res.status).toBe(expected);expect(res.body.code).toBe(code);
    expect(JSON.stringify(console.warn.mock.calls)).not.toContain('private-url');
  });
  test('network timeout returns 504 instead of an empty success',async()=>{
    axios.get.mockRejectedValue({code:'ECONNABORTED',message:'private'});
    const res=await request(load()).post('/api/itinerary').send(basic);
    expect(res.status).toBe(504);expect(res.body.code).toBe('PROVIDER_TIMEOUT');
  });
  test('ZERO_RESULTS is a successful empty itinerary, but geocoding returns not found',async()=>{
    axios.get.mockResolvedValue(response({status:'ZERO_RESULTS',results:[]}));
    const res=await request(load()).post('/api/itinerary').send(basic);
    expect(res.status).toBe(200);expect(res.body.itinerary).toEqual([]);
    expect((await request(app).post('/api/reverse-geocode').send({lat:0,lng:0})).status).toBe(404);
  });
  test('missing Maps configuration returns 503 without any provider call',async()=>{
    process.env.GOOGLE_API_KEY='';load();
    expect((await request(app).get(photoPath)).status).toBe(503);
    expect((await request(app).post('/api/itinerary').send(basic)).status).toBe(503);
    expect(axios.get).not.toHaveBeenCalled();
  });
  test('caps AI candidates and propagates abort signal and provider timeout',async()=>{
    generate.mockResolvedValue({response:{text:()=>JSON.stringify(Array.from({length:80},(_,i)=>({name:`Place ${i}`})))}});
    axios.get.mockResolvedValue(response({status:'ZERO_RESULTS',results:[]}));
    const res=await request(appWithAI()).post('/api/itinerary').send(basic);
    expect(res.status).toBe(200);expect(axios.get).toHaveBeenCalledTimes(10);
    expect(generate.mock.calls[0][1].signal).toBeDefined();expect(generate.mock.calls[0][1].timeout).toBe(8000);
  });
  test('AI outage cannot turn into misleading empty success',async()=>{
    generate.mockRejectedValue({status:429,message:'sensitive'});
    axios.get.mockResolvedValue(response({status:'ZERO_RESULTS',results:[]}));
    const res=await request(appWithAI()).post('/api/itinerary').send(basic);
    expect(res.status).toBe(503);expect(res.body.code).toBe('PROVIDER_QUOTA');
  });
  test('actual route preserves free cost, round trip and group capacity, and ignores Host',async()=>{
    axios.get.mockImplementation(async url=>happyGoogle(url));
    const res=await request(load()).post('/api/itinerary').set('Host','attacker.test').set('X-Forwarded-Proto','http').send({...basic,people:8,mileage:null});
    expect(res.status).toBe(200);
    expect(res.body.itinerary[0]).toMatchObject({people:8,travelCost:980,roughCostPerPerson:0,costPerPerson:0,latitude:12.971,type:'park'});
    expect(res.body.itinerary[0].photoUrl).toBe('/api/photo?ref=valid_reference_12345');
    expect(res.text).not.toContain('attacker.test');
  });
  test('provider coordinates and distance must be finite and bounded',async()=>{
    axios.get.mockResolvedValue(response({status:'OK',results:[{...place,geometry:{location:{lat:Infinity,lng:1}}}]}));
    expect((await request(load()).post('/api/itinerary').send(basic)).status).toBe(502);
  });
});

describe('deadlines and spending circuit breakers',()=>{
  function context(max){const req=new EventEmitter();const res=new EventEmitter();res.writableFinished=false;return {req,res,ctx:security.createContext(req,res,max)};}
  test('request call budget prevents additional provider execution',async()=>{
    const {ctx}=context(2);const op=jest.fn().mockResolvedValue('ok');
    try {await ctx.run(op);await ctx.run(op);await expect(ctx.run(op)).rejects.toMatchObject({code:'REQUEST_BUDGET'});expect(op).toHaveBeenCalledTimes(2);}finally{ctx.close();}
  });
  test('provider timeout aborts hung operation',async()=>{
    jest.useFakeTimers();const {ctx}=context();let signal;
    const pending=ctx.run(s=>{signal=s;return new Promise(()=>{});});
    const check=expect(pending).rejects.toMatchObject({status:504,code:'PROVIDER_TIMEOUT'});
    await jest.advanceTimersByTimeAsync(8000);await check;expect(signal.aborted).toBe(true);ctx.close();
  });
  test('overall request deadline prevents later calls even with individually fast operations',async()=>{
    jest.useFakeTimers();const {ctx}=context();
    await jest.advanceTimersByTimeAsync(30000);
    await expect(ctx.run(jest.fn())).rejects.toMatchObject({code:'REQUEST_TIMEOUT'});ctx.close();
  });
  test('disconnect cancels pending work and prevents fallback calls',async()=>{
    const {ctx,res}=context();let signal;
    const pending=ctx.run(s=>{signal=s;return new Promise(()=>{});});
    await Promise.resolve();res.emit('close');
    await expect(pending).rejects.toMatchObject({code:'CLIENT_CLOSED'});expect(signal.aborted).toBe(true);
    const more=jest.fn();await expect(ctx.run(more)).rejects.toMatchObject({code:'CLIENT_CLOSED'});expect(more).not.toHaveBeenCalled();ctx.close();
  });
  test('concurrent provider operations have a process-wide cap',async()=>{
    const contexts=Array.from({length:9},()=>context());const releases=[];
    const pending=contexts.slice(0,8).map(({ctx})=>ctx.run(()=>new Promise(resolve=>releases.push(resolve))));
    await Promise.resolve();
    await expect(contexts[8].ctx.run(jest.fn())).rejects.toMatchObject({code:'SERVICE_BUSY'});
    releases.forEach(resolve=>resolve('ok'));await Promise.all(pending);contexts.forEach(({ctx})=>ctx.close());
  });
  test('process-wide fixed-window call budget cannot be bypassed by new requests',async()=>{
    for(let i=0;i<1000;i++){const {ctx}=context(1);await ctx.run(async()=>true);ctx.close();}
    const {ctx}=context(1);const op=jest.fn();await expect(ctx.run(op)).rejects.toMatchObject({code:'SERVICE_BUDGET'});expect(op).not.toHaveBeenCalled();ctx.close();
  });
});

describe('additional provider regressions', () => {
  test('stalled photo stream is destroyed on provider deadline', async () => {
    jest.useFakeTimers();
    const stream = new PassThrough();
    axios.get.mockResolvedValue({ status:200, headers:{'content-type':'image/jpeg'}, data:stream });
    const req=new EventEmitter();const res=new EventEmitter();
    const ctx=security.createContext(req,res);
    const pending=security.photoImage(axios,'https://maps.googleapis.com/photo',ctx);
    const checked=expect(pending).rejects.toMatchObject({code:'PROVIDER_TIMEOUT'});
    await jest.advanceTimersByTimeAsync(8000);await checked;
    expect(stream.destroyed).toBe(true);ctx.close();
  });
  test('AI pricing failure returns an explicit warning and preserves a usable estimated itinerary',async()=>{
    generate.mockRejectedValue({status:429,message:'private'});
    axios.get.mockImplementation(async url=>happyGoogle(url));
    const res=await request(appWithAI()).post('/api/itinerary').send(basic);
    expect(res.status).toBe(200);expect(res.body.itinerary.length).toBeGreaterThan(0);
    expect(res.body.warnings).toEqual(expect.arrayContaining([expect.objectContaining({code:'PROVIDER_QUOTA'})]));
    expect(res.body.itinerary[0].costConfidence).toBe('low');
  });
  test('actual route rejects invalid provider distance',async()=>{
    axios.get.mockImplementation(async url=>url.includes('/directions/') ? response({status:'OK',routes:[{legs:[{distance:{value:-1,text:'bad'},duration:{text:'bad'}}]}]}) : happyGoogle(url));
    expect((await request(load()).post('/api/itinerary').send(basic)).status).toBe(502);
  });
  test('provider fan-out remains sequential and below per-request budget',async()=>{
    let activeCalls=0;let maximum=0;
    axios.get.mockImplementation(async url=>{
      activeCalls+=1;maximum=Math.max(maximum,activeCalls);
      await new Promise(resolve=>setImmediate(resolve));activeCalls-=1;
      return happyGoogle(url);
    });
    const res=await request(load()).post('/api/itinerary').send({...basic,filters:['adventure_sports','entertainment','nature_park','restaurant']});
    expect(res.status).toBe(200);expect(maximum).toBe(1);expect(axios.get.mock.calls.length).toBeLessThanOrEqual(40);
  });
  test('photo endpoint shares general IP cap even when references are invalid',async()=>{
    load();for(let i=0;i<150;i++)await request(app).get('/api/photo');
    expect((await request(app).get('/api/photo').set('X-Forwarded-For','203.0.113.9')).status).toBe(429);
    expect(axios.get).not.toHaveBeenCalled();
  });
});

test('rejected photo HTTP response destroys its body stream',async()=>{
  const stream=new PassThrough();
  axios.get.mockRejectedValue({response:{status:404,data:stream},message:'private'});
  expect((await request(load()).get(photoPath)).status).toBe(404);
  expect(stream.destroyed).toBe(true);
});

test('a provider ignoring cancellation cannot create unbounded live operations',async()=>{
  jest.useFakeTimers();
  const contexts=Array.from({length:9},()=>security.createContext(new EventEmitter(),new EventEmitter()));
  const releases=[];
  const pending=contexts.slice(0,8).map(ctx=>ctx.run(()=>new Promise(resolve=>releases.push(resolve))));
  const settled=Promise.allSettled(pending);
  await jest.advanceTimersByTimeAsync(8000);await settled;
  await expect(contexts[8].run(jest.fn())).rejects.toMatchObject({code:'SERVICE_BUSY'});
  releases.forEach(resolve=>resolve());await Promise.resolve();await Promise.resolve();
  await expect(contexts[8].run(async()=>true)).resolves.toBe(true);
  contexts.forEach(ctx=>ctx.close());
});
