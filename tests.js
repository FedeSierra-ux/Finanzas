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

// ─── fetchSharedBin tombstone filtering — phantom gastos/pagos after a failed
// delete-push must not resurrect on the next sync ───────────────────────────
// Regression test found by code-review of the compartidos fixes: deleting a
// shared gasto/pago removes it locally first, then tries to push the removal
// to the bin. If that push fails (flaky network), the item survives in the
// remote bin and used to come back on the next fetchSharedBin() — this tests
// the tombstone-filter step that now strips them again after every fetch.
section('fetchSharedBin — tombstone filtering');

function filterByTombstone(binItems, deletedIds) {
  const del = new Set(deletedIds);
  return binItems.filter(item => !del.has(item.id));
}

{
  const binGastos = [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }];
  const filtered = filterByTombstone(binGastos, ['g2']);
  assertEqual(filtered.length, 2, 'gasto tombstoned locally is stripped back out of the bin snapshot');
  assert(!filtered.some(g => g.id === 'g2'), 'the deleted gasto id is gone, the other two remain');
}
{
  const binPayments = [{ id: 'p1' }, { id: 'p2' }];
  const filtered = filterByTombstone(binPayments, ['p1', 'p2']);
  assertEqual(filtered.length, 0, 'all tombstoned payments are stripped');
}
{
  // No tombstones → nothing filtered (the common case shouldn't lose data)
  const binGastos = [{ id: 'g1' }, { id: 'g2' }];
  const filtered = filterByTombstone(binGastos, []);
  assertEqual(filtered.length, 2, 'empty tombstone list leaves the bin snapshot untouched');
}

// ─── shared vencimiento — pay-time payer/split state machine ────────────────
// New feature: a vencimiento can be marked "compartido" with a default payer/
// split; when it's actually paid, the pay modal lets you confirm/change who
// paid this time, and the resulting gasto is tagged shared.{paidBy,splitPct}
// accordingly. This mirrors pickPaidBy/pickSplitSolo from the gasto modal
// (see pickPayPaidBy/pickPaySplitSolo in index.html) — same recompute-on-
// payer-change fix applied from the start here.
section('shared vencimiento — pay-time payer/split recompute');

function makePayShareState(defaultPaidBy, defaultSplitPct) {
  let paidBy = defaultPaidBy, splitPct = defaultSplitPct, soloWho = null;
  const api = {
    pickPaidBy(who) {
      paidBy = who;
      if (soloWho != null) splitPct = (soloWho === paidBy) ? 100 : 0;
    },
    pickSplit(pct) { splitPct = pct; soloWho = null; },
    pickSplitSolo(who) { soloWho = who; splitPct = (who === paidBy) ? 100 : 0; },
    state() { return { paidBy, splitPct }; },
  };
  return api;
}

{
  // Vencimiento's stored default: Fede pays, 50/50. At pay time, Mile actually paid.
  const s = makePayShareState('fede', 50);
  s.pickPaidBy('mile');
  assertEqual(s.state().paidBy, 'mile', 'pay-time payer override replaces the stored default');
  assertEqual(s.state().splitPct, 50, 'plain 50/50 split is untouched by a payer change');
}
{
  // Default was "Solo Mile" (Fede advances it, Mile owes 100%); at pay time Mile herself paid.
  const s = makePayShareState('fede', 50);
  s.pickSplitSolo('mile');
  assertEqual(s.state().splitPct, 0, 'Solo Mile + payer Fede → splitPct 0 before the pay-time change');
  s.pickPaidBy('mile');
  assertEqual(s.state().splitPct, 100, 'switching payer to Mile while "Solo Mile" active recomputes to 100 (no debt)');
}

// ─── applyPayContext — shared gasto created from a paid vencimiento ────────
// Pure reimplementation of the relevant slice of applyPayContext(): the
// created gasto must carry shared:{active:true,paidBy,splitPct} only when the
// vencimiento being paid was marked shared, and must be plain otherwise.
section('applyPayContext — shared flag carried from vencimiento to gasto');

function buildGastoFromPayContext(payContext) {
  const g = { id: 'x', desc: payContext.name, amount: payContext.amount };
  if (payContext.shared) g.shared = { active: true, paidBy: payContext.shared.paidBy, splitPct: payContext.shared.splitPct };
  return g;
}

{
  const g = buildGastoFromPayContext({ name: 'Expensas', amount: 10000, shared: { paidBy: 'mile', splitPct: 50 } });
  assert(!!g.shared && g.shared.active === true, 'shared vencimiento produces a gasto with shared.active true');
  assertEqual(g.shared.paidBy, 'mile', 'gasto.shared.paidBy matches the pay-time decision');
  assertEqual(g.shared.splitPct, 50, 'gasto.shared.splitPct matches the pay-time decision');
}
{
  const g = buildGastoFromPayContext({ name: 'Cable', amount: 5000, shared: null });
  assert(!g.shared, 'a non-shared vencimiento produces a plain gasto with no shared field');
}

// ─── fetchSharedBin — edge-triggered connectivity warning ───────────────────
// Regression test for a bug reported in production: once _sharedBinFetchFailed
// had been set back to false by any successful fetch (including one loaded
// from a stale localStorage cache at boot), every subsequent fetch failure
// was completely silent — no toast, on any device, ever again — because the
// old code gated the warning on `!_sharedBinLoaded`, which stays true forever
// once set. This mirrors the fixed fetchSharedBin() catch-block logic: warn
// only on the transition from working to broken, not on every failed retry.
section('fetchSharedBin — edge-triggered connectivity warning');

function shouldWarnOnFetchFailure(wasFailingBefore) {
  return !wasFailingBefore;
}

{
  assert(shouldWarnOnFetchFailure(false) === true, 'first failure after a working state warns the user');
  assert(shouldWarnOnFetchFailure(true) === false, 'a second consecutive failure does not spam another toast');
}

// ─── Bin compartido: merge por item en vez de sobreescritura ────────────────
// Regresión de la pérdida de datos reportada en producción: al actualizar la
// app en la notebook y cargar un gasto, el PUT subía el array que hubiera en
// memoria (la caché de localStorage, de días atrás) y borraba del bin todo lo
// que se había cargado desde el celular. Después el celular hacía fetch, veía
// sus gastos ausentes del bin y los borraba también en local.
//
// Estas pruebas corren las funciones reales extraídas de index.html, no una
// reimplementación: si el merge vuelve a ser destructivo, fallan.
section('bin compartido — merge por item (last-write-wins)');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => {
    const m = src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'));
    if (!m) throw new Error('no se encontró la función ' + name + ' en index.html');
    return m[0];
  };
  const api = new Function(
    grab('_itemTs') + grab('_normalizeTombs') + grab('_mergeTombs') + grab('mergeSharedLists') +
    'return {_itemTs,_normalizeTombs,_mergeTombs,mergeSharedLists};'
  )();
  const { mergeSharedLists, _normalizeTombs, _mergeTombs } = api;

  // El caso exacto del bug: estado local viejo (solo el gasto A) contra un bin
  // que ya tiene A y B. El merge tiene que conservar B.
  const local = [{ id: 'a', desc: 'viejo', updatedAt: 1000 }];
  const remote = [{ id: 'a', desc: 'viejo', updatedAt: 1000 }, { id: 'b', desc: 'del celu', updatedAt: 5000 }];
  const merged = mergeSharedLists(remote, local, {});
  assertEqual(merged.length, 2, 'un estado local viejo no borra los gastos que solo están en el bin');
  assert(merged.some(g => g.id === 'b'), 'el gasto cargado desde el otro dispositivo sobrevive al push');

  // Al revés: lo que solo existe en local (push que falló) tampoco se pierde.
  const merged2 = mergeSharedLists([{ id: 'a', updatedAt: 1000 }], [{ id: 'a', updatedAt: 1000 }, { id: 'c', updatedAt: 9000 }], {});
  assertEqual(merged2.length, 2, 'lo que solo está en local se suma al bin en vez de descartarse');

  // Mismo id en los dos lados → gana la edición más reciente, no el último push.
  const conflict = mergeSharedLists(
    [{ id: 'a', amount: 100, updatedAt: 8000 }],
    [{ id: 'a', amount: 50, updatedAt: 2000 }],
    {}
  );
  assertEqual(conflict[0].amount, 100, 'ante el mismo gasto editado en los dos lados gana el updatedAt más nuevo');
  const conflict2 = mergeSharedLists(
    [{ id: 'a', amount: 100, updatedAt: 2000 }],
    [{ id: 'a', amount: 50, updatedAt: 8000 }],
    {}
  );
  assertEqual(conflict2[0].amount, 50, 'y gana igual cuando el más nuevo es el local');

  // Sin updatedAt (datos de versiones anteriores) se cae a addedAt.
  const legacy = mergeSharedLists([{ id: 'a', amount: 1, addedAt: 100 }], [{ id: 'a', amount: 2, addedAt: 900 }], {});
  assertEqual(legacy[0].amount, 2, 'items viejos sin updatedAt se comparan por addedAt');
}

