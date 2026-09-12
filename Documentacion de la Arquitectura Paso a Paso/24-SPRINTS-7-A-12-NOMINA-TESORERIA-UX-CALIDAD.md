# 24 — Sprints 7 a 12: Nómina, Tesorería, UX Odoo, Declaraciones SRI y Calidad

> Consolida seis sprints (2026-07-06 → 2026-07-23) que no tenían documento propio en esta
> carpeta. El detalle vivo de cada área está en `Arquitectura KallpaPro/`.
> Estado al cierre: **backend 173/173 · frontend 72/72 · tsc limpio en ambos**.

---

## Sprint 7 — Tests de frontend y barrido de calidad

**Objetivo:** el frontend no tenía red de seguridad.

- Se montó **Vitest + React Testing Library** (`src/test/setup.ts`, jsdom).
- 36 tests iniciales sobre las páginas críticas.
- **Barrido manual de todos los módulos como usuario**: terminó con 0 errores de consola y
  ~10 correcciones de i18n/labels (textos en inglés o enums crudos que se escapaban a la UI).
- **Bug contable real corregido**: el mapeo `SUPPLIER_ADVANCE` apuntaba a `1010308` cuando la
  cuenta correcta de anticipos a proveedores es `1010403`.

Pendiente detectado: el mapeo en la BD demo y un `movementId` huérfano en el ajuste AJU-0001.

---

## Sprint 8 — Nómina Ecuador 2026

Módulo completo backend + frontend con la normativa ecuatoriana vigente.

- **Motor puro de cálculo** (`payroll.service`) con tests: SBU 482, aporte personal IESS 9,45 %
  y patronal 12,15 %, décimo tercero y décimo cuarto (mensualizado o provisionado), fondos de
  reserva 8,33 %, e impuesto a la renta 2026 con rebaja por gastos personales.
- **Asientos automáticos**: devengo (520201/520202/520203) y pago (2010701/2010703/2010704).
- Empleados por categoría (jefatura/asistente/servicios) y departamento.
- 21 tests backend + 7 frontend. **E2E validado** con 3 empleados demo; asientos AST-0007 y
  AST-0008 cuadrados.

Detalle: `Arquitectura KallpaPro/tesoreria-nomina-biometrico.md`.

---

## Sprint 9 — Tesorería + Biométrico (y 9.1 Conciliación bancaria)

**Tesorería**
- `BankAccount` con catálogo de 21 instituciones ecuatorianas y BIC verificados
  (PICHECEQ, GUAYECEG, PACIECEG, PRODECEQ…); las cuentas del exterior exigen SWIFT/IBAN.
- **Flujo de pagos consolidado** (`GET /treasury/obligations`): cuentas por pagar + nómina
  aprobada + impuestos SRI/IESS, cada uno con su **vencimiento normativo** (SRI por 9.º dígito
  del RUC: día 10…28; IESS día 15).
- **Flujo de cobros** por `dueDate` de las facturas de venta y proyección de caja semanal.
- `registerTransaction` despacha por origen y **genera el asiento** correspondiente; un
  movimiento con asiento no se anula desde Tesorería.

**Biométrico**
- Import CSV de ZKTeco (`cedula;fecha;entrada;salida`) → `attendance_records` (descuenta 1 h de
  almuerzo si la jornada supera 5 h) → `classifyDay` (lun–vie sobre 8 h = suplementarias 50 %;
  sábado/domingo = extraordinarias 100 %) → novedades idempotentes en el rol del período.

**Sprint 9.1 — Conciliación bancaria**
- `BankStatementLine` + matcher puro `matchStatementLines`:
  **AUTO** cuando la referencia coincide o hay candidato único ±3 días;
  **SEMIAUTO** con sugerencias puntuadas hasta ±15 días.
- Import de extracto CSV, confirmación de sugerencia con un clic, y creación de movimientos
  MANUAL desde la línea del extracto (comisiones/intereses nacen ya conciliados).

Migraciones: `payroll_module`, `treasury_attendance`, `bank_reconciliation`.

---

## Sprint 10 — Fase A del plan Odoo 18 (UX transversal)

**A1 · Búsqueda global Ctrl+K**
- `GET /api/search?q=` federado sobre clientes, proveedores, productos, órdenes de compra,
  facturas, pedidos y requisiciones (motor puro `buildSearchResponse`, 5 resultados por tipo).
- Frontend con la librería `cmdk`: se abre con Ctrl+K o el botón del navbar; incluye los menús
  del sistema con palabras clave.
- **Limitación conocida:** sensible a acentos. Pendiente: extensión `unaccent` de PostgreSQL.

**A4 · Smart buttons**
- `GET /api/search/related/:entityType/:entityId` + componente `<SmartButtons/>`:
  OC → asientos/envíos/documentos SRI; pedido → asientos/facturas/envíos;
  factura → asientos/pagos/retenciones/notas de crédito.
- El libro diario acepta `?entityType&entityId` con un chip para quitar el filtro.

**A2 · Chatter ligero**
- Modelo `DocumentMessage` + `GET/POST /api/chatter/:entityType/:entityId` y componente
  `<Chatter/>` montado en OC, factura, pedido y requisición.
