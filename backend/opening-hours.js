// Request-scoped, provider-neutral hours. No provider data is cached here.
// Current periods are absolute, venue-local date/time points from Places (New).
// Regular periods are weekly hints only; they never prove an exceptional date.
/**
 * @typedef {{status:'known'|'closed'|'unknown', placeId?:string, provider?:string,
 *   source?:string, timeZone?:string,
 *   fetchedAt?:string, validFrom?:string, validUntil?:string,
 *   windows?:Array<{opensAt:string,closesAt:string}>, regularPeriods?:Array<object>,
 *   specialDays?:Array<object>, confidence?:string, reason?:string,
 *   warnings?:Array<{code:string}>}} PlaceHours
 */
/** @typedef {{status:'open'|'closed'|'unknown', source:string,
 *   verifiedForScheduledInterval:boolean, reason?:string, regularSchedule?:string}} HoursEvaluation */
function formatterFor(zone) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  } catch { return null; }
}

function zoneParts(time, formatter) {
  return Object.fromEntries(formatter.formatToParts(time).filter(part =>
    ['year', 'month', 'day', 'hour', 'minute'].includes(part.type)).map(part => [part.type, Number(part.value)]));
}

function localEpoch(point, formatter) {
  const { year, month, day } = point?.date ?? {};
  const { hour, minute } = point ?? {};
  if (![year, month, day, hour, minute].every(Number.isInteger) || year < 2000 || year > 2100 ||
      hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const local = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(local);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const target = { year, month, day, hour, minute };
  const possible = new Set();
  for (const sample of [local - 86400000, local, local + 86400000]) {
    const zoned = zoneParts(sample, formatter);
    const offset = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute) - sample;
    const epoch = local - offset;
    const actual = zoneParts(epoch, formatter);
    if (Object.keys(target).every(key => actual[key] === target[key])) possible.add(epoch);
  }
  // Ambiguous fall-back and nonexistent spring-forward times cannot be verified.
  return possible.size === 1 ? [...possible][0] : null;
}

function unknown(reason, extra = {}) {
  return { status: 'unknown', reason, confidence: 'unknown', warnings: [{ code: reason }], ...extra };
}

function regularHint(periods, zone, start, end) {
  const formatter = formatterFor(zone);
  if (!formatter || !Array.isArray(periods) || periods.length > 14) return 'unavailable';
  const arrival = typeof start === 'number' ? start : Date.parse(start);
  const departure = typeof end === 'number' ? end : Date.parse(end);
  if (!Number.isFinite(arrival) || !Number.isFinite(departure) || departure <= arrival) return 'unavailable';
  if (periods.length === 0) return 'closed';
  const local = zoneParts(arrival, formatter);
  const day = Date.UTC(local.year, local.month - 1, local.day);
  const windows = [];
  for (const period of periods) {
    const open = period?.open;
    const close = period?.close;
    if (!Number.isInteger(open?.day) || open.day < 0 || open.day > 6 ||
        !Number.isInteger(open.hour) || open.hour < 0 || open.hour > 23 ||
        !Number.isInteger(open.minute) || open.minute < 0 || open.minute > 59) return 'unavailable';
    if (close === undefined && periods.length === 1 && open.day === 0 && open.hour === 0 && open.minute === 0) return 'open';
    if (!Number.isInteger(close?.day) || close.day < 0 || close.day > 6 ||
        !Number.isInteger(close.hour) || close.hour < 0 || close.hour > 23 ||
        !Number.isInteger(close.minute) || close.minute < 0 || close.minute > 59) return 'unavailable';
    for (let offset = -7; offset <= 1; offset++) {
      const calendar = new Date(day + offset * 86400000);
      if (calendar.getUTCDay() !== open.day) continue;
      const openDate = { year: calendar.getUTCFullYear(), month: calendar.getUTCMonth() + 1, day: calendar.getUTCDate() };
      const daysToClose = (close.day - open.day + 7) % 7 +
        (close.day === open.day && (close.hour < open.hour ||
          (close.hour === open.hour && close.minute <= open.minute)) ? 7 : 0);
      const closeCalendar = new Date(calendar.getTime() + daysToClose * 86400000);
      const closeDate = { year: closeCalendar.getUTCFullYear(), month: closeCalendar.getUTCMonth() + 1,
        day: closeCalendar.getUTCDate() };
      const from = localEpoch({ date: openDate, hour: open.hour, minute: open.minute }, formatter);
      const until = localEpoch({ date: closeDate, hour: close.hour, minute: close.minute }, formatter);
      if (from === null || until === null || until <= from) return 'unavailable';
      windows.push([from, until]);
    }
  }
  return windows.some(([from, until]) => arrival >= from && departure <= until) ? 'open' : 'closed';
}

