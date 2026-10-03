/**
 * MetaDev Loadscreen · calendar.js
 *
 * Pure date logic for scheduled (holiday) themes.
 * This module never touches the DOM, so it can be tested with plain Node:
 *
 *   node web/js/calendar.test.mjs
 *
 * Dates are handled as plain `{ y, m, d }` objects (month is 1-12) and all
 * arithmetic is done in UTC, so the result never depends on the timezone of
 * the machine running the code. The *server's* timezone is applied once, in
 * `resolveToday()`, and everything downstream works with that calendar date.
 */

const DAY_MS = 86400000;

/* -------------------------------------------------------------------------- */
/* Date helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Builds a normalised date object (overflowing days roll into next month). */
export function makeDate(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Parses "YYYY-MM-DD". Returns null for anything else. */
export function parseISODate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = makeDate(y, m, d);
  // Reject impossible dates such as 2026-02-31 instead of silently rolling over.
  return date.y === y && date.m === m && date.d === d ? date : null;
}

export function formatISODate({ y, m, d }) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Days since the Unix epoch; handy for comparisons and differences. */
export function dayNumber({ y, m, d }) {
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function addDays(date, days) {
  return makeDate(date.y, date.m, date.d + days);
}

export function daysBetween(from, to) {
  return dayNumber(to) - dayNumber(from);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday({ y, m, d }) {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The n-th given weekday of a month, e.g. 2nd Sunday of May. */
export function nthWeekday(y, m, dow, n) {
  const first = weekday({ y, m, d: 1 });
  const offset = (dow - first + 7) % 7;
  return makeDate(y, m, 1 + offset + (n - 1) * 7);
}

/** The last given weekday of a month, e.g. last Monday of May. */
export function lastWeekday(y, m, dow) {
  const last = makeDate(y, m + 1, 0); // day 0 of next month = last day of this month
  const offset = (weekday(last) - dow + 7) % 7;
  return makeDate(y, m, last.d - offset);
}

/**
 * Western (Gregorian) Easter Sunday, using the anonymous Gregorian
 * "Computus" algorithm (Meeus/Jones/Butcher).
 */
export function easterSunday(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return makeDate(y, month, day);
}

/* -------------------------------------------------------------------------- */
/* "Today" in the server's timezone                                           */
/* -------------------------------------------------------------------------- */

/**
 * Converts a UTC timestamp to a calendar date in the given IANA timezone.
 * Falls back to a fixed UTC offset (hours) if the browser has no tz data.
 */
export function dateInTimeZone(epochMs, timeZone, fallbackOffsetHours = 0) {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(new Date(epochMs));
      const get = (type) => Number(parts.find((p) => p.type === type).value);
      return { y: get('year'), m: get('month'), d: get('day') };
    } catch {
      /* unknown timezone or no ICU data: use the offset below */
    }
  }
  const shifted = new Date(epochMs + fallbackOffsetHours * 3600000);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

/**
 * Decides which calendar date the loading screen should use.
 * A valid `forceDate` ("YYYY-MM-DD", from Config.Debug.ForceDate) always wins.
 */
export function resolveToday({ now, timeZone, utcOffset = 0, forceDate } = {}) {
  const forced = parseISODate(forceDate);
  if (forced) return forced;
  const epochMs = Number.isFinite(now) ? now * 1000 : Date.now();
  return dateInTimeZone(epochMs, timeZone, utcOffset);
}

/* -------------------------------------------------------------------------- */
/* Holiday definitions                                                        */
/* -------------------------------------------------------------------------- */

/** Range helpers: each returns `(year) => [startDate, endDate]` (inclusive). */
const on = (m, d) => (y) => [makeDate(y, m, d), makeDate(y, m, d)];
const between = (m1, d1, m2, d2) => (y) => [makeDate(y, m1, d1), makeDate(y, m2, d2)];
const computed = (fn) => (y) => { const date = fn(y); return [date, date]; };

const SUN = 0;
const MON = 1;
const THU = 4;

/** Shared colour sets so the table below stays readable. */
const PALETTE = {
  hearts: ['#FF6B9A', '#FF3B5C', '#FFC2D4'],
  rainbow: ['#7BE495', '#FFC93C', '#FF6B9A', '#6FA8FF', '#C77DFF'],
  trRedWhite: ['#E30A17', '#FFFFFF', '#FFFFFF'],
  usa: ['#FF4D5A', '#FFFFFF', '#3C6DF0'],
  pastel: ['#B5A8FF', '#FFC2D4', '#A8E6CF', '#FFF3A8', '#A8D8FF'],
  autumn: ['#E8833A', '#C2501F', '#F2B544', '#8A4B1C'],
};

/** Overlay used by all remembrance themes, taken from the 10 Kasım design. */
const REMEMBRANCE_SHADE = 'rgba(0,0,0,0.25)';

/**
 * Every scheduled theme.
 *
 *   id        Stable key. Also used in locale files (`holidays.<id>`) and
 *             in Config.ScheduledThemes.
 *   scope     'common' (every language), 'tr' or 'en' (only that locale).
 *   priority  Higher wins when two themes fall on the same day. National
 *             days and remembrance days are ≥ 80, celebrations are lower.
 *   mode      'celebration' (default) or 'remembrance' (greyscale, no
 *             effects, music off).
 *   since     Base year for the `{years}` message variable.
 *   tilt      Rotates the server name (degrees), used for April Fools'.
 */
export const HOLIDAYS = [
  /* ----- Common: shown in every language -------------------------------- */
  { id: 'new-year', scope: 'common', priority: 40, range: between(12, 25, 12, 31),
    accent: '#E9C46A', tint: 'rgba(30,60,110,0.22)', effect: { type: 'snow' } },
  { id: 'valentines', scope: 'common', priority: 40, range: on(2, 14),
    accent: '#FF6B9A', tint: 'rgba(180,30,80,0.15)', effect: { type: 'hearts', colors: PALETTE.hearts } },
  { id: 'womens-day', scope: 'common', priority: 40, range: on(3, 8),
    accent: '#C77DFF', tint: 'rgba(110,40,140,0.16)',
    effect: { type: 'confetti', colors: ['#C77DFF', '#E3B8FF', '#FFFFFF'] } },
  { id: 'april-fools', scope: 'common', priority: 30, range: on(4, 1),
    accent: '#7BE495', tint: null, tilt: -4, effect: { type: 'confetti', colors: PALETTE.rainbow } },
  { id: 'mothers-day', scope: 'common', priority: 40, range: computed((y) => nthWeekday(y, 5, SUN, 2)),
    accent: '#FF8FB1', tint: 'rgba(180,60,100,0.12)',
    effect: { type: 'hearts', colors: ['#FF8FB1', '#FF6B9A', '#FFC2D4'] } },
  { id: 'fathers-day', scope: 'common', priority: 40, range: computed((y) => nthWeekday(y, 6, SUN, 3)),
    accent: '#6FA8FF', tint: 'rgba(20,40,90,0.22)', effect: { type: 'none' } },
  { id: 'community-day', scope: 'common', priority: 40, range: on(9, 17), since: 2013,
    accent: '#57E389', tint: 'rgba(10,60,30,0.18)',
    effect: { type: 'confetti', colors: ['#57E389', '#FFFFFF', '#F2C14E'] } },
  { id: 'halloween', scope: 'common', priority: 20, range: between(10, 24, 11, 1),
    accent: '#FF8A1F', tint: 'rgba(60,10,90,0.38)',
    effect: { type: 'embers', colors: ['#FF8A1F', '#B15CFF', '#FFB347'] } },
  { id: 'black-friday', scope: 'common', priority: 30,
    range: computed((y) => addDays(nthWeekday(y, 11, THU, 4), 1)),
    accent: '#FFE14D', tint: 'rgba(0,0,0,0.42)', effect: { type: 'none' } },

  /* ----- Turkish only --------------------------------------------------- */
  { id: 'canakkale', scope: 'tr', priority: 95, range: on(3, 18), since: 1915, mode: 'remembrance',
    accent: '#D9D9D9', icon: 'flag-tr' },
  { id: 'childrens-day', scope: 'tr', priority: 85, range: on(4, 23), since: 1920,
    accent: '#FFC93C', tint: null, icon: 'flag-tr', effect: { type: 'confetti', colors: PALETTE.rainbow } },
  { id: 'labour-day', scope: 'tr', priority: 80, range: on(5, 1),
    accent: '#FF4D4D', tint: 'rgba(200,30,30,0.10)', effect: { type: 'none' } },
  { id: 'youth-day', scope: 'tr', priority: 85, range: on(5, 19), since: 1919,
    accent: '#FF3B47', tint: 'rgba(227,10,23,0.14)', icon: 'flag-tr', effect: { type: 'none' } },
  { id: 'democracy-day', scope: 'tr', priority: 95, range: on(7, 15), since: 2016, mode: 'remembrance',
    accent: '#D9D9D9', icon: 'flag-tr' },
  { id: 'victory-day', scope: 'tr', priority: 85, range: on(8, 30), since: 1922,
    accent: '#F2C14E', tint: 'rgba(110,10,20,0.26)', icon: 'flag-tr', effect: { type: 'none' } },
  { id: 'republic-day', scope: 'tr', priority: 90, range: between(10, 28, 10, 30), since: 1923,
    accent: '#FF3B47', tint: 'rgba(227,10,23,0.16)', icon: 'flag-tr',
    effect: { type: 'confetti', colors: PALETTE.trRedWhite } },
  { id: 'ataturk-memorial', scope: 'tr', priority: 100, range: on(11, 10), since: 1938, mode: 'remembrance',
    accent: '#E6E6E6', grayscale: 1 },
  { id: 'teachers-day', scope: 'tr', priority: 80, range: on(11, 24),
    accent: '#7CE7C3', tint: null,
    effect: { type: 'confetti', colors: ['#7CE7C3', '#FFFFFF', '#F5B544'], density: 0.45 } },

  /* ----- English only --------------------------------------------------- */
  { id: 'st-patricks', scope: 'en', priority: 60, range: on(3, 17),
    accent: '#3DDC84', tint: 'rgba(10,80,40,0.14)', icon: 'clover',
    effect: { type: 'confetti', colors: ['#3DDC84', '#1E9E5A', '#A8F0C6'] } },
  { id: 'easter', scope: 'en', priority: 60, range: computed(easterSunday),
    accent: '#B5A8FF', tint: null, effect: { type: 'confetti', colors: PALETTE.pastel, density: 0.7 } },
  { id: 'memorial-day', scope: 'en', priority: 95, range: computed((y) => lastWeekday(y, 5, MON)),
    mode: 'remembrance', accent: '#D9D9D9', icon: 'flag-us' },
  { id: 'independence-day', scope: 'en', priority: 90, range: on(7, 4), since: 1776,
    accent: '#FF4D5A', tint: null, icon: 'flag-us', effect: { type: 'confetti', colors: PALETTE.usa } },
  { id: 'labor-day', scope: 'en', priority: 80, range: computed((y) => nthWeekday(y, 9, MON, 1)),
    accent: '#F5B544', tint: null, icon: 'flag-us', effect: { type: 'none' } },
  { id: 'veterans-day', scope: 'en', priority: 95, range: on(11, 11), mode: 'remembrance',
    accent: '#D9D9D9', icon: 'flag-us' },
  { id: 'thanksgiving', scope: 'en', priority: 70, range: computed((y) => nthWeekday(y, 11, THU, 4)),
    accent: '#E8833A', tint: 'rgba(120,60,10,0.18)', effect: { type: 'leaves', colors: PALETTE.autumn } },
  { id: 'christmas', scope: 'en', priority: 70, range: between(12, 18, 12, 24),
    accent: '#E5484D', tint: 'rgba(40,80,150,0.20)', effect: { type: 'snow' } },
];

/** Fills in defaults so consumers never need to null-check optional fields. */
function normalise(holiday) {
  const remembrance = holiday.mode === 'remembrance';
  return {
    mode: 'celebration',
    tint: null,
    icon: null,
    tilt: 0,
    since: null,
    ...holiday,
    // Remembrance: 75 % greyscale (10 Kasım overrides to 100 %), dim overlay, no effects.
    grayscale: holiday.grayscale ?? (remembrance ? 0.75 : 0),
    shade: remembrance ? REMEMBRANCE_SHADE : null,
    effect: remembrance ? { type: 'none' } : (holiday.effect ?? { type: 'none' }),
  };
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

/** Common days show for every locale; 'tr' / 'en' days only for that locale. */
export function isVisibleForLocale(holiday, locale) {
  return holiday.scope === 'common' || holiday.scope === locale;
}

/** Start and end dates of a holiday in the given year. */
export function occurrence(holiday, year) {
  const [start, end] = holiday.range(year);
  return { start, end };
}

export function isOnDate(holiday, date) {
  const { start, end } = occurrence(holiday, date.y);
  const today = dayNumber(date);
  return today >= dayNumber(start) && today <= dayNumber(end);
}

/**
 * Returns the holiday to show on `date`, or null.
 *
 * @param {{y:number,m:number,d:number}} date
 * @param {object}  options
 * @param {string}  options.locale     Active locale code ('tr', 'en', …)
 * @param {object}  options.overrides  Per-id settings, e.g. { halloween: { enabled: false } }
 * @param {boolean} options.enabled    Master switch (Config.ScheduledThemesEnabled)
 */
export function findActiveHoliday(date, { locale, overrides = {}, enabled = true, holidays = HOLIDAYS } = {}) {
  if (!enabled || !date) return null;
  const candidates = holidays
    .filter((h) => isVisibleForLocale(h, locale))
    .filter((h) => overrides?.[h.id]?.enabled !== false)
    .filter((h) => isOnDate(h, date))
    .sort((a, b) => b.priority - a.priority);
  return candidates.length ? normalise(candidates[0]) : null;
}

/** Looks a holiday up by id (normalised), e.g. for editor previews. */
export function getHoliday(id) {
  const holiday = HOLIDAYS.find((h) => h.id === id);
  return holiday ? normalise(holiday) : null;
}

/** All holidays visible for a locale in a given year, sorted by date (for the editor). */
export function listHolidays(year, locale) {
  return HOLIDAYS
    .filter((h) => isVisibleForLocale(h, locale))
    .map((h) => ({ ...normalise(h), ...occurrence(h, year) }))
    .sort((a, b) => dayNumber(a.start) - dayNumber(b.start));
}

/**
 * Values for message placeholders:
 *   {years}    Anniversary count (year − `since`), e.g. Republic Day → year − 1923
 *   {days}     Days left until 1 January
 *   {year}     Current year,   {nextYear} the coming year
 */
export function holidayVars(holiday, date) {
  return {
    year: date.y,
    nextYear: date.y + 1,
    years: holiday?.since ? date.y - holiday.since : '',
    days: daysBetween(date, { y: date.y + 1, m: 1, d: 1 }),
  };
}
