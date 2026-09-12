# 4. Ventas

> 📍 Módulo **4** del ciclo operativo · [[flujo-trabajo-erp|← Router de módulos]]

## Flujo de trabajo
Cotización → pedido (reserva de stock) → despacho (parcial, con tracking) → factura de
venta (con `dueDate`, alimenta el flujo de cobros) → COGS exacto por capa consumida.

## Ejecutado ✅
| Paso | Dónde |
|---|---|
| Cotización → pedido → confirmación (chequeo blando de stock) | Sprint 3 |
| Listas de precios (el precio sale de la lista) | `PriceLists` |
| Venta rápida POS (pedido+reserva+despacho+factura en 1 paso) | `/ventas/rapida` |
| Despachos parciales con envíos y tracking | Logística |
| Factura de venta con `dueDate` (alimenta flujo de cobros) | Invoice SALES |
| COGS exacto por capa consumida (`ShipmentItem.unitCost`) | doc23 |
| Notas de crédito con documento sustento + reversos | Sprint 4 / doc20 |
| PDF de factura y NC | Sprint 5 |
| Retención que el cliente nos practica (crédito tributario) | `createSalesWithholdingEntry` |
| **Aprobación de descuento fuera de tope + protección de margen** (venta bajo costo) | `discount-approval.engine.ts` |
| **Venta de servicios / productos no cargados a inventario** (`Product.type='SERVICE'`): sin reserva ni consumo de stock, sin COGS, `availableStock: null` en vez de 0 falso | `confirmOrder`/`getSalesOrderById` (2026-09-10) |
| **Guía de remisión electrónica** (Etapa 4 del plan SRI): sustenta el traslado de un envío ante el SRI (transportista, placa, trayecto, cantidades — sin valores monetarios); ver [[06-contabilidad]] | `electronic-deliveryguide.service.ts` + `ShipmentDetailPage.tsx` (2026-09-11) |

## Ejecutado ✅ (2026-09-10 — Servicios/no-inventario + integración con demanda/rotación de Inventario)
El usuario pidió integrar Ventas con Contabilidad e Inventario, agregar pronóstico de demanda
de los más vendidos, tendencia de rotación en Inventario, y "facturación a clientes con
productos no cargados de inventario" — investigado (suavizado exponencial para demanda,
rotación = COGS/inventario promedio, ver [[03-inventario]]). Hallazgos:
- **Ventas↔Contabilidad e Inventario YA estaban integrados de fondo** (todo pedido despachado
  genera asiento de venta + COGS exacto por capa — doc23 — y consume stock real); lo que
  faltaba era el caso de **servicios y productos sin stock**.
- **Bug real corregido**: `confirmOrder` intentaba reservar stock para TODO ítem sin excepción,
  incluyendo productos `type='SERVICE'` — un servicio (consultoría, mano de obra, un producto
  deliberadamente no cargado a inventario) no puede venderse limpiamente porque no tiene
  `ProductStock`. Ahora un ítem SERVICIO se marca reservado sin bodega ni movimiento;
  `dispatchOrder` ya se salta bodega=null (código preexistente) así que el resto del flujo
  (despacho, factura, retenciones por tipo bienes/servicios ya existente en
  `withholding.service`) no necesitó cambios. `getSalesOrderById` devuelve
  `availableStock: null` para servicios en vez de 0 (el frontend, `DispatchModal.tsx`, YA
  esperaba `null` para "sin límite de stock" — la brecha era solo del backend).
- **Reembolsos**: ya cubiertos por Notas de Crédito (Sprint 4/doc20) — reversan ingreso, IVA,
  COGS (si la mercancía vuelve a stock) y retenciones proporcional; el reembolso en efectivo/
  transferencia real se gestiona después en la mesa de trabajo CxC (ajuste/write-off). No se
  encontró brecha que justifique un mecanismo nuevo.
- 360/360 tests backend (+31: 14 motor de demanda + 3 integración de servicios + 3 integración
  de demanda/rotación + 7 del motor de descuento de la sesión anterior, etc.) + 117/117
  frontend (sin cambios), `tsc --noEmit` limpio. Verificado con tests de integración contra BD
  real (pedido con ítem SERVICIO → confirmar → despachar → facturar, cero movimientos de
  inventario, COGS=0) — ver `tests/integration/sales-service-billing.test.ts`.

## Ejecutado ✅ (2026-09-07 — Aprobación de cotizaciones/pedidos fuera de tope)
Investigado el patrón Odoo 18 (quotation templates, firma/pago online, upsell) y las mejores
prácticas de sales order management 2026 antes de decidir qué construir; se optó por NO copiar
templates/firma online (bajo valor para el mercado PYME EC objetivo) y en cambio cerrar una
brecha real de automatización: el tope de descuento por rol (`ErpConfig.sales.maxDiscountByRole`)
era un bloqueo duro (error 400) — el vendedor no podía ni guardar la cotización si se pasaba,
sin ninguna vía de escape. Ahora:
- Motor puro `evaluateDiscountApproval` (`services/sales/engines/discount-approval.engine.ts`):
  evalúa cada línea contra el tope de descuento del rol Y contra el costo (`avgCost`) del
  producto — protección de margen automática que Odoo no trae de fábrica (ahí queda a criterio
  manual del vendedor).
