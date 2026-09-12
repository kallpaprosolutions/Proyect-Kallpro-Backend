# 8. Análisis financiero — CxP / CxC (decisiones gerenciales)

> 📍 Módulo **8** del ciclo operativo · [[flujo-trabajo-erp|← Router de módulos]]
> Detalle de permisos por rol: [[asistente-contable-cxp-cxc-permisos|Asistente Contable CxP/CxC — operatividad por rol]]

## Flujo de trabajo
Aging de CxC/CxP → mesa de trabajo priorizada (score de urgencia) → acción (pagar, cobrar,
ajustar, reclasificar, aplicar NC) → asiento automático → tablero de ratios/DCF/4D para
decisión gerencial.

## Ejecutado ✅
| Paso | Dónde |
|---|---|
| Ingresos & Egresos mensual (cuentas 4x/5x) con margen | Financiero → Resultados |
| Cartera CxC / Pagos CxP con aging | Financiero |
| Estado de cuenta CxP/CxC (cronología cargo/pago/NC con saldo corrido, imprimible) | `ap.service.getSupplierStatement` / `ar.service.getCustomerStatement` (2026-08-26) |
| Detección de facturas de compra duplicadas | `findPossibleDuplicates` — cierra B1 (2026-08-26) |
| Ratios, DCF, escenarios, 4D scores, ahorros | Modo Experto |
| Insights de IA (fallback sin Ollama) | `FinanzasPage` |
| Gestión de cobranza (CxC): historial de contactos + radar de cartera vencida priorizado | `CollectionActivity` + `<CollectionRadar/>` (2026-08-27) |
| Acciones sugeridas (bandeja de trabajo): tarjetas 🔴 vencidos / 🟡 vencen esta semana | `ActionSuggestions` en `AgingViews.tsx` (2026-08-27) |
| Priorización y programación de pagos (CxP): score 0-100, "Programar pago", "Procesar todo" | `payment-priority.engine.ts` (motor puro) + `PaymentSchedule` (2026-08-27) |
| Mesa de trabajo CxP (rediseño): cola priorizada + panel de detalle con acciones inline | `CxPWorkbench.tsx` (2026-08-27) |
| Pagos parciales, ajuste de saldo (write-off), aplicación manual de NC/ND, reclasificación de cuenta | ver [[asistente-contable-cxp-cxc-permisos]] |
| Mesa de trabajo CxC (mismo rediseño que CxP): dunning, write-off simétrico, reclasificación reutilizada, cobranza integrada | `CxCWorkbench.tsx` (2026-08-27 / 2026-09-02) |
| **Fase 4**: aprobaciones de pago por monto (3 niveles AUTO/RESPONSABLE/GERENCIAL configurables en Ajustes), forzadas server-side en pagar/ajustar CxP y CxC (no solo UI) | `payment-approval.service.ts` (motor puro) + hook en `ap.service.payPayable/writeOffPayable` y `ar.service.collectReceivable/writeOffReceivable` (2026-09-05) |
| **Fase 5**: conciliación bancaria visible en la mesa de trabajo CxP/CxC (estado REGISTRADO/CONCILIADO/ANULADO + banco/fecha/monto por `BankTransaction.sourceType/sourceId`) | `reconciliation.service.getReconciliationBySource` + sección "Conciliación bancaria" en `CxPWorkbench.tsx`/`CxCWorkbench.tsx` (2026-09-05) |
| **RBAC server-side de las 10 rutas mutantes de CxP/CxC** (pagar, ajustar, programar/procesar/cancelar programados, aplicar/desenlazar NC, reclasificar) — antes solo ocultas en el frontend, ahora bloqueadas también en el backend con `authorize('pay','Payment')`; de paso se corrigió que GERENTE (diseñado en Fase 4 como aprobador RESPONSABLE/GERENCIAL) nunca podía ver el botón "Pagar" — nuevo permiso `approveGerencial` | `financial.routes.ts` + `roles.ts` (reglas CASL nuevas en GERENTE/ASISTENTE_CONTABLE) + `permissions.ts` (2026-09-05) — ver [[asistente-contable-cxp-cxc-permisos]] §6 |
| **RBAC server-side del resto de `financial.routes.ts`**: facturas de venta (`create`/`update`,`Finance`), NC de venta, DCF/escenarios (guardar → `create`,`Finance`; calcular/simular → `read`,`Finance`), parse-statement, savings, cobranza CxC (mismo gate `pay:Payment` que el resto de la mesa de trabajo) — cierra la brecha completa documentada en [[arquitectura-tecnica]] §5 | `financial.routes.ts` (2026-09-05), sin cambios de rol nuevos (reutiliza reglas CASL existentes) |
| **Cobranza automática (dunning)**: escalones configurables por días de mora (`ErpConfig.finance.dunning.steps`, default 3/15/30 días → EMAIL/WHATSAPP/CALL) corren a diario (07:30) o a demanda ("⚡ Ejecutar recordatorios ahora" en el radar). Cada recordatorio se registra como `CollectionActivity` automática (`automated:true`, `dunningStep`) en el MISMO historial que la gestión manual — nunca un canal paralelo. EMAIL se envía solo si hay SendGrid configurado (`lib/mailer.ts`); si no, o si es WHATSAPP/CALL, queda como tarea pendiente con `nextActionAt: hoy`. Una factura que entra tarde con mucha mora dispara solo el escalón MÁS ALTO aplicable (no los tres de golpe); una promesa de pago vigente pausa los recordatorios | `dunning.engine.ts` + `dunning.service.ts` + `dunning.job.ts` (2026-09-11) |

## Mejoras propuestas
- ❌ Comparativo presupuesto-vs-real dentro de Resultados.
- ❌ KPIs por departamento; consolidación multiempresa; descuentos por pronto pago.
- ❌ Límite de crédito para proveedores (asimetría: `Customer` sí lo tiene, `Supplier` no).
- ❌ Clasificación contable con score de confianza; motor de reglas configurable.
- ❌ `SriDocument.paymentStatus`/`paidAt` no reflejan un cierre mixto pago+NC (queda PARTIAL aunque el saldo neto ya sea $0; el aging/worklist sí es correcto porque recalcula el neteo).

## Ver también
- [[06-contabilidad|Módulo 6 · Contabilidad]] (asientos de origen)
- [[05-07-tesoreria-nomina-biometrico|Módulos 5/7 · Tesorería]] (pagos/cobros de caja)
- [[asistente-contable-cxp-cxc-permisos|Matriz de operatividad por rol]]
