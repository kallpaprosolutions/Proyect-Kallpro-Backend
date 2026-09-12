# KPI_FORMULAS.md
## Diccionario de fórmulas financieras · LOGIFI™ ERP

> Referencia técnica completa de las 60+ métricas calculadas por el módulo financiero.
> Cada fórmula incluye su justificación NIIF/SRI y notas de implementación.

---

## 📐 Convenciones

- **AC** = Activo Corriente
- **PC** = Pasivo Corriente
- **ANC** = Activo No Corriente
- **PNC** = Pasivo No Corriente
- **Inv** = Inventarios
- **CxC** = Cuentas por Cobrar comerciales
- **CxP** = Cuentas por Pagar comerciales
- **COGS** = Costo de Ventas (Cost of Goods Sold)
- **EBITDA** = Earnings Before Interest, Taxes, Depreciation & Amortization
- **NOPAT** = Net Operating Profit After Tax
- **WACC** = Weighted Average Cost of Capital
- **FCF** = Free Cash Flow
- **CapEx** = Capital Expenditures
- **WC** = Working Capital
- **t** = tasa impositiva efectiva (Ecuador: 36.25%)

---

# 1. LIQUIDEZ

## RC · Razón corriente
**Fórmula:** `RC = AC / PC`
**Interpretación:** ¿Cuántas veces el activo corriente cubre las obligaciones de corto plazo?
**Benchmark sector:** ≥ 1.5x
**NIIF ref:** NIC 1 (presentación de estados financieros)
**Implementación SQL:**
```sql
SELECT
  SUM(CASE WHEN coa.account_type='ACTIVO' AND coa.code LIKE '1.1%' THEN balance ELSE 0 END) /
  NULLIF(SUM(CASE WHEN coa.account_type='PASIVO' AND coa.code LIKE '2.1%' THEN balance ELSE 0 END), 0)
FROM finance.mv_balance_sheet;
```

## PA · Prueba ácida (Quick ratio)
**Fórmula:** `PA = (AC - Inv) / PC`
**Interpretación:** Liquidez excluyendo inventarios (más conservadora).
**Benchmark sector:** ≥ 1.0x
**NIIF ref:** NIC 2 (inventarios excluidos por menor liquidez)

## RE · Razón de efectivo (Cash ratio)
**Fórmula:** `RE = (Caja + Equivalentes) / PC`
**Interpretación:** Capacidad de pago inmediata sin convertir activos.
**Benchmark sector:** ≥ 0.20x

## CTN · Capital de trabajo neto
**Fórmula:** `CTN = AC - PC`
**Interpretación:** Recursos disponibles después de cubrir deuda corto plazo.
**Unidad:** USD
**NIIF ref:** NIC 1.66 (clasificación corriente/no corriente)

---

# 2. SOLVENCIA Y ENDEUDAMIENTO

## END · Endeudamiento total
**Fórmula:** `END = Pasivo Total / Activo Total`
**Benchmark Ecuador PyMES:** ≤ 60%
**Interpretación:** % del activo financiado con deuda.

## DE · Apalancamiento (Debt to Equity)
**Fórmula:** `D/E = Pasivo Total / Patrimonio`
**Benchmark sector:** ≤ 1.5x
**NIIF ref:** NIIF 9 (instrumentos financieros)

## CI · Cobertura de intereses
**Fórmula:** `CI = EBITDA / Gastos Financieros`
**Benchmark mínimo:** ≥ 3x (bancos suelen requerir esto para crédito)
**NIIF ref:** NIC 23 (costos por préstamos)

## END_FIN · Endeudamiento financiero
**Fórmula:** `END_FIN = Deuda Financiera / EBITDA`
**Interpretación:** ¿En cuántos años de EBITDA se paga toda la deuda financiera?
**Benchmark:** ≤ 3.5x (para acceso a crédito empresarial Ecuador)