- Si excede tope o vende bajo costo, la cotización/pedido se crea igual pero en estado
  `PENDING_APPROVAL` (antes: rechazado). `ErpConfig.sales.discountApproverRoles` (editable en
  Ajustes → Empresa, default ADMIN/GERENTE/GERENTE_VENTAS) define quién puede aprobar/rechazar
  (`POST /sales/quotations/:id/approve|reject`, `POST /sales/orders/:id/approve|reject`),
  reforzado server-side además del gate CASL `approve:Sales`.
- `SALES_QUOTATION` se agregó a `CHATTER_ENTITY_TYPES` (antes solo pedidos/OC/factura/
  requisición tenían Chatter) — la nota de por qué quedó pendiente y el log de aprobación/
  rechazo quedan en el hilo del documento. **Brecha conocida**: no existe una página de detalle
  de cotización en el frontend todavía, así que ese chatter no tiene dónde mostrarse en UI (solo
  vía API/BD por ahora) — candidato para una futura `QuotationDetailPage`.
- RBAC server-side agregado a `sales.routes.ts` (antes sin `authorize()` en ninguna ruta mutante,
  mismo patrón de brecha ya cerrado en compras/financiero en sesiones previas).
- 326/326 tests backend (+7: motor puro) + 117/117 frontend, `tsc --noEmit` limpio en ambos.
  Verificado e2e real en el navegador (ADMIN crea cotización con 90% de descuento sobre una
  Laptop de $950 costo $933 → PENDING_APPROVAL → Aprobar → DRAFT → convertida a PV-0003) y por
  API con un usuario `FUERZA_VENTAS` de prueba (creó cotización con descuento del 50% sobre su
  tope de 5% → intentó aprobar su propia cotización → 403 real; ADMIN aprobó con éxito). Datos y
  usuario de prueba borrados después.

## Ejecutado ✅ (2026-09-11 — Puente CRM→Ventas, flete real, webhooks de couriers)
Pedido directo del usuario (implementar las "Propuestas de Mejora e Integración por Módulo —
ERP KallpaPro / LOGIFI™"). Tres integraciones cruzadas cerradas:
- **Puente CRM → Ventas**: `CrmDeal.customerId`/`salesQuotationId` + `CrmDealItem` (productos
  conversados en la oportunidad). `updateDealStage` dispara `tryAutoConvertOnWon` (no
  bloqueante) al marcar la etapa como ganadora; botón manual "Generar cotización" disponible
  en cualquier etapa desde `DealsPage`. Emparejamiento de cliente por RUC → email del contacto
  → razón social exacta (nunca por nombre parecido, para no mezclar dos clientes reales); sin
  coincidencia, crea el `Customer` desde la empresa/contacto del CRM. Reusa
  `sales.service.createQuotation` con `reprice:false` (el precio ya se negoció en el CRM, no
  se topa como descuento de vendedor) — cero lógica de ventas duplicada.
- **Costo real de flete por envío**: `Shipment.freightCost` capturado al crear la guía —
  insumo para que Ventas conozca el margen real de la entrega, no solo el del producto.
- **Webhooks de couriers** (Servientrega/Tramaco/DHL/Urbano…): endpoint público
  `POST /api/logistics/webhooks/:companyId/:carrier` con token por empresa (rotable desde
  Ajustes → Empresa), normaliza el payload por alias de campo en vez de un adaptador rígido
  por courier, y llama la MISMA `addShipmentEvent` que la captura manual — misma máquina de
  estados, misma facturación al entregar. Un envío `FAILED` (manual o por webhook) crea una
  `Activity` tipo REVISAR para quien creó el pedido, vencimiento hoy, visible en "Mis
  actividades" del Inicio.

Backend: `deal-conversion.engine.ts` + `deal-conversion.service.ts`,
`carrier-webhook.engine.ts` + `logistics-webhook.service.ts`. 529/529 back (+33: 27 motores +
6 integración con BD real) + 117/117 front, tsc limpio. Verificado e2e real en navegador:
oportunidad real de la empresa demo → productos agregados → "Generar cotización" → COT-0003
creada con el cliente real emparejado por RUC (`Constructora Andes`, sin duplicar) — datos de
prueba revertidos después. Webhook probado con `curl` contra el token real generado desde
Ajustes (autenticación validada; rechazo esperado por guía inexistente). Ver
[[10-crm|Módulo 10 · CRM]] para el detalle del lado CRM.

## Mejoras propuestas
- ❌ **Página de detalle de cotización** en el frontend (hoy solo hay lista + modal de creación);
  sería el lugar natural para mostrar el Chatter/Actividades que ya soporta el backend.
- ❌ Planificación de rutas/despachos (asignación de flota, secuenciación) — el módulo de
  logística sigue tracking de un envío ya despachado, no planifica el despacho.
- ❌ SLA de proveedores de transporte tercerizados alimentando `supplier-scoring.service.ts`
  (reusar el motor existente, sumando el `carrier` como entidad evaluable).

## Ver también
- [[03-inventario|Módulo 3 · Inventario]] (reserva y despacho)
- [[08-analisis-financiero-cxp-cxc|Módulo 8 · Análisis financiero]] (cartera CxC de la factura)
