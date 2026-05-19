"""
Genera los archivos de importación del Libro IVA Digital (AFIP/ARCA)
a partir del listado de facturas pendientes de tomar CF.

Produce:
  - COMPRAS_CBTE.txt    : registros de comprobantes (325 chars/línea)
  - COMPRAS_ALICUOTAS.txt: registros de alícuotas   (84 chars/línea)
"""

import pandas as pd
import numpy as np
import re
from pathlib import Path

# ── Rutas de archivos ────────────────────────────────────────────────────────
UPLOAD_1 = Path('/root/.claude/uploads/55d48dcc-612d-437c-bd75-cbf68e74e902')
UPLOAD_2 = Path('/root/.claude/uploads/3111fb71-971b-4deb-abd6-ca07e56cc102')

DIFERENCIAS_FILE = UPLOAD_1 / '77fb1db4-Facturas_pendientes.xlsx'
ARCA_OLD_FILE    = UPLOAD_2 / '023a4f94-Comprobantes_de_compras_arca.xlsx'
ARCA_2026_FILE   = UPLOAD_1 / '15a1ef3b-ARCA_2026.csv'

OUTPUT_CBTE      = Path('COMPRAS_CBTE.txt')
OUTPUT_ALICUOTAS = Path('COMPRAS_ALICUOTAS.txt')

# ── Helpers de formato ────────────────────────────────────────────────────────

def fmt_amount(amount) -> str:
    """Float → 15 chars, 13 enteros + 2 decimales implícitos, sin punto."""
    try:
        val = abs(float(amount)) if pd.notna(amount) else 0.0
    except (TypeError, ValueError):
        val = 0.0
    return str(round(val * 100)).zfill(15)


def fmt_tipo_cambio(tc) -> str:
    """Float → 10 chars: 4 enteros + 6 decimales implícitos."""
    try:
        val = float(tc) if pd.notna(tc) else 1.0
    except (TypeError, ValueError):
        val = 1.0
    int_part = int(val)
    dec_part = round((val - int_part) * 1_000_000)
    return str(int_part).zfill(4) + str(dec_part).zfill(6)


def fmt_moneda(moneda) -> str:
    s = str(moneda).strip()
    return 'DOL' if s.upper() in ('USD', 'DOL') else 'PES'


def normalize_cuit(cuit) -> str:
    """Convierte 'XX-XXXXXXXX-X' o entero a string de 11 dígitos sin guiones."""
    if pd.isna(cuit):
        return ''
    return re.sub(r'[-\s]', '', str(cuit)).strip()


def parse_nro(nro_str):
    """
    Parsea el número de comprobante del Diferencias:
      '00014-15873907'  → pv=14,  num=15873907
      'A-00004-00002312'→ pv=4,   num=2312
    Retorna (pv:int, num:int) o (None, None).
    """
    s = str(nro_str).strip()
    s = re.sub(r'^[A-Za-z]-', '', s)   # quitar prefijo letra
    parts = s.split('-')
    if len(parts) == 2:
        try:
            return int(parts[0]), int(parts[1])
        except ValueError:
            pass
    return None, None


# Códigos de alícuota AFIP
ALICUOTA_CODE = {0: '0003', 10.5: '0004', 21: '0005', 27: '0006'}

# ── Lectura de archivos ───────────────────────────────────────────────────────

print("Leyendo Diferencias...")
# Fila 0: vacía, Fila 1: título, Fila 2: encabezados, Fila 3+: datos
dif = pd.read_excel(DIFERENCIAS_FILE, sheet_name='Diferencias', header=2)
dif.columns = ['Fecha', 'Tipo', 'Nro', 'Proveedor', 'Descripcion',
               'Debito', 'Credito', 'Neto', 'Saldo']
dif = dif[dif['Fecha'].notna()].reset_index(drop=True)
dif['Fecha'] = pd.to_datetime(dif['Fecha'], errors='coerce')
dif['Debito']  = pd.to_numeric(dif['Debito'],  errors='coerce').fillna(0)
dif['Credito'] = pd.to_numeric(dif['Credito'], errors='coerce').fillna(0)
print(f"  {len(dif)} filas en Diferencias")

print("Leyendo ARCA 2023-2024...")
arca_old = pd.read_excel(ARCA_OLD_FILE)
# Corregir encoding mojibake en nombres de columnas
fixed = []
for c in arca_old.columns:
    try:
        fixed.append(c.encode('latin-1').decode('utf-8'))
    except Exception:
        fixed.append(c)
arca_old.columns = fixed
print(f"  {len(arca_old)} filas")

print("Leyendo ARCA 2026...")
arca_2026 = pd.read_csv(ARCA_2026_FILE, sep=';', decimal=',', encoding='utf-8')
print(f"  {len(arca_2026)} filas")