// ─── Transferencias: mes por fecha del pago, no por cuándo se cargó ─────────
// Una transferencia hecha en julio pero registrada en agosto aparecía en el
// listado de agosto, porque la lista no filtraba por mes y el orden usaba
// addedAt. _payTs() ancla la transferencia al día que eligió el usuario.
section('transferencias — _payTs y filtro por mes');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const m = src.match(/\nfunction _payTs\([\s\S]*?\n}\n/);
  assert(!!m, '_payTs existe en index.html');
  const _payTs = new Function(m[0] + 'return _payTs;')();

  // Pago hecho el 15/07 pero cargado el 02/08: cuenta como julio.
  const julio = { date: '2026-07-15', addedAt: new Date('2026-08-02T10:00:00').getTime(), amount: 1000 };
  assertEqual(new Date(_payTs(julio)).getMonth(), 6, 'una transferencia del 15/07 cargada en agosto cae en julio');
  assertEqual(new Date(_payTs(julio)).getDate(), 15, 'y conserva el día elegido');

  // Sin p.date (datos viejos) se cae a addedAt en vez de romperse.
  const legacy = { addedAt: new Date('2026-08-02T10:00:00').getTime() };
  assertEqual(_payTs(legacy), legacy.addedAt, 'sin fecha explícita usa addedAt');
  assertEqual(_payTs({}), 0, 'un pago sin ninguna fecha no rompe el orden');

  // El ancla al mediodía evita que el huso corra la fecha un día atrás.
  assertEqual(new Date(_payTs({ date: '2026-08-01' })).getDate(), 1, 'el día 1 no se corre al 31 del mes anterior');

  // El filtro del listado (mismo criterio que _renderSharedContent).
  const enMes = (p, mes, anio) => {
    const d = new Date(_payTs(p));
    return d.getMonth() === mes && d.getFullYear() === anio;
  };
  assertEqual(enMes(julio, 7, 2026), false, 'la transferencia de julio NO aparece en agosto');
  assertEqual(enMes(julio, 6, 2026), true, 'y sí aparece en julio');
  assertEqual(enMes({ date: '2025-08-10' }, 7, 2026), false, 'mismo mes pero otro año no cuenta');
}

// ─── Cuotas: editar una cuota tiene que moverse al proyectado ──────────────
// Bug reportado con capturas: en Agenda, "Cuotas celu" figuraba como 3/4 con
// vencimiento el 3 de agosto, pero en Plan la fila decía "(1c)" y solo tenía
// importe en septiembre. La fila de Proyección se creaba una única vez y no se
// volvía a tocar nunca, así que editar la cuota (monto, total, pagas o fecha)
// no se reflejaba.
section('cuotas — la edición se propaga a la Proyección');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const run = (plan, cq) => new Function(
    grab('cuotaBaseName') + grab('syncCuotaToPlan') +
    `const S={plan:${JSON.stringify(plan)}};` +
    'function uid(){return "nuevo";}' +
    'function planBucket(){return "gasto";}' +
    `const changed=syncCuotaToPlan(${JSON.stringify(cq)});` +
    'return {changed,plan:S.plan};'
  )();

  // El caso de la captura: agenda dice 3/4 con vencimiento en agosto (mes 7),
  // la fila vieja dice "(1c)" solo en septiembre (mes 8).
  const celu = { name: 'Cuotas celu', fee: 58333, total: 4, paid: 2, nextDueDate: '2026-08-03' };
  const r = run([{ id: 'p1', name: 'Cuotas celu (1c)', cat: 'tarjeta', months: { 8: 58333 }, order: 3 }], celu);
  assertEqual(r.changed, true, 'una fila desfasada se marca como cambiada');
  assertEqual(r.plan.length, 1, 'se reescribe la fila existente, no se agrega otra');
  assertEqual(r.plan[0].name, 'Cuotas celu (2c)', 'el label pasa a reflejar las 2 cuotas que faltan');
  assertEqual(JSON.stringify(r.plan[0].months), JSON.stringify({ 7: 58333, 8: 58333 }),
    'aparece en agosto (la que vence) y en septiembre');
  assertEqual(r.plan[0].id, 'p1', 'conserva el id de la fila (no rompe el orden ni las referencias)');
  assertEqual(r.plan[0].order, 3, 'y conserva la posición en la grilla');

  // Editar el monto también tiene que bajar al proyectado.
  const r2 = run([{ id: 'p1', name: 'Cuotas celu (2c)', cat: 'tarjeta', months: { 7: 58333, 8: 58333 }, order: 1 }],
    { ...celu, fee: 60000 });
  assertEqual(r2.plan[0].months[7], 60000, 'cambiar el monto de la cuota actualiza los meses proyectados');

  // Si no cambió nada, no se toca el estado (para no ensuciar el sync).
  const r3 = run([{ id: 'p1', name: 'Cuotas celu (2c)', cat: 'tarjeta', months: { 7: 58333, 8: 58333 }, order: 1 }], celu);
  assertEqual(r3.changed, false, 'una fila que ya está bien no se reescribe');

  // Última cuota paga → la fila deja de proyectar gasto.
  const r4 = run([{ id: 'p1', name: 'Cuotas celu (1c)', cat: 'tarjeta', months: { 8: 58333 }, order: 1 }],
    { ...celu, paid: 4 });
  assertEqual(r4.plan.length, 0, 'cuando no quedan cuotas la fila se saca del proyectado');

  // Sin fila previa se crea.
  const r5 = run([], celu);
  assertEqual(r5.plan.length, 1, 'si no había fila, se crea');
  assertEqual(r5.plan[0].cat, 'tarjeta', 'con la categoría de tarjeta');

  // El nombre base se normaliza: la fila vieja puede tener el sufijo "(3/4)".
  const r6 = run([{ id: 'p1', name: 'Cuotas celu (3/4)', cat: 'tarjeta', months: {}, order: 1 }], celu);
  assertEqual(r6.plan.length, 1, 'reconoce la fila aunque el sufijo sea "(3/4)" y no "(Nc)"');
  assertEqual(r6.plan[0].name, 'Cuotas celu (2c)', 'y la renombra al formato actual');
}

// ─── Adelgazar el payload de sync ──────────────────────────────────────────
// El bin personal llegaba a 78kb de los 100kb que permite JSONBin, y ~30% de
// eso eran claves que no aportan información. Se omiten al serializar; lo
// importante es que la ausencia signifique exactamente lo mismo que el valor
// que se quitó, porque no hay reposición al leer.
section('sync — adelgazado del payload');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];
  const api = new Function(grab('slimGastosParaSync') + grab('slimFinV6') + 'return {slimGastosParaSync,slimFinV6};')();

  const gasto = { id: 'g1', desc: 'Super', amount: 1000, addedAt: 5, weeklyBudget: true, extraBudgetId: null, _sharedBinSynced: true, _dev: 'x' };
  const [slim] = api.slimGastosParaSync([gasto]);
  assertEqual(slim.weeklyBudget, undefined, 'weeklyBudget:true no viaja (el código solo pregunta ===false)');
  assertEqual(slim.extraBudgetId, undefined, 'extraBudgetId:null no viaja (el código solo lo lee como truthy)');
  assertEqual(slim._sharedBinSynced, undefined, '_sharedBinSynced no viaja: es un flag local que se recalcula');
  assertEqual(slim._dev, undefined, 'el sello de dispositivo viejo tampoco');
  assertEqual(slim.amount, 1000, 'los datos reales quedan intactos');
  assertEqual(slim.desc, 'Super', 'la descripción también');

  // Lo que NO vale el default tiene que sobrevivir, o cambiaría el comportamiento.
  const especiales = api.slimGastosParaSync([
    { id: 'a', weeklyBudget: false },
    { id: 'b', extraBudgetId: 'fondo1' },
  ]);
  assertEqual(especiales[0].weeklyBudget, false, 'weeklyBudget:false SÍ viaja: no es el default');
  assertEqual(especiales[1].extraBudgetId, 'fondo1', 'un extraBudgetId real SÍ viaja');

  // No se muta el estado local: solo se adelgaza lo que sale a la red.
  assertEqual(gasto.weeklyBudget, true, 'el gasto original no se toca');
  assertEqual(gasto._sharedBinSynced, true, 'ni su flag local');

  // Un gasto que ya está limpio no se copia al pedo.
  const limpio = { id: 'c', amount: 1 };
  assert(api.slimGastosParaSync([limpio])[0] === limpio, 'si no hay nada que sacar se devuelve el mismo objeto');

  // El resto del estado pasa igual.
  const fin = api.slimFinV6({ gastos: [gasto], accounts: [{ id: 'a1' }], tc: 1300 });
  assertEqual(fin.tc, 1300, 'slimFinV6 no toca el resto del estado');
  assertEqual(fin.accounts.length, 1, 'ni las cuentas');
  assertEqual(fin.gastos[0].weeklyBudget, undefined, 'pero sí adelgaza los gastos');

  // Medido con 400 gastos: 65,2kb → 45,9kb.
  const muchos = Array.from({ length: 400 }, (_, i) => ({ ...gasto, id: 'g' + i }));
  const antes = JSON.stringify(muchos).length, despues = JSON.stringify(api.slimGastosParaSync(muchos)).length;
  assert(despues < antes * 0.75, `el ahorro supera el 25% (fue ${(100 - despues / antes * 100).toFixed(0)}%)`);
}

