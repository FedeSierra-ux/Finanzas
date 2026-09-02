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
  // Los dos borrados anotan la compra como borrada a mano (ver la sección
  // "borrarlas no se deshace solo al recargar"), así que las marcas viajan con
  // los stubs.
  const stubs = grab('cuotasBorradas') + grab('markCuotaBorrada') + grab('clearCuotaBorrada') + `
    let _saved=false;
    function save(){_saved=true;}
    function uid(){return 'nuevo';}
    function planBucket(){return 'gasto';}
    function scheduleNotifications(){}
    function renderAgenda(){}
    function renderProj(){}
    function planIsVisible(){return curPage==='plan';}
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

// ─── Borrar una cuota tiene que ser definitivo ─────────────────────────────
// Reportado con "Prueba" y "Cuota zapatillad": se borraban desde Agenda,
// desaparecían, y volvían solas. syncCuotasToAgenda() corre en cada load() y
// reconstruye las cuotas desde los gastos de tarjeta con cuotaTotal — el gasto
// sigue en el historial (así tiene que ser), así que sin dejar constancia del
// borrado la cuota se recreaba para siempre.
section('cuotas — borrarlas no se deshace solo al recargar');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const HACE_UN_MES = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const gastoDe = (desc, addedAt) => ({
    id: 'g-' + desc, desc, cat: 'tarjeta', amount: 36083,
    cuotaActual: 1, cuotaTotal: 3, month: 7, year: 2026, day: 31, addedAt,
  });

  // Arma un mundo con la cuota en Agenda + su gasto de tarjeta, corre lo que le
  // pidas y devuelve el estado. `undo` ejecuta el callback del toast (deshacer).
  const mundo = (body) => new Function(
    grab('cuotaBaseName') + grab('cuotasBorradas') + grab('markCuotaBorrada') +
    grab('clearCuotaBorrada') + grab('cuotaBorradaAt') + grab('gastoTs') +
    grab('pruneCuotasBorradas') + grab('syncCuotasToAgenda') + grab('delAgenda') +
    grab('dateKey') + grab('proxVencCuota') +
    `let _undo=null;
     function save(){}
     function uid(){return 'nuevo';}
     function syncCuotaToPlan(){}
     function markCuotaDoneState(){}
     function scheduleNotifications(){}
     function renderAgenda(){}
     function renderProj(){}
     function planIsVisible(){return curPage==='plan';}
     function showToast(msg,cb){_undo=cb;}
     function $(){return null;}
     const curPage='agenda';
     const S={plan:[{id:'p1',name:'Prueba (3c)',cat:'tarjeta',months:{7:1,8:1,9:1}}],
              gastos:[${JSON.stringify(gastoDe('Prueba', HACE_UN_MES))}],
              agenda:{subs:[],vencimientos:[],inversiones:[],
                      cuotas:[{id:'c1',name:'Prueba',fee:1,total:3,paid:1}]}};
     const undo=()=>{if(_undo)_undo();};
     ${body}
     return {S,nombres:S.agenda.cuotas.map(c=>c.name),plan:S.plan.map(p=>p.name),
             marcas:(S.agenda.cuotasBorradas||[]).map(x=>x.name)};`
  )();

  // Referencia: sin borrar nada, el sync no cambia lo que ya está.
  const intacto = mundo('syncCuotasToAgenda();');
  assertEqual(intacto.nombres.join(','), 'Prueba', 'sin borrados, el sync deja la cuota como está');

  // El borrado se anota.
  const borrada = mundo("delAgenda('cuota','c1');");
  assertEqual(borrada.nombres.length, 0, 'borrar la cuota la saca de Agenda');
  assertEqual(borrada.plan.length, 0, 'y también saca su fila del proyectado');
  assertEqual(borrada.marcas.join(','), 'prueba', 'y queda anotado que esa compra se borró a mano');

  // El caso del reporte: borrar y recargar (load → syncCuotasToAgenda).
  const recarga = mundo("delAgenda('cuota','c1');syncCuotasToAgenda();");
  assertEqual(recarga.nombres.length, 0, 'al recargar, el gasto de tarjeta ya no la resucita');
  assertEqual(recarga.plan.length, 0, 'ni vuelve la fila del proyectado');

  // Deshacer desde el toast la trae de vuelta y borra la marca — si no, el
  // "deshacer" duraba hasta el próximo load().
  const deshecho = mundo("delAgenda('cuota','c1');undo();syncCuotasToAgenda();");
  assertEqual(deshecho.nombres.join(','), 'Prueba', 'deshacer la restaura');
  assertEqual(deshecho.marcas.length, 0, 'y limpia la marca, así sobrevive a la recarga');

  // Una compra NUEVA con el mismo nombre sí tiene que aparecer: el gasto es
  // posterior al borrado. Si no, el nombre quedaba vetado para siempre.
  const compraNueva = mundo(
    `delAgenda('cuota','c1');
     S.gastos.push(${JSON.stringify(gastoDe('Prueba', 0))});
     S.gastos[S.gastos.length-1].addedAt=Date.now()+60000;
     syncCuotasToAgenda();`
  );
  assertEqual(compraNueva.nombres.join(','), 'Prueba', 'una compra nueva con el mismo nombre vuelve a crear la cuota');
  assertEqual(compraNueva.marcas.length, 0, 'y la marca de borrado se levanta');

  // La marca no crece sin control: vive mientras exista el gasto que la
  // recrearía. Borrado el gasto, se limpia sola.
  const podada = mundo("delAgenda('cuota','c1');S.gastos=[];pruneCuotasBorradas();");
  assertEqual(podada.marcas.length, 0, 'si se borra el gasto de origen, la marca se poda');

  // Borrar la cuota desde el Plan tiene que anotarse igual que desde Agenda.
  const desdePlan = new Function(
    grab('cuotaBaseName') + grab('cuotasBorradas') + grab('markCuotaBorrada') +
    grab('clearCuotaBorrada') + grab('cuotaBorradaAt') + grab('gastoTs') +
    grab('syncCuotasToAgenda') + grab('deletePlanItemWithSync') +
    `function save(){}
     function uid(){return 'nuevo';}
     function syncCuotaToPlan(){}
     function renderProj(){}
     function renderAgenda(){}
     function planIsVisible(){return curPage==='plan';}
     function logAction(){}
     function $(){return null;}
     const curPage='plan';
     const S={plan:[{id:'p1',name:'Prueba (3c)',cat:'tarjeta',months:{7:1}}],
              gastos:[${JSON.stringify(gastoDe('Prueba', HACE_UN_MES))}],
              agenda:{subs:[],vencimientos:[],inversiones:[],
                      cuotas:[{id:'c1',name:'Prueba',fee:1,total:3,paid:1}]}};
     deletePlanItemWithSync('p1','Prueba (3c)');
     syncCuotasToAgenda();
     return {cuotas:S.agenda.cuotas.length,plan:S.plan.length};`
  )();
  assertEqual(desdePlan.cuotas, 0, 'borrada desde el Plan, la cuota tampoco vuelve al recargar');
  assertEqual(desdePlan.plan, 0, 'y la fila del proyectado queda borrada');

  // ── Lo que seguía roto: el gasto con fecha futura ─────────────────────
  // El gasto no guarda "cuándo lo cargué" sino la fecha que eligió el usuario
  // (addedAt = fecha del gasto). Una compra en cuotas anotada con la fecha del
  // vencimiento —el 31, o directamente un mes que todavía no llegó— tenía un ts
  // por delante del borrado, así que syncCuotasToAgenda la leía como "compra
  // nueva", la recreaba y encima borraba la marca. Reportado de nuevo con
  // "Prueba" y "Cuota zapatillad", que volvían en cada recarga.
  const futuroAddedAt = mundo(
    `S.gastos[0].addedAt=Date.now()+14*24*60*60*1000;
     delAgenda('cuota','c1');syncCuotasToAgenda();`
  );
  assertEqual(futuroAddedAt.nombres.length, 0, 'un gasto con fecha futura ya no resucita la cuota borrada');
  assertEqual(futuroAddedAt.marcas.join(','), 'prueba', 'y la marca de borrado sigue en pie');

  // Mismo caso sin addedAt: la fecha sale de year/month/day y también puede ser
  // de un mes que todavía no llegó.
  const futuroSinAddedAt = mundo(
    `delete S.gastos[0].addedAt;
     const _d=new Date();
     S.gastos[0].year=_d.getFullYear();S.gastos[0].month=_d.getMonth()+2;S.gastos[0].day=1;
     delAgenda('cuota','c1');syncCuotasToAgenda();`
  );
  assertEqual(futuroSinAddedAt.nombres.length, 0, 'y tampoco si la fecha futura viene de year/month/day');
  assertEqual(futuroSinAddedAt.marcas.join(','), 'prueba', 'la marca tampoco se levanta sola');

  // Una compra nueva de verdad sigue apareciendo aunque la anterior fuera
  // futura: el gasto nuevo es posterior a TODOS los que había al borrar.
  const nuevaTrasFutura = mundo(
    `S.gastos[0].addedAt=Date.now()+14*24*60*60*1000;
     delAgenda('cuota','c1');
     S.gastos.push(${JSON.stringify(gastoDe('Prueba', 0))});
     S.gastos[S.gastos.length-1].addedAt=Date.now()+30*24*60*60*1000;
     syncCuotasToAgenda();`
  );
  assertEqual(nuevaTrasFutura.nombres.join(','), 'Prueba', 'una compra posterior sí vuelve a crear la cuota');

  // ── Y que el sync no la traiga de vuelta ──────────────────────────────
  // La marca vive dentro de fin_v6 y applyPayload pisaba la agenda entera con
  // la de la nube: bastaba con sincronizar contra un estado que todavía no
  // sabía del borrado para que la cuota reapareciera.
  const sinc = (cloudAgenda, localAgenda) => new Function(
    grab('cuotaBaseName') + grab('_syncParse') + grab('_syncAsObj') +
    grab('_syncAsStr') + grab('_mergeById') + grab('applyPayload') +
    `const KEY='fin_v6',SYNC_TS_KEY='fin_sync_ts';
     let guardado=null;
     const localStorage={setItem(k,v){if(k===KEY)guardado=v;},getItem(){return null;}};
     const S={gastos:[],agenda:${JSON.stringify(localAgenda)}};
     let funds=[],_checklists=[];
     const _budgetTab='funds',curPage='agenda';
     function load(){}
     function loadFunds(){return [];}
     function loadChecklists(){return [];}
     function loadBudgets(){}
     function render(){}
     function renderFunds(){}
     function renderPresupuesto(){}
     function renderAgenda(){}
     function logError(){}
     applyPayload({fin_v6:{gastos:[],agenda:${JSON.stringify(cloudAgenda)}}});
     const out=JSON.parse(guardado);
     return {cuotas:(out.agenda.cuotas||[]).map(c=>c.name),
             marcas:(out.agenda.cuotasBorradas||[]).map(x=>x.name)};`
  )();

  const conMarcaLocal = sinc(
    { subs:[], vencimientos:[], inversiones:[], cuotas:[{id:'c1',name:'Prueba',fee:1,total:3,paid:1}] },
    { subs:[], vencimientos:[], inversiones:[], cuotas:[], cuotasBorradas:[{name:'prueba',at:Date.now()}] }
  );
  assertEqual(conMarcaLocal.cuotas.length, 0, 'sincronizar no revive una cuota borrada acá');
  assertEqual(conMarcaLocal.marcas.join(','), 'prueba', 'y la marca viaja al estado fusionado');

  const marcaEnLaNube = sinc(
    { subs:[], vencimientos:[], inversiones:[], cuotas:[], cuotasBorradas:[{name:'prueba',at:Date.now()}] },
    { subs:[], vencimientos:[], inversiones:[], cuotas:[{id:'c1',name:'Prueba',fee:1,total:3,paid:1}] }
  );
  assertEqual(marcaEnLaNube.marcas.join(','), 'prueba', 'la marca del otro dispositivo también se respeta');

  const sinMarcas = sinc(
    { subs:[], vencimientos:[], inversiones:[], cuotas:[{id:'c1',name:'Prueba',fee:1,total:3,paid:1}] },
    { subs:[], vencimientos:[], inversiones:[], cuotas:[{id:'c1',name:'Prueba',fee:1,total:3,paid:1}] }
  );
  assertEqual(sinMarcas.cuotas.join(','), 'Prueba', 'sin borrados de por medio, el sync deja las cuotas como están');
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
    grab('cuotasBorradas') + grab('clearCuotaBorrada') +
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
    function renderGastos(){} function render(){} function planIsVisible(){return curPage==='plan';}
    function refreshAgendaViews(){} function refreshPlanViews(){} function refreshGastosViews(){}
    function scheduleRender(){} function syncPush(){} function notifyPartnerNewShared(){}
    function closeOv(){} function $(){return null;}
    function compBinConfigured(){return false;} function upsertSharedBinGasto(){}
    function markCuotaDoneState(){return false;} function syncCuotaToPlan(){}
    function planBucket(){return 'gasto';} function logAction(){}
    function cuotaBaseName(n){return String(n||'');}
    function stampAcc(a){if(a)a.updatedAt=Date.now();return a;}
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


// ─── Importar desde Excel: el 0% de división se perdía ─────────────────────
// Reportado con la planilla a la vista: una fila decía "División % Fede = 0"
// (el gasto era todo de Mile, lo pagó Fede) y entraba como 50/50. La culpa era
// del `|| 50`: 0 es falsy, así que cualquier 0 legítimo se convertía en 50.
section('excel — la división importada respeta el 0%');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const parse = (filas) => new Function(
    grab('parseExcelFileWithSheetJS') +
    `const CATS={varios:{},transporte:{},super:{}};
     let excelReviewItems=[];
     const XLSX={read:()=>({SheetNames:['h'],Sheets:{h:{}}}),
                 utils:{sheet_to_json:()=>(${JSON.stringify(filas)})}};
     function renderExcelReview(){}
     function $(){return null;}
     function esc(x){return x;}
     parseExcelFileWithSheetJS(null);
     return excelReviewItems.map(g=>({n:g.nombre,pct:g.divPct}));`
  )();

  const head = ['Nombre','Cat','Fecha','Monto','Semanal','Compartido','Quién pagó','División % Fede'];
  const fila = (n, pct) => [n,'varios','25/07/2026','9157','Si','Si','fede',pct];

  const r = parse([head, fila('Todo de Mile','0'), fila('Mitad','50'), fila('Todo mío','100'),
                   fila('Sin dato',''), fila('Fuera de rango','230'), fila('Negativo','-10')]);
  const pct = Object.fromEntries(r.map(x => [x.n, x.pct]));

  assertEqual(pct['Todo de Mile'], 0, 'un 0 en la planilla entra como 0% (antes se convertía en 50)');
  assertEqual(pct['Mitad'], 50, 'el 50 sigue entrando igual');
  assertEqual(pct['Todo mío'], 100, 'y el 100 también');
  assertEqual(pct['Sin dato'], 50, 'una celda vacía cae en el 50/50 de siempre');
  assertEqual(pct['Fuera de rango'], 100, 'un porcentaje mayor a 100 se acota');
  assertEqual(pct['Negativo'], 0, 'y uno negativo también');

  // La importación sube todo en un solo viaje al bin, no uno por gasto.
  // Sin los comentarios, que nombran la función vieja al explicar el cambio.
  const imp = src.match(/function confirmExcelImport\(\)[\s\S]*?\n}/)[0]
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assertEqual(/upsertSharedBinGasto\s*\(/.test(imp), false,
    'importar ya no dispara un push al bin por cada gasto compartido');
  assert(/pushImportadosAlBin\(/.test(imp), 'los sube todos juntos en una sola subida');
}

// ─── La división es siempre una de tres ────────────────────────────────────
// 50/50, todo de uno o todo del otro: no hay porcentaje a mano en ningún lado.
// El caso "todo del otro" (0% del que pagó) es el que antes obligaba a escribir
// el número, así que se sigue comprobando que salga de los botones.
section('compartidos — la división es siempre una de tres');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const solo = (fn, paidBy, who, pctVar) => new Function(
    grab(fn) +
    `let ${pctVar}=50;const ${pctVar.replace('SplitPct', 'PaidBy')}='${paidBy}';
     function _renderESGSplitUI(){} function _renderEGSplitUI(){}
     ${fn}('${who}');
     return ${pctVar};`
  )();
  // Editor del gasto compartido (lista de Compartidos).
  assertEqual(solo('pickESGSplitSolo', 'fede', 'mile', '_esgSplitPct'), 0, 'pagó Fede y es todo de Mile → 0% del que pagó');
  assertEqual(solo('pickESGSplitSolo', 'fede', 'fede', '_esgSplitPct'), 100, 'pagó Fede y es todo suyo → 100%');
  assertEqual(solo('pickESGSplitSolo', 'mile', 'fede', '_esgSplitPct'), 0, 'pagó Mile y es todo de Fede → 0%');
  // Editor del gasto de la lista de Gastos, que antes tenía el campo de %.
  assertEqual(solo('pickEGSplitSolo', 'fede', 'mile', '_egSplitPct'), 0, 'y lo mismo editando desde Gastos: todo del otro → 0%');
  assertEqual(solo('pickEGSplitSolo', 'mile', 'mile', '_egSplitPct'), 100, 'todo del que pagó → 100%');

  const medio = (fn, pctVar) => new Function(
    grab(fn) + `let ${pctVar}=0;function _renderESGSplitUI(){} function _renderEGSplitUI(){}
     ${fn}(50); return ${pctVar};`
  )();
  assertEqual(medio('pickESGSplitPct', '_esgSplitPct'), 50, 'y volver a mitad y mitad');
  assertEqual(medio('pickEGSplit', '_egSplitPct'), 50, 'también desde Gastos');

  assertEqual(src.includes('id="esg-split-pct"'), false, 'ya no hay campo para escribir el porcentaje a mano');
  assertEqual(src.includes('id="eg-split-pct"'), false, 'ni en el editor de Gastos');
  assertEqual(src.includes('onESGSplitInput'), false, 'ni el handler que lo leía');
  assert(src.includes("pickESGSplitSolo('mile')"), 'y quedan los atajos "Solo Fede" / "Solo Mile"');
  assert(/id="eg-split-solo-a"/.test(src) && /id="eg-split-solo-b"/.test(src), 'que ahora también están al editar desde Gastos');
}

// ─── Copias de compartidos: ver y elegir qué falta ─────────────────────────
// La lista decía "2 que hoy no están" pero no había forma de saber CUÁLES sin
// restaurar y fijarse después, ni de traer solo algunos.
section('copias — qué falta de cada copia');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const falt = (snap, ids, payIds) => new Function(
    grab('snapFaltantes') +
    `return snapFaltantes(${JSON.stringify(snap)},new Set(${JSON.stringify(ids)}),new Set(${JSON.stringify(payIds)}));`
  )();

  const snap = { gastos:[{id:'a'},{id:'b'},{id:'c'}], payments:[{id:'p1'},{id:'p2'}] };
  const r = falt(snap, ['a','b'], ['p1']);
  assertEqual(r.gastos.map(g=>g.id).join(','), 'c', 'lista los gastos de la copia que hoy no están');
  assertEqual(r.payments.map(p=>p.id).join(','), 'p2', 'y las transferencias que faltan');

  const nada = falt(snap, ['a','b','c'], ['p1','p2']);
  assertEqual(nada.gastos.length + nada.payments.length, 0, 'una copia sin novedades no reporta faltantes');

  const vacia = falt({}, [], []);
  assertEqual(vacia.gastos.length + vacia.payments.length, 0, 'una copia vieja sin campos no rompe');

  // La fila del detalle: tildada por defecto y con el id para restaurar.
  const row = new Function(
    grab('_snapFaltanteRow') + grab('esc') +
    `function fARS(n){return '$ '+n;}
     return _snapFaltanteRow(2,'g','id-1','🛒','Rappi "Coto" & Vea',17871,new Date(2026,6,1).getTime(),'fede');`
  )();
  assert(row.includes('checked'), 'cada ítem viene tildado (el caso normal es querer todo)');
  assert(row.includes('data-snap="2"') && row.includes('data-tipo="g"'), 'lleva a qué copia y tipo pertenece');
  assert(row.includes('value="id-1"'), 'y el id con el que se restaura');
  assert(row.includes('Rappi &quot;Coto&quot; &amp; Vea'), 'la descripción se escapa (no rompe el HTML)');
  assert(row.includes('pagó Fede'), 'muestra quién lo pagó');
  assert(row.includes('$ 17871'), 'y el importe');

  // Restaurar solo lo tildado filtra la copia por los ids elegidos.
  const restore = src.match(/async function restoreSharedSnapshot\([\s\S]*?\n  await queueSharedBinWrite/)[0];
  assert(/soloIds/.test(restore), 'restoreSharedSnapshot acepta un subconjunto de ids');
  assert(/filter\(g=>soloIds\.has/.test(restore), 'y filtra los gastos de la copia por esos ids');
  assert(/filter\(p=>soloIds\.has/.test(restore), 'también las transferencias');
}

// ─── Compartidos: qué falta subir y el botón que lo sube ───────────────────
// Reportado: saltaba seguido "no se pudo sincronizar" y había que ir hasta
// Ajustes → Compartidos → Sincronizar, porque el ↻ de la pestaña Compartidos
// solo TRAÍA (fetch) — tocarlo no subía nada. Ahora ese botón hace el viaje
// completo, lo que queda pendiente se reintenta solo, y el botón muestra
// cuántos ítems faltan para no tener que tocarlo "por las dudas".
section('compartidos — qué falta subir al bin');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  // Corre sharedPendientes() sobre un mundo armado, después aplicarPendientes()
  // y vuelve a medir: así cada caso comprueba también que el sync converge.
  const pend = ({ bin = [], binPays = [], gastos = [], pays = [], configurado = true }) => new Function(
    grab('_sharedFingerprint') + grab('sharedPendientes') + grab('aplicarPendientes') + grab('_payFingerprint') + grab('marcarConfirmado') +
    `let _sharedBinGastos=${JSON.stringify(bin)},_sharedBinPayments=${JSON.stringify(binPays)};
     let _sharedConfirmado={gastos:{},pays:{}};
     const localStorage={setItem(){},getItem(){return null;}};
     const S={gastos:${JSON.stringify(gastos)}};
     function compBinConfigured(){return ${!!configurado};}
     function getSharedPayments(){return ${JSON.stringify(pays)};}
     // Punto de partida: lo que el bin ya tenía confirmado.
     marcarConfirmado(_sharedBinGastos,_sharedBinPayments);
     const p=sharedPendientes();
     const ids=x=>x.map(i=>i.id);
     const antes={nuevos:ids(p.nuevos),corregidos:ids(p.corregidos),pays:ids(p.pays),total:p.total};
     const aplicados=aplicarPendientes(p);
     // Un push que sale bien confirma lo que quedó escrito.
     marcarConfirmado(_sharedBinGastos,_sharedBinPayments);
     return {antes,aplicados,restante:sharedPendientes().total,
             bin:_sharedBinGastos.map(g=>g.id+':'+g.amount),binPays:_sharedBinPayments.map(x=>x.id)};`
  )();

  const compartido = (id, amount, extra) => ({
    id, desc: 'Super', amount, cat: 'super', addedAt: 1000, month: 7, year: 2026,
    updatedAt: 500, shared: { active: true, paidBy: 'fede', splitPct: 50 }, ...extra,
  });

  // ── Un gasto que el bin no tiene ──────────────────────────────────────
  const nuevo = pend({ gastos: [compartido('g1', 5000)] });
  assertEqual(nuevo.antes.nuevos.join(','), 'g1', 'un compartido que el bin no tiene queda pendiente como nuevo');
  assertEqual(nuevo.antes.total, 1, 'y cuenta 1 pendiente');
  assertEqual(nuevo.restante, 0, 'aplicarlo lo deja al día (el sync converge)');
  assertEqual(nuevo.bin.join(','), 'g1:5000', 'y entra al bin con su importe');

  // ── Lo que ya está igual no se vuelve a subir ─────────────────────────
  // Importa de verdad: JSONBin cobra por request y el badge diría "pendiente"
  // para siempre si esto fallara.
  const igual = pend({ bin: [compartido('g1', 5000)], gastos: [compartido('g1', 5000)] });
  assertEqual(igual.antes.total, 0, 'un gasto idéntico al del bin no queda pendiente');
  assertEqual(igual.bin.length, 1, 'y no se duplica en el bin');

  // ── Banderas internas: la regresión del fingerprint ───────────────────
  // La copia local arrastra _sharedBinSynced/_dev que nunca viajan al bin.
  // Comparadas de más, todo gasto compartido parecería desincronizado siempre.
  const banderas = pend({
    bin: [compartido('g1', 5000)],
    gastos: [compartido('g1', 5000, { _sharedBinSynced: true, _dev: 'celu-1' })],
  });
  assertEqual(banderas.antes.total, 0, 'las banderas internas no cuentan como diferencia');

  // ── Un gasto editado ──────────────────────────────────────────────────
  const editado = pend({
    bin: [compartido('g1', 5000)],
    gastos: [compartido('g1', 7200, { updatedAt: 900 })],
  });
  assertEqual(editado.antes.corregidos.join(','), 'g1', 'un gasto editado queda pendiente como corregido');
  assertEqual(editado.antes.nuevos.length, 0, 'y no se cuenta dos veces como nuevo');
  assertEqual(editado.bin.join(','), 'g1:7200', 'aplicarlo pisa la versión vieja del bin');
  assertEqual(editado.bin.length, 1, 'sin dejar el gasto duplicado');
  assertEqual(editado.restante, 0, 'y queda al día');

  // Cada campo que viaja al bin tiene que disparar el pendiente por sí solo.
  const cambia = (extra, label) => assertEqual(
    pend({ bin: [compartido('g1', 5000)], gastos: [compartido('g1', 5000, extra)] }).antes.corregidos.length,
    1, label);
  cambia({ desc: 'Coto' }, 'cambiar la descripción deja el gasto pendiente');
  cambia({ cat: 'salidas' }, 'cambiar la categoría también');
  cambia({ shared: { active: true, paidBy: 'mile', splitPct: 50 } }, 'cambiar quién pagó también');
  cambia({ shared: { active: true, paidBy: 'fede', splitPct: 0 } }, 'y cambiar la división también');

  // ── Lo que no es compartido no se toca ────────────────────────────────
  const ajeno = pend({ gastos: [{ id: 'g9', desc: 'Nafta', amount: 30000, cat: 'auto' }] });
  assertEqual(ajeno.antes.total, 0, 'un gasto no compartido nunca queda pendiente');

  const desactivado = pend({ gastos: [compartido('g1', 5000, { shared: { active: false, paidBy: 'fede' } })] });
  assertEqual(desactivado.antes.total, 0, 'un compartido desactivado tampoco');

  // ── Transferencias ────────────────────────────────────────────────────
  const transfPago = (id, amount) => ({ id, paidBy: 'mile', amount, desc: 'Transferencia', date: '2026-08-20', addedAt: 10, updatedAt: 10 });
  const transf = pend({ pays: [transfPago('p1', 40000), transfPago('p2', 1000)], binPays: [transfPago('p1', 40000)] });
  assertEqual(transf.antes.pays.join(','), 'p2', 'una transferencia que el bin no tiene queda pendiente');
  assertEqual(transf.antes.total, 1, 'y la que ya está, idéntica, no se cuenta');
  assertEqual(transf.binPays.join(','), 'p1,p2', 'aplicarla la agrega sin pisar la existente');
  assertEqual(transf.restante, 0, 'y después no queda nada pendiente');

  // Corregirle el importe a una transferencia YA subida también es algo que
  // falta subir. Con la comparación por id nomás, la corrección no se pusheaba
  // nunca y cada dispositivo quedaba mostrando una deuda distinta.
  const transfCorregida = pend({
    pays: [{ ...transfPago('p1', 40000), amount: 65000, updatedAt: 90 }],
    binPays: [transfPago('p1', 40000)],
  });
  assertEqual(transfCorregida.antes.pays.join(','), 'p1', 'una transferencia corregida queda pendiente');
  assertEqual(transfCorregida.antes.total, 1, 'y cuenta una sola vez');
  assertEqual(transfCorregida.binPays.join(','), 'p1', 'aplicarla pisa la que estaba, no agrega otra');
  assertEqual(transfCorregida.restante, 0, 'y después queda al día');

  // ── El total suma las tres cosas ──────────────────────────────────────
  const mixto = pend({
    bin: [compartido('g1', 5000)],
    gastos: [compartido('g1', 9999), compartido('g2', 100)],
    pays: [{ id: 'p1', amount: 40000 }],
  });
  assertEqual(mixto.antes.total, 3, 'el total suma nuevos + corregidos + transferencias');
  assertEqual(mixto.antes.nuevos.join(','), 'g2', 'con el nuevo bien clasificado');
  assertEqual(mixto.antes.corregidos.join(','), 'g1', 'y el corregido también');
  assertEqual(mixto.aplicados, 3, 'aplicarPendientes devuelve cuántos volcó');
  assertEqual(mixto.restante, 0, 'y deja todo al día');

  // ── Sin bin configurado no hay nada pendiente ─────────────────────────
  // Si no, el botón mostraría un contador de items que no tienen a dónde ir.
  const sinBin = pend({ gastos: [compartido('g1', 5000)], pays: [{ id: 'p1' }], configurado: false });
  assertEqual(sinBin.antes.total, 0, 'sin bin compartido configurado no se cuenta nada pendiente');

  // ── Estado vacío o a medio armar no rompe ─────────────────────────────
  assertEqual(pend({}).antes.total, 0, 'un estado vacío da cero pendientes');

  // ── Un corregido cuyo id ya no está en el bin no se pierde ────────────
  // (el bin puede haber cambiado entre medir y aplicar)
  const carrera = new Function(
    grab('_sharedFingerprint') + grab('sharedPendientes') + grab('aplicarPendientes') + grab('_payFingerprint') + grab('marcarConfirmado') +
    `let _sharedBinGastos=[${JSON.stringify(compartido('g1', 5000))}],_sharedBinPayments=[];
     let _sharedConfirmado={gastos:{},pays:{}};
     const localStorage={setItem(){},getItem(){return null;}};
     const S={gastos:[${JSON.stringify(compartido('g1', 7200, { updatedAt: 900 }))}]};
     function compBinConfigured(){return true;}
     function getSharedPayments(){return [];}
     marcarConfirmado(_sharedBinGastos,_sharedBinPayments);
     const p=sharedPendientes();
     _sharedBinGastos=[];              // el bin cambió entre medir y aplicar
     aplicarPendientes(p);
     return _sharedBinGastos.map(g=>g.id+':'+g.amount);`
  )();
  assertEqual(carrera.join(','), 'g1:7200', 'un corregido que ya no está en el bin se agrega igual (no se pierde)');
}

// ─── Compartidos: hallazgos de la auditoría con dos dispositivos ───────────
// Salieron de simular meses de uso con la app real en Chromium contra un
// JSONBin en memoria compartido entre dos dispositivos.
async function testsEdicionCompartida() {
  section('compartidos — editar un gasto compartido no se revierte solo');
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];
  const grabAsync = (name) => src.match(new RegExp('\\nasync function ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  // doSaveEditGasto() modifica el gasto en su lugar y NO le toca updatedAt;
  // el sello lo pone upsertSharedBinGasto(). Si ese sello va después del
  // fetch, fetchSharedBin() ve la copia local con el mismo updatedAt que la
  // del bin, decide que la del bin "no es más vieja" y le copia encima los
  // valores viejos: la edición recién hecha se pierde en pantalla y en el bin.
  // Reproducido en Chromium editando por el modal real antes de arreglarlo.
  const orden = new Function(
    grab('stampShared') + grab('queueSharedBinWrite') + grabAsync('upsertSharedBinGasto') +
    `let _sharedBinGastos=[],_sharedBinWriteQueue=Promise.resolve();
     const S={gastos:[{id:'g1',desc:'Super',amount:99000,updatedAt:100}],_gTombs:{},_deletedGastoIds:[]};
     const g=S.gastos[0];
     const log={tsEnFetch:null,montoEnFetch:null};
     function save(){}
     async function fetchSharedBin(){log.tsEnFetch=g.updatedAt;log.montoEnFetch=g.amount;return true;}
     async function pushSharedBin(){return true;}
     return upsertSharedBinGasto(g).then(()=>({log,tsFinal:g.updatedAt,montoFinal:g.amount}));`
  );

  const r = await orden();
  assert(r.log.tsEnFetch !== 100,
    'el gasto ya viene sellado cuando corre el fetch (si no, el fetch lo pisa con la versión del bin)');
  assertEqual(r.log.tsEnFetch, r.tsFinal, 'y es el mismo sello que queda al final: se sella una sola vez');
  assertEqual(r.montoFinal, 99000, 'el importe editado sobrevive al ciclo de sincronización');
}

// ─── Saldos: editar el saldo de un banco y que no vuelva atrás solo ────────
// Reportado con el sync andando: se cobra el sueldo desde el Plan (suma a la
// cuenta), después se corrige el saldo desde la tarjeta del banco, se guarda...
// y la tarjeta vuelve a mostrar el monto de antes. applyPayload reemplazaba
// S.accounts con la lista del bin sin mirar nada, así que cualquier bajada que
// llegara con la foto anterior pisaba la edición recién hecha y repintaba.
// ─── Presupuesto apagado: en la app no queda nada, en el código queda todo ──
// La pestaña Presupuesto (Semanal + Extra) y el selector "Descontar de
// presupuesto" salieron de pantalla detrás de FEAT_PRESUPUESTO. Lo que estos
// tests cuidan es que siga siendo un interruptor y no una amputación: que el
// flag esté apagado, que nadie pueda dibujar ni abrir nada del presupuesto
// mientras lo esté, y que los datos (los del gasto y la columna del Excel)
// sigan intactos para el día que se vuelva a prender.
section('presupuesto — apagado en pantalla, entero en el código');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  assert(/\nconst FEAT_PRESUPUESTO=false;/.test(src), 'el flag está apagado');

  // Toda puerta de entrada al presupuesto corta apenas empieza.
  const puertas = ['refreshBudgetViews', 'renderPresupuesto', 'renderFunds', 'switchBudgetTab',
                   'openSetBudget', 'openWeekDetail', 'openFundModal', 'openFundAdjust'];
  puertas.forEach((fn) => {
    const cuerpo = src.match(new RegExp('\\nfunction ' + fn + '\\([^)]*\\)\\{\\n([^\\n]*)'));
    assert(cuerpo && /if\(!FEAT_PRESUPUESTO\) return;/.test(cuerpo[1]),
      fn + '() no dibuja ni abre nada con el flag apagado');
  });

  // La página Gastos ya no tiene otra vista a la que ir.
  assert(/if\(!FEAT_PRESUPUESTO\) tab='gastos';/.test(src),
    'switchGastosTab() se queda siempre en Gastos');

  // Los nodos siguen en el HTML pero apagados al arrancar.
  assert(/\['gastos-tab-row','gt-view-presup','g-budget-field','eg-budget-field'\]/.test(src),
    'applyPresupuestoFlag() apaga la fila de pestañas, la vista y los dos selectores');
  assert(/\n  applyPresupuestoFlag\(\);/.test(src), 'y corre en el arranque');
  ['id="gastos-tab-row"', 'id="gt-view-presup"', 'id="g-budget-field"', 'id="eg-budget-field"']
    .forEach((id) => assert(src.includes(id), 'sigue en el HTML: ' + id));

  // El toast de "gasto guardado" no puede nombrar un presupuesto que no existe.
  assert(/if\(FEAT_PRESUPUESTO\)\{\n    if\(extraBudgetId\)/.test(src),
    'el aviso de gasto guardado no nombra el presupuesto con el flag apagado');

  // Editar un gasto no puede reescribir a qué presupuesto estaba imputado
  // cuando el selector no está a la vista.
  assert(/if\(FEAT_PRESUPUESTO\)\{\n    g\.weeklyBudget=budgetDest==='weekly';/.test(src),
    'editar un gasto no le toca weeklyBudget/extraBudgetId con el flag apagado');

  // La columna "Semanal" del Excel se sigue leyendo: sacarla correría de lugar
  // a Compartido / Pagador / % y rompería los archivos que ya existen.
  assert(/const semanal=String\(r\[4\]\|\|'Si'\)/.test(src),
    'el importador de Excel sigue leyendo la columna Semanal en su posición');
  assert(/weeklyBudget:g\.semanal/.test(src),
    'y el gasto importado se sigue guardando con ese dato');

  // Los datos del presupuesto siguen viajando en el sync.
  assert(/fin_weekly_budgets: _syncParse/.test(src) && /fin_funds     : _syncParse/.test(src),
    'los presupuestos y los fondos se siguen sincronizando');
}

section('saldos — una bajada de la nube no pisa el saldo recién editado');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];
  const mergeAccounts = new Function(grab('mergeAccounts') + 'return mergeAccounts;')();

  const banco = (extra) => Object.assign({ id: 'a1', name: 'Santander', type: 'bancaria', currency: 'ARS' }, extra);

  // El caso del reporte: el bin trae el saldo con el sueldo ya sumado (sin
  // sello, porque lo subió una versión anterior) y acá se acaba de corregir.
  const editado = mergeAccounts(
    [banco({ amount: 1500000 })],
    [banco({ amount: 900000, updatedAt: 5000 })],
    4000
  );
  assertEqual(editado[0].amount, 900000, 'el saldo editado acá le gana a la foto vieja del bin');

  // Pero una edición real desde otro dispositivo sí tiene que entrar.
  const remoto = mergeAccounts(
    [banco({ amount: 2222222, updatedAt: 9000 })],
    [banco({ amount: 900000, updatedAt: 5000 })],
    9000
  );
  assertEqual(remoto[0].amount, 2222222, 'un saldo tocado después en otro dispositivo sí pisa al local');

  // Cuenta nueva creada acá después de la foto: no se puede perder.
  const nueva = mergeAccounts(
    [banco({ amount: 1500000 })],
    [banco({ amount: 1500000 }), { id: 'a2', name: 'Brubank', type: 'bancaria', currency: 'ARS', amount: 10, updatedAt: 8000 }],
    4000
  );
  assertEqual(nueva.length, 2, 'una cuenta agregada acá después de la foto sobrevive a la bajada');

  // Cuenta borrada en el otro dispositivo: sigue borrada (su sello es viejo).
  const borrada = mergeAccounts(
    [banco({ amount: 1500000, updatedAt: 9000 })],
    [banco({ amount: 1500000, updatedAt: 9000 }), { id: 'a3', name: 'Vieja', type: 'bancaria', currency: 'ARS', amount: 0, updatedAt: 1000 }],
    9000
  );
  assertEqual(borrada.length, 1, 'una cuenta borrada en el otro dispositivo no revive');

  // Sin sellos de ningún lado (datos de una versión anterior): manda la nube,
  // que es el comportamiento que había — el arreglo no cambia ese caso.
  const sinSellos = mergeAccounts([banco({ amount: 1500000 })], [banco({ amount: 900000 })], 4000);
  assertEqual(sinSellos[0].amount, 1500000, 'sin updatedAt de ningún lado sigue mandando la nube');
}

section('compartidos — un push que falla deja el gasto como pendiente');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  // _sharedBinGastos se completa ANTES de escribir (el push arma ahí el
  // payload) y no se revierte si el PUT falla. Contando pendientes contra esa
  // copia, un gasto cargado sin señal figuraba como subido: el contador decía
  // "al día" y reintentarPendientesCompartidos() se cortaba en seco, así que
  // nunca le llegaba a la pareja.
  const mundo = (body) => new Function(
    grab('_sharedFingerprint') + grab('sharedPendientes') + grab('_payFingerprint') + grab('marcarConfirmado') +
    `let _sharedBinGastos=[],_sharedBinPayments=[];
     let _sharedConfirmado={gastos:{},pays:{}};
     const localStorage={setItem(){},getItem(){return null;}};
     const g={id:'g1',desc:'Sin red',amount:5000,cat:'super',addedAt:1,month:7,year:2026,
              updatedAt:5,shared:{active:true,paidBy:'fede',splitPct:50}};
     const S={gastos:[g]};
     function compBinConfigured(){return true;}
     function getSharedPayments(){return [];}
     ${body}`
  )();

  // El push falló: la copia en memoria lo tiene, el servidor no.
  const fallo = mundo(`_sharedBinGastos.push({...g});
     return sharedPendientes().total;`);
  assertEqual(fallo, 1, 'un gasto que quedó solo en la copia en memoria cuenta como pendiente');

  // El push salió: el servidor confirmó lo escrito.
  const exito = mundo(`_sharedBinGastos.push({...g});
     marcarConfirmado(_sharedBinGastos,_sharedBinPayments);
     return sharedPendientes().total;`);
  assertEqual(exito, 0, 'confirmado por el servidor, deja de estar pendiente');

  // Y una edición posterior vuelve a ponerlo pendiente.
  const editado = mundo(`_sharedBinGastos.push({...g});
     marcarConfirmado(_sharedBinGastos,_sharedBinPayments);
     g.amount=7000;
     return sharedPendientes().total;`);
  assertEqual(editado, 1, 'editarlo después de confirmado lo vuelve a dejar pendiente');

  // Los dos puntos donde el servidor contesta tienen que registrar la confirmación.
  const fetchFn = src.match(/\nasync function fetchSharedBin\([\s\S]*?\n}\n/)[0];
  const pushFn = src.match(/\nasync function pushSharedBin\([\s\S]*?\n}\n/)[0];
  assert(/marcarConfirmado\(data\.gastos,data\.payments\)/.test(fetchFn),
    'un GET que respondió registra lo que el bin tiene');
  assert(/marcarConfirmado\(gastos,payments\)/.test(pushFn),
    'y un PUT que salió registra lo que quedó escrito');
  assert(!/marcarConfirmado/.test(grab('aplicarPendientes')),
    'preparar el payload NO confirma nada (es justo el error que se arregló)');
}

section('compartidos — una transferencia se corrige desde los dos lados');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  // "Registrar pago" propone como pagadora a la pareja cuando ella te debe
  // (que es el caso habitual), así que exigir ser el pagador para mostrar el
  // ✎ y el ✕ dejaba sin arreglo la transferencia que cargabas vos.
  const modal = src.match(/function openSharedPaymentModal\([\s\S]*?\n}\n/)[0];
  assert(/_spPayer=debt>0\?\(_mn3==='fede'\?'mile':'fede'\):_mn3/.test(modal),
    'referencia: si la pareja te debe, el pagador propuesto es la pareja');

  // El isOwn de la fila de transferencia (hay otro homónimo en renderGastos).
  const fila = src.match(/paidBy dice quién transfirió[\s\S]{0,200}/)[0];
  assert(/const isOwn=true/.test(fila),
    'la transferencia se puede editar y borrar desde cualquiera de los dos lados');
  const filaPago = src.match(/isOwn\?`<button onclick="event\.stopPropagation\(\);openEditSharedPayment[\s\S]{0,600}/)[0];
  assert(/deleteSharedPayment/.test(filaPago), 'con su botón de borrar al lado del de editar');
  // Y los gastos compartidos nunca tuvieron esa restricción: quedan iguales.
  const filaGasto = src.match(/openEditSharedGasto\(\$\{JSON\.stringify[\s\S]{0,400}/)[0];
  assert(/removeSharedBinGasto/.test(filaGasto), 'igual que los gastos compartidos, que ya se editaban y borraban de los dos lados');
}

// ─── Compartidos: el aviso de "no se pudo sincronizar" no se encima ────────
// Sin señal, cargar tres gastos compartidos daba tres carteles idénticos
// encimados. Se avisa una vez y no se repite hasta pasado un rato.
section('compartidos — el aviso de sincronización no se repite');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];
  // La ventana sale del fuente, no de una copia: si cambia allá, el test la sigue.
  const ventana = src.match(/const AVISO_PUSH_MS=([^;]+);/)[1];

  const r = new Function(
    grab('avisarPushFallo') + grab('resetAvisoPushFallo') +
    `const AVISO_PUSH_MS=${ventana};
     let _avisoPushFalloTs=0,_ahora=10*60*1000,_syncEnSilencio=false;
     const Date={now:()=>_ahora};
     const vistos=[];
     function showToast(msg){vistos.push(msg);}
     const res=[];
     res.push(avisarPushFallo('a'));
     res.push(avisarPushFallo('b'));
     _ahora+=AVISO_PUSH_MS-1000; res.push(avisarPushFallo('c'));
     _ahora+=2000;               res.push(avisarPushFallo('d'));
     resetAvisoPushFallo();      res.push(avisarPushFallo('e'));
     return {res,vistos,ventana:AVISO_PUSH_MS};`
  )();

  assertEqual(r.ventana, 2 * 60 * 1000, 'la ventana del aviso es de 2 minutos');
  assert(r.res[0] === true, 'el primer fallo sí avisa');
  assert(r.res[1] === false, 'el segundo inmediato no encima otro cartel');
  assert(r.res[2] === false, 'ni uno justo antes de que se cumpla la ventana');
  assert(r.res[3] === true, 'pasada la ventana vuelve a avisar');
  assert(r.res[4] === true, 'y un push exitoso resetea: el próximo corte avisa en el acto');
  assertEqual(r.vistos.join(','), 'a,d,e', 'solo se muestran los carteles que corresponden');

  // Un fallo dentro de un reintento de fondo no se muestra — y tampoco puede
  // "gastar" el turno del próximo aviso, que sí puede ser en primer plano.
  const fondo = new Function(
    grab('avisarPushFallo') + grab('resetAvisoPushFallo') +
    `const AVISO_PUSH_MS=${ventana};
     let _avisoPushFalloTs=0,_syncEnSilencio=true;
     const vistos=[];
     function showToast(msg){vistos.push(msg);}
     const callado=avisarPushFallo('de fondo');
     _syncEnSilencio=false;
     const visible=avisarPushFallo('en primer plano');
     return {callado,visible,vistos};`
  )();
  assert(fondo.callado === false, 'un fallo durante un reintento de fondo no muestra nada');
  assert(fondo.visible === true, 'y no consume la ventana: el siguiente aviso en primer plano sí sale');
  assertEqual(fondo.vistos.join(','), 'en primer plano', 'solo se ve el que corresponde');
}