arca = pd.concat([arca_old, arca_2026], ignore_index=True)
arca['cuit_norm'] = arca['Nro. Doc. Emisor'].apply(
    lambda x: str(int(x)).zfill(11) if pd.notna(x) else ''
)
arca['num_norm'] = arca['Número Desde'].apply(
    lambda x: int(x) if pd.notna(x) else -1
)
arca['pv_norm'] = arca['Punto de Venta'].apply(
    lambda x: int(x) if pd.notna(x) else -1
)
print(f"  Total ARCA combinado: {len(arca)} filas")

# ── Procesamiento ─────────────────────────────────────────────────────────────

cbte_lines      = []
alicuota_lines  = []
unmatched       = []
skipped         = []

for idx, row in dif.iterrows():
    tipo_doc = str(row['Tipo']).strip().upper()
    nro      = str(row['Nro']).strip()
    cuit_raw = str(row['Proveedor']).strip()
    descr    = str(row['Descripcion']).strip()
    fecha    = row['Fecha']
    debito   = float(row['Debito'])
    credito  = float(row['Credito'])

    # ADG → son ajustes internos sin comprobante AFIP
    if tipo_doc == 'ADG':
        skipped.append({'fila': idx+2, 'tipo': tipo_doc, 'nro': nro,
                        'proveedor': descr, 'razon': 'Ajuste interno (ADG) - sin comprobante AFIP'})
        continue

    cuit_11 = normalize_cuit(cuit_raw)
    pv, num = parse_nro(nro)

    if pv is None:
        unmatched.append({'fila': idx+2, 'tipo': tipo_doc, 'nro': nro,
                          'proveedor': descr, 'razon': 'No se pudo parsear el número'})
        continue

    # Buscar en ARCA: primero por CUIT + PV + Número
    mask = ((arca['cuit_norm'] == cuit_11) &
            (arca['num_norm']  == num) &
            (arca['pv_norm']   == pv))
    matches = arca[mask]

    # Si no encuentra, intentar solo CUIT + Número (PV puede diferir por errores de carga)
    if matches.empty:
        mask2 = (arca['cuit_norm'] == cuit_11) & (arca['num_norm'] == num)
        matches = arca[mask2]

    if matches.empty:
        unmatched.append({'fila': idx+2, 'tipo': tipo_doc, 'nro': nro,
                          'proveedor': descr, 'razon': 'Sin coincidencia en ARCA'})
        continue

    m = matches.iloc[0]

    # ── Datos desde ARCA ──
    arca_tipo   = int(m['Tipo de Comprobante'])
    arca_pv     = int(m['Punto de Venta'])
    arca_num    = int(m['Número Desde'])
    arca_cuit   = str(int(m['Nro. Doc. Emisor'])).zfill(11)
    arca_denom  = str(m['Denominación Emisor'])[:30].ljust(30)
    arca_total  = float(m['Imp. Total'])          if pd.notna(m['Imp. Total'])          else 0.0
    arca_no_grav= float(m['Imp. Neto No Gravado']) if pd.notna(m['Imp. Neto No Gravado']) else 0.0
    arca_exentas= float(m['Imp. Op. Exentas'])     if pd.notna(m['Imp. Op. Exentas'])     else 0.0
    arca_otros  = float(m['Otros Tributos'])       if pd.notna(m['Otros Tributos'])       else 0.0
    arca_moneda = fmt_moneda(m['Moneda'])
    arca_tc     = float(m['Tipo Cambio'])          if pd.notna(m['Tipo Cambio'])          else 1.0

    iva_105  = float(m['IVA 10,5%'])                    if pd.notna(m['IVA 10,5%'])                    else 0.0
    neto_105 = float(m['Imp. Neto Gravado IVA 10,5%'])  if pd.notna(m['Imp. Neto Gravado IVA 10,5%'])  else 0.0
    iva_21   = float(m['IVA 21%'])                      if pd.notna(m['IVA 21%'])                      else 0.0
    neto_21  = float(m['Imp. Neto Gravado IVA 21%'])    if pd.notna(m['Imp. Neto Gravado IVA 21%'])    else 0.0
    iva_27   = float(m['IVA 27%'])                      if pd.notna(m['IVA 27%'])                      else 0.0
    neto_27  = float(m['Imp. Neto Gravado IVA 27%'])    if pd.notna(m['Imp. Neto Gravado IVA 27%'])    else 0.0

    # CF computable: FAC → débito; NCC/NC → crédito (es la reducción de CF)
    cf = debito if tipo_doc == 'FAC' else credito

    # ── Alícuotas ──
    alicuotas = []
    if neto_105 > 0 or iva_105 > 0:
        alicuotas.append((neto_105, '0004', iva_105))
    if neto_21 > 0 or iva_21 > 0:
        alicuotas.append((neto_21,  '0005', iva_21))
    if neto_27 > 0 or iva_27 > 0:
        alicuotas.append((neto_27,  '0006', iva_27))

    # Si la factura tiene monto exento/no gravado Y también gravado → agregar línea 0%
    has_exempt = (arca_exentas > 0 or arca_no_grav > 0)
    if alicuotas and has_exempt:
        alicuotas.insert(0, (0.0, '0003', 0.0))

    # Si no hay nada gravado → sólo línea 0%
    if not alicuotas:
        alicuotas.append((0.0, '0003', 0.0))

    cant_alic  = len(alicuotas)
    tipo_str   = str(arca_tipo).zfill(3)
    pv_str     = str(arca_pv).zfill(5)
    num_str    = str(arca_num).zfill(20)
    fecha_str  = pd.Timestamp(fecha).strftime('%Y%m%d')
    cuit_20    = arca_cuit.zfill(20)

    # ── Registro CBTE (325 chars) ──
    cbte = (
        fecha_str                    +  # 1-8   fecha
        tipo_str                     +  # 9-11  tipo comprobante
        pv_str                       +  # 12-16 punto de venta
        num_str                      +  # 17-36 número
        ' ' * 16                     +  # 37-52 despacho importación (vacío)
        '80'                         +  # 53-54 código doc vendedor (CUIT)
        cuit_20                      +  # 55-74 CUIT vendedor
        arca_denom                   +  # 75-104 denominación (30)
        fmt_amount(arca_total)       +  # 105-119 importe total
        fmt_amount(arca_no_grav)     +  # 120-134 no gravado
        fmt_amount(arca_exentas)     +  # 135-149 operaciones exentas
        fmt_amount(0)                +  # 150-164 percepciones IVA
        fmt_amount(0)                +  # 165-179 percepciones otros imp. nac.
        fmt_amount(0)                +  # 180-194 percepciones IIBB
        fmt_amount(0)                +  # 195-209 percepciones municipales
        fmt_amount(0)                +  # 210-224 impuestos internos
        arca_moneda                  +  # 225-227 moneda (3)
        fmt_tipo_cambio(arca_tc)     +  # 228-237 tipo de cambio (10)
        str(cant_alic)               +  # 238    cantidad alícuotas (1)
        'E'                          +  # 239    código operación
        fmt_amount(cf)               +  # 240-254 crédito fiscal computable
        fmt_amount(arca_otros)       +  # 255-269 otros tributos
        '00000000000'                +  # 270-280 CUIT corredor (vacío)
        ' ' * 30                     +  # 281-310 denominación corredor (vacío)
        fmt_amount(0)                   # 311-325 IVA comisión
    )

    assert len(cbte) == 325, f"Fila {idx+2}: largo CBTE={len(cbte)}"
    cbte_lines.append(cbte)

    # ── Registros ALÍCUOTAS (84 chars c/u) ──
    for neto_g, alic_code, imp_liq in alicuotas:
        ali = (
            tipo_str              +  # 1-3   tipo
            pv_str                +  # 4-8   punto de venta
            num_str               +  # 9-28  número (20)
            '80'                  +  # 29-30 código doc vendedor
            cuit_20               +  # 31-50 CUIT (20)
            fmt_amount(neto_g)    +  # 51-65 neto gravado
            alic_code             +  # 66-69 código alícuota (4)
            fmt_amount(imp_liq)      # 70-84 impuesto liquidado
        )
        assert len(ali) == 84, f"Fila {idx+2}: largo ALI={len(ali)}"
        alicuota_lines.append(ali)