function normalizeCurrentHours(place, plannedAt, fetchedAt, provider = 'supplied_fixture') {
  if (!plannedAt) return unknown('HOURS_NOT_REQUESTED');
  if (!Number.isFinite(fetchedAt)) return unknown('HOURS_UNUSABLE');
  const zone = place?.timeZone?.id;
  const formatter = typeof zone === 'string' ? formatterFor(zone) : null;
  if (!formatter) return unknown('HOURS_TIMEZONE_UNKNOWN');
  const fetched = zoneParts(fetchedAt, formatter);
  const from = localEpoch({ date: fetched, hour: 0, minute: 0 }, formatter);
  const next = new Date(Date.UTC(fetched.year, fetched.month - 1, fetched.day + 7));
  const until = localEpoch({ date: { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1,
    day: next.getUTCDate() }, hour: 0, minute: 0 }, formatter);
  if (from === null || until === null) return unknown('HOURS_TIMEZONE_UNKNOWN');
  const regular = place.regularOpeningHours;
  const regularPeriods = Array.isArray(regular?.periods) && regular.periods.length <= 14 ? regular.periods : null;
  const hours = place.currentOpeningHours;
  const meta = { ...(typeof place?.id === 'string' ? { placeId: place.id } : {}), provider,
    source: 'current_opening_hours', timeZone: zone,
    fetchedAt: new Date(fetchedAt).toISOString(), validFrom: new Date(from).toISOString(),
    validUntil: new Date(until).toISOString(),
    specialDays: Array.isArray(hours?.specialDays) ? hours.specialDays.slice(0, 7)
      .map(item => item?.date).filter(Boolean) : [],
    ...(regularPeriods ? { regularPeriods } : {}) };
  if (!hours || !Array.isArray(hours.periods)) return unknown(regularPeriods ? 'REGULAR_HOURS_ONLY' : 'HOURS_UNAVAILABLE',
    { ...meta, source: regularPeriods ? 'regular_opening_hours' : 'none' });
  if (hours.periods.length > 14) return unknown('HOURS_UNUSABLE', meta);
  const windows = [];
  for (const period of hours.periods) {
    const alwaysOpen = period?.close === undefined && hours.periods.length === 1 &&
      period?.open?.day === 0 && period?.open?.hour === 0 && period?.open?.minute === 0;
    const opens = alwaysOpen ? from : localEpoch(period?.open, formatter);
    const closes = alwaysOpen ? until : localEpoch(period?.close, formatter);
    if (opens === null || closes === null || closes <= opens || closes - opens > 8 * 86400000 ||
        opens < from || closes > until) return unknown('HOURS_UNUSABLE', meta);
    windows.push({ opensAt: new Date(opens).toISOString(), closesAt: new Date(closes).toISOString() });
  }
  windows.sort((a, b) => a.opensAt.localeCompare(b.opensAt));
  for (let i = 1; i < windows.length; i++) if (windows[i].opensAt < windows[i - 1].closesAt) {
    return unknown('HOURS_UNUSABLE', meta);
  }
  const planned = Date.parse(plannedAt);
  if (!Number.isFinite(planned) || planned < from || planned >= until) return unknown('HOURS_OUTSIDE_CURRENT_WINDOW', meta);
  return hours.periods.length === 0 ? { status: 'closed', confidence: 'provider_current_hours',
    warnings: [], ...meta } : { status: 'known', windows, confidence: 'provider_current_hours',
    warnings: [], ...meta };
}

function evaluateVisitHours(opening, start, end) {
  const arrival = typeof start === 'number' ? start : Date.parse(start);
  const departure = typeof end === 'number' ? end : Date.parse(end);
  if (!Number.isFinite(arrival) || !Number.isFinite(departure) || departure <= arrival) {
    return { status: 'unknown', source: 'none', verifiedForScheduledInterval: false, reason: 'INVALID_INTERVAL' };
  }
  const source = opening?.source ?? 'supplied_schedule';
  if (!opening || opening.status === 'unknown') return { status: 'unknown', source,
    verifiedForScheduledInterval: false, reason: opening?.reason ?? 'HOURS_UNAVAILABLE',
    ...(opening?.regularPeriods && opening?.timeZone ? { regularSchedule: regularHint(opening.regularPeriods,
      opening.timeZone, arrival, departure) } : {}) };
  if (opening.status === 'closed') {
    const from = Date.parse(opening.validFrom);
    const until = Date.parse(opening.validUntil);
    if (!Number.isFinite(from) || !Number.isFinite(until) || arrival < from || departure > until) {
      return { status: 'unknown', source, verifiedForScheduledInterval: false,
        reason: 'HOURS_OUTSIDE_CURRENT_WINDOW' };
    }
    return { status: 'closed', source, verifiedForScheduledInterval: false, reason: 'CLOSED_DURING_VISIT' };
  }
  if (opening.status !== 'known' || !Array.isArray(opening.windows)) return { status: 'unknown', source,
    verifiedForScheduledInterval: false, reason: 'HOURS_UNUSABLE' };
  const from = opening.validFrom === undefined ? null : Date.parse(opening.validFrom);
  const until = opening.validUntil === undefined ? null : Date.parse(opening.validUntil);
  if ((from !== null && (!Number.isFinite(from) || arrival < from)) ||
      (until !== null && (!Number.isFinite(until) || departure > until))) return { status: 'unknown', source,
    verifiedForScheduledInterval: false, reason: 'HOURS_OUTSIDE_CURRENT_WINDOW' };
  const windows = opening.windows.map(window => [
    typeof window.opens === 'number' ? window.opens : Date.parse(window.opensAt),
    typeof window.closes === 'number' ? window.closes : Date.parse(window.closesAt)]);
  if (windows.length > 14 || windows.some(([a, b]) => !Number.isFinite(a) || !Number.isFinite(b) || b <= a)) return {
    status: 'unknown', source, verifiedForScheduledInterval: false, reason: 'HOURS_UNUSABLE' };
  windows.sort((a, b) => a[0] - b[0]);
  if (windows.some(([a], index) => index > 0 && a < windows[index - 1][1])) return {
    status: 'unknown', source, verifiedForScheduledInterval: false, reason: 'HOURS_UNUSABLE' };
  const covered = windows.some(([a, b]) => arrival >= a && departure <= b);
  return { status: covered ? 'open' : 'closed', source,
    verifiedForScheduledInterval: covered, ...(covered ? {} : { reason: 'CLOSED_DURING_VISIT' }) };
}

module.exports = { normalizeCurrentHours, evaluateVisitHours, regularHint, formatterFor, localEpoch };
