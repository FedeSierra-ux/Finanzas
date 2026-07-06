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
  const mToken = src.match(/\$?\s*(\d[\d.,]*(?:\s\d{3})*)(\s*(?:k|mil))?/i);
  if (!mToken) return null;
  const numPart = mToken[1];
  if (!numPart) return null;
  const suffixMult = mToken[2] && /k|mil/i.test(mToken[2]) ? 1000 : 1;
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
    normalized = numPart.replace(/\s/g, '');
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
// natural-language text (inbox input) — regression from PR #90/#91 review
assertEqual(parseLooseAmount('pagué 1500 super'),     1500,  'natural text: amount embedded mid-sentence');
assertEqual(parseLooseAmount('gasté 1,500 en Uber'),  1500,  'natural text: LatAm thousands in sentence');
assertEqual(parseLooseAmount('$1.500'),               1500,  'dollar-sign prefix');
assertEqual(parseLooseAmount('$1.500,25'),            1500,  'dollar-sign + mixed separators');
assertEqual(parseLooseAmount('18k de servicios'),     18000, 'natural text: k suffix mid-sentence');
assertEqual(parseLooseAmount('5k super'),             5000,  'k suffix with trailing word');
// space-grouped thousands (pasted bank text) — P2 from PR #92 review
assertEqual(parseLooseAmount('1 500'),                1500,  'space-grouped thousands');
assertEqual(parseLooseAmount('50 000'),               50000, 'space-grouped tens of thousands');
assertEqual(parseLooseAmount('$ 1 500'),              1500,  '$ + space-grouped thousands');
assertEqual(parseLooseAmount('pagué 50 000 super'),   50000, 'natural text: space-grouped thousands in sentence');

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

// ─── fCompact ────────────────────────────────────────────────────────────────
section('fCompact');

function fCompact(n) {
  const abs = Math.abs(n);
  const s = n < 0 ? '−' : '';
  if (abs >= 1000000) return s + '$' + (abs / 1000000).toFixed(1).replace('.', ',') + 'M';
  if (abs >= 10000)   return s + '$' + Math.round(abs / 1000) + 'k';
  return (n < 0 ? '−' : '') + fARS(Math.abs(n));
}

assertEqual(fCompact(0),         fARS(0),    'zero stays as fARS');
assertEqual(fCompact(5000),      fARS(5000), 'under 10k stays as fARS');
assertEqual(fCompact(10000),     '$10k',     '10k compact');
assertEqual(fCompact(12500),     '$13k',     '12500 rounds to 13k');
assertEqual(fCompact(1000000),   '$1,0M',    '1M');
assertEqual(fCompact(1500000),   '$1,5M',    '1.5M');
assertEqual(fCompact(-15000),    '−$15k', 'negative compact');
assertEqual(fCompact(-1200000),  '−$1,2M','negative million');

// ─── eAmt ─────────────────────────────────────────────────────────────────────
section('eAmt');

function eAmt(g, myName) {
  if (!g.shared || !g.shared.active) return g.amount;
  const sp = g.shared.splitPct ?? 50;
  return g.shared.paidBy === myName
    ? Math.round(g.amount * sp / 100)
    : Math.round(g.amount * (100 - sp) / 100);
}

const ME = 'fede';
assert(eAmt({amount: 1000}, ME) === 1000,                                          'no shared → full amount');
assert(eAmt({amount: 1000, shared: {active: false}}, ME) === 1000,                 'shared inactive → full amount');
assert(eAmt({amount: 1000, shared: {active: true, paidBy: 'fede', splitPct: 50}}, ME) === 500,  'payer 50/50 → 500');
assert(eAmt({amount: 1000, shared: {active: true, paidBy: 'mile', splitPct: 50}}, ME) === 500,  'non-payer 50/50 → 500');
assert(eAmt({amount: 1000, shared: {active: true, paidBy: 'fede', splitPct: 70}}, ME) === 700,  'payer 70% → 700');
assert(eAmt({amount: 1000, shared: {active: true, paidBy: 'mile', splitPct: 70}}, ME) === 300,  'non-payer, partner 70% → own 30%');
assert(eAmt({amount: 999,  shared: {active: true, paidBy: 'fede', splitPct: 50}}, ME) === 500,  'rounds 999/2 → 500');

