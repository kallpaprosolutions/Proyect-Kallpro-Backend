# Propuestas de Mejora e Integración por Módulo — ERP KallpaPro / LOGIFI™

**Fecha:** 2026-09-11
**Alcance:** Inventario, Compras, Nómina, Ventas, Financiero, CRM y Logística
**Base de análisis:** Diagnóstico previo (`Bitácora KallpaPro`, corte 2026-09-02) **verificado contra el código real** de `Proyect-Kallpro-Backend` en esta sesión (carpeta conectada por Kuro). Las propuestas que el código ya resuelve se retiraron de la lista de pendientes y se documentan como "ya implementado" para que la bitácora no quede desactualizada; solo quedan como propuestas los vacíos confirmados en el código o los puntos que no se pudieron verificar del todo.

---

## 1. Resumen ejecutivo

El proyecto avanzó de forma importante desde el corte del 2026-09-02: los dos hallazgos de mayor riesgo de la bitácora anterior ya están resueltos en código.

1. **Facturación electrónica SRI: ya implementada.** Existen el motor de firma XML (`xml-signer.engine.ts`), clave de acceso (`clave-acceso.engine.ts`), cliente SOAP de recepción/autorización (`sri-soap.engine.ts`, `sri-soap-client.ts`), inspección y uso del certificado `.p12` (`p12-inspector.engine.ts`, `cert-crypto.engine.ts`), configuración de ambiente/establecimientos/puntos de emisión, y los endpoints `/invoices/:id/sri/emit` y `/sri/check-authorization`. El bloqueante legal para vender a un cliente real en Ecuador ya no existe a nivel de código (queda pendiente la validación en el ambiente de certificación/producción del SRI con un caso real, que es un paso de homologación, no de desarrollo).
2. **Brecha de autorización en Contabilidad: cerrada.** Se revisó `financial.routes.ts` completo: todos los endpoints de CxP, CxC y `journal-entries/reclassify` ya pasan por `authorize()` con el gate correspondiente (`pay/Payment`, `post/Journal`, `configure/Accounting`, etc.). No se encontró ningún endpoint mutador sin autorización por rol en este módulo.
3. **Cobranza: ya no es 100% manual, pero tampoco es automática.** Se construyó un radar de cobranza real (`collection.service.ts`) con historial de gestiones (llamada/email/WhatsApp/reunión), promesas de pago y "próxima acción", que prioriza a quién contactar. Sigue siendo un **panel de trabajo para que un humano registre y ejecute** la gestión — no dispara recordatorios por sí solo. Este es el único de los tres cortes originales que sigue parcialmente abierto, y de forma más acotada que antes.

Además, se confirmaron implementados varios puntos que en el análisis anterior figuraban como propuestas: valorización de inventario configurable (AVG/FIFO/LIFO/Standard Cost) con costeo automático, trazabilidad de lotes con fecha de vencimiento y alertas de próximos a vencer, multi-bodega con reabastecimiento automático (traslado interno o sugerencia de compra), matriz de aprobación de compras por monto (5 niveles), historial/score de desempeño de proveedores, asiento contable automático de nómina, escalones de precio por volumen en Ventas, y un portal de autoservicio para proveedores (RFQ y cotizaciones).

Lo que queda abierto es más acotado y más específico que en el diagnóstico anterior — se detalla módulo por módulo abajo.

---

## 2. Mapa de integración — estado verificado