// ─── Compartidos: el botón de al lado de Liquidar sube de verdad ───────────
section('compartidos — el botón sincroniza en vez de solo traer');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grabAsync = (name) => src.match(new RegExp('\\nasync function ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const btn = src.match(/<button id="shared-sync-btn"[\s\S]*?<\/button>/)[0];
  assert(/onclick="syncCompartidos\(this\)"/.test(btn), 'el botón de la pestaña Compartidos hace el sync completo');
  assert(!/syncSharedBtn/.test(src), 'ya no queda el handler viejo que solo traía (tocarlo no subía nada)');

  // Y está donde lo espera el usuario: al lado de Liquidar y del de control.
  const acciones = src.match(/<div class="sh-actions">[\s\S]*?<\/div>/)[0];
  assert(acciones.indexOf('sh-btn-liq') < acciones.indexOf('shared-sync-btn'),
    'queda inmediatamente después de Liquidar');
  assert(acciones.indexOf('shared-sync-btn') < acciones.indexOf('exportCompartidosData'),
    'y antes del botón de exportar control');
  assert(!/fetchPartnerGastos\(\)\.then/.test(acciones),
    'el botón suelto de "sincronizar pareja" ya no hace falta (lo hace el sync)');

  const sync = grabAsync('syncCompartidos');
  assert(/fetchSharedBin\(/.test(sync), 'sincronizar primero trae el bin compartido');
  assert(/fetchPartnerGastos\(/.test(sync), 'y también los gastos de la pareja');
  assert(/pushSharedBin\(/.test(sync), 'y después sube lo que falte — esto es lo que antes no pasaba');
  assert(/sharedPendientes\(/.test(sync), 'usando la misma cuenta que muestra el botón');
  assert(/fetchOk===false/.test(sync), 'si el fetch falla no pushea (no sobreescribe el bin con datos viejos)');

  // El contador de pendientes en el botón.
  assert(/const _pendCount=hasCompBin\?sharedPendientes\(\)\.total:0/.test(src),
    'el botón muestra cuántos items faltan subir');
  assert(/\.sh-pend\{/.test(src), 'y hay estilo para el contador');
  assert(/sin subir — tocá para sincronizar/.test(btn), 'con un título que explica qué significa');

  // Reintentos automáticos: es lo que evita tener que ir a Ajustes.
  const auto = src.match(/\nfunction startSharedAutoSync\([\s\S]*?\n}\n/)[0];
  assert(/reintentarPendientesCompartidos\(/.test(auto), 'el auto-sync reintenta lo que quedó sin subir');
  assert(/addEventListener\('online'/.test(src), 'y también se reintenta al recuperar la conexión');
  const visib = src.match(/Refrescar datos compartidos al volver al foco[\s\S]{0,500}/)[0];
  assert(/reintentarPendientesCompartidos\(/.test(visib), 'y al volver a la app');

  const push = grabAsync('pushSharedBin');
  assert(/resetAvisoPushFallo\(\)/.test(push), 'un push exitoso rehabilita el aviso');
  // El silencio del reintento es de contexto, no un parámetro del push: si
  // fuera un parámetro, el push anidado de fetchSharedBin se lo saltearía.
  const retry = grabAsync('reintentarPendientesCompartidos');
  assert(/_syncEnSilencio=true/.test(retry), 'el reintento se marca como "de fondo"');
  assert(/finally\{_syncEnSilencio=false;\}/.test(retry), 'y lo levanta pase lo que pase');
  assert(!/silencioso/.test(push), 'el push ya no depende de un flag propio que los anidados no reciben');
}

// ─── Compartidos: el reintento automático no puede pisar el bin ────────────
// Estas corren la función real, que es async.
async function testsReintentoCompartidos() {
  section('compartidos — reintento automático de lo que no subió');
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];
  const grabAsync = (name) => src.match(new RegExp('\\nasync function ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const compartido = (id, amount) => ({
    id, desc: 'Super', amount, cat: 'super', addedAt: 1000, month: 7, year: 2026,
    updatedAt: 500, shared: { active: true, paidBy: 'fede', splitPct: 50 },
  });

  const correr = ({ fetchOk = true, online = true, configurado = true, gastos = [], bin = [], doble = false }) =>
    new Function(
      grab('_sharedFingerprint') + grab('sharedPendientes') + grab('aplicarPendientes') +
      grab('_payFingerprint') + grab('marcarConfirmado') + grab('queueSharedBinWrite') + grabAsync('reintentarPendientesCompartidos') +
      `let _sharedBinGastos=${JSON.stringify(bin)},_sharedBinPayments=[];
       let _sharedBinWriteQueue=Promise.resolve();
       let _reintentandoPendientes=false;
       let _syncEnSilencio=false;
       let _sharedConfirmado={gastos:{},pays:{}};
       const localStorage={setItem(){},getItem(){return null;}};
       const log={fetch:0,push:0,enFetch:null,enPush:null,alFinal:null,render:0};
       const S={gastos:${JSON.stringify(gastos)}};
       const navigator={onLine:${!!online}};
       function compBinConfigured(){return ${!!configurado};}
       function getSharedPayments(){return [];}
       function scheduleRender(){log.render++;}
       function renderCompartidos(){}
       // Anotan si el silencio estaba puesto mientras corrían: fetchSharedBin
       // hace su propio push adentro, así que también tiene que estar cubierto.
       async function fetchSharedBin(){log.fetch++;log.enFetch=_syncEnSilencio;return ${!!fetchOk};}
       async function pushSharedBin(){log.push++;log.enPush=_syncEnSilencio;return true;}
       // Lo que el bin ya tenía confirmado antes del reintento.
       marcarConfirmado(_sharedBinGastos,_sharedBinPayments);
       const primera=reintentarPendientesCompartidos();
       const segunda=${doble} ? reintentarPendientesCompartidos() : Promise.resolve(null);
       return Promise.all([primera,segunda]).then(([r,r2])=>{
         log.alFinal=_syncEnSilencio;
         return {r,r2,log,bin:_sharedBinGastos.map(g=>g.id)};
       });`
    )();

  // El caso feliz: había un gasto sin subir y se sube solo, sin carteles.
  const ok = await correr({ gastos: [compartido('g1', 5000)] });
  assertEqual(ok.log.fetch, 1, 'el reintento trae el bin antes de escribir');
  assertEqual(ok.log.push, 1, 'y sube lo pendiente');
  assert(ok.log.enPush === true, 'el push del reintento va en silencio');
  assert(ok.log.enFetch === true, 'y el fetch también — su push interno (_needsRepush) queda cubierto');
  assert(ok.log.alFinal === false, 'terminado el reintento, el silencio se levanta');
  assertEqual(ok.bin.join(','), 'g1', 'el gasto queda en el bin');
  assert(ok.r === true, 'y devuelve que salió bien');

  // El silencio se levanta aunque el reintento corte por la mitad.
  const cortado = await correr({ gastos: [compartido('g1', 5000)], fetchOk: false });
  assert(cortado.log.alFinal === false, 'y también se levanta si el reintento aborta a mitad de camino');

  // Lo importante: sin un fetch bueno NO se pushea. Pushear ahí sobreescribiría
  // el bin con el snapshot viejo de la caché y borraría lo de la pareja.
  const sinRed = await correr({ gastos: [compartido('g1', 5000)], fetchOk: false });
  assertEqual(sinRed.log.fetch, 1, 'con el bin caído se intenta el fetch');
  assertEqual(sinRed.log.push, 0, 'pero no se pushea nada (no se pisa el bin con datos viejos)');
  assert(sinRed.r === false, 'y avisa que no pudo');

  // Sin nada pendiente no se gasta un request.
  const alDia = await correr({ bin: [compartido('g1', 5000)], gastos: [compartido('g1', 5000)] });
  assertEqual(alDia.log.fetch, 0, 'sin pendientes no se hace ni el fetch');
  assertEqual(alDia.log.push, 0, 'ni el push');
  assert(alDia.r === false, 'y devuelve false: no hubo nada que hacer');

  // Sin conexión ni se intenta.
  const offline = await correr({ gastos: [compartido('g1', 5000)], online: false });
  assertEqual(offline.log.fetch, 0, 'sin conexión no se intenta nada');
  assert(offline.r === false, 'y devuelve false');

  // Sin bin configurado tampoco.
  const sinBin = await correr({ gastos: [compartido('g1', 5000)], configurado: false });
  assertEqual(sinBin.log.fetch, 0, 'sin bin configurado no se intenta nada');

  // Dos disparos a la vez (el timer y el "online" pueden caer juntos) hacen
  // un solo viaje, no dos.
  const doble = await correr({ gastos: [compartido('g1', 5000)], doble: true });
  assertEqual(doble.log.fetch, 1, 'dos reintentos simultáneos hacen un solo fetch');
  assertEqual(doble.log.push, 1, 'y un solo push');
  assert(doble.r2 === false, 'el segundo se corta solo');

  // ── El timer de 3 minutos ─────────────────────────────────────────────
  // Tener algo sin subir no puede apagar el polling de la pareja: un bin
  // propio que rechaza escrituras deja pendientes para siempre, y con el
  // corte de antes los gastos de la pareja dejaban de llegar.
  section('compartidos — el auto-sync no deja de traer a la pareja');
  const tick = ({ pendientes = 0, oculto = false, pareja = true, bin = true }) => new Function(
    grab('startSharedAutoSync') +
    `let _sharedAutoTimer=null,_onlineRetryHooked=false,cb=null;
     const log={pareja:0,fetch:0,reintento:0,online:0};
     function setInterval(fn){cb=fn;return 1;}
     function clearInterval(){}
     const document={hidden:${!!oculto}};
     const window={addEventListener:(ev)=>{if(ev==='online')log.online++;}};
     const localStorage={getItem:()=>${!!pareja}?'binpareja':null};
     const PARTNER_BIN_KEY='p';
     function compBinConfigured(){return ${!!bin};}
     function sharedPendientes(){return {total:${pendientes}};}
     function fetchPartnerGastos(){log.pareja++;return Promise.resolve();}
     function fetchSharedBin(){log.fetch++;return Promise.resolve(true);}
     function reintentarPendientesCompartidos(){log.reintento++;return Promise.resolve(true);}
     startSharedAutoSync();
     cb();
     return log;`
  )();

  const conPendientes = tick({ pendientes: 3 });
  assertEqual(conPendientes.pareja, 1, 'con cosas sin subir, igual se trae a la pareja');
  assertEqual(conPendientes.reintento, 1, 'y además se reintenta la subida');
  assertEqual(conPendientes.fetch, 0, 'sin duplicar el fetch del bin (ya lo hace el reintento)');

  const alDiaTick = tick({ pendientes: 0 });
  assertEqual(alDiaTick.pareja, 1, 'sin pendientes se trae a la pareja');
  assertEqual(alDiaTick.fetch, 1, 'y el bin compartido');
  assertEqual(alDiaTick.reintento, 0, 'sin reintentar nada');

  const oculto = tick({ pendientes: 3, oculto: true });
  assertEqual(oculto.pareja, 0, 'en segundo plano no se gastan requests');
  assertEqual(oculto.reintento, 0, 'ni siquiera habiendo pendientes');

  const soloPareja = tick({ pendientes: 3, bin: false });
  assertEqual(soloPareja.pareja, 1, 'sin bin propio configurado, la pareja se trae igual');
  assertEqual(soloPareja.reintento, 0, 'y no se intenta subir a ningún lado');

  assertEqual(tick({}).online, 1, 'y se engancha el reintento al volver la conexión');
}


// ─── El chip del gasto compartido nombra al otro, sin "todo de" ────────────
// El chip ya empieza con 👫, así que "👫 todo de Mile" repetía la idea de
// compartido y hacía la etiqueta más larga que el nombre de la categoría.
section('compartidos — el chip del reparto');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const linea = src.match(/const repartoTxt=[^\n]*\n\s*const chip=[^\n]*/)[0];

  // pct es el porcentaje DEL QUE PAGÓ; miPct es el que le toca a quien mira.
  const chipDe = (yo, paidBy, pct) => new Function(
    `const _yo='${yo}';
     const sh={active:true,paidBy:'${paidBy}',splitPct:${pct}};
     const pagoYo=sh.paidBy===_yo;
     const miPct=pagoYo?${pct}:100-${pct};
     ` + linea + `
     return chip;`
  )();

  assertEqual(chipDe('fede', 'fede', 0), '<span class="gshared-chip">👫 Mile</span>',
    'lo pagó Fede pero es todo de Mile → "👫 Mile", sin el "todo de"');
  assertEqual(chipDe('mile', 'mile', 0), '<span class="gshared-chip">👫 Fede</span>',
    'y desde el celular de Mile el caso simétrico dice "👫 Fede"');
  assertEqual(chipDe('fede', 'mile', 100), '<span class="gshared-chip">👫 Mile</span>',
    'da igual quién puso la plata: si el 100% es de ella, el chip la nombra a ella');
  assertEqual(chipDe('fede', 'fede', 50), '<span class="gshared-chip">👫 50/50</span>',
    'el 50/50 no cambia');
  assertEqual(chipDe('fede', 'fede', 100), '<span class="gshared-chip">👫 todo tuyo</span>',
    'ni el "todo tuyo"');
  assertEqual(chipDe('fede', 'fede', 30), '<span class="gshared-chip">👫 30%</span>',
    'ni un porcentaje libre');

  assertEqual(/todo de \$\{/.test(src), false, 'no queda ningún "todo de X" en el código');
}

// ─── Editar gasto: el pagador que se guarda es el que se ve marcado ────────
// Los botones "Fede pagó" / "Mile pagó" viven en una sección que se oculta,
// no se recrea. openEditGasto solo los sincronizaba en la rama "es compartido",
// así que un gasto NO compartido los heredaba de la edición anterior. Al marcar
// el toggle, toggleEditShared miraba esas clases para decidir si poner un
// pagador por defecto: como ya había una marcada, no tocaba nada y _egPaidBy
// se quedaba con el usuario actual. Resultado: la pantalla decía "Mile pagó"
// resaltado y el gasto se guardaba como pagado por uno mismo.
section('editar gasto — quién pagó no se hereda del gasto anterior');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const stub = `
    function _mk(on){return {classList:{_s:new Set(on?['on']:[]),
      add(c){this._s.add(c)},remove(c){this._s.delete(c)},
      toggle(c,v){if(v)this._s.add(c);else this._s.delete(c);return v},
      contains(c){return this._s.has(c)}},style:{},textContent:'',innerHTML:'',dataset:{}};}
    function updateEGSharedPreview(){}
    function _renderEGSplitUI(){}`;

  // Escenario: los botones quedaron marcados del gasto anterior (mileOn) y el
  // usuario abre un gasto no compartido y toca el toggle "compartido".
  const alActivar = (mileOn, egPaidBy, myName) => new Function(
    grab('toggleEditShared') + grab('pickEGPaidBy') + stub +
    `const _els={'eg-pb-fede':_mk(!${mileOn}),'eg-pb-mile':_mk(${mileOn}),
       'eg-shared-toggle':_mk(),'eg-shared-toggle-ico':_mk(),
       'eg-shared-toggle-lbl':_mk(),'eg-shared-section':_mk()};
     function $(id){return _els[id];}
     function getMyName(){return '${myName}';}
     let _egShared=false, _egPaidBy='${egPaidBy}', _egSplitPct=50;
     toggleEditShared();
     return {guardado:_egPaidBy,
             marcadoYo:_els['eg-pb-fede'].classList.contains('on'),
             marcadoPareja:_els['eg-pb-mile'].classList.contains('on')};`
  )();

  const heredado = alActivar(true, 'fede', 'fede');
  assertEqual(heredado.guardado, 'fede', 'el pagador sale del estado, no de qué botón quedó marcado');
  assertEqual(heredado.marcadoYo, true, 'y los botones se repintan para coincidir con lo que se va a guardar');
  assertEqual(heredado.marcadoPareja, false, 'sin dejar marcado el de la pareja');

  const eligioPareja = alActivar(false, 'mile', 'fede');
  assertEqual(eligioPareja.guardado, 'mile', 'si el gasto ya venía pagado por la pareja, se respeta');
  assertEqual(eligioPareja.marcadoPareja, true, 'y es el botón de ella el que queda marcado');

  const desdeMile = alActivar(true, 'mile', 'mile');
  assertEqual(desdeMile.guardado, 'mile', 'desde el celular de Mile, "yo" es Mile');
  assertEqual(desdeMile.marcadoYo, true, 'y el botón "yo" (id -fede) es el suyo');

  // Y openEditGasto ya no deja los controles sin repintar cuando el gasto no
  // es compartido: la sincronización tiene que estar ANTES del if(isShared).
  const open = grab('openEditGasto');
  const iSync = open.indexOf("$('eg-pb-fede')?.classList.toggle('on'");
  const iSplit = open.indexOf('_renderEGSplitUI()');
  const iIf = open.indexOf('if(isShared){');
  assert(iSync > -1 && iSync < iIf, 'openEditGasto pinta quién pagó para cualquier gasto, compartido o no');
  assert(iSplit > -1 && iSplit < iIf, 'y también cómo se divide');

  // El toggle ya no decide nada mirando el DOM.
  assertEqual(/classList\.contains\('on'\)/.test(grab('toggleEditShared')), false,
    'toggleEditShared no vuelve a leer el estado desde las clases del DOM');
}

// ─── El fondo del modal siempre tapa la pantalla ──────────────────────────
// El overlay se dimensionaba con el visualViewport (var --vp-height + un
// style.height inline). Mientras el teclado se abre, Android reporta alturas
// intermedias, y la que quedaba fija dejaba el editor recortado arriba y la
// lista de gastos asomando abajo sin oscurecer: el editor y la lista parecían
// mezclarse. Ahora el overlay va de borde a borde y el teclado se esquiva con
// padding-bottom.
section('modales — el overlay cubre toda la pantalla');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const regla = src.match(/\n\.overlay\{[\s\S]*?\}\n/)[0];

  assert(/position:fixed/.test(regla) && /top:0/.test(regla) && /bottom:0/.test(regla),
    'el overlay va de borde a borde');
  assertEqual(/height:var\(--vp-height/.test(regla), false,
    'ya no se achica al alto del visualViewport');
  assert(/padding-bottom:var\(--kb-height/.test(regla) && /box-sizing:border-box/.test(regla),
    'el teclado se esquiva con padding, así el fondo sigue tapando lo de atrás');

  assertEqual(/\.overlay'\)\.forEach\(ov => \{ ov\.style\.height = vph/.test(src), false,
    'y el JS ya no le pisa el alto a cada overlay');

  // Con el teclado abierto queda poca pantalla: la hoja usa todo lo que hay en
  // vez del 88% de siempre, que dejaba una franja de fondo inútil arriba.
  assert(/:root\.kb-open \.modal\{max-height:100%\}/.test(src),
    'con el teclado abierto la hoja usa todo el alto disponible');
  assert(/classList\.toggle\('kb-open', kbH > 80\)/.test(src),
    'y la clase la pone el mismo handler que mide el teclado, con umbral');
}

// ─── El editor de gasto compartido tiene cuerpo scrolleable propio ────────
// Sin .modal-body explícito, el wrapper automático metía también el título
// adentro del área que scrollea: con el teclado abierto el título se iba para
// arriba y la hoja quedaba mostrando campos sueltos, sin decir qué era.
section('compartidos — el editor mantiene el título a la vista');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const modal = src.match(/id="ov-edit-shared"[\s\S]*?\n<\/div>\n/)[0];

  const iTitulo = modal.indexOf('✎ Editar gasto compartido');
  const iBody = modal.indexOf('class="modal-body"');
  const iAcciones = modal.indexOf('class="mactions"');
  const iCierre = modal.indexOf('/modal-body');

  assert(iBody > -1, 'el modal declara su propio .modal-body');
  assert(iTitulo < iBody, 'el título queda fuera del área que scrollea');
  assert(iCierre > iBody && iAcciones > iCierre, 'y los botones Cancelar/Guardar también');
}


// ─── El teclado del teléfono, medido con el visual viewport ────────────────
// En Safari innerHeight se queda con el alto máximo (barras de navegación
// plegadas) mientras visualViewport.height refleja lo que se ve: la resta da
// 60-100px sin ningún teclado abierto. Como de esa cuenta salen --kb-height y
// el modo kb-open, en iPhone el botón flotante, el chat y el relleno de las
// hojas quedaban levantados del piso todo el tiempo. La cuenta solo vale si hay
// un campo enfocado, que es lo único que garantiza que el teclado esté abierto.
section('teclado — las barras de Safari no cuentan como teclado');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];
  const kb = new Function(
    grab('_kbTypingEl') + grab('kbMetrics') +
    'return kbMetrics(arguments[0],arguments[1],arguments[2],arguments[3]);'
  );
  const campo = { tagName: 'INPUT' };
  const area = { tagName: 'TEXTAREA' };
  const lista = { tagName: 'SELECT' };
  const nota = { tagName: 'DIV', isContentEditable: true };
  const cuerpo = { tagName: 'BODY' };

  // El caso de iPhone: 90px de barras, sin nadie escribiendo.
  assertEqual(kb(844, 754, 0, cuerpo).kb, 0, 'sin campo enfocado, 90px de barras no son teclado');
  assertEqual(kb(844, 754, 0, cuerpo).open, false, 'y no se enciende el modo teclado');
  assertEqual(kb(844, 754, 0, null).kb, 0, 'sin activeElement tampoco');

  // Con alguien escribiendo, la misma cuenta sí vale.
  assertEqual(kb(844, 508, 0, campo).kb, 336, 'con un input enfocado, 336px de teclado');
  assertEqual(kb(844, 508, 0, campo).open, true, 'y se enciende el modo teclado');
  assertEqual(kb(844, 508, 0, area).kb, 336, 'un textarea cuenta igual');
  assertEqual(kb(844, 508, 0, lista).kb, 336, 'y un select, que en el teléfono también abre rueda');
  assertEqual(kb(844, 508, 0, nota).kb, 336, 'y un campo editable');

  // iOS además desplaza el visual viewport para dejar el campo a la vista: eso
  // es alto que sí se ve, no lo tapa el teclado.
  assertEqual(kb(844, 508, 90, campo).kb, 246, 'el corrimiento del viewport se descuenta');

  // Bordes.
  assertEqual(kb(844, 842, 0, campo).kb, 2, '2px de redondeo se miden igual');
  assertEqual(kb(844, 842, 0, campo).open, false, 'pero no abren el modo teclado (umbral 80px)');
  assertEqual(kb(844, 764, 0, campo).open, false, '80px justos tampoco');
  assertEqual(kb(844, 763, 0, campo).open, true, '81px sí');
  assertEqual(kb(844, 900, 0, campo).kb, 0, 'un viewport más alto que la ventana no da negativo');
}

// ─── Una cuota ya registrada no puede seguir pendiente ─────────────────────
// Reportado con "Cuotas celu" y "Cuotas zapatillas": las dos vencían el 3 de
// septiembre en Agenda, pero en Gastos de septiembre había una sola —la de
// zapatillas, ya cargada— y la Agenda la seguía mostrando por pagar. El gasto
// existía y la cuota también: el mes que viene contaba dos veces, y marcarla
// "Pagué" habría cargado el gasto por segunda vez.
section('cuotas — un gasto ya registrado en un mes futuro cierra la cuota');
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (name) => src.match(new RegExp('\\nfunction ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];

  const hoy = new Date();
  const mesQueViene = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 3);
  const gastoCuota = (desc, act, tot, d) => ({
    id: 'g-' + desc + act, desc, cat: 'tarjeta', amount: 36083, cuotaActual: act,
    cuotaTotal: tot, month: d.getMonth(), year: d.getFullYear(), day: d.getDate(),
    addedAt: d.getTime(),
  });

  const mundo = (gastos, cuotas) => new Function(
    grab('cuotaBaseName') + grab('cuotasBorradas') + grab('cuotaBorradaAt') +
    grab('clearCuotaBorrada') + grab('gastoTs') + grab('dateKey') +
    grab('proxVencCuota') + grab('markCuotaDoneState') + grab('cuotaGastoRegistrado') +
    grab('syncCuotasToAgenda') +
    `function save(){}
     function uid(){return 'nuevo';}
     function syncCuotaToPlan(){}
     const S={plan:[],gastos:${JSON.stringify(gastos)},
              agenda:{subs:[],vencimientos:[],inversiones:[],cuotas:${JSON.stringify(cuotas)}}};
     syncCuotasToAgenda();
     return {cuotas:S.agenda.cuotas,pendientes:S.agenda.cuotas.filter(c=>c.paid<c.total).map(c=>c.name),
             yaRegistrada:cuotaGastoRegistrado('Cuotas zapatillas',3),
             otra:cuotaGastoRegistrado('Cuotas celu',4)};`
  )();

  // El caso de la captura: la 3/3 de zapatillas ya está cargada con fecha del mes
  // que viene, pero la Agenda la sigue dando por pagar.
  const zapas = mundo(
    [gastoCuota('Cuotas zapatillas', 3, 3, mesQueViene)],
    [{ id: 'c1', name: 'Cuotas zapatillas', fee: 36083, total: 3, paid: 2, nextDueDate: '2026-09-03' }]
  );
  assertEqual(zapas.cuotas[0].paid, 3, 'la cuota ya registrada queda como paga');
  assertEqual(zapas.pendientes.length, 0, 'y sale de los próximos vencimientos');
  assert(!!zapas.cuotas[0].completedAt, 'queda marcada como terminada');
  assert(!!zapas.yaRegistrada, 'el gasto de esa cuota se encuentra por nombre + número');
  assertEqual(zapas.otra, null, 'y no se confunde con otra compra en cuotas');

  // La otra mitad del reporte: la cuota que NO tiene gasto cargado sigue pendiente.
  const celu = mundo(
    [gastoCuota('Cuotas celu', 3, 4, new Date(hoy.getFullYear(), hoy.getMonth(), 3))],
    [{ id: 'c2', name: 'Cuotas celu', fee: 58333, total: 4, paid: 3, nextDueDate: '2026-09-03' }]
  );
  assertEqual(celu.cuotas[0].paid, 3, 'una cuota sin gasto futuro no se toca');
  assertEqual(celu.pendientes.join(','), 'Cuotas celu', 'y sigue esperando el pago');

  // Recrear la compra desde los gastos (cuota borrada o venida de otro dispositivo)
  // tampoco puede resucitarla como pendiente si la última ya está cargada.
  const recreada = mundo([gastoCuota('Cuotas zapatillas', 3, 3, mesQueViene)], []);
  assertEqual(recreada.cuotas.length, 1, 'la compra se recrea desde el gasto');
  assertEqual(recreada.cuotas[0].paid, 3, 'con la cuota futura ya contada');
  assertEqual(recreada.pendientes.length, 0, 'así que no vuelve a la agenda por pagar');

  // Recreada a mitad de camino: la próxima vence un mes después de la última
  // registrada, no a fin del mes actual.
  const mitad = mundo([gastoCuota('Cuotas zapatillas', 1, 3, new Date(2026, 6, 3))], []);
  assertEqual(mitad.cuotas[0].nextDueDate, '2026-08-03', 'la próxima cuota vence el mismo día del mes siguiente');
  assertEqual(mitad.pendientes.join(','), 'Cuotas zapatillas', 'y queda pendiente, que es lo correcto');
}

// ─── Summary ─────────────────────────────────────────────────────────────────
function _summary() {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`${_passed + _failed} tests: ${_passed} passed, ${_failed} failed`);
  if (_failed > 0) {
    console.error(`\n${_failed} test(s) failed.`);
    process.exit(1);
  } else {
    console.log('\nAll tests passed.');
  }
}

// Las secciones async corren antes del resumen.
testsReintentoCompartidos().then(testsEdicionCompartida).then(_summary).catch((e) => {
  console.error('\nError corriendo las pruebas async:', e);
  process.exit(1);
});