## DC · Deuda concentrada corto plazo
**Fórmula:** `DC = Deuda CP / Deuda Total`
**Benchmark:** ≤ 40% (mayor concentración = mayor riesgo refinanciación)

---

# 3. RENTABILIDAD

## MB · Margen bruto
**Fórmula:** `MB = Utilidad Bruta / Ingresos Netos × 100`
**Donde:** `Utilidad Bruta = Ingresos - COGS`
**Benchmark sector B2B logística Ecuador:** 55-65%
**NIIF ref:** NIIF 15 (reconocimiento ingresos), NIC 2 (costo inventarios)

## ME · Margen EBITDA
**Fórmula:** `ME = EBITDA / Ingresos × 100`
**Benchmark target LOGIFI:** ≥ 18%

## MO · Margen operativo
**Fórmula:** `MO = Utilidad Operativa / Ingresos × 100`
**Donde:** `Util. Op. = EBITDA - Depreciación - Amortización`
**NIIF ref:** NIC 16 (PPE), NIC 38 (intangibles)

## MN · Margen neto
**Fórmula:** `MN = Utilidad Neta / Ingresos × 100`
**Para Ecuador:** Después de 15% PT (Código Trabajo Art. 97) + 25% IR (LRTI Art. 37)

## ROA · Return on Assets
**Fórmula:** `ROA = Utilidad Neta / Activo Total Promedio × 100`
**Benchmark sector Ecuador:** 8-12%
**NIIF ref:** NIC 1.85 (información a presentar)

## ROE · Return on Equity
**Fórmula:** `ROE = Utilidad Neta / Patrimonio Promedio × 100`
**Benchmark mínimo aceptable:** 15%
**Excelente:** ≥ 20%

## ROIC · Return on Invested Capital
**Fórmula:** `ROIC = NOPAT / Capital Invertido × 100`
**Donde:**
```
NOPAT = EBIT × (1 - t)
Capital Invertido = Patrimonio + Deuda Financiera Neta
```
**Interpretación:** Rentabilidad real del capital empleado en el negocio.
**Comparar con WACC:** Si ROIC > WACC → empresa crea valor económico.

## DUPONT · Análisis DuPont
**Fórmula:** `ROE = MN × Rotación de Activos × Apalancamiento`
**Donde:**
```
ROE = (Utilidad Neta / Ingresos) × (Ingresos / Activo) × (Activo / Patrimonio)
```
**Uso:** Descomponer ROE para identificar qué palanca está moviendo la rentabilidad.

---

# 4. EFICIENCIA OPERATIVA

## RA · Rotación de activos
**Fórmula:** `RA = Ingresos / Activo Total Promedio`
**Interpretación:** USD de venta generados por cada USD invertido en activos.
**Benchmark sector logística:** 1.8x

## RI · Rotación de inventario
**Fórmula:** `RI = COGS / Inventario Promedio`
**Benchmark sector:** 6.0x (cada inventario rota cada 60 días)
**NIIF ref:** NIC 2.34 (información a revelar)

## DI · Días de inventario
**Fórmula:** `DI = (Inventario Promedio / COGS) × 365`
**Benchmark target LOGIFI:** ≤ 45 días
**Cálculo:** `DI = 365 / RI`

## RCC · Rotación de cuentas por cobrar
**Fórmula:** `RCC = Ingresos a Crédito / CxC Promedio`
**Interpretación:** Cuántas veces se cobra el portafolio de clientes en el año.

## DSO · Days Sales Outstanding
**Fórmula:** `DSO = (CxC Promedio / Ingresos a Crédito) × 365`
**Benchmark sector Ecuador B2B:** 45-60 días
**Acción si > 60d:** programa de pronto pago, factoring, revisar cupos
**NIIF ref:** NIIF 9 (deterioro de instrumentos financieros - ECL)

## RCP · Rotación de cuentas por pagar
**Fórmula:** `RCP = Compras a Crédito / CxP Promedio`

