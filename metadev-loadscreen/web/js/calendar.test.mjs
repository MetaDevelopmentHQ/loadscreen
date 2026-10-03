/**
 * Tests for calendar.js. No dependencies, just Node 18+:
 *
 *   node web/js/calendar.test.mjs
 */
import assert from 'node:assert/strict';
import {
  easterSunday, nthWeekday, lastWeekday, parseISODate, formatISODate,
  findActiveHoliday, holidayVars, resolveToday, dateInTimeZone, listHolidays, HOLIDAYS,
} from './calendar.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const iso = (date) => formatISODate(date);
const active = (day, locale, overrides) => findActiveHoliday(parseISODate(day), { locale, overrides })?.id ?? null;

test('Computus: known Easter Sundays', () => {
  assert.equal(iso(easterSunday(2024)), '2024-03-31');
  assert.equal(iso(easterSunday(2025)), '2025-04-20');
  assert.equal(iso(easterSunday(2026)), '2026-04-05');
  assert.equal(iso(easterSunday(2027)), '2027-03-28');
  assert.equal(iso(easterSunday(2038)), '2038-04-25');
});

test('nth / last weekday rules', () => {
  assert.equal(iso(nthWeekday(2026, 5, 0, 2)), '2026-05-10');   // Mother's Day
  assert.equal(iso(nthWeekday(2026, 6, 0, 3)), '2026-06-21');   // Father's Day
  assert.equal(iso(nthWeekday(2026, 11, 4, 4)), '2026-11-26');  // Thanksgiving
  assert.equal(iso(nthWeekday(2026, 9, 1, 1)), '2026-09-07');   // Labor Day
  assert.equal(iso(lastWeekday(2026, 5, 1)), '2026-05-25');     // Memorial Day
  assert.equal(iso(nthWeekday(2027, 11, 4, 4)), '2027-11-25');
});

test('parseISODate rejects invalid input', () => {
  assert.equal(parseISODate('2026-02-31'), null);
  assert.equal(parseISODate('29.10.2026'), null);
  assert.equal(parseISODate(null), null);
  assert.deepEqual(parseISODate('2026-10-29'), { y: 2026, m: 10, d: 29 });
});

test('locale rules: common / tr / en', () => {
  assert.equal(active('2026-02-14', 'tr'), 'valentines');
  assert.equal(active('2026-02-14', 'en'), 'valentines');
  assert.equal(active('2026-04-23', 'tr'), 'childrens-day');
  assert.equal(active('2026-04-23', 'en'), null);
  assert.equal(active('2026-07-04', 'en'), 'independence-day');
  assert.equal(active('2026-07-04', 'tr'), null);
  assert.equal(active('2026-05-01', 'tr'), 'labour-day');
  assert.equal(active('2026-05-01', 'de'), null); // a new locale only gets common days
  assert.equal(active('2026-02-14', 'de'), 'valentines');
});

test('priority: national days beat Halloween', () => {
  assert.equal(active('2026-10-27', 'tr'), 'halloween');
  assert.equal(active('2026-10-28', 'tr'), 'republic-day');
  assert.equal(active('2026-10-29', 'tr'), 'republic-day');
  assert.equal(active('2026-10-30', 'tr'), 'republic-day');
  assert.equal(active('2026-10-31', 'tr'), 'halloween');
  assert.equal(active('2026-10-29', 'en'), 'halloween');
  assert.equal(active('2026-11-01', 'en'), 'halloween');
});

test('ranges and computed days', () => {
  assert.equal(active('2026-12-24', 'en'), 'christmas');
  assert.equal(active('2026-12-24', 'tr'), null);
  assert.equal(active('2026-12-25', 'tr'), 'new-year');
  assert.equal(active('2026-12-31', 'en'), 'new-year');
  assert.equal(active('2026-11-27', 'tr'), 'black-friday');
  assert.equal(active('2026-11-26', 'en'), 'thanksgiving');
  assert.equal(active('2026-04-05', 'en'), 'easter');
  assert.equal(active('2026-05-25', 'en'), 'memorial-day');
});

test('disabled overrides fall through to the next theme', () => {
  assert.equal(active('2026-10-29', 'tr', { 'republic-day': { enabled: false } }), 'halloween');
  assert.equal(active('2026-10-29', 'tr', { 'republic-day': { enabled: false }, halloween: { enabled: false } }), null);
  assert.equal(findActiveHoliday(parseISODate('2026-02-14'), { locale: 'tr', enabled: false }), null);
});

test('remembrance defaults', () => {
  const memorial = findActiveHoliday(parseISODate('2026-11-10'), { locale: 'tr' });
  assert.equal(memorial.mode, 'remembrance');
  assert.equal(memorial.grayscale, 1);
  assert.equal(memorial.effect.type, 'none');
  const canakkale = findActiveHoliday(parseISODate('2026-03-18'), { locale: 'tr' });
  assert.equal(canakkale.grayscale, 0.75);
});

test('dynamic variables', () => {
  const day = parseISODate('2026-10-29');
  assert.equal(holidayVars(findActiveHoliday(day, { locale: 'tr' }), day).years, 103);
  const nov10 = parseISODate('2026-11-10');
  assert.equal(holidayVars(findActiveHoliday(nov10, { locale: 'tr' }), nov10).years, 88);
  const sep17 = parseISODate('2026-09-17');
  assert.equal(holidayVars(findActiveHoliday(sep17, { locale: 'en' }), sep17).years, 13);
  const dec26 = parseISODate('2026-12-26');
  assert.equal(holidayVars(findActiveHoliday(dec26, { locale: 'tr' }), dec26).days, 6);
  assert.equal(holidayVars(null, dec26).nextYear, 2027);
});

test('timezone resolution', () => {
  // 2026-10-28 22:30 UTC is already the 29th in Istanbul (UTC+3).
  const epoch = Date.UTC(2026, 9, 28, 22, 30) / 1000;
  assert.equal(iso(resolveToday({ now: epoch, timeZone: 'Europe/Istanbul' })), '2026-10-29');
  assert.equal(iso(resolveToday({ now: epoch, timeZone: 'America/New_York' })), '2026-10-28');
  assert.equal(iso(dateInTimeZone(epoch * 1000, 'Not/AZone', 3)), '2026-10-29');
  assert.equal(iso(resolveToday({ now: epoch, timeZone: 'UTC', forceDate: '2026-02-14' })), '2026-02-14');
});

test('every holiday resolves for a range of years', () => {
  for (let year = 2024; year <= 2040; year += 1) {
    for (const holiday of HOLIDAYS) {
      const [start, end] = holiday.range(year);
      assert.ok(start.y === year && end.y === year, `${holiday.id} ${year}`);
    }
  }
  assert.equal(new Set(HOLIDAYS.map((h) => h.id)).size, HOLIDAYS.length, 'ids must be unique');
  assert.ok(listHolidays(2026, 'tr').every((h) => h.scope !== 'en'));
});

console.log(`✓ calendar.js: ${passed} tests passed`);
