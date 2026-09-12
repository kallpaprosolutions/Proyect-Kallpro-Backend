# Flujo de Trabajo Completo del ERP KallpaPro — Router de módulos

> **Documento VIVO — es un ÍNDICE, no el detalle.** El detalle de cada módulo (ejecutado,
> flujo, mejoras propuestas) vive en su propio archivo dentro de `Modulos/`. Abre solo el
> módulo que vas a tocar — no hace falta leer todo esto para tener contexto.
> Última actualización: 2026-09-10 · Ver [[00 - Inicio|panel de inicio]] para prioridades del momento.
> Base de datos: [[base-de-datos|mapa de los 113 modelos Prisma por módulo]].

---

## El ciclo operativo completo (dinero → mercadería → dinero)

```
 (1) PLANIFICACIÓN            (2) COMPRAS                    (3) INVENTARIO
 Presupuesto por depto  →  Requisición → Cotizaciones →  Recepción → Kardex/Capas
 Punto de reorden          Comparativo → Aprobación L1-L5   FIFO/LIFO/AVG → Multibodega
        │                  → OC → Anticipo → Pago saldo            │
        │                       (asientos automáticos)             │
        ▼                                                          ▼
 (8) ANÁLISIS FINANCIERO   (7) TESORERÍA                (4) VENTAS
 Ingresos & Egresos     ←  Bancos + SWIFT            ←  Cotización → Pedido →
 Ratios · DCF · 4D         Flujo de pagos/cobros        Reserva stock → Despacho →
 Presupuesto vs real       Conciliación bancaria        Factura (dueDate) → COGS
        ▲                  Pago impuestos/nómina/CxP           │
        │                       │                              │
 (6) CONTABILIDAD          (5) NÓMINA + BIOMÉTRICO             │
 Diario · Mayor · Balanza  Empleados → Asistencia →            │
 Cierres · NIIF · SRI   ←  Rol de pagos (IESS, décimos,  ←─────┘
 CxP (facturas compra)     fondos, IR) → Devengo → Pago     (todo genera asientos)
```
`(3.b) Producción y Calidad` se inserta entre Inventario y Ventas (transforma materia
prima en producto terminado con lote/calidad). `(9) UX transversal` y `(10) CRM` son
transversales al ciclo: UX aplica a todos los documentos; CRM alimenta Ventas con leads.

## Índice de módulos

| # | Módulo | Estado global | Archivo |
|---|---|---|---|
| 1 | Planificación y presupuesto | ✅ | [[01-planificacion-presupuesto]] |
| 2 | Compras (requisición → pago) | ✅ sin brechas activas | [[02-compras]] |
| 3 | Inventario | ✅ · 1 brecha (cuenta contable por producto) | [[03-inventario]] |
| 3.b | Producción y Calidad (ISO 9001 · ISO 22000/HACCP · ARCSA) | ✅ · 5 brechas menores | [[03b-produccion-calidad]] |
| 4 | Ventas | ✅ · 2 brechas (facturación electrónica, detalle de cotización) | [[04-ventas]] |
| 5 / 7 | Nómina + Biométrico / Tesorería | ✅ · varias brechas normativas (ver §5 del archivo) | [[05-07-tesoreria-nomina-biometrico]] |
| 6 | Contabilidad (NIIF · control interno) | ✅ · 3 brechas (Form 101, diferidos, reverso NC compra) | [[06-contabilidad]] |
| 8 | Análisis financiero — CxP/CxC | ✅ · roadmap de 88 secciones CERRADO (Fases 1-5) · brechas menores | [[08-analisis-financiero-cxp-cxc]] |
| 9 | UX transversal | ✅ **Fase A completa** (A1-A5, A2.2) · 1 brecha (acentos) | [[09-ux-transversal]] |
| 10 | CRM — captura, scoring, pronóstico | ✅ · brechas menores | [[10-crm]] |

**Plan de mejoras Odoo 18**: Fases A, B y C **completas** (2026-09-11) — ver
[[plan-mejoras-odoo18|plan de mejoras]], queda solo la Fase D (multiempresa/dashboards),
sin fecha de inicio decidida.

**Documentos de referencia cruzados** (no son un módulo del ciclo, complementan uno):
- [[plan-mejoras-odoo18|Plan de mejoras Odoo 18]] — backlog priorizado Fase A→D con registro de avance por fecha.
- [[asistente-contable-cxp-cxc-permisos|Asistente Contable CxP/CxC — permisos por rol]] — complementa el módulo 8.
- [[base-de-datos|Base de Datos — modelos y relaciones]] — los 113 modelos Prisma agrupados por módulo.
- [[arquitectura-tecnica|Arquitectura técnica]] — capas de código, RBAC, convenciones.
- [[plan-contabilidad-tributaria-sri|Plan — Facturación electrónica SRI + NIIF/Supercías]] —
  plan activo de 8 etapas (decisiones YA confirmadas con el usuario), Etapa 1 sin empezar
  todavía. Complementa los módulos 4 (Ventas) y 6 (Contabilidad).

## Reglas transversales que TODO nuevo desarrollo debe respetar
1. **Multi-tenant**: toda tabla lleva `companyId`; numeraciones por empresa (`getNextDocumentNumber`).
2. **Contabilidad como columna vertebral**: cualquier hecho económico genera asiento vía `journal.service` (numeración AST atómica + `assertPeriodOpen`). Nunca escribir en `journal_entries` directo.
3. **Cuentas por posting setup** (`AccountMapping`), nunca códigos quemados en lógica de negocio.
4. **Trazabilidad**: entidad origen ↔ asiento ↔ movimiento bancario enlazados por ids (`entityType/entityId`, `sourceType/sourceId`, `journalEntryId`).
5. **Estados que bloquean**: documentos contabilizados/pagados no se editan; se reversan.
6. **Motores de cálculo puros** (sin BD) con tests unitarios (payroll, treasury, attendance, reconciliation, FIFO/LIFO).
7. **UI en español**, sin enums crudos; breadcrumbs en `routeLabels.ts`; labels centralizados.

## Cómo usar este documento
- **Vas a trabajar en un módulo específico** → abre directamente su archivo en `Modulos/`.
  Ahí encuentras: qué está ejecutado, el flujo de ese módulo, y las mejoras propuestas —
  no necesitas leer los otros 9 módulos.
- **Vas a decidir qué hacer a continuación** → mira la columna "Estado global" de arriba,
  o abre el [[00 - Inicio|panel de inicio]] que trae las prioridades vigentes.
- **Terminaste una mejora** → actualiza la fila (❌→✅) y las brechas en el archivo del
  módulo correspondiente dentro de `Modulos/`, no aquí. Este archivo solo cambia si se
  agrega/quita un módulo completo del ciclo.