- Falta del patrón Odoo: log automático de cambios por campo y seguidores (backlog A2.2).

Migración: `chatter_document_messages`.

---

## Sprint 11 — Declaraciones SRI por casillas + tablero contable

Nació de **explorar en vivo la instancia Odoo 18 QA** del cliente (solo lectura). El objetivo
era la capa visual: el backend tributario ya existía, pero la UI no era operativa.

- **Formulario 104 (IVA) renderizado por casillas oficiales** (411/415/419/421/425/429 ventas ·
  500/507/520 adquisiciones · 601/602/609/902 liquidación), agrupadas en secciones, con
  subtotales en negrita, ceros atenuados y el resultado destacado (a pagar / crédito).
  Resta las notas de crédito emitidas y considera las retenciones de IVA recibidas (casilla 609).
- **Formulario 103** con las retenciones agrupadas por código.
- **`PeriodPicker`**: popover estilo Odoo (flechas de mes + grid de 12 meses + navegación de año)
  que reemplazó al `<input type="month">`.
- **Banner de pendientes accionable**: avisa de documentos SRI por revisar y facturas en borrador
  que aún no suman a la declaración, con enlaces directos.
- **Tablero contable accionable** en el Resumen: tarjetas clicables (SRI por revisar, CxC/CxP
  vencidas, asientos del mes) + chip con el estado del período fiscal.

Sin migración. Limitación: las facturas de venta guardan el total con IVA incluido, así que el
neto se calcula por división (aproximado).

---

## Sprint 12 — Calidad en Producción (ISO 9001 · ISO 22000/HACCP · ARCSA)

El módulo de producción tenía BOM y órdenes, pero cuatro huecos graves: sin lote ni
vencimiento (imposible cumplir ARCSA), sin control de calidad, costeo con `avgCost` estimado
en vez del real, y **sin asiento contable** (violaba la regla 2 del proyecto).

- **Lote y vencimiento**: al completar la orden se crea el `InventoryBatch` con número de lote
  (`LOTE-AAAAMMDD-####`) y fecha de vencimiento (elaboración + vida útil del producto).
- **Costeo real**: consume capas FIFO reales y cuesta el lote con el costo de los consumos;
  recalcula el promedio ponderado del terminado.
- **Asiento de transformación**: DR 1010305 producto terminado / CR 1010301 materia prima.
  Nuevos mapeos `INVENTORY_RAW`, `INVENTORY_WIP`, `INVENTORY_FINISHED`.
- **Trazabilidad**: `ProductionConsumption` registra qué lote de materia prima entró (hacia
  atrás) y `InventoryMovement.batchId` a dónde salió el lote (hacia adelante / recall).
- **Control de calidad**: `QualityParameter` (especificación numérica/booleana/texto, con método
  de ensayo, norma y marca de Punto Crítico de Control), `QualityInspection` evaluada por un
  **motor puro** — el usuario no aprueba a mano y una medición ausente siempre reprueba.
- **Liberación firmada** (ISO 9001 §8.6): el lote nace en cuarentena y solo se libera con
  inspección aprobada, quedando registrado quién autorizó.
- **Bloqueo de despacho** de lote no liberado (`assertReleasedStock` en `dispatchOrder`).
- **CAPA** (ISO 9001 §8.7 y §10.2): disposición del producto → causa raíz → acción correctiva →
  **verificación de eficacia** para cerrar. No se saltan etapas ni se reabren cerradas.
- **Certificado de Análisis** imprimible y ficha de trazabilidad en la UI.

Migración: `quality_production_iso_arcsa`. Detalle completo:
`Arquitectura KallpaPro/calidad-produccion-iso-arcsa.md`.

---

## Migraciones aplicadas (orden cronológico)

```
0_init
20260623150000_credit_notes
20260703120000_fiscal_periods
20260704180000_sri_doc_sustento
20260704190000_inventory_adjustment_journal_link
20260704200000_requisition_needed_by
20260705100000_unique_numbers_per_company_v2
20260705110000_shipment_item_unit_cost
20260706042258_payroll_module
20260709234457_treasury_attendance
20260710002203_bank_reconciliation
20260717041708_chatter_document_messages
20260723013315_quality_production_iso_arcsa
```

## Bugs de fondo corregidos en este tramo

| Bug | Sprint | Corrección |
|---|---|---|
| Mapeo contable de anticipos a proveedores erróneo (1010308) | 7 | → `1010403` |
| Costeo FIFO/LIFO no consumía capas reales (doc 23) | — | Consumo real de capas + `ShipmentItem.unitCost` para COGS exacto; las capas viajan en transferencias |
| Numeración de documentos colisionaba entre empresas | — | `@@unique([companyId, numero])` + `getNextDocumentNumber` atómico |
| Producción sin asiento contable ni costo real | 12 | Asiento de transformación + costeo por capas |
| `updateProduct` no convertía la fecha del registro sanitario (error 500 de Prisma) | 12 | Coerción de `sanitaryRegistryExpiry` y `shelfLifeDays` |