```
CRM (lead → oportunidad)
   → Ventas: al día de hoy, cerrar un deal como "WON" en el CRM SOLO cambia
     el estado del deal (services/crm/tools/close_deal.ts → updateDealStage).
     NO genera automáticamente una cotización/orden de venta. ← BRECHA REAL

Ventas → Inventario/Logística/Financiero:
   - Facturación por envío al marcar un shipment DELIVERED: implementado
     (logistics.service.ts invoca invoiceSalesOrder de forma idempotente).
   - Emisión SRI de esa factura: implementada (ver arriba).

Compras → Inventario → Financiero:
   - Aprobación multinivel por monto: implementada (approval-matrix.service.ts).
   - Costeo e impacto contable al recibir: implementado (inventory.service.ts,
     motor de costeo AVG/FIFO/LIFO/STANDARD_COST).

Nómina → Financiero:
   - Asiento contable automático al cerrar periodo: implementado
     (payroll.service.ts genera journalEntryId).

Logística:
   - Tracking tipo courier (Servientrega/Tramaco/DHL) manual, con modelo de
     datos "listo para webhooks de carriers" según el propio código, pero
     los webhooks NO están implementados todavía. ← BRECHA REAL
```

---

## 3. Inventario

**Ya implementado (retirado de la lista de pendientes):**
- Costeo configurable por producto: AVG, FIFO, LIFO y Standard Cost, con motor de capas de costo (`InventoryBatch`) y actualización automática de `avgCost` en cada movimiento.
- Trazabilidad por lote con `lotNumber`, `supplierBatch` y `expiryDate`, incluyendo un reporte de lotes próximos a vencer (`getBatchesNearExpiry`).
- Multi-bodega con jerarquía padre/hija (`getWarehouseTree`) y reabastecimiento automático entre bodegas: el motor `replenishment.engine.ts` decide, por producto y bodega bajo su mínimo, si conviene un traslado interno (si otra bodega tiene excedente suficiente) o sugerir una compra, con nivel de urgencia (CRITICAL/HIGH/MEDIUM) calculado sobre días de cobertura.
- Pronóstico de demanda (`demand-forecast.engine.ts`) como insumo del reabastecimiento.

**Propuestas que siguen abiertas:**
- El reabastecimiento hoy es una *sugerencia calculada* (`computeReplenishmentPlan`); conviene confirmar si ya dispara la requisición de compra automáticamente en Compras o si todavía requiere que alguien tome la sugerencia y la capture a mano — si es lo segundo, cerrar ese último tramo (un botón "Generar requisición" sobre la sugerencia) evita que el trabajo de cálculo se pierda en una pantalla que nadie revisa a diario.
- El motor de reabastecimiento explícitamente no reparte un faltante entre varias bodegas donantes a la vez (documentado como decisión deliberada, igual que Odoo). Vale la pena confirmar con Kuro si ese es el comportamiento deseado a largo plazo o si en algún vertical (ej. distribución con muchas bodegas pequeñas) conviene revisitarlo.

---

## 4. Compras

**Ya implementado (retirado de la lista de pendientes):**
- Flujo de aprobación configurable por monto: matriz de 5 niveles (Jefe de Área, Jefe de Compras, Director Financiero, Gerente General, Directorio/Comité) con montos mínimos/máximos editables por empresa (`approval-matrix.service.ts`), y la requisición efectivamente escala de nivel según si excede presupuesto (`approveRequisition`).
- Historial y score de desempeño de proveedores (`supplier-scoring.service.ts`: `recordPerformance`, `calculateAndSaveScore`, `getSupplierRanking`).
- Portal de autoservicio para proveedores: RFQ y envío de cotizaciones desde un login propio del proveedor (`portal.service.ts`, `portal.controller.ts`) — esto ya resuelve buena parte de lo que en el diagnóstico anterior se proponía como "Supplier Management 360°" separado.

**Propuestas que siguen abiertas:**
- Comparador de cotizaciones de proveedores lado a lado (precio, plazo de entrega, score histórico) al momento de decidir sobre una requisición — hoy el score existe como dato, pero conviene confirmar si ya se muestra junto a las cotizaciones entrantes en la misma pantalla de decisión, o si vive en una pantalla separada de "ranking de proveedores".
- Contratos marco con proveedores (precio fijo por periodo, volumen mínimo) — no se encontró evidencia de esto en el código revisado; sigue siendo una propuesta nueva, relevante para el modelo de marketplace B2B de LOGIFI™.
- Sugerencia de IA para requisiciones recurrentes (patrón "sugerencia visible + aceptar/rechazar" que ya usa el CRM) — el reabastecimiento automático de Inventario (sección 3) ya cubre la parte determinística de esto; lo que falta es la capa de IA que aprenda de estacionalidad/historial de consumo más allá de mínimos y máximos fijos.