## DPO · Days Payable Outstanding
**Fórmula:** `DPO = (CxP Promedio / Compras a Crédito) × 365`
**Benchmark sector:** 35-45 días
**Estrategia:** maximizar DPO sin afectar relación con proveedores

## CCC · Cash Conversion Cycle
**Fórmula:** `CCC = DI + DSO - DPO`
**Interpretación:** Días que el dinero está "atrapado" en el ciclo operativo.
**Target LOGIFI:** ≤ 45 días
**Optimización:** reducir DSO + DI, extender DPO (sin sanción)

---

# 5. GENERACIÓN DE VALOR (CFO MÉTRICAS)

## EVA · Economic Value Added
**Fórmula:** `EVA = NOPAT - (WACC × Capital Invertido)`
**Interpretación:**
- EVA > 0 → empresa crea valor económico
- EVA < 0 → empresa destruye valor (ROIC < WACC)

**Implementación:**
```javascript
function calculateEVA(period) {
  const nopat = ebit(period) * (1 - taxRate);
  const ic = patrimony(period) + netFinancialDebt(period);
  const wacc = calculateWACC(period);
  return nopat - (wacc * ic);
}
```

## WACC · Weighted Average Cost of Capital
**Fórmula:**
```
WACC = (E/V × Re) + (D/V × Rd × (1 - t))

Donde:
  E = valor mercado del patrimonio
  D = valor mercado de la deuda
  V = E + D
  Re = costo del patrimonio (CAPM: Rf + β × ERP + RP)
  Rd = costo de la deuda
  t = tasa impositiva
```

**Para Ecuador (PyMES sin valor de mercado):**
- Rf = bonos USA 10Y o tasa pasiva BCE (~4.5%)
- β = 1.0 (proxy sectorial)
- ERP = 6% (prima riesgo accionario USA)
- RP = 3.4% (prima riesgo país Ecuador, EMBI)
- Rd = tasa promedio créditos bancarios sector (~10-12%)

**Resultado típico Ecuador:** 11-14%

## FCF · Free Cash Flow
**Fórmula 1 (desde EBITDA):**
```
FCF = EBITDA × (1 - t) + Depreciación × t - CapEx - ΔWC
```

**Fórmula 2 (desde Cash Flow operativo):**
```
FCF = Flujo Operativo - CapEx - Pago dividendos preferentes
```

**Uso:** input clave del DCF.

## FCFE · Free Cash Flow to Equity
**Fórmula:** `FCFE = FCF - Pago intereses × (1 - t) - Amortización deuda + Nueva deuda`

---

# 6. VALUACIÓN DCF

## EV · Enterprise Value
**Fórmula:**
```
EV = Σ(FCF_y / (1 + WACC)^y) + TV / (1 + WACC)^N
```

**Donde:**
- y = año (1 a N, típicamente 5)
- N = último año de proyección explícita
- TV = Terminal Value

## TV · Terminal Value (Gordon Growth Model)
**Fórmula:**
```
TV = FCF_(N+1) / (WACC - g) = FCF_N × (1 + g) / (WACC - g)
```

**Donde:**
- g = tasa crecimiento perpetuo (Ecuador L.P.: 2-4%)
- WACC > g (siempre — si no, fórmula explota)

## Equity Value
**Fórmula:** `Equity Value = EV - Deuda Financiera Neta + Caja excedente`