// ─── _dayKeyOf ────────────────────────────────────────────────────────────────
section('_dayKeyOf');

function dayKeyOf(g) {
  if (g.addedAt) {
    const d = new Date(g.addedAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return `${g.year}-${String(g.month + 1).padStart(2, '0')}-${String(g.day || 1).padStart(2, '0')}`;
}

// addedAt path (local date, not UTC)
assertEqual(dayKeyOf({addedAt: new Date(2025, 5, 15, 21, 30).getTime()}), '2025-06-15', 'addedAt: evening local date');
assertEqual(dayKeyOf({addedAt: new Date(2025, 0, 1, 0, 0).getTime()}),   '2025-01-01', 'addedAt: Jan 1 midnight');

// legacy year/month/day path
assertEqual(dayKeyOf({year: 2025, month: 5, day: 15}), '2025-06-15', 'year/month(0-based)/day');
assertEqual(dayKeyOf({year: 2025, month: 0, day: 1}),  '2025-01-01', 'January with 0-based month');
assertEqual(dayKeyOf({year: 2025, month: 11, day: 31}),'2025-12-31', 'December last day');
assertEqual(dayKeyOf({year: 2025, month: 5}),          '2025-06-01', 'missing day defaults to 1');

// ─── Agenda bucket classification ─────────────────────────────────────────────
section('Agenda bucket classification');

const BUCKETS = [
  {key: 'vencido', test: d => d < 0,    lbl: 'Vencido'},
  {key: 'hoy',     test: d => d === 0,  lbl: 'Hoy'},
  {key: 'semana',  test: d => d <= 7,   lbl: 'Esta semana'},
  {key: 'mes',     test: d => d <= 30,  lbl: 'Este mes'},
  {key: 'proximo', test: () => true,    lbl: 'Próximo mes'},
];

function classifyBucket(days) {
  return BUCKETS.find(b => b.test(days)).key;
}

assertEqual(classifyBucket(-1),  'vencido', 'yesterday → vencido');
assertEqual(classifyBucket(-30), 'vencido', '30 days past → vencido');
assertEqual(classifyBucket(0),   'hoy',     'today → hoy');
assertEqual(classifyBucket(1),   'semana',  'tomorrow → semana');
assertEqual(classifyBucket(7),   'semana',  '7 days → semana');
assertEqual(classifyBucket(8),   'mes',     '8 days → mes');
assertEqual(classifyBucket(30),  'mes',     '30 days → mes');
assertEqual(classifyBucket(31),  'proximo', '31 days → proximo');
assertEqual(classifyBucket(999), 'proximo', 'far future → proximo');

// ─── shared-gasto split state — "Solo Fede/Mile" recompute on payer change ───
// Regression test for a bug found in the compartidos audit: pickSplitSolo()
// derived splitPct from whoever was the payer *at that moment*; if the user
// then changed the payer via pickPaidBy(), splitPct stayed stale and the
// "Solo X" chip kept showing selected while actually meaning the opposite
// debt direction. Fix: pickPaidBy() re-derives splitPct when a solo mode is
// active. This mirrors that state machine (see pickPaidBy/pickSplitSolo/
// pickSplit/onSplitPctInput in index.html).
section('shared-gasto split — Solo Fede/Mile recompute on payer change');

function makeSplitState() {
  let paidBy = 'fede', splitPct = 50, soloWho = null;
  const api = {
    pickPaidBy(who) {
      paidBy = who;
      if (soloWho != null) api.pickSplitSolo(soloWho);
    },
    pickSplitSolo(who) {
      soloWho = who;
      splitPct = (who === paidBy) ? 100 : 0;
    },
    pickSplit(pct) { splitPct = pct; soloWho = null; },
    state() { return { paidBy, splitPct, soloWho }; },
  };
  return api;
}

{
  const s = makeSplitState();
  s.pickSplitSolo('mile'); // "Solo Mile" while Fede is the payer → Mile owns it, Fede paid → splitPct 0
  assertEqual(s.state().splitPct, 0, 'Solo Mile + payer Fede → splitPct 0 (Fede advanced it, Mile owes 100%)');
  s.pickPaidBy('mile'); // user realizes Mile actually paid
  assertEqual(s.state().splitPct, 100, 'switching payer to Mile while "Solo Mile" active → recomputes to 100 (no debt)');
  assertEqual(s.state().soloWho, 'mile', 'solo mode stays "mile" across the payer change');
}
{
  // Numeric split (not "solo") must NOT get recomputed on payer change
  const s = makeSplitState();
  s.pickSplit(70);
  s.pickPaidBy('mile');
  assertEqual(s.state().splitPct, 70, 'a plain numeric split is left untouched when payer changes');
}

// ─── _getMergedGastos — un-shared bin items must not leak into partner view ──
// Regression test: un-sharing an expense sets shared.active=false but the item
// is never deleted from the shared bin (upsertSharedBinGasto just updates it in
// place). Without filtering by shared.active, the partner's personal "Gastos"
// tab kept showing that expense forever, inflating their monthly total.
section('_getMergedGastos — filters inactive shared bin items');

function getMergedGastos(localGastos, binGastos, month, year) {
  const local = localGastos.filter(g => g.month === month && g.year === year);
  const localMap = new Map(local.map(g => [g.id, g]));
  const bin = binGastos.filter(g => g.month === month && g.year === year && g.shared?.active);
  bin.forEach(g => {
    const loc = localMap.get(g.id);
    if (!loc || (g.addedAt || 0) > (loc.addedAt || 0)) localMap.set(g.id, g);
  });
  return [...localMap.values()];
}

{
  const local = []; // Mile's own gastos — doesn't include Fede's expense
  const bin = [
    { id: 'a', month: 5, year: 2026, amount: 1000, shared: { active: false } }, // Fede un-shared it
    { id: 'b', month: 5, year: 2026, amount: 2000, shared: { active: true } },  // still shared
  ];
  const merged = getMergedGastos(local, bin, 5, 2026);
  assertEqual(merged.length, 1, 'un-shared bin item is excluded, only the still-shared one appears');
  assertEqual(merged[0].id, 'b', 'the surviving item is the still-shared one');
}

// ─── Version sync: sw.js reads its cache version from the registration URL ──
// index.html no longer keeps a hardcoded CACHE literal in sw.js in sync by hand —
// sw.js derives it from the "?v=" query string that index.html passes when it
// registers the worker (see sw.js top comment). This test checks that wiring
// instead of comparing two hardcoded literals (which is what used to bit-rot).
section('Version sync');
{
  const fs = require('fs'), path = require('path');
  const dir = __dirname;
  const idx = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const sw  = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
  const mV  = idx.match(/const APP_VERSION='([^']+)'/);
  const mReg = idx.match(/serviceWorker\.register\(['"`]\.\/sw\.js\?v=['"`]\s*\+\s*encodeURIComponent\(APP_VERSION\)/);
  const mSw  = sw.match(/const _swVersion=new URL\(self\.location\.href\)\.searchParams\.get\(['"]v['"]\)/);
  const mCache = sw.match(/const CACHE='finanzas-v'\s*\+\s*_swVersion/);
  assert(!!mV, 'APP_VERSION found in index.html');
  assert(!!mReg, 'index.html registers sw.js with ?v=APP_VERSION');
  assert(!!mSw, 'sw.js reads the "v" query param into _swVersion');
  assert(!!mCache, 'sw.js CACHE is derived from _swVersion (not a hardcoded literal)');
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
