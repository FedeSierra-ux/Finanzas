# Cruce de un detalle de Mercado Pago (.xlsx) contra un backup de la app.
# Uso: python3 -I control-mp/cruce.py <backup.json> <detalle_mp.xlsx> <mes> [<mes> ...]
#   <mes> es 1-12 (los meses del detalle, más el anterior si hay gastos que se cruzan).
# Criterios en control-mp/CRITERIOS.md.
import json, sys, re, datetime, openpyxl
from collections import defaultdict

bk, xl, meses = sys.argv[1], sys.argv[2], {int(m) - 1 for m in sys.argv[3:]}  # la app guarda month 0-11

# Reglas de descarte (ver CRITERIOS.md). Se aplican solo a lo que NO está cargado.
DESCARTE = [
    (r'uber|dlocal|didi|ebanx', 'Uber/DiDi/EBANX'),
    (r'milena aluhe caro|aluhe caro milena', 'Transferencia a Mile'),
]
GRANDE = 80000  # transferencias a terceros desde este monto: se descartan si no están cargadas

d = json.loads(json.load(open(bk))['data']['fin_v6'])
borrados = set(d.get('_deletedGastoIds') or []) | set(d.get('_gTombs') or {})
G = [g for g in d['gastos'] if g['id'] not in borrados and g.get('year') and g.get('month') in meses
     and 'amount' in g and (g.get('shared') or {}).get('paidBy') != 'mile']

def fecha(g):
    if g.get('day'): return datetime.date(g['year'], g['month'] + 1, g['day'])
    return datetime.datetime.fromtimestamp(g['addedAt'] / 1000).date()

def num(v):
    return float(v) if isinstance(v, (int, float)) else float(str(v).replace('.', '').replace(',', '.'))

rows = [r[:4] for r in openpyxl.load_workbook(xl).active.iter_rows(min_row=2, values_only=True) if r[0]]
neto, info = defaultdict(float), {}
for f, t, ref, a in rows:
    neto[ref] += num(a)
    if not str(t).startswith('Devoluci'): info[ref] = (datetime.datetime.strptime(f, '%d-%m-%Y').date(), t)

usados, salida = set(), defaultdict(list)
for ref, (f, t) in sorted(info.items(), key=lambda kv: kv[1][0]):
    n = round(-neto[ref], 2)
    if abs(n) < 0.01:
        salida['NETEADO'].append((f, t, 0, 'cobro y devolución completa')); continue
    if n < 0: continue  # ingreso
    cands = sorted((g for g in G if g['id'] not in usados and abs(g['amount'] - n) <= 1.5),
                   key=lambda g: abs((fecha(g) - f).days))
    if cands:
        g = cands[0]; usados.add(g['id'])
        salida['OK'].append((f, t, n, f"{g['desc']} [{g['cat']}] {fecha(g):%d/%m}")); continue
    regla = next((r for p, r in DESCARTE if re.search(p, t, re.I)), None)
    if not regla and t.startswith('Transferencia') and n >= GRANDE: regla = 'Transferencia grande'
    salida['DESCARTE' if regla else 'FALTA'].append((f, t, n, regla or ''))

for k in ('FALTA', 'DESCARTE', 'OK', 'NETEADO'):
    print(f'\n=== {k} ({len(salida[k])}) ===')
    for f, t, n, x in salida[k]: print(f'{f:%d/%m}  {t[:48]:48} {n:>12,.2f}  {x}')

print('\n=== En la app (pagado por Fede) sin movimiento en MP: revisar duplicados o montos ===')
for g in sorted(G, key=fecha):
    if g['id'] not in usados: print(f"{fecha(g):%d/%m}  {g['desc'][:40]:40} {g['cat'][:22]:22} {g['amount']:>12,.2f}")