**Implementación completa en `dcfService.js`:**
```javascript
async function calculateDCF(tenantId, assumptions) {
  const {
    growth_rate, ebitda_margin, tax_rate,
    wacc, perpetual_growth, capex_pct,
    wc_change_pct, projection_years = 5
  } = assumptions;

  if (wacc <= perpetual_growth) {
    throw new Error('WACC debe ser mayor que la tasa de crecimiento perpetuo');
  }

  let baseRevenue = await getLatestAnnualRevenue(tenantId);
  let pvFlows = 0;
  const yearlyProjections = [];

  for (let y = 1; y <= projection_years; y++) {
    const revenueY = baseRevenue * Math.pow(1 + growth_rate, y);
    const ebitdaY = revenueY * ebitda_margin;
    const nopatY = ebitdaY * (1 - tax_rate);
    const capexY = revenueY * capex_pct;
    const dwcY = revenueY * wc_change_pct;
    const fcfY = nopatY - capexY - dwcY;
    const pvFcfY = fcfY / Math.pow(1 + wacc, y);

    pvFlows += pvFcfY;
    yearlyProjections.push({
      year: new Date().getFullYear() + y,
      revenue: revenueY,
      ebitda: ebitdaY,
      fcf: fcfY,
      pv_fcf: pvFcfY
    });
  }

  const lastFCF = yearlyProjections[projection_years - 1].fcf;
  const tv = (lastFCF * (1 + perpetual_growth)) / (wacc - perpetual_growth);
  const pvTv = tv / Math.pow(1 + wacc, projection_years);

  const enterpriseValue = pvFlows + pvTv;
  const netDebt = await getNetFinancialDebt(tenantId);
  const equityValue = enterpriseValue - netDebt;

  return {
    enterprise_value: enterpriseValue,
    equity_value: equityValue,
    pv_explicit_flows: pvFlows,
    pv_terminal: pvTv,
    yearly_projections: yearlyProjections,
    assumptions_used: assumptions
  };
}
```

---

# 7. KPIs DE OPTIMIZACIÓN 4D (DIFERENCIADOR LOGIFI)

## Dimensión TIEMPO

### PCT · Procurement Cycle Time
**Fórmula:** `PCT = Σ(Fecha OC - Fecha Requisición) / N requisiciones`
**Origen:** módulo Compras
**Target:** ≤ 3 días

### LT · Lead Time promedio
**Fórmula:** `LT = Σ(Fecha Recepción - Fecha OC) / N OCs`
**Origen:** módulo Compras + Inventario

### CCC (ya definido en sección 4)

### TTI · Time To Insight
**Fórmula:** `TTI = tiempo desde cierre hasta KPI disponible`
**Target LOGIFI:** ≤ 60 segundos (gracias a mat_views en tiempo real)

---

## Dimensión DINERO

### WC, ROI, EVA, FCF (ya definidos)

### CoC · Costo de capital atrapado
**Fórmula:** `CoC = (CCC × Ventas Diarias) × (Tasa Activa Mensual)`
**Interpretación:** ¿Cuánto te cuesta cada mes tener dinero "atrapado" en el ciclo?

### ABC Spend Concentration
**Fórmula:**
```
A = items con 80% del spend (típicamente 14-20% de SKUs)
B = items con 15% del spend (siguiente 30%)
C = items con 5% del spend (resto)
```
**Origen:** módulo Compras (campo amount_usd en purchase_orders)

### SUM · Spend Under Management
**Fórmula:** `SUM = Spend gestionado por LOGIFI / Spend total empresa × 100`

### IMR · Invoice Match Rate (3-way matching)
**Fórmula:** `IMR = Facturas con 3-way match exitoso / Total facturas × 100`
**Target:** ≥ 95%

---

## Dimensión CALIDAD

### DR · Defect Rate
**Fórmula:** `DR = Unidades rechazadas / Unidades recibidas × 100`
**Origen:** módulo Inventario (recepciones con discrepancia)

### COPQ · Cost of Poor Quality
**Fórmula:** `COPQ = Σ(rechazos × costo unitario + retrabajos + scrap)`

### OTIF · On-Time In-Full
**Fórmula:** `OTIF = Entregas a tiempo Y completas / Total entregas × 100`
**Target:** ≥ 90%

### FPY · First Pass Yield
**Fórmula:** `FPY = Items aceptados primera revisión / Total recibido × 100`

### RR · Returns Rate
**Fórmula:** `RR = Devoluciones de clientes / Unidades vendidas × 100`

