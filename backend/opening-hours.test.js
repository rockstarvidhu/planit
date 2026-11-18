const { normalizeCurrentHours, evaluateVisitHours, regularHint } = require('./opening-hours');
const { generateItineraries } = require('./itinerary-engine');
const { scenarios } = require('./benchmarks/itinerary-quality');

const fetched = Date.parse('2026-01-01T08:00:00Z');
const point = (day, hour, minute = 0, month = 1, year = 2026, extra = {}) => ({
  date: { year, month, day }, hour, minute, ...extra });
const period = (open, close) => ({ open, close });
const venue = (periods, extra = {}) => ({ timeZone: { id: 'Asia/Kolkata' },
  currentOpeningHours: { periods }, ...extra });
const planAt = '2026-01-01T10:00:00+05:30';
const model = periods => normalizeCurrentHours(venue(periods), planAt, fetched);
const check = (hours, start, end) => evaluateVisitHours(hours, `2026-01-01T${start}:00+05:30`, `2026-01-01T${end}:00+05:30`);

describe('dated opening hours', () => {
  const day = model([period(point(1, 10), point(1, 13))]);
  test.each([
    ['open entire visit', '10:00', '12:00', 'open'],
    ['closed before arrival', '08:00', '09:00', 'closed'],
    ['closing during visit', '12:30', '14:00', 'closed'],
    ['opening after arrival', '09:00', '11:00', 'closed'],
    ['closing boundary', '12:00', '13:00', 'open'],
  ])('%s', (_label, start, end, expected) => {
    expect(check(day, start, end).status).toBe(expected);
  });

  test('midday break and multiple separate periods are closed during the gap', () => {
    const hours = model([period(point(1, 10), point(1, 13)), period(point(1, 18), point(1, 22))]);
    expect(check(hours, '14:00', '15:00').status).toBe('closed');
    expect(check(hours, '18:00', '19:00').status).toBe('open');
    expect(check(hours, '12:00', '19:00').status).toBe('closed');
  });

  test('overnight and midnight-crossing visits use absolute instants', () => {
    const hours = model([period(point(1, 18), point(2, 2))]);
    expect(evaluateVisitHours(hours, '2026-01-01T23:30:00+05:30',
      '2026-01-02T01:30:00+05:30').status).toBe('open');
    expect(evaluateVisitHours(hours, '2026-01-02T01:30:00+05:30',
      '2026-01-02T02:30:00+05:30').status).toBe('closed');
  });

  test('Google 24-hour no-close sentinel covers the current seven-day window only', () => {
    const hours = model([{ open: { day: 0, hour: 0, minute: 0 } }]);
    expect(check(hours, '10:00', '12:00').status).toBe('open');
    expect(evaluateVisitHours(hours, '2026-01-07T23:30:00+05:30',
      '2026-01-08T00:30:00+05:30').status).toBe('unknown');
  });

  test('explicit empty week is closed, missing schedule is unknown', () => {
    expect(model([]).status).toBe('closed');
    expect(check(model([]), '10:00', '12:00').status).toBe('closed');
    expect(normalizeCurrentHours({ timeZone: { id: 'Asia/Kolkata' } }, planAt, fetched).status).toBe('unknown');
  });

  test('special holiday closure and exceptional opening follow dated current periods', () => {
    const closed = normalizeCurrentHours(venue([], { currentOpeningHours: {
      periods: [], specialDays: [{ date: { year: 2026, month: 1, day: 1 } }] } }), planAt, fetched);
    expect(check(closed, '10:00', '12:00').status).toBe('closed');
    const open = normalizeCurrentHours(venue([period(point(1, 10), point(1, 13))], {
      currentOpeningHours: { periods: [period(point(1, 10), point(1, 13))],
        specialDays: [{ date: { year: 2026, month: 1, day: 1 } }] } }), planAt, fetched);
    expect(check(open, '10:00', '12:00').status).toBe('open');
    expect(open.specialDays).toHaveLength(1);
  });

  test('malformed periods, overlap, unknown timezone and missing hours remain unknown', () => {
    expect(model([period(point(1, 25), point(1, 26))]).status).toBe('unknown');
    expect(model([period(point(1, 10), point(1, 13)), period(point(1, 12), point(1, 14))]).status).toBe('unknown');
    expect(normalizeCurrentHours(venue([], { timeZone: { id: 'Bad/Zone' } }), planAt, fetched).status).toBe('unknown');
    expect(normalizeCurrentHours(venue([], { currentOpeningHours: undefined }), planAt, fetched).status).toBe('unknown');
  });

  test('visit outside current coverage is unknown, not closed', () => {
    const hours = model([period(point(1, 10), point(1, 13))]);
    expect(evaluateVisitHours(hours, '2026-01-08T10:00:00+05:30',
      '2026-01-08T11:00:00+05:30').status).toBe('unknown');
  });

  test('other timezone and DST transition use venue-local calendar rules', () => {
    const ny = normalizeCurrentHours({ timeZone: { id: 'America/New_York' },
      currentOpeningHours: { periods: [period(point(8, 1, 0, 3), point(8, 3, 30, 3))] } },
    '2026-03-08T01:30:00-05:00', Date.parse('2026-03-08T12:00:00Z'));
    expect(evaluateVisitHours(ny, '2026-03-08T01:30:00-05:00',
      '2026-03-08T03:20:00-04:00').status).toBe('open');
    const gap = normalizeCurrentHours({ timeZone: { id: 'America/New_York' },
      currentOpeningHours: { periods: [period(point(8, 2, 30, 3), point(8, 4, 0, 3))] } },
    '2026-03-08T03:00:00-04:00', Date.parse('2026-03-08T12:00:00Z'));
    expect(gap.status).toBe('unknown');
  });

  test('regular weekly hours are a tentative hint, including overnight and 24-hour patterns', () => {
    const regular = [period({ day: 4, hour: 18, minute: 0 }, { day: 5, hour: 2, minute: 0 })];
    expect(regularHint(regular, 'Asia/Kolkata', '2026-01-01T23:00:00+05:30',
      '2026-01-02T01:00:00+05:30')).toBe('open');
    expect(regularHint(regular, 'Asia/Kolkata', '2026-01-01T12:00:00+05:30',
      '2026-01-01T13:00:00+05:30')).toBe('closed');
    expect(regularHint([{ open: { day: 0, hour: 0, minute: 0 } }], 'Asia/Kolkata',
      '2026-01-01T12:00:00+05:30', '2026-01-01T13:00:00+05:30')).toBe('open');
    const uncertain = normalizeCurrentHours(venue(undefined, { currentOpeningHours: undefined,
      regularOpeningHours: { periods: regular } }), planAt, fetched);
    expect(evaluateVisitHours(uncertain, '2026-01-01T23:00:00+05:30',
      '2026-01-02T01:00:00+05:30')).toMatchObject({ status: 'unknown', regularSchedule: 'open' });
  });

  test('provider timeout and contradictory data never become open', () => {
    expect(evaluateVisitHours({ status: 'unknown', reason: 'PROVIDER_TIMEOUT' },
      '2026-01-01T10:00:00+05:30', '2026-01-01T11:00:00+05:30').status).toBe('unknown');
    expect(model([period(point(1, 10), point(1, 11)), period(point(1, 10), point(1, 12))]).status).toBe('unknown');
  });

  test('openNow alone cannot validate a future visit', () => {
    const hours = normalizeCurrentHours(venue(undefined, { currentOpeningHours: { openNow: true } }), planAt, fetched);
    expect(evaluateVisitHours(hours, '2026-01-01T10:00:00+05:30',
      '2026-01-01T11:00:00+05:30').status).toBe('unknown');
  });

  test('24-hour sentinel with an unrelated opening point is unusable', () => {
    const hours = model([{ open: { day: 2, hour: 0, minute: 0 } }]);
    expect(hours.status).toBe('unknown');
  });

  test('DST fall-back ambiguity does not become a verified interval', () => {
    const hours = normalizeCurrentHours({ timeZone: { id: 'America/New_York' },
      currentOpeningHours: { periods: [period(point(1, 1, 30, 11), point(1, 3, 0, 11))] } },
    '2026-11-01T01:30:00-04:00', Date.parse('2026-11-01T12:00:00Z'));
    expect(hours.status).toBe('unknown');
  });

  test('regular hours cannot override exceptional dated closure', () => {
    const hours = normalizeCurrentHours(venue([], { currentOpeningHours: { periods: [],
      specialDays: [{ date: { year: 2026, month: 1, day: 1 } }] },
    regularOpeningHours: { periods: [period({ day: 4, hour: 9, minute: 0 },
      { day: 4, hour: 18, minute: 0 })] } }), planAt, fetched);
    expect(check(hours, '10:00', '11:00').status).toBe('closed');
  });

  test('mixed open, closed and unknown engine candidates exclude closure and retain uncertainty', () => {
    const base = scenarios[1].request;
    const candidates = base.candidates.slice(0, 3).map((candidate, index) => ({ ...candidate,
      opening: index === 0 ? model([period(point(1, 10), point(1, 20))]) :
        index === 1 ? model([]) : { status: 'unknown', reason: 'HOURS_UNAVAILABLE' } }));
    const ids = new Set(['origin', ...candidates.map(candidate => candidate.id)]);
    const result = generateItineraries({ ...base, candidates,
      travelLegs: base.travelLegs.filter(leg => ids.has(leg.fromId) && ids.has(leg.toId)) });
    expect(result.plans.length).toBeGreaterThan(0);
    expect(result.plans.every(plan => plan.stops.every(stop => stop.placeId !== 'b'))).toBe(true);
    expect(result.plans.some(plan => plan.stops.some(stop => stop.hoursValidation.status === 'unknown'))).toBe(true);
    expect(result.plans.every(plan => plan.stops.every(stop => stop.hoursValidation.status !== 'closed'))).toBe(true);
  });
});