---

## 5. Nómina

**Ya implementado (retirado de la lista de pendientes):**
- Control de asistencia biométrico (`attendance.service.ts`).
- Aportes IESS (personal 9,45% / patronal 11,15% + IECE/SECAP) y fondos de reserva desde el 13.º mes (8,33%), parametrizados en `data/payrollEcuador.ts`.
- Asiento contable automático de nómina al cerrar el periodo (`payroll.service.ts` genera `journalEntryId` y lo asocia al periodo).

**Propuestas que siguen abiertas:**
- No se confirmó en el código revisado el cálculo de décimo tercero, décimo cuarto ni utilidades (`payroll.service.ts` tiene 29 KB y no se revisó completo) — vale la pena una verificación puntual de esos tres cálculos específicos antes de darlos por hechos o por pendientes.
- Portal de autoservicio del empleado (roles de pago, vacaciones, permisos): el único portal de autoservicio encontrado en el código es para **proveedores** (RFQ/cotizaciones), no para empleados. Esta propuesta sigue vigente sin cambios.
- Prorrateo de costo laboral hacia centros de costo/proyecto (útil si algún cliente PyME de LOGIFI™ factura por horas-hombre): no se encontró evidencia de esto; sigue siendo una propuesta nueva.

---

## 6. Ventas

**Ya implementado (retirado de la lista de pendientes):**
- Escalones de precio por volumen (`price-list.service.ts`: "soporta escalones por volumen (minQuantity) y un fallback al precio base del producto").
- Motor de aprobación de descuentos (`discount-approval.engine.ts`).
- Facturación automática por envío al marcar un shipment como entregado, de forma idempotente (`logistics.service.ts` → `invoiceSalesOrder`), incluyendo el recálculo de estado de la orden.

**Propuestas que siguen abiertas:**
- **CRM → Ventas sigue sin conectar de forma automática.** Se confirmó en `services/crm/tools/close_deal.ts` que cerrar un deal como `WON` solo llama a `updateDealStage` — no crea ninguna cotización ni orden de venta. Esta es la integración cruzada de mayor impacto pendiente entre los dos módulos más maduros del sistema: cuando el agente "Andrés/Closer" (o un humano) marca un deal como ganado, debería poder generar el borrador de cotización en Ventas con los productos/montos ya conversados en el CRM, en vez de exigir que alguien vuelva a capturarlos de cero.
- Segmentación de precio por vertical/rubro (mining, construcción, agro-industria, retail — las verticales que menciona la visión de LOGIFI™): el sistema de precios ya soporta volumen, pero no se encontró segmentación explícita por tipo de cliente/vertical más allá de eso. Podría resolverse extendiendo el mismo motor de price-list en vez de construir uno nuevo.
- Panel de comisiones de vendedores calculado sobre ventas cobradas (no solo facturadas): no se encontró evidencia de esto en el código revisado; sigue siendo una propuesta nueva.

---

## 7. Financiero

**Ya implementado (retirado de la lista de pendientes):**
- **Autorización por rol en CxP/CxC/reclasificación de asientos**, verificada endpoint por endpoint en `financial.routes.ts`: todo el corte de seguridad que documentaba la bitácora anterior está cerrado con `authorize('pay','Payment')`, `authorize('post','Journal')`, `authorize('configure','Accounting')` según corresponda.
- **Facturación electrónica SRI completa**: firma XML, clave de acceso, recepción y autorización vía SOAP, gestión de certificado `.p12`, ambiente/establecimientos/puntos de emisión, y las mismas garantías de autorización que contabilizar (`post`/`Journal`).
- ATS (ver anexo transaccional simplificado) con exportación XML, formularios 103/104 por casillas, y calendario de vencimientos SRI.
- Radar de cobranza con historial de gestión y promesas de pago (`collection.service.ts`), priorizado por antigüedad de mora y monto — resuelve la parte de "saber a quién llamar hoy" que antes no existía.