// ─── Auditoría: peso del payload y firma de las copias ─────────────────────
section('auditoría — copias de seguridad y peso del sync');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  // stampShared ya no escribe _dev por item: no lo lee nadie y con 150 gastos
  // eran ~4kb de los 100kb que permite JSONBin.
  const stamp = new Function(grab('stampShared') + 'function _devId(){return "dispositivo-1";}' +
    'const a=stampShared({id:"x",amount:1,_dev:"viejo"});return a;')();
  assertEqual(stamp._dev, undefined, 'stampShared no deja _dev en el item (y limpia el que hubiera)');
  assert(typeof stamp.updatedAt === 'number', 'pero sí sella updatedAt, que es lo que resuelve conflictos');

  // La firma de la copia tiene que cambiar si cambia un importe: si no, una
  // corrección de monto no genera respaldo.
  const sigDe = new Function(grab('_itemTs') +
    'return (gastos,payments)=>{const _suma=arr=>(arr||[]).reduce((s,x)=>s+_itemTs(x)+(Number(x&&x.amount)||0),0);' +
    "return (gastos||[]).length+'/'+(payments||[]).length+'/'+_suma(gastos)+'/'+_suma(payments);};")();
  const base = [{ id: 'a', amount: 1000, updatedAt: 5 }];
  assert(sigDe(base, []) !== sigDe([{ id: 'a', amount: 2000, updatedAt: 5 }], []),
    'cambiar el importe cambia la firma → se guarda copia');
  assert(sigDe(base, []) === sigDe([{ id: 'a', amount: 1000, updatedAt: 5 }], []),
    'un estado idéntico no genera copia repetida');
  assert(sigDe(base, []) !== sigDe(base, [{ id: 'p', amount: 50, updatedAt: 1 }]),
    'agregar una transferencia también cambia la firma');

  // El registro de recuperados viaja dentro de fin_v6 al bin personal, que ya
  // roza los 100kb: no puede crecer sin tope.
  const revived = new Function(
    grab('getRevived') + grab('markRevived') +
    'const S={};function save(){}' +
    'markRevived(Array.from({length:500},(_,i)=>"g"+i),[]);' +
    'return Object.keys(S._revived.gastos).length;'
  )();
  assertEqual(revived, 300, 'el registro de recuperados se poda a 300 ids');
}

// ─── Restaurar algo que el bin tiene marcado como borrado ──────────────────
// Hallazgo de code review, reproducido en Chromium antes de arreglarlo:
// limpiar el tombstone local no alcanzaba. pushSharedBin() relee el bin, funde
// los tombstones remotos y mergeSharedLists() volvía a descartar el item (su
// updatedAt es viejo, del snapshot). El PUT salía sin él, la UI decía
// "restaurado" y el siguiente fetch lo borraba otra vez en local.
section('restaurar — el tombstone remoto no puede tapar una recuperación');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const api = new Function(
    grab('_itemTs') + grab('_normalizeTombs') + grab('_mergeTombs') + grab('mergeSharedLists') +
    grab('getRevived') + grab('markRevived') + grab('dropRevivedTombs') + grab('clearRevived') +
    'const S={};function save(){}' +
    'return {S,mergeSharedLists,markRevived,dropRevivedTombs,clearRevived,getRevived,_mergeTombs,_normalizeTombs};'
  )();

  const BORRADO = 1000, VIEJO = 500; // el item es anterior a su propio borrado
  const item = { id: 'gViejo', amount: 20000, updatedAt: VIEJO };

  // Sin la excepción, el item restaurado se cae del merge.
  assertEqual(api.mergeSharedLists([], [item], { gViejo: BORRADO }).length, 0,
    'referencia: un item viejo con tombstone posterior se descarta');

  // Marcado como recuperado, el tombstone deja de aplicar.
  api.markRevived(['gViejo'], ['pViejo']);
  const tombs = { gViejo: BORRADO, otro: BORRADO };
  const sacados = api.dropRevivedTombs(tombs, 'gastos');
  assertEqual(sacados, 1, 'se saca el tombstone del item recuperado');
  assertEqual(tombs.gViejo, undefined, 'el borrado ya no figura para ese id');
  assertEqual(tombs.otro, BORRADO, 'y los borrados de otros items no se tocan');
  assertEqual(api.mergeSharedLists([], [item], tombs).length, 1,
    'con el tombstone fuera, el item restaurado sobrevive al merge y entra al PUT');

  // Las transferencias van por su propio mapa.
  const pTombs = { pViejo: BORRADO };
  assertEqual(api.dropRevivedTombs(pTombs, 'pays'), 1, 'las transferencias recuperadas usan su propio registro');
  assertEqual(pTombs.pViejo, undefined, 'y su tombstone también se saca');

  // Marcar un id que no tiene tombstone no rompe ni cuenta de más.
  api.markRevived(['sinTumba'], []);
  assertEqual(api.dropRevivedTombs({ gViejo: BORRADO }, 'gastos'), 1,
    'solo cuenta los tombstones que existían de verdad');

  // Tras un push OK la excepción se limpia: el bin ya quedó escrito sin ese
  // tombstone, no hace falta seguir arrastrándola.
  api.clearRevived();
  assertEqual(api.dropRevivedTombs({ gViejo: BORRADO }, 'gastos'), 0,
    'limpiada la marca, los tombstones vuelven a aplicarse normalmente');

  // Sobrevive a un reload: vive en S, que es lo que se persiste.
  assertEqual(typeof api.S._revived, 'object', 'el registro de recuperados vive en S (se persiste y sincroniza)');
}

