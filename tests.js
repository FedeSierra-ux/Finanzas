#!/usr/bin/env node
// Minimal unit tests for pure functions in index.html.
// Run with: node tests.js
// No external dependencies — exits with code 1 if any assertion fails.

let _passed = 0;
let _failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    _passed++;
  } else {
    console.error(`  ✗ ${label}`);
    _failed++;
  }
}

function assertEqual(actual, expected, label) {
  const ok = actual === expected;
  if (ok) {
    console.log(`  ✓ ${label}`);
    _passed++;
  } else {
    console.error(`  ✗ ${label}  →  got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    _failed++;
  }
}

function section(name) {
  console.log(`\n${name}`);
}

// ─── Re-implementations of pure functions under test ────────────────────────
// These mirror index.html exactly. If the app implementation changes, update
// these copies and add/adjust the relevant tests.

function daysUntil(dateStr, _now) {
  if (!dateStr) return 999;
  const today = _now ? new Date(_now) : new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

function nextMonthDate(dateStr, period) {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  if (period === 'unica') return dateStr;
  else if (period === 'anual') {
    const targetMonth = d.getMonth();
    d.setFullYear(d.getFullYear() + 1);
    if (d.getMonth() !== targetMonth) d.setDate(0);
  } else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, maxDay));
  }
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function fARS(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '- ' : '';
  const formatted = Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return sign + '$ ' + formatted;
}

function normalizeTextLite(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ─── daysUntil ───────────────────────────────────────────────────────────────
section('daysUntil');

const NOW = '2025-06-15T12:00:00'; // fixed reference date for deterministic tests

assertEqual(daysUntil('2025-06-15', NOW),  0,  'same day → 0');
assertEqual(daysUntil('2025-06-16', NOW),  1,  'tomorrow → 1');
assertEqual(daysUntil('2025-06-14', NOW), -1,  'yesterday → -1');
assertEqual(daysUntil('2025-06-22', NOW),  7,  '7 days ahead');
assertEqual(daysUntil('2025-06-08', NOW), -7,  '7 days past');
assertEqual(daysUntil('',           NOW), 999, 'empty string → 999');
assertEqual(daysUntil(null,         NOW), 999, 'null → 999');

// UTC-offset safety: ISO string with time component should not shift the date
assertEqual(daysUntil('2025-06-15T00:00:00.000Z', NOW), 0, 'ISO with time — same day, no double-T corruption');
assertEqual(daysUntil('2025-06-16T00:00:00.000Z', NOW), 1, 'ISO with time — tomorrow, no double-T corruption');

// ─── nextMonthDate ───────────────────────────────────────────────────────────
section('nextMonthDate');

// unica — unchanged
assertEqual(nextMonthDate('2025-06-15', 'unica'),   '2025-06-15', 'unica — same date');
assertEqual(nextMonthDate('2025-12-31', 'unica'),   '2025-12-31', 'unica — year end unchanged');

// mensual — regular months
assertEqual(nextMonthDate('2025-06-15', 'mensual'), '2025-07-15', 'mensual — mid month');
assertEqual(nextMonthDate('2025-12-15', 'mensual'), '2026-01-15', 'mensual — year rollover');

// mensual — month-end clamping
assertEqual(nextMonthDate('2025-01-31', 'mensual'), '2025-02-28', 'mensual — Jan 31 → Feb 28');
assertEqual(nextMonthDate('2025-03-31', 'mensual'), '2025-04-30', 'mensual — Mar 31 → Apr 30');
assertEqual(nextMonthDate('2024-01-31', 'mensual'), '2024-02-29', 'mensual — Jan 31 → Feb 29 (leap year)');

// anual — regular
assertEqual(nextMonthDate('2025-06-15', 'anual'),   '2026-06-15', 'anual — same day next year');
assertEqual(nextMonthDate('2025-12-31', 'anual'),   '2026-12-31', 'anual — year end');

// anual — leap-year edge: Feb 29 in non-leap year
assertEqual(nextMonthDate('2024-02-29', 'anual'),   '2025-02-28', 'anual — Feb 29 leap → Feb 28 non-leap');

// ISO with time component should be handled safely
assertEqual(nextMonthDate('2025-06-15T00:00:00.000Z', 'mensual'), '2025-07-15', 'mensual with ISO timestamp input');

// ─── fARS ──────────────────────────────────────────────
section('fARS');
// fARS uses   (non-breaking space) between $ and the number.
const NBSP = ' ';

assertEqual(fARS(0),       '$' + NBSP + '0',           'zero');
assertEqual(fARS(1000),    '$' + NBSP + '1.000',       'thousands separator');
assertEqual(fARS(1000000), '$' + NBSP + '1.000.000',   'millions');
assertEqual(fARS(-500),    '- $' + NBSP + '500',       'negative');
assertEqual(fARS(1500.7),  '$' + NBSP + '1.501',       'rounds up');
assertEqual(fARS(1500.4),  '$' + NBSP + '1.500',       'rounds down');
assertEqual(fARS(-1500),   '- $' + NBSP + '1.500',     'negative thousands');

// ─── normalizeTextLite ───────────────────────────────────────────────────────
section('normalizeTextLite');

assertEqual(normalizeTextLite('Café'),       'cafe',    'accent stripped + lowercased');
assertEqual(normalizeTextLite('NETFLIX'),    'netflix', 'uppercased → lowercase');
assertEqual(normalizeTextLite('Año Nuevo'),  'ano nuevo','ñ stripped');
assertEqual(normalizeTextLite(''),           '',         'empty string');
assertEqual(normalizeTextLite(null),         '',         'null → empty string');
assertEqual(normalizeTextLite(undefined),    '',         'undefined → empty string');

// ─── Local date string (dedup key) ──────────────────────────────────────────
section('local date key — no UTC shift');

// Simulate the sentinel key generation used in checkTodayTaskNotifs.
function localDateKey(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// At 21:30 local in UTC-3 (= 00:30 UTC next day), UTC-based slice gives tomorrow
// but localDateKey must give today.
const eveningLocal = new Date('2025-06-15T21:30:00');  // local interpretation
assertEqual(localDateKey(eveningLocal), '2025-06-15', 'evening local date = today, not UTC tomorrow');

// At midnight UTC (= 21:00 local UTC-3 on the 14th), UTC key would be the 15th
const utcMidnight = new Date('2025-06-15T00:00:00Z');  // UTC midnight
// local date in UTC-3 would be 2025-06-14 — toISOString gives '2025-06-15'
assert(utcMidnight.toISOString().slice(0, 10) !== localDateKey(utcMidnight) || utcMidnight.getTimezoneOffset() === 0,
  'toISOString key differs from local key in non-UTC timezone (expected difference)');

// ─── weekRangeKey (local dates, no UTC shift) ────────────────────────────────
section('weekRangeKey — local date parts');

function weekRangeKey(start, end) {
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return `${fmt(start)}|${fmt(end)}`;
}

// Verify that a week ending Sun 23:59:59 local (AR = UTC-3) doesn't become Monday in UTC
const weekEnd = new Date(2026, 5, 7, 23, 59, 59, 999);  // June 7 local
const weekStart = new Date(2026, 5, 2, 0, 0, 0, 0);    // June 2 local
const key = weekRangeKey(weekStart, weekEnd);
assertEqual(key, '2026-06-02|2026-06-07', 'weekRangeKey uses local dates, not UTC');
assert(!key.includes('2026-06-08'), 'weekRangeKey end is not shifted to next day (UTC issue)');

// ─── parseLooseAmount ─────────────────────────────────────────────────────────
section('parseLooseAmount');

function parseLooseAmount(text) {
  const src = String(text || '').trim();
  if (!src) return null;
  const mSuffix = src.match(/(k|mil)\s*$/i);
  const suffixMult = mSuffix ? 1000 : 1;
  const numPart = (mSuffix ? src.slice(0, mSuffix.index) : src).trim();
  if (!numPart || !/\d/.test(numPart)) return null;
  const hasDot = numPart.includes('.');
  const hasComma = numPart.includes(',');
  let normalized;
  if (hasDot && hasComma) {
    const lastDot = numPart.lastIndexOf('.');
    const lastComma = numPart.lastIndexOf(',');
    normalized = lastComma > lastDot
      ? numPart.replace(/\./g, '').replace(',', '.')
      : numPart.replace(/,/g, '');
  } else if (hasDot) {
    const parts = numPart.split('.');
    const last = parts[parts.length - 1];
    normalized = (parts.length > 2 || last.length === 3) ? numPart.replace(/\./g, '') : numPart;
  } else if (hasComma) {
    const parts = numPart.split(',');
    const last = parts[parts.length - 1];
    normalized = (parts.length > 2 || last.length === 3) ? numPart.replace(/,/g, '') : numPart.replace(',', '.');
  } else {
    normalized = numPart.replace(/\s+/g, '');
  }
  const val = parseFloat(normalized) * suffixMult;
  if (!Number.isFinite(val)) return null;
  return Math.round(val);
}

assertEqual(parseLooseAmount('1500'),      1500,  'integer');
assertEqual(parseLooseAmount('1.500'),     1500,  'dot-thousands separator');
assertEqual(parseLooseAmount('1,500'),     1500,  'comma + 3 digits → thousands separator (LatAm)');
assertEqual(parseLooseAmount('1,50'),      2,     'comma + 2 digits → decimal separator');
assertEqual(parseLooseAmount('1,5'),       2,     'comma + 1 digit → decimal separator');
assertEqual(parseLooseAmount('1500.50'),   1501,  'dot-decimal rounds up');
assertEqual(parseLooseAmount('50.000'),    50000, 'dot-thousands five digits');
assertEqual(parseLooseAmount('1.500.000'), 1500000, 'multiple dot-thousands groups');
assertEqual(parseLooseAmount('1,500,000'), 1500000, 'multiple comma-thousands groups');
assertEqual(parseLooseAmount('1.500,25'),  1500,  'dot-thousands + comma-decimal');
assertEqual(parseLooseAmount('1,500.25'),  1500,  'comma-thousands + dot-decimal');
assertEqual(parseLooseAmount('5k'),        5000,  'k suffix');
assertEqual(parseLooseAmount('5 mil'),     5000,  'mil suffix');
assertEqual(parseLooseAmount(''),          null,  'empty → null');
assertEqual(parseLooseAmount(null),        null,  'null → null');

// ─── nextMonthDate — único period (both spellings) ────────────────────────────
section('nextMonthDate — único / unica');

function nextMonthDate(dateStr, period) {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  if (period === 'unica' || period === 'único') return dateStr;
  else if (period === 'anual') {
    const targetMonth = d.getMonth();
    d.setFullYear(d.getFullYear() + 1);
    if (d.getMonth() !== targetMonth) d.setDate(0);
  } else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, maxDay));
  }
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

assertEqual(nextMonthDate('2025-06-15', 'unica'),  '2025-06-15', 'unica — returns same date');
assertEqual(nextMonthDate('2025-06-15', 'único'),  '2025-06-15', 'único (accented) — returns same date');
assertEqual(nextMonthDate('2025-06-15', 'mensual'), '2025-07-15', 'mensual still works after fix');

// ─── MP duplicate detection tolerance ────────────────────────────────────────
section('MP duplicate tolerance — relative to amount');

function isDupRelativeTol(existingAmt, newAmt, diffDays, descSim) {
  const diffAmt = Math.abs(existingAmt - newAmt);
  return diffDays <= 3 && diffAmt < Math.max(50, newAmt * 0.01) && descSim;
}

// Old bug: $10 tolerance missed electricity bill that went up $11
assert( isDupRelativeTol(85200, 85211, 1, true),  'electricity bill +$11 within 1% tol → detected as dup (was missed with old $10 hardcoded tol)');
assert( isDupRelativeTol(85200, 85201, 1, true),  'electricity $85200 vs $85201 — same bill, detected dup');
// Small amounts still work
assert( isDupRelativeTol(1200, 1200, 0, true),    'same coffee same day → dup');
assert(!isDupRelativeTol(1200, 1200, 0, false),   'same amount but different desc → not dup');
// Large bill tolerance
assert( isDupRelativeTol(150000, 150500, 2, true), 'utility bill $150k±$500 (0.33%) → dup within 1%');
assert(!isDupRelativeTol(150000, 152000, 2, true), 'utility bill $150k vs $152k (1.3%) → not dup');

// ─── Version sync: APP_VERSION must match sw.js CACHE suffix ─────────────────
section('Version sync');
{
  const fs = require('fs'), path = require('path');
  const dir = __dirname;
  const idx = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const sw  = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
  const mV  = idx.match(/const APP_VERSION='([^']+)'/);
  const mC  = sw.match(/const CACHE='finanzas-v([^']+)'/);
  assert(!!mV, 'APP_VERSION found in index.html');
  assert(!!mC, 'CACHE version found in sw.js');
  if (mV && mC) assertEqual(mC[1], mV[1], `sw.js CACHE suffix (${mC[1]}) matches APP_VERSION (${mV[1]})`);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`${_passed + _failed} tests: ${_passed} passed, ${_failed} failed`);
if (_failed > 0) {
  console.error(`\n${_failed} test(s) failed.`);
  process.exit(1);
} else {
  console.log('\nAll tests passed.');
}