### SQS · Supplier Quality Score
**Fórmula:** `SQS = (OTIF × 0.4) + (FPY × 0.3) + (Cumplimiento × 0.2) + (Documentación × 0.1)`
**Origen:** módulo Proveedores (calificación 360°)

---

## Dimensión LOGÍSTICA

### CPK · Cost Per Kilometer
**Fórmula:** `CPK = Costo total operación TMS / Km recorridos`
**Componentes:** combustible + peajes + nómina + mantenimiento + amortización

### UTL · Truck Utilization (Llenado de carga)
**Fórmula:** `UTL = Volumen utilizado / Capacidad disponible × 100`
**Target:** ≥ 80%

### OTD · On-Time Delivery
**Fórmula:** `OTD = Entregas a tiempo / Total entregas × 100`

### DMG · Demurrage Cost
**Fórmula:** `DMG = Σ(horas detenidas × tarifa demurrage)`
**Origen:** módulo Logística (eventos GPS de detención)

### ROIL · Route Optimization Index
**Fórmula:** `ROIL = (Km original - Km optimizado) / Km original × 100`
**Origen:** módulo TMS (algoritmo de ruteo)
**Conversión a USD:** `Ahorro = ROIL × CPK × Km totales`

---

# 8. CUMPLIMIENTO SRI ECUADOR

## IVA por pagar mensual
**Fórmula:**
```
IVA por pagar = IVA Repercutido (ventas) - IVA Soportado (compras)
```

**Tasas vigentes:**
- 0% (productos básicos, exportaciones)
- 15% (general, vigente desde abril 2024) — antes era 12%

## Crédito tributario IVA
**Fórmula:**
```
Si IVA Soportado > IVA Repercutido:
  Crédito Tributario = IVA Soportado - IVA Repercutido (se acumula)
```

**NIIF ref:** NIC 12 (impuesto a las ganancias)

## Retenciones en la fuente

**Tabla de porcentajes Ecuador (2026):**

| Concepto | % |
|----------|----|
| Servicios profesionales | 10% |
| Servicios prestados por sociedades | 2% |
| Honorarios profesionales personas naturales | 10% |
| Compras locales (bienes) | 1.75% |
| Servicios entre sociedades | 2% |
| Arrendamiento mercantil | 2.75% |
| Transporte privado pasajeros y carga | 1% |
| Pagos al exterior | 25% (varía por convenio) |

## Impuesto a la Renta sociedades
**Fórmula:**
```
Base imponible = Utilidad antes de imp. - Participación trabajadores 15%
IR = Base imponible × 25%
```

**Tasa Ecuador:** 25% (LRTI Art. 37)
**Reducciones aplicables:** zonas deprimidas, contratación inclusiva, reinversión

## Participación de trabajadores
**Fórmula:** `PT = Utilidad antes de imp. × 15%`
**Base legal:** Código de Trabajo Art. 97
**Distribución:** 10% trabajadores activos, 5% según cargas familiares

## Tasa impositiva efectiva total
```
TET = (PT + IR) / Utilidad antes de impuestos
TET = (15% + 25% × 85%) = 36.25%
```

---

# 9. AHORROS (4 TIPOS — DIFERENCIADOR LOGIFI)

## Hard Savings
**Fórmula:**
```
Hard Savings = (Precio referencia - Precio negociado) × Cantidad comprada
```
**Validación:** precio referencia debe estar documentado (cotización previa, lista oficial proveedor, contrato anterior).

## Cost Avoidance
**Fórmula:**
```
Cost Avoidance = Costo evitado (precio inflación esperada vs precio congelado)
                + Penalidades evitadas
                + Costos no incurridos por mejor decisión
```
**Ejemplo:** proveedor anuncia subida 10%, contrato congela precio actual por 12m → CA = precio × cantidad × 10%.

## Consolidación Savings
**Fórmula:**
```
Consolidación = (Precio sin contrato marco - Precio con contrato marco) × Volumen YTD
              + Reducción gastos administrativos por menor # OCs
```