// ─── Auditoría de propagación: Agenda ↔ Plan con cuotas ────────────────────
// Las suscripciones y los vencimientos tenían sincronización en los dos
// sentidos; las cuotas quedaban afuera de todos los caminos porque la fila del
// Plan lleva el sufijo "(Nc)" y las comparaciones eran por nombre exacto.
section('propagación — borrar y editar cuotas entre Agenda y Plan');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];
  const stubs = `
    let _saved=false;
    function save(){_saved=true;}
    function uid(){return 'nuevo';}
    function planBucket(){return 'gasto';}
    function scheduleNotifications(){}
    function renderAgenda(){}
    function renderProj(){}
    function renderCalendar(){}
    function logAction(){}
    function showToast(){}
    function $(){return null;}
    const curPage='plan';
  `;

  // Borrar la cuota en Agenda tiene que llevarse la fila del proyectado.
  const delAgenda = new Function(
    grab('cuotaBaseName') + grab('delAgenda') + stubs +
    `const S={plan:[{id:'p1',name:'Cuotas celu (2c)',cat:'tarjeta',months:{7:5,8:5}},{id:'p2',name:'Internet',cat:'gasto',months:{7:9}}],
              agenda:{subs:[],vencimientos:[],inversiones:[],cuotas:[{id:'c1',name:'Cuotas celu',fee:5,total:4,paid:2}]}};
     delAgenda('cuota','c1');
     return {plan:S.plan.map(p=>p.name),cuotas:S.agenda.cuotas.length};`
  )();
  assertEqual(delAgenda.cuotas, 0, 'borrar la cuota la saca de Agenda');
  assertEqual(delAgenda.plan.join(','), 'Internet', 'y también saca su fila del proyectado');

  // Borrar la fila en el Plan tiene que llevarse la cuota de Agenda: si no,
  // ensureAgendaInPlan() la vuelve a crear y la cuota "no se deja borrar".
  const delPlan = new Function(
    grab('cuotaBaseName') + grab('deletePlanItemWithSync') + stubs +
    `const S={plan:[{id:'p1',name:'Cuotas celu (2c)',cat:'tarjeta',months:{}}],
              agenda:{subs:[],vencimientos:[],cuotas:[{id:'c1',name:'Cuotas celu',fee:5,total:4,paid:2}]}};
     deletePlanItemWithSync('p1','Cuotas celu (2c)');
     return {plan:S.plan.length,cuotas:S.agenda.cuotas.length};`
  )();
  assertEqual(delPlan.plan, 0, 'borrar la fila la saca del Plan');
  assertEqual(delPlan.cuotas, 0, 'y saca la cuota de Agenda, así no reaparece en el próximo render');

  // Editar el importe de la cuota desde el Plan tiene que bajar a Agenda.
  const editPlan = new Function(
    grab('cuotaBaseName') + grab('syncPlanEditToAgenda') + stubs +
    `const S={agenda:{subs:[],vencimientos:[],cuotas:[{id:'c1',name:'Cuotas celu',fee:58333,total:4,paid:2}]}};
     syncPlanEditToAgenda('Cuotas celu (2c)','Cuotas celu (2c)',70000);
     return S.agenda.cuotas[0];`
  )();
  assertEqual(editPlan.fee, 70000, 'cambiar el importe en el Plan actualiza la cuota en Agenda');
  assertEqual(editPlan.name, 'Cuotas celu', 'y el nombre en Agenda queda sin el sufijo "(Nc)"');

  // Una suscripción con el mismo nombre que una cuota no se pisa.
  const noCruce = new Function(
    grab('cuotaBaseName') + grab('syncPlanEditToAgenda') + stubs +
    `const S={agenda:{subs:[{id:'s1',name:'Internet',amount:15800}],vencimientos:[],cuotas:[{id:'c1',name:'Cuotas celu',fee:5,total:4,paid:2}]}};
     syncPlanEditToAgenda('Internet','Internet',16000);
     return {sub:S.agenda.subs[0].amount,cuota:S.agenda.cuotas[0].fee};`
  )();
  assertEqual(noCruce.sub, 16000, 'editar una suscripción sigue funcionando');
  assertEqual(noCruce.cuota, 5, 'y no toca las cuotas');
}

// ─── calcSharedDebtDetail: el saldo, item por item ─────────────────────────
// El desglose que exporta "📋 Exportar datos de control" sale de la misma
// función que calcula el saldo que se muestra, así que auditarlo es auditar el
// cálculo real. Estos casos se pueden verificar a mano.
section('saldo compartido — desglose del cálculo');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const calc = ({ gastos, pagos, yo }) => new Function(
    grab('calcSharedDebtDetail') +
    `const S={gastos:${JSON.stringify(gastos)}};` +
    'const _sharedBinGastos=[],_partnerGastos=[],_sharedBinLoaded=false;' +
    'function compBinConfigured(){return false;}' +
    `function _allKnownPayments(){return ${JSON.stringify(pagos || [])};}` +
    `function getMyName(){return ${JSON.stringify(yo || 'fede')};}` +
    'return calcSharedDebtDetail();'
  )();

  const g = (id, monto, paidBy, splitPct) => ({ id, desc: id, amount: monto, addedAt: 0, shared: { active: true, paidBy, splitPct } });

  // 50/50 pagado por mí: la pareja me debe la mitad.
  assertEqual(calc({ gastos: [g('a', 45000, 'fede', 50)] }).saldo, 22500, '50/50 que pagué yo → me deben la mitad');
  // 50/50 pagado por ella: le debo la mitad.
  assertEqual(calc({ gastos: [g('a', 30000, 'mile', 50)] }).saldo, -15000, '50/50 que pagó ella → le debo la mitad');
  // splitPct=0 → lo adelanté pero es 100% de ella.
  assertEqual(calc({ gastos: [g('a', 10000, 'fede', 0)] }).saldo, 10000, 'splitPct 0 pagado por mí → me debe todo');
  // splitPct=100 → es 100% mío, nadie debe nada.
  assertEqual(calc({ gastos: [g('a', 8000, 'fede', 100)] }).saldo, 0, 'splitPct 100 pagado por mí → sin deuda');
  // Sin splitPct se asume 50.
  assertEqual(calc({ gastos: [g('a', 1000, 'fede', null)] }).saldo, 500, 'sin splitPct se reparte 50/50');

  // Las transferencias descuentan del lado correcto.
  assertEqual(calc({ gastos: [], pagos: [{ id: 'p', paidBy: 'mile', amount: 5000 }] }).saldo, -5000,
    'si ella transfiere, baja lo que me debe');
  assertEqual(calc({ gastos: [], pagos: [{ id: 'p', paidBy: 'fede', amount: 2000 }] }).saldo, 2000,
    'si transfiero yo, baja lo que le debo');

  // Caso completo, verificado a mano:
  // +22500 (50/50 mío) −15000 (50/50 suyo) +10000 (100% de ella) +0 (100% mío)
  // −5000 (transfirió ella) +2000 (transferí yo) = 14500
  const full = calc({
    gastos: [g('g1', 45000, 'fede', 50), g('g2', 30000, 'mile', 50), g('g3', 10000, 'fede', 0), g('g4', 8000, 'fede', 100)],
    pagos: [{ id: 'p1', paidBy: 'mile', amount: 5000 }, { id: 'p2', paidBy: 'fede', amount: 2000 }],
  });
  assertEqual(full.saldo, 14500, 'caso completo: el saldo da lo mismo que la cuenta a mano');
  assertEqual(full.laParejaTeDebe, 27500, 'el bruto que me deben se informa aparte');
  assertEqual(full.leDebés, 13000, 'y el bruto que debo también');
  assertEqual(full.saldo, full.laParejaTeDebe - full.leDebés, 'el saldo es la resta de los dos brutos');
  assertEqual(full.gastos.length, 4, 'el desglose lista todos los gastos contados');
  assertEqual(full.pagos.length, 2, 'y todas las transferencias contadas');
  assertEqual(full.gastos[0].leDebeAlOtro, 22500, 'cada línea muestra cuánto aporta al saldo');

  // El mismo set visto desde el otro lado tiene que dar el saldo espejado.
  const desdeElla = calc({
    gastos: [g('g1', 45000, 'fede', 50), g('g2', 30000, 'mile', 50), g('g3', 10000, 'fede', 0), g('g4', 8000, 'fede', 100)],
    pagos: [{ id: 'p1', paidBy: 'mile', amount: 5000 }, { id: 'p2', paidBy: 'fede', amount: 2000 }],
    yo: 'mile',
  });
  assertEqual(desdeElla.saldo, -14500, 'desde el otro dispositivo el saldo es el mismo con el signo dado vuelta');
}

// ─── _allKnownPayments: una transferencia nunca vive en un solo lado ────────
// Antes cada transferencia existía solo donde se había cargado: el snapshot
// copiaba únicamente las propias, applyPayload ignoraba shared_payments y las
// de la pareja no se guardaban nunca. Perder ese dispositivo (o el bin) las
// perdía. Ahora las tres fuentes se unen, se deduplican y se guardan en local.
section('transferencias — unión de todas las fuentes');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const build = ({ local, bin, partner, tombs }) => new Function(
    grab('_itemTs') + grab('_normalizeTombs') + grab('_allKnownPayments') +
    `const S=${JSON.stringify({ _pTombs: tombs || {} })};` +
    `const _sharedBinPayments=${JSON.stringify(bin || [])};` +
    `const _partnerPayments=${JSON.stringify(partner || [])};` +
    `function getSharedPayments(){return ${JSON.stringify(local || [])};}` +
    'function getDeletedSharedPaymentIds(){return [];}' +
    'return _allKnownPayments();'
  )();

  const mia = { id: 'p1', paidBy: 'fede', amount: 1000, addedAt: 100 };
  const suya = { id: 'p2', paidBy: 'mile', amount: 2000, addedAt: 200, _partner: true };
  const delBin = { id: 'p3', paidBy: 'fede', amount: 3000, addedAt: 300 };

  const todas = build({ local: [mia], bin: [delBin], partner: [suya] });
  assertEqual(todas.length, 3, 'se juntan las propias, las del bin y las de la pareja');
  assert(todas.every(p => p._partner === undefined), 'se limpia el flag _partner antes de guardar');

  // La misma transferencia en varias fuentes cuenta una sola vez (si no, el
  // saldo de la deuda se descontaría dos veces).
  const dup = build({ local: [mia], bin: [{ ...mia }], partner: [{ ...mia, _partner: true }] });
  assertEqual(dup.length, 1, 'la misma transferencia en las tres fuentes no se duplica');

  // Una transferencia borrada no vuelve por estar colgada en otra fuente.
  const borrada = build({ local: [], bin: [mia], partner: [], tombs: { p1: 500 } });
  assertEqual(borrada.length, 0, 'un tombstone posterior la saca de todas las fuentes');

  // Pero una transferencia posterior al borrado sí sobrevive.
  const nueva = build({ local: [{ ...mia, addedAt: 900 }], bin: [], partner: [], tombs: { p1: 500 } });
  assertEqual(nueva.length, 1, 'una transferencia más nueva que el tombstone se conserva');
}