**Propuestas que siguen abiertas:**
- **Automatizar el disparo de la gestión de cobranza.** El radar ya calcula quién está en riesgo y con qué prioridad, pero según el código revisado sigue siendo el usuario quien registra manualmente cada gestión (`logCollectionActivity`); no hay un job/cron que envíe automáticamente un recordatorio por WhatsApp/email cuando una factura cruza cierto umbral de mora. Conectar esto al mismo canal Unipile que ya usa el CRM sería la extensión natural, y ya existe toda la lógica de priorización necesaria para decidir a quién y cuándo escribirle.
- Panel "Mis permisos" generado desde las políticas de CASL, visible en el perfil de cada usuario — no se encontró evidencia de esto en el backend revisado (podría existir solo en frontend, que no se revisó en esta sesión); sigue siendo una propuesta razonable dado que ya existe la infraestructura de roles/CASL para generarlo sin trabajo adicional de modelado.
- Extender el patrón "sugerencia visible + aceptar/rechazar" de IA (el que usan los agentes del CRM) a la conciliación bancaria y a la clasificación de gastos — no se encontró un motor de IA equivalente en Financiero; lo que existe ahí son motores determinísticos (reglas fijas), no agentes que aprendan o sugieran con lenguaje natural.

---

## 8. Logística

**Ya implementado (retirado de la lista de pendientes):**
- Gestión de envíos con número de tracking propio, estados con transiciones válidas controladas (`NEXT_STATUSES`), y eventos de tracking con ubicación/notas.
- Facturación automática e idempotente al marcar un envío como entregado, con recálculo de estado de la orden de venta asociada.
- KPIs de logística (en tránsito, pendientes de despacho, entregados hoy, fallidos).

**Propuestas que siguen abiertas — confirmadas como reales, no supuestas:**
- El propio código documenta el estado actual como **"MVP: eventos registrados manualmente; el modelo queda listo para webhooks de carriers"** — es decir, el diseño ya previó la integración con Servientrega/Tramaco/DHL, pero esa integración todavía no está construida. Esta sigue siendo la inversión de mayor apalancamiento en el módulo: conectar los webhooks reales de los couriers eliminaría la captura manual de cada evento de tracking.
- Planificación de rutas y despachos (asignación de flota propia o de terceros, secuenciación de entregas) no existe en el código revisado — el módulo gestiona el seguimiento de un envío ya despachado, no la planificación previa del despacho.
- Costo de flete por envío para que Ventas pueda cotizar con margen real: no se encontró en el código revisado.
- SLA de proveedores de transporte tercerizados alimentando el mismo historial de desempeño que ya existe para proveedores de Compras (`supplier-scoring.service.ts`) — sería reutilizar infraestructura ya construida en vez de duplicarla, sumando el `carrier` del envío como una entidad más a evaluar con ese mismo motor.
- Alerta automática hacia el CRM cuando un envío queda `FAILED` o se retrasa (para que el agente "Lucía/Success" gestione proactivamente al cliente): no se encontró esta integración en el código revisado.

---

## 9. CRM

**Ya implementado (confirmado, sin cambios respecto al diagnóstico anterior):**
- 6 agentes de IA reales sobre Claude (router, Sofía/SDR, Iván/Researcher, Camila/Copywriter, Andrés/Closer, Lucía/Success) con herramientas propias (`services/crm/tools/*`): calificación BANT, detección de señales de compra, detección de riesgo de churn, manejo de objeciones, scoring de leads, forecasting.
- Motor de forecasting (`forecast.engine.ts`) y de scoring de leads (`lead-scoring.engine.ts`) independientes y bien desarrollados.