# ── Escribir archivos ─────────────────────────────────────────────────────────

with open(OUTPUT_CBTE, 'w', encoding='ascii') as f:
    f.write('\r\n'.join(cbte_lines))
    if cbte_lines:
        f.write('\r\n')

with open(OUTPUT_ALICUOTAS, 'w', encoding='ascii') as f:
    f.write('\r\n'.join(alicuota_lines))
    if alicuota_lines:
        f.write('\r\n')

# ── Reporte ───────────────────────────────────────────────────────────────────

print()
print("=" * 60)
print("RESULTADO")
print("=" * 60)
print(f"Registros CBTE generados      : {len(cbte_lines)}")
print(f"Registros Alícuotas generados : {len(alicuota_lines)}")
print(f"Saltados (ADG)                : {len(skipped)}")
print(f"Sin coincidencia en ARCA      : {len(unmatched)}")

total_cf = sum(
    float(row['Debito']) if str(row['Tipo']).strip().upper() == 'FAC' else float(row['Credito'])
    for _, row in dif.iterrows()
    if str(row['Tipo']).strip().upper() not in ('ADG',)
       and parse_nro(str(row['Nro']))[0] is not None
)

if skipped:
    print()
    print("── Ajustes internos (ADG) omitidos ──────────────────────")
    for s in skipped:
        print(f"  Fila {s['fila']:3d} | {s['tipo']:4s} | {s['nro']:20s} | {s['proveedor'][:40]}")

if unmatched:
    print()
    print("── Sin coincidencia en ARCA (requieren revisión manual) ──")
    for u in unmatched:
        print(f"  Fila {u['fila']:3d} | {u['tipo']:4s} | {u['nro']:25s} | {u['proveedor'][:35]} | {u['razon']}")

print()
print(f"Archivos generados:")
print(f"  → {OUTPUT_CBTE}      ({OUTPUT_CBTE.stat().st_size} bytes)")
print(f"  → {OUTPUT_ALICUOTAS} ({OUTPUT_ALICUOTAS.stat().st_size} bytes)")