section('bin compartido — tombstones con fecha');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];
  const api = new Function(
    grab('_itemTs') + grab('_normalizeTombs') + grab('_mergeTombs') + grab('mergeSharedLists') +
    'return {_normalizeTombs,_mergeTombs,mergeSharedLists};'
  )();
  const { mergeSharedLists, _normalizeTombs, _mergeTombs } = api;

  // Un borrado explícito sí saca el item (antes esto se deducía por ausencia,
  // que es lo que rompía en cuanto el bin quedaba incompleto).
  const afterDelete = mergeSharedLists([{ id: 'a', updatedAt: 1000 }], [], { a: 4000 });
  assertEqual(afterDelete.length, 0, 'un tombstone posterior elimina el item del merge');

  // Pero una edición posterior al borrado gana: el otro lo revivió a propósito.
  const revived = mergeSharedLists([], [{ id: 'a', updatedAt: 9000 }], { a: 4000 });
  assertEqual(revived.length, 1, 'una edición posterior al tombstone revive el item');

  // Los ids legacy sin fecha (S._deletedGastoIds) entran como ts=1, así que
  // cualquier item con fecha real les gana en vez de desaparecer.
  const legacyTombs = _normalizeTombs(null, ['a']);
  assertEqual(legacyTombs.a, 1, 'los borrados viejos sin fecha entran con ts=1');
  assertEqual(mergeSharedLists([{ id: 'a', updatedAt: 5 }], [], legacyTombs).length, 1,
    'un tombstone legacy no borra un item con fecha real');

  // Se acepta tanto el formato mapa como el array viejo.
  assertEqual(_normalizeTombs({ x: 700 }, []).x, 700, 'formato mapa {id: ts}');
  assertEqual(_normalizeTombs(['y'], []).y, 1, 'formato array de ids (versiones anteriores)');

  // El merge de tombstones se queda con el borrado más reciente y se poda.
  assertEqual(_mergeTombs({ a: 10 }, { a: 99 }).a, 99, 'gana el tombstone más nuevo');
  const many = {}; for (let i = 0; i < 400; i++) many['id' + i] = i;
  assertEqual(Object.keys(_mergeTombs(many, {})).length, 300, 'el mapa de tombstones se poda a 300');
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

// ─── isSplit5050: totales por categoría en Compartidos ───────────────────────
// El total de cada categoría (y el "c/u" del popup) cuenta únicamente los
// gastos repartidos mitad y mitad. Los de reparto desigual —el 100/0 de "lo
// pagué yo pero es todo de ella"— quedan afuera, así el "c/u" siempre es
// exactamente la mitad del total mostrado.
section('isSplit5050');
{
  const isSplit5050 = g => (g.shared?.splitPct ?? 50) === 50;
  const sh = (splitPct, paidBy = 'fede') => ({shared: {active: true, paidBy, splitPct}});

  assert(isSplit5050(sh(50)),                     'splitPct 50 → cuenta');
  assert(isSplit5050({shared: {active: true, paidBy: 'fede'}}), 'splitPct ausente → default 50, cuenta');
  assert(!isSplit5050(sh(0)),                     'splitPct 0 (lo adelanté, es todo de ella) → no cuenta');
  assert(!isSplit5050(sh(100)),                   'splitPct 100 (solo mío) → no cuenta');
  assert(!isSplit5050(sh(70)),                    'splitPct 70 → no cuenta');

  const items = [
    {cat: 'hogar', amount: 22197, ...sh(50)},
    {cat: 'hogar', amount: 15800, ...sh(50, 'mile')},
    {cat: 'hogar', amount: 90000, ...sh(0)},      // de Mile, lo pagué yo
    {cat: 'hogar', amount: 40000, ...sh(100)},    // solo mío
    {cat: 'super', amount: 10000, ...sh(50)},
  ];
  const hogar = items.filter(g => g.cat === 'hogar' && isSplit5050(g));
  const total = hogar.reduce((s, g) => s + g.amount, 0);
  assertEqual(hogar.length, 2,                'hogar: quedan solo los 2 gastos 50/50');
  assertEqual(total, 37997,                   'total de hogar excluye el 0% y el 100%');
  assertEqual(Math.round(total / 2), 18999,   'c/u = la mitad exacta del total filtrado');
}