**Propuestas que siguen abiertas:**
- **Cerrar el círculo Deal→Venta** (ver sección 6): es la brecha más concreta y de mayor impacto encontrada en todo este análisis, porque conecta el módulo más maduro (CRM) con uno de los cinco módulos originales del alcance (Ventas), y hoy ese puente no existe en código.
- Retroalimentar el lead scoring con resultados reales de Ventas y Financiero (¿el cliente que el modelo calificó alto terminó comprando y pagando a tiempo?) — no se encontró esta retroalimentación; hoy el scoring se nutre de señales de conversación, no de resultados posteriores.
- Definir si el alcance actual de agentes es el definitivo o se construye hacia la visión completa v2 (inbox omnicanal + apps móviles) — sigue siendo una decisión de producto pendiente, no técnica.

---

## 10. Prioridades sugeridas (actualizadas tras la verificación de código)

1. **Cerrar Deal→Venta (CRM↔Ventas).** Es la única brecha de integración de alto impacto que queda entre los módulos más maduros del sistema, y no depende de terceros (SRI, carriers) — es trabajo interno.
2. **Automatizar el disparo de cobranza.** Toda la lógica de priorización ya existe (`collection.service.ts`); falta la capa de automatización que la conecte a Unipile, reutilizando la mensajería que ya usa el CRM.
3. **Webhooks de couriers en Logística.** El modelo de datos ya está preparado según el propio código; es la inversión con mejor relación esfuerzo/beneficio en ese módulo.
4. **Validar en ambiente de certificación del SRI.** La facturación electrónica está construida; falta el paso de homologación con un caso real antes de vender a un cliente en producción.
5. **Verificar cálculo de décimo tercero/cuarto y utilidades en Nómina** antes de asumir que están o no implementados — es una verificación puntual de bajo costo con alto valor legal.
6. **Panel "Mis permisos" (CASL)** — bajo costo dado que la infraestructura de roles ya existe; alto valor de soporte/onboarding para clientes nuevos.

---

## 11. Preguntas abiertas para Kuro

Las preguntas de producto de la bitácora anterior siguen sin respuesta y siguen siendo las que más condicionan cómo priorizar lo de arriba:

1. ¿El CRM-IA apunta a la visión completa v2/LOGIFI (inbox omnicanal, apps móviles) o el alcance actual ya es definitivo?
2. ¿La suscripción por módulo implica que un mismo usuario atienda varias empresas (hoy el sistema es 1:1 usuario↔empresa)?
3. Con el corte de seguridad de Contabilidad ya cerrado, ¿cambia la prioridad de sumar más usuarios/clientes?
4. Dado que Logística confirmó ser un MVP deliberado (webhooks de carriers pendientes por diseño), ¿se agenda esa integración como el siguiente hito del módulo, o se prioriza otra cosa primero?
5. ¿Se formaliza ESLint en ambos proyectos (deuda técnica ya reconocida repetidamente en la bitácora anterior)? — no se volvió a verificar en esta sesión.

---

## 12. Nota metodológica

Esta verificación se hizo leyendo el código fuente real de `Proyect-Kallpro-Backend` (rutas, servicios, motores/`engines`) recién conectado en esta sesión. No se revisó el frontend (`Proyect-Kallpro-Frontend`), por lo que cualquier funcionalidad que exista solo del lado de la interfaz (por ejemplo, un panel de permisos armado a mano en React sin lógica propia en el backend) puede no reflejarse aquí. Tampoco se leyeron completos los archivos más grandes (`inventory.service.ts` 74 KB, `journal.service.ts` 55 KB, `sales.service.ts` 38 KB, `payroll.service.ts` 29 KB) — se usaron búsquedas dirigidas sobre ellos, así que un vacío no encontrado en la búsqueda no es prueba absoluta de que no exista, aunque sí es razonablemente confiable para las funciones nombradas de forma explícita (SRI, autorización, costeo, cobranza, matriz de aprobación, scoring de proveedores).
