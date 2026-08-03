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

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`${_passed + _failed} tests: ${_passed} passed, ${_failed} failed`);
if (_failed > 0) {
  console.error(`\n${_failed} test(s) failed.`);
  process.exit(1);
} else {
  console.log('\nAll tests passed.');
}