// ─── Google Calendar deep links ──────────────────────────────────────────────
// Mirror de gcalEventUrl/gcalRRule en index.html. El evento es de día completo,
// así que "dates" va inicio/fin con el fin exclusivo (día siguiente), y la
// repetición sale de la periodicidad del ítem.
section('gcalEventUrl — deep link de Google Calendar');
{
  function dateKey(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  function gcalMonthlyRule(day) {
    if (day >= 31) return 'FREQ=MONTHLY;BYMONTHDAY=-1';
    if (day > 28) {
      const cands = [];
      for (let d = 28; d <= day; d++) cands.push(d);
      return `FREQ=MONTHLY;BYMONTHDAY=${cands.join(',')};BYSETPOS=-1`;
    }
    return 'FREQ=MONTHLY';
  }
  function gcalRRule(item) {
    const day = item.date ? parseInt(String(item.date).slice(8, 10), 10) : 0;
    if (item.type === 'cuota') return item.cuotasLeft > 1 ? `RRULE:${gcalMonthlyRule(day)};COUNT=${item.cuotasLeft}` : '';
    if (item.period === 'unica') return '';
    if (item.period === 'anual') return String(item.date).slice(5, 10) === '02-29'
      ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1'
      : 'RRULE:FREQ=YEARLY';
    return `RRULE:${gcalMonthlyRule(day)}`;
  }
  function gcalEventUrl(item) {
    if (!item || !item.date) return '';
    const day = String(item.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
    const d = new Date(day + 'T12:00:00');
    if (isNaN(d.getTime())) return '';
    const start = day.replace(/-/g, '');
    d.setDate(d.getDate() + 1);
    const end = dateKey(d.getFullYear(), d.getMonth(), d.getDate()).replace(/-/g, '');
    const ico = item.type === 'sub' ? '🔄' : item.type === 'cuota' ? '💳' : '🔔';
    const tipo = item.type === 'sub' ? 'Suscripción' : item.type === 'cuota' ? 'Cuota de tarjeta' : 'Vencimiento';
    const title = `${ico} ${item.name}` + (item.amount > 0 ? ` · ${fARS(item.amount)}` : '');
    const details = [`${tipo}: ${item.name}`, item.amount > 0 ? `Monto: ${fARS(item.amount)}` : '',
      item.detail ? `Detalle: ${item.detail}` : '', 'Creado desde Finanzas'].filter(Boolean).join('\n');
    const p = new URLSearchParams({action: 'TEMPLATE', text: title, dates: `${start}/${end}`, details});
    let url = 'https://calendar.google.com/calendar/render?' + p.toString();
    const rrule = gcalRRule(item);
    if (rrule) url += '&recur=' + encodeURIComponent(rrule);
    return url;
  }
  const q = (url, key) => new URL(url).searchParams.get(key);

  const sub = {type: 'sub', name: 'Netflix', amount: 7500, date: '2026-08-05', period: 'mensual'};
  const u = gcalEventUrl(sub);
  assertEqual(q(u, 'action'), 'TEMPLATE',              'action=TEMPLATE');
  assertEqual(q(u, 'dates'), '20260805/20260806',      'día completo: fin exclusivo = día siguiente');
  assertEqual(q(u, 'recur'), 'RRULE:FREQ=MONTHLY',     'mensual → FREQ=MONTHLY');
  assert(q(u, 'text').includes('Netflix'),             'el título lleva el nombre del ítem');
  assert(q(u, 'text').includes('7.500'),               'el título lleva el monto formateado');
  assert(u.startsWith('https://calendar.google.com/calendar/render?'), 'apunta al endpoint render');

  assertEqual(q(gcalEventUrl({...sub, period: 'anual'}), 'recur'), 'RRULE:FREQ=YEARLY', 'anual → FREQ=YEARLY');
  assertEqual(gcalEventUrl({...sub, period: 'unica'}).includes('recur='), false, 'una vez → sin recur');

  // Fin de mes: el día siguiente cruza al mes (y al año) que corresponde.
  assertEqual(q(gcalEventUrl({...sub, date: '2026-08-31'}), 'dates'), '20260831/20260901', 'fin de mes → 1° del siguiente');
  assertEqual(q(gcalEventUrl({...sub, date: '2026-12-31'}), 'dates'), '20261231/20270101', 'fin de año → 1° de enero');
  assertEqual(q(gcalEventUrl({...sub, date: '2028-02-28'}), 'dates'), '20280228/20280229', 'año bisiesto → 29 de febrero');

  // Las cuotas se cortan solas: COUNT = las que faltan.
  const cuota = {type: 'cuota', name: 'iPhone', amount: 90000, date: '2026-08-10', period: 'mensual', cuotasLeft: 9};
  assertEqual(q(gcalEventUrl(cuota), 'recur'), 'RRULE:FREQ=MONTHLY;COUNT=9', 'cuotas → COUNT con las pendientes');
  assertEqual(gcalEventUrl({...cuota, cuotasLeft: 1}).includes('recur='), false, 'última cuota → evento suelto');

  // Fechas ausentes o basura no generan link (el modal las muestra deshabilitadas).
  assertEqual(gcalEventUrl({...sub, date: ''}), '',        'sin fecha → sin link');
  assertEqual(gcalEventUrl({...sub, date: 'mañana'}), '',  'fecha inválida → sin link');
  assertEqual(gcalEventUrl(null), '',                      'ítem nulo → sin link');

  // Repetición mensual con días que no existen en todos los meses. Un
  // FREQ=MONTHLY pelado saltearía febrero (y los meses de 30 días si el
  // vencimiento es el 31), así que se acota con BYMONTHDAY/BYSETPOS.
  assertEqual(q(gcalEventUrl({...sub, date: '2026-08-31'}), 'recur'),
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1',                   'día 31 → último día del mes');
  assertEqual(q(gcalEventUrl({...sub, date: '2026-08-30'}), 'recur'),
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30;BYSETPOS=-1', 'día 30 → se acota en febrero');
  assertEqual(q(gcalEventUrl({...sub, date: '2026-08-29'}), 'recur'),
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29;BYSETPOS=-1',    'día 29 → se acota en febrero');
  assertEqual(q(gcalEventUrl({...sub, date: '2026-08-28'}), 'recur'),
    'RRULE:FREQ=MONTHLY',                                  'día 28 → existe siempre, sin acotar');
  assertEqual(q(gcalEventUrl({...cuota, date: '2026-08-31'}), 'recur'),
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=9',            'las cuotas del 31 también se acotan');
  assertEqual(q(gcalEventUrl({...sub, date: '2028-02-29', period: 'anual'}), 'recur'),
    'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1', '29 de feb anual → cae todos los años');
  assertEqual(q(gcalEventUrl({...sub, date: '2026-08-31', period: 'anual'}), 'recur'),
    'RRULE:FREQ=YEARLY',                                   'anual en fecha normal → sin acotar');

  // Expansión de la regla mensual (subset de RFC 5545: BYMONTHDAY + BYSETPOS)
  // para verificar que las fechas que genera son las esperadas, no solo que el
  // string tenga la forma correcta.
  function expandMonthly(rrule, startDate, n) {
    const parts = Object.fromEntries(rrule.replace(/^RRULE:/, '').split(';').map(kv => kv.split('=')));
    const byday = parts.BYMONTHDAY ? parts.BYMONTHDAY.split(',').map(Number) : null;
    const start = new Date(startDate + 'T12:00:00');
    const startDay = start.getDate();
    const out = [];
    for (let i = 0; out.length < n && i < n * 3; i++) {
      const y = start.getFullYear(), mo = start.getMonth() + i;
      const last = new Date(y, mo + 1, 0).getDate();
      let day;
      if (!byday) {
        day = startDay <= last ? startDay : null;              // FREQ=MONTHLY pelado: saltea
      } else if (byday.length === 1 && byday[0] === -1) {
        day = last;
      } else {
        const exist = byday.filter(d => d <= last);
        day = exist.length ? (parts.BYSETPOS === '-1' ? exist[exist.length - 1] : exist[0]) : null;
      }
      if (day == null) continue;
      const d = new Date(y, mo, day);
      out.push(dateKey(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    return out;
  }
  const occ = (date) => expandMonthly(gcalRRule({type: 'sub', period: 'mensual', date}), date, 8);

  assertEqual(occ('2026-08-31').join(' '),
    '2026-08-31 2026-09-30 2026-10-31 2026-11-30 2026-12-31 2027-01-31 2027-02-28 2027-03-31',
    'día 31 cae todos los meses (fin de mes, febrero incluido)');
  assertEqual(occ('2026-12-30').join(' '),
    '2026-12-30 2027-01-30 2027-02-28 2027-03-30 2027-04-30 2027-05-30 2027-06-30 2027-07-30',
    'día 30 cae todos los meses y en febrero se corre al 28');
  assertEqual(occ('2027-12-29').join(' '),
    '2027-12-29 2028-01-29 2028-02-29 2028-03-29 2028-04-29 2028-05-29 2028-06-29 2028-07-29',
    'día 29 en año bisiesto cae el 29 de febrero');
  assertEqual(occ('2026-12-15').slice(0, 3).join(' '), '2026-12-15 2027-01-15 2027-02-15',
    'día 15 no necesita acotarse');
  // Sin el fix, la regla pelada se saltea los meses cortos.
  assertEqual(expandMonthly('RRULE:FREQ=MONTHLY', '2026-08-31', 3).join(' '),
    '2026-08-31 2026-10-31 2026-12-31',
    'referencia: FREQ=MONTHLY pelado sí se saltea septiembre y noviembre');

  // Nombres con caracteres especiales tienen que sobrevivir el round-trip.
  const raro = gcalEventUrl({...sub, name: 'Luz & Gas #2 (Mile)'});
  assertEqual(q(raro, 'text').includes('Luz & Gas #2 (Mile)'), true, 'el & y el # se codifican y vuelven intactos');
  assert(q(raro, 'details').includes('Creado desde Finanzas'), 'la descripción marca el origen');
}


// ─── Cuotas: corregir el número de cuota y el nombre ───────────────────────
// Bug reportado: se marcó "Pagué" cuando la agenda decía 3/3 pero en realidad
// era la 2/3. La cuota se borraba de la Agenda en el acto y no había forma de
// volver atrás; además el número de cuota no se podía editar desde Gastos ni el
// nombre desde Agenda (había que borrar y volver a cargar todo).
section('cuotas — corregir cuota mal marcada, número y nombre');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];
  const helpers = `
    function cuotaDone(cq){return !!cq&&(parseInt(cq.paid)||0)>=(parseInt(cq.total)||0);}
    const CUOTA_KEEP_DONE_MS=180*24*60*60*1000;
    function uid(){return 'nuevo';}
    function planBucket(){return 'gasto';}
  `;

  // ── markCuotaDoneState: acota y marca/desmarca terminada ────────────────
  const done = (cq) => new Function(
    helpers + grab('markCuotaDoneState') +
    `const cq=${JSON.stringify(cq)};const r=markCuotaDoneState(cq);return {r,cq};`
  )();

  const d1 = done({ total: 3, paid: 3 });
  assertEqual(d1.r, true, 'pagar la última cuota deja la compra en estado terminada');
  assert(d1.cq.completedAt > 0, 'y le queda la marca de cuándo terminó (para poder limpiarla después)');

  const d2 = done({ total: 3, paid: 2, completedAt: 111 });
  assertEqual(d2.r, false, 'bajar las cuotas pagadas la reactiva');
  assertEqual(d2.cq.completedAt, undefined, 'y le saca la marca de terminada');

  const d3 = done({ total: 3, paid: 9 });
  assertEqual(d3.cq.paid, 3, 'no se puede quedar con más cuotas pagadas que el total');
  const d4 = done({ total: 3, paid: -2 });
  assertEqual(d4.cq.paid, 0, 'ni con un número negativo');

  // ── pruneCuotasTerminadas: las terminadas viejas se limpian solas ───────
  const prune = new Function(
    helpers + grab('pruneCuotasTerminadas') +
    `const now=1000*24*3600*1000;
     const S={agenda:{cuotas:[
       {id:'a',total:3,paid:3,completedAt:now-10*24*3600*1000},
       {id:'b',total:3,paid:3,completedAt:now-200*24*3600*1000},
       {id:'c',total:3,paid:1}
     ]}};
     const changed=pruneCuotasTerminadas(now);
     return {changed,ids:S.agenda.cuotas.map(c=>c.id)};`
  )();
  assertEqual(prune.ids.join(','), 'a,c', 'la terminada reciente se conserva y la vieja se limpia');
  assertEqual(prune.changed, true, 'y se avisa que hubo cambios para persistir');

  // ── renameCuotaEverywhere: Agenda + Plan + Gastos a la vez ─────────────
  const ren = new Function(
    grab('cuotaBaseName') + grab('renameCuotaEverywhere') +
    `const S={
       agenda:{cuotas:[{id:'c1',name:'Notebok'},{id:'c2',name:'Otra cosa'}]},
       plan:[{id:'p1',name:'Notebok (9c)'},{id:'p2',name:'Internet'}],
       gastos:[{id:'g1',desc:'Notebok (3/12)',cat:'tarjeta',cuotaTotal:12},
               {id:'g2',desc:'Notebok',cat:'tarjeta',cuotaTotal:12},
               {id:'g3',desc:'Notebok',cat:'comida'}]
     };
     const changed=renameCuotaEverywhere('Notebok','Notebook');
     return {changed,cuota:S.agenda.cuotas[0].name,otra:S.agenda.cuotas[1].name,
             plan:S.plan.map(p=>p.name),gastos:S.gastos.map(g=>g.desc)};`
  )();
  assertEqual(ren.cuota, 'Notebook', 'renombrar la cuota corrige el nombre en Agenda');
  assertEqual(ren.plan[0], 'Notebook (9c)', 'la fila del proyectado conserva el sufijo "(Nc)"');
  assertEqual(ren.gastos[0], 'Notebook (3/12)', 'los gastos ya registrados conservan el "(x/y)"');
  assertEqual(ren.gastos[1], 'Notebook', 'y el gasto sin sufijo también se renombra');
  assertEqual(ren.gastos[2], 'Notebok', 'un gasto homónimo de otra categoría no se toca');
  assertEqual(ren.otra, 'Otra cosa', 'ni otra cuota distinta');

  // ── syncGastoCuotaToAgenda: el número de cuota del gasto manda ─────────
  const sync = (gasto, cuotas, plan, oldDesc) => new Function(
    helpers + grab('cuotaBaseName') + grab('renameCuotaEverywhere') +
    grab('markCuotaDoneState') + grab('dateKey') + grab('syncCuotaToPlan') +
    grab('syncGastoCuotaToAgenda') +
    `const S={agenda:{subs:[],vencimientos:[],inversiones:[],cuotas:${JSON.stringify(cuotas)}},
              plan:${JSON.stringify(plan || [])},gastos:[${JSON.stringify(gasto)}]};` +
    `const cq=syncGastoCuotaToAgenda(S.gastos[0],${JSON.stringify(oldDesc || gasto.desc)});` +
    `return {cq,cuotas:S.agenda.cuotas,plan:S.plan};`
  )();

  // El caso reportado: la compra quedó como 3/3 (terminada) y en realidad iba
  // por la 2/3. Corregirlo desde el gasto la revive con la 3 pendiente.
  const fix = sync(
    { id: 'g1', desc: 'Zapatillas', cat: 'tarjeta', amount: 30000, year: 2026, month: 6, day: 10, cuotaTotal: 3, cuotaActual: 2 },
    [{ id: 'c1', name: 'Zapatillas', fee: 30000, total: 3, paid: 3, completedAt: 123 }]
  );
  assertEqual(fix.cuotas[0].paid, 2, 'corregir el número de cuota en Gastos baja a la Agenda');
  assertEqual(fix.cuotas[0].completedAt, undefined, 'y la compra deja de estar terminada');
  assertEqual(fix.cuotas[0].nextDueDate, '2026-08-10', 'la próxima cuota vence un mes después del gasto');
  assertEqual(fix.plan.length, 1, 'y vuelve a proyectarse');
  assertEqual(fix.plan[0].name, 'Zapatillas (1c)', 'con la cuota que falta');

  // Corregir para arriba también funciona (y deja la compra terminada).
  const last = sync(
    { id: 'g1', desc: 'Zapatillas', cat: 'tarjeta', amount: 30000, year: 2026, month: 6, day: 10, cuotaTotal: 3, cuotaActual: 3 },
    [{ id: 'c1', name: 'Zapatillas', fee: 30000, total: 3, paid: 1, nextDueDate: '2026-06-10' }],
    [{ id: 'p1', name: 'Zapatillas (2c)', cat: 'tarjeta', months: { 6: 30000, 7: 30000 } }]
  );
  assertEqual(last.cuotas[0].paid, 3, 'marcar la última cuota desde Gastos la completa');
  assert(last.cuotas[0].completedAt > 0, 'queda archivada como terminada, no se borra');
  assertEqual(last.plan.length, 0, 'y sale del proyectado');

  // Sacarle las cuotas al gasto (total 1) la termina en vez de dejarla colgada.
  const suelto = sync(
    { id: 'g1', desc: 'Zapatillas', cat: 'tarjeta', amount: 30000, year: 2026, month: 6, day: 10 },
    [{ id: 'c1', name: 'Zapatillas', fee: 30000, total: 3, paid: 1 }],
    [{ id: 'p1', name: 'Zapatillas (2c)', cat: 'tarjeta', months: { 6: 30000, 7: 30000 } }]
  );
  assertEqual(suelto.cq, null, 'un gasto sin cuotas no deja cuota activa');
  assertEqual(suelto.plan.length, 0, 'y limpia la fila del proyectado');

  // Renombrar el gasto arrastra la cuota, no crea una segunda.
  const renGasto = sync(
    { id: 'g1', desc: 'Zapatillas Nike', cat: 'tarjeta', amount: 30000, year: 2026, month: 6, day: 10, cuotaTotal: 3, cuotaActual: 1 },
    [{ id: 'c1', name: 'Zapatillas', fee: 30000, total: 3, paid: 1 }],
    [],
    'Zapatillas'
  );
  assertEqual(renGasto.cuotas.length, 1, 'renombrar el gasto no duplica la cuota en Agenda');
  assertEqual(renGasto.cuotas[0].name, 'Zapatillas Nike', 'y le baja el nombre nuevo');
  assertEqual(renGasto.plan[0].name, 'Zapatillas Nike (2c)', 'el proyectado también queda con el nombre nuevo');

  // Si el gasto en cuotas no estaba en Agenda, se crea (no se pierde el link).
  const nueva = sync(
    { id: 'g1', desc: 'Heladera', cat: 'tarjeta', amount: 50000, year: 2026, month: 0, day: 5, cuotaTotal: 6, cuotaActual: 2 },
    []
  );
  assertEqual(nueva.cuotas.length, 1, 'un gasto en cuotas sin cuota en Agenda la crea');
  assertEqual(nueva.cuotas[0].startDate, '2025-12-01', 'con el mes de arranque calculado desde la cuota actual');
}


// ─── Pagar desde la Agenda: deshacer tiene que revertir TODO ───────────────
// Solo las suscripciones tenían undo. Pagar un vencimiento no se podía
// deshacer, y si era de período único el ítem se borraba de la Agenda para
// siempre (mismo molde que la cuota que desaparecía al marcar la última).
// Además la fila del proyectado quedaba colgada y el saldo descontado no
// volvía a la cuenta.
section('agenda — deshacer el pago de un vencimiento');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const stubs = `
    let _payContext=null,_lastPaySnap=null,_payAcctSnap=null,funds=[];
    let _undoFn=null;
    function showToast(m,fn){if(typeof fn==='function')_undoFn=fn;}
    function save(){} function uid(){return 'g-nuevo';}
    function scheduleNotifications(){} function renderAgenda(){} function renderProj(){}
    function renderGastos(){} function render(){} function renderCalendar(){}
    function refreshAgendaViews(){} function refreshPlanViews(){} function refreshGastosViews(){}
    function scheduleRender(){} function syncPush(){} function notifyPartnerNewShared(){}
    function closeOv(){} function $(){return null;}
    function compBinConfigured(){return false;} function upsertSharedBinGasto(){}
    function markCuotaDoneState(){return false;} function syncCuotaToPlan(){}
    function planBucket(){return 'gasto';} function logAction(){}
    function cuotaBaseName(n){return String(n||'');}
    const curPage='agenda';
  `;

  const run = (period, deducir) => new Function(
    stubs + grab('nextMonthDate') + grab('applyPayContext') + grab('confirmPayDeduct') +
    `S={tc:1300,
        accounts:[{id:'a1',name:'Galicia',type:'bancaria',amount:500000,currency:'ARS'}],
        gastos:[],
        plan:[{id:'p1',name:'Patente auto',cat:'gasto',months:{7:90000}}],
        agenda:{subs:[],inversiones:[],cuotas:[],
          vencimientos:[{id:'v1',name:'Patente auto',amount:90000,date:'2026-08-20',period:'${period}'}]}};
     _payContext={type:'venc',id:'v1',amount:90000,name:'Patente auto',nextDate:'2026-09-20'};
     ${deducir ? "confirmPayDeduct('a1');" : "applyPayContext();"}
     const pagado={vencs:S.agenda.vencimientos.length,plan:S.plan.length,
                   saldo:S.accounts[0].amount,gastos:S.gastos.length,hayUndo:!!_undoFn};
     if(_undoFn)_undoFn();
     const deshecho={vencs:S.agenda.vencimientos.length,plan:S.plan.map(p=>p.name),
                     saldo:S.accounts[0].amount,gastos:S.gastos.length,
                     fecha:S.agenda.vencimientos[0]&&S.agenda.vencimientos[0].date,
                     mesPlan:S.plan[0]&&S.plan[0].months&&S.plan[0].months[7]};
     return {pagado,deshecho};`
  )();

  // Vencimiento de una sola vez, descontando de una cuenta.
  const unico = run('unica', true);
  assertEqual(unico.pagado.vencs, 0, 'un vencimiento único se cumple y sale de la Agenda');
  assertEqual(unico.pagado.plan, 0, 'y su fila deja de proyectar gasto (antes quedaba colgada)');
  assertEqual(unico.pagado.saldo, 410000, 'el importe se descuenta de la cuenta elegida');
  assertEqual(unico.pagado.hayUndo, true, 'ahora ofrece deshacer (antes no había toast)');
  assertEqual(unico.deshecho.vencs, 1, 'deshacer devuelve el vencimiento a la Agenda');
  assertEqual(unico.deshecho.fecha, '2026-08-20', 'con su fecha original');
  assertEqual(unico.deshecho.plan.join(','), 'Patente auto', 'y devuelve la fila del proyectado');
  assertEqual(unico.deshecho.saldo, 500000, 'y la plata a la cuenta');
  assertEqual(unico.deshecho.gastos, 0, 'y borra el gasto que había registrado');

  // Vencimiento recurrente: no se borra, avanza la fecha — y también se deshace.
  const recur = run('mensual', true);
  assertEqual(recur.pagado.vencs, 1, 'un vencimiento mensual no se borra al pagarlo');
  assertEqual(recur.deshecho.fecha, '2026-08-20', 'deshacer devuelve la fecha sin avanzar');
  assertEqual(recur.deshecho.mesPlan, 90000, 'y repone el mes que se había limpiado del Plan');
  assertEqual(recur.deshecho.saldo, 500000, 'y el saldo descontado');

  // Sin descontar de ninguna cuenta, el undo no inventa plata.
  const sinDeducir = run('unica', false);
  assertEqual(sinDeducir.pagado.saldo, 500000, 'si no se descuenta, la cuenta no se toca');
  assertEqual(sinDeducir.deshecho.saldo, 500000, 'y deshacer tampoco la toca');
}

// ─── Agenda: cargar dos veces lo mismo no duplica la Proyección ────────────
// Cargar dos veces "Netflix" (pasa: no ves que ya estaba) creaba dos ítems y
// DOS filas en el Plan, así que el mes proyectaba el doble sin ningún aviso.
section('agenda — alta duplicada');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  // El alta vive dentro de doSaveAgenda (con DOM), así que se testea la regla
  // que la sostiene: reusar la fila del Plan que ya existe con ese nombre.
  const reusa = src.includes("const _pr=S.plan.find(x=>x.name.toLowerCase().trim()===_nml&&x.cat!=='ingreso');");
  assert(reusa, 'el alta busca la fila del Plan existente antes de crear otra');
  const avisa = src.includes("_dupWarn.classList.add('show')");
  assert(avisa, 'y avisa que el nombre ya está en la agenda antes de guardar');
  assert(src.includes('id="ag-dup-warn"'), 'el modal de agenda tiene el aviso de duplicado');
}


// ─── Fondos: una sola fuente para "cuánto llevás gastado" ──────────────────
// Había dos: la suma de los gastos que apuntan al fondo (lo que muestra la
// pantalla) y un campo "spent" acumulado a mano en cinco lugares que viajaba
// en el sync y no leía nadie — el recálculo lo pisaba siempre. Encima el
// acumulador sumaba g.amount y la pantalla usa eAmt(g) (tu parte, si el gasto
// es compartido), así que ni siquiera medían lo mismo, y se descuadraba al
// borrar un gasto. Queda solo fundSpent().
section('fondos — lo gastado sale de los gastos, no de un acumulador');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const spent = (gastos, yo) => new Function(
    grab('eAmt') + grab('fundSpent') +
    `function getMyName(){return '${yo || 'fede'}';}` +
    `const S={gastos:${JSON.stringify(gastos)}};` +
    `return fundSpent('f1');`
  )();

  assertEqual(spent([{ id: 'a', amount: 100000, extraBudgetId: 'f1' }]), 100000, 'un gasto imputado al fondo suma completo');
  assertEqual(spent([{ id: 'a', amount: 100000, extraBudgetId: 'otro' }]), 0, 'un gasto de otro fondo no cuenta');
  assertEqual(spent([]), 0, 'sin gastos, el fondo arranca en cero');
  assertEqual(spent([{ id: 'a', amount: 60000, extraBudgetId: 'f1' }, { id: 'b', amount: 40000, extraBudgetId: 'f1' }]),
    100000, 'varios gastos se suman');

  // Borrar el gasto lo saca del fondo solo: era el caso que descuadraba el
  // acumulador (restaba solo al editar, nunca al borrar).
  assertEqual(spent([{ id: 'b', amount: 40000, extraBudgetId: 'f1' }]), 40000,
    'borrar un gasto baja lo gastado sin que nadie tenga que restarlo');

  // Compartido: cuenta tu parte, no el total pagado.
  const compartido = [{ id: 'a', amount: 100000, extraBudgetId: 'f1', shared: { active: true, paidBy: 'fede', splitPct: 50 } }];
  assertEqual(spent(compartido, 'fede'), 50000, 'de un gasto compartido 50/50 cuenta la mitad');
  assertEqual(spent(compartido, 'mile'), 50000, 'y al otro lado también le toca la mitad');
  assertEqual(spent([{ id: 'a', amount: 100000, extraBudgetId: 'f1', shared: { active: true, paidBy: 'fede', splitPct: 100 } }], 'fede'),
    100000, 'si pagaste el 100% cuenta entero');

  // La migración saca el campo muerto de lo guardado.
  const mig = new Function(
    grab('loadFunds') +
    `let _guardado=null;
     const FUNDS_KEY='fin_funds';
     function lsGet(){return [{id:'f1',name:'Vacaciones',spent:999999},{id:'f2',name:'Ropa'}];}
     function persistJsonStorage(k,v){_guardado=JSON.parse(JSON.stringify(v));}
     const out=loadFunds();
     return {tieneSpent:out.some(f=>'spent' in f),reescrito:!!_guardado,
             guardadoSinSpent:_guardado&&!_guardado.some(f=>'spent' in f),
             nombres:out.map(f=>f.name).join(',')};`
  )();
  assertEqual(mig.tieneSpent, false, 'al cargar, el contador muerto se saca de los fondos');
  assertEqual(mig.reescrito, true, 'y se reescribe el guardado para que deje de viajar en el sync');
  assertEqual(mig.guardadoSinSpent, true, 'lo persistido queda sin el campo');
  assertEqual(mig.nombres, 'Vacaciones,Ropa', 'sin perder ningún fondo ni sus datos');

  // Y ya no queda ningún punto que lo escriba.
  const escrituras = (src.match(/\.spent\s*=/g) || []).length;
  assertEqual(escrituras, 0, 'ningún lugar del código vuelve a escribir fund.spent');
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
