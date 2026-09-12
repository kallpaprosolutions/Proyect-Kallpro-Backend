# Producción y Calidad — ISO 9001 · ISO 22000/HACCP · ARCSA

> 📍 Módulo **3.b** del ciclo operativo · [[flujo-trabajo-erp|← Router de módulos]] · [[plan-mejoras-odoo18|Plan de mejoras]]
> Documento de módulo. Fecha: 2026-07-23 (Sprint 12). Estado: ejecutado y validado e2e.

## 1. Por qué este sprint

El módulo de producción tenía BOM y órdenes, pero **cuatro huecos graves** para una
empresa regulada en Ecuador:

| Hueco | Consecuencia real |
|---|---|
| El producto terminado no generaba lote ni fecha de vencimiento | Imposible rotular según ARCSA; imposible un retiro de mercado |
| No existía control de calidad | Se podía vender producto sin verificar (incumple ISO 9001 §8.6) |
| El costo del terminado usaba `avgCost` estimado, no el costo real consumido | Márgenes y valorización de inventario incorrectos |
| **La producción no generaba asiento contable** | Violaba la regla 2 del proyecto: materia prima y producto terminado nunca se reclasificaban |

## 2. Normas implementadas y dónde viven

| Norma | Requisito | Implementación |
|---|---|---|
| ISO 9001 §8.5.2 | Identificación y trazabilidad | `ProductionOrder.lotNumber` + `ProductionConsumption` (qué lote de materia prima entró) + `InventoryMovement.batchId` (a dónde salió) |
| ISO 9001 §8.6 | Liberación de productos: no entregar hasta verificar, con registro de quién autoriza | Lote nace en `QUARANTINE`; `releaseLot` exige inspección `PASSED` y firma (`releasedBy`, `releasedAt`) |
| ISO 9001 §8.7 | Control de salidas no conformes | `NonConformity.disposition` (reproceso/desecho/concesión/devolución), obligatoria para avanzar |
| ISO 9001 §10.2 | No conformidad y acción correctiva (CAPA) | `checkTransition` obliga: causa raíz → acción correctiva → **verificación de eficacia** antes de cerrar |
| ISO 9001 §9.1 | Seguimiento y medición | `getQualityKPIs`: NC abiertas/críticas/vencidas, lotes en cuarentena/rechazados, tasa de aprobación |
| ISO 9001 §7.1.5 | Recursos de seguimiento y medición | `QualityParameter.method` (método de ensayo declarado por parámetro) |
| ISO 22000 / HACCP | Puntos Críticos de Control | `QualityParameter.isCritical` = PCC; sus fallos se reportan aparte (`criticalFailures`) |
| ARCSA (Ecuador) | Registro Sanitario / NSO vigente | `Product.sanitaryRegistry` + `sanitaryRegistryExpiry`; `checkSanitaryRegistry` avisa vencido/por vencer |
| ARCSA · rotulado | Lote y fecha de vencimiento obligatorios | `lotNumber` + `expiryDate = elaboración + Product.shelfLifeDays` |
| ARCSA · BPM Res. 067-2015 | Registro de producción por lote y retiro de mercado | Ficha de trazabilidad hacia atrás/adelante + Certificado de Análisis imprimible |

## 3. Flujo operativo (lo que hace el usuario)

```
1. Configurar (una vez)
   Producción → Calidad → Especificaciones: qué se mide por producto
     · numérico con rango (pH 3–4), verificación sí/no, o texto
     · marcar PCC si su fallo reprueba el lote
     · método de ensayo y norma de referencia
   Inventario → Producto: registro sanitario ARCSA, vida útil (días),
     "exige control de calidad"

2. Producir
   Orden PLANNED → Iniciar → Completar
     · consume materia prima por capas FIFO reales
     · registra QUÉ lote de materia prima entró (trazabilidad hacia atrás)
     · crea el LOTE del terminado con nº y fecha de vencimiento
     · si el producto exige QC → el lote nace en CUARENTENA
     · costea con el costo REAL de los consumos
     · genera el asiento: DR 1010305 Prod. terminado / CR 1010301 Materia prima

3. Controlar
   Panel de calidad del lote → "Registrar inspección"
     · el sistema evalúa cada medición contra su especificación
     · el resultado (APROBADA/REPROBADA) NO lo elige el usuario
     · si falla, se registra una no conformidad y se trata con el ciclo CAPA

4. Liberar
   Solo con inspección final APROBADA → "Liberar lote"
     · queda firmado quién autorizó y cuándo
     · el InventoryBatch pasa a RELEASED

5. Vender
   El despacho valida `assertReleasedStock`: un lote en cuarentena o rechazado
   NO se puede despachar (mensaje explícito con las cantidades retenidas)

6. Auditar / retirar del mercado
   "Trazabilidad": materias primas y sus lotes de proveedor ⟵ lote ⟶ salidas
   "Certificado de análisis": PDF imprimible con especificación vs resultado
```

## 4. Reglas duras (no se pueden saltar desde la UI ni desde la API)

1. **Sin inspección aprobada no hay liberación** si el producto exige control de calidad.
2. **Una medición ausente reprueba**: "no verificado" ≠ "conforme" (ISO 9001 §8.6).
3. **El resultado de la inspección lo decide el motor**, no el usuario.
4. **No se despacha lote no liberado** (`LOT_NOT_RELEASED`).
5. **No se cierra una no conformidad sin verificación de eficacia** (ISO 9001 §10.2).
6. **No se salta etapas del CAPA** ni se reabre una NC cerrada.
7. **Si el período contable está cerrado, la producción no se completa** (falla antes de mover stock).

## 5. Modelo de datos añadido

- `Product`: `sanitaryRegistry`, `sanitaryRegistryExpiry`, `shelfLifeDays`, `requiresQualityControl`
- `ProductionOrder`: `lotNumber`, `manufacturingDate`, `expiryDate`, `qualityStatus`, `releasedBy/At`, `releaseNotes`, `batchId`, `actualCost`, `journalEntryId`
- `InventoryBatch`: `qualityStatus`, `productionOrderId`
- `ProductionConsumption` (nuevo): trazabilidad hacia atrás lote a lote
- `QualityParameter` (nuevo): especificación, PCC, método, norma
- `QualityInspection` + `QualityInspectionResult` (nuevos)
- `NonConformity` (nuevo): CAPA completo
- Mapeos contables: `INVENTORY_RAW` (1010301), `INVENTORY_WIP` (1010302), `INVENTORY_FINISHED` (1010305)

Migración: `20260723013315_quality_production_iso_arcsa` — APLICADA.

## 6. Brechas conocidas / backlog

- **Trazabilidad hacia adelante por cliente**: hoy se listan los movimientos de salida
  con su referencia (nº de envío/factura). Falta resolver el cliente en un clic.
- **Reproceso**: la disposición `REWORK` se registra pero no genera automáticamente
  una orden de producción de reproceso.
- **Calibración de equipos** (ISO 9001 §7.1.5): se declara el método por parámetro,
  pero no hay maestro de equipos con fechas de calibración.
- **Inspección de recepción** (`type: RECEPTION`): el modelo la soporta; falta el
  disparador en la recepción de OC.
- **Firma electrónica** del liberador (hoy es el usuario autenticado + timestamp).
- **Auditorías internas** y **control de documentos** (ISO 9001 §7.5) no cubiertos.
- Producto en proceso (`INVENTORY_WIP` 1010302) está mapeado pero aún no se usa:
  la producción es de un solo paso (no hay etapas intermedias).