## Downtime Avoided (Lucro cesante evitado)
**Fórmula:**
```
Downtime Avoided = Stockouts prevenidos × Horas evitadas × (Ingresos/hora - Costos variables/hora)
```

**Donde `Ingresos/hora` viene de la línea de negocio del cliente:**
- Mining: producción horaria × precio comoditie
- Construcción: avance horario × valor contractual
- Agro: hectáreas/hora × ingreso/hectárea
- Retail: ticket promedio × transacciones/hora

**Implementación:**
```javascript
async function calculateDowntimeAvoided(tenantId, period) {
  const stockoutsPrevented = await getStockoutsPredicted(tenantId, period);
  const businessSettings = await getBusinessSettings(tenantId);
  // businessSettings.revenue_per_hour: USD/hora cuando todo opera

  return stockoutsPrevented.reduce((acc, s) => {
    return acc + (s.hours_avoided * businessSettings.revenue_per_hour);
  }, 0);
}
```

## Total Savings (mega-card del dashboard)
**Fórmula:**
```
Total Savings = Hard Savings + Cost Avoidance + Consolidation + Downtime Avoided
```

---

# 10. NOTAS DE IMPLEMENTACIÓN

## Reglas críticas para Claude Code

### 1. Promedios para ratios financieros
Cuando una fórmula incluye "Promedio" (ej: Inventario Promedio, Activo Promedio), siempre calcular:
```
Promedio = (Valor inicio período + Valor fin período) / 2
```
NO usar solo el valor final. Esto es estándar contable y NIIF.

### 2. Ajuste de moneda
Toda fórmula asume USD (moneda funcional Ecuador). Si el cliente tiene operaciones en otras monedas:
- Convertir al tipo de cambio de cierre (NIC 21)
- Diferencias cambiarias → cuenta separada en P&L

### 3. Anualización de ratios
Si el período no es anual (ej: trimestral), anualizar las métricas de flujo:
```
EBITDA anualizado = EBITDA del trimestre × 4
```
NO anualizar las de stock (Activos, Pasivos, Patrimonio).

### 4. Tax shield en WACC y FCF
El beneficio fiscal de la deuda se aplica en:
- WACC: `Rd × (1 - t)` (no Rd directo)
- FCF: NOPAT usa `EBIT × (1 - t)` (sin restar interest)

### 5. Trazabilidad
Cada KPI debe poder hacer "drill-down" hasta los asientos contables que lo originan. Implementa metadatos en el response:
```json
{
  "code": "ROE",
  "value": 23.1,
  "drill_down": {
    "numerator_query": "/api/finance/account-detail?account=resultado_ejercicio",
    "denominator_query": "/api/finance/account-detail?account=patrimonio"
  }
}
```

### 6. Validación de cierre contable
Antes de calcular KPIs de un período, verificar:
- ¿Está cerrado el período? → usar valores definitivos
- ¿Está abierto? → marcar resultados como "preliminares"

### 7. Manejo de divisiones por cero
TODAS las fórmulas con división deben usar `NULLIF` en SQL o validación en JS:
```javascript
const ratio = denominator !== 0 ? numerator / denominator : null;
```

---

## Referencias y bibliografía

- **Ross, Westerfield & Jaffe** — *Corporate Finance* (capítulos sobre DCF, WACC, EVA)
- **Damodaran** — *Investment Valuation* (referencia estándar para DCF)
- **NIIF/IFRS Foundation** — Normas oficiales: https://www.ifrs.org
- **Superintendencia de Compañías Ecuador** — https://www.supercias.gob.ec
- **SRI Ecuador** — https://www.sri.gob.ec
- **BCE Ecuador** — Tasas referenciales: https://contenido.bce.fin.ec

---

**KallpaPro Soluciones Integrales · Mayo 2026**
*Si encuentras una discrepancia entre este diccionario y la implementación, este documento es la fuente de verdad.*
