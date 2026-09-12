# 4. Módulo Ventas (Order-to-Cash) — comparación con mejores prácticas de mercado

> 📍 Ubicación: `Proyect-Kallpro-Backend/src/modules/sales` (servicios de cotización, pedido, despacho, facturación) + `Proyect-Kallpro-Frontend/src/features/ventas`. Integra con Inventario (reserva/consumo de stock), Financiero (asiento contable vía `journal.service`) y Tesorería (cobros vía `dueDate` de la factura).

## 1. Investigación: qué hacen los mejores ERP de ventas B2B en 2026

| Práctica | Odoo 18 | SAP Business One | NetSuite | Shopify B2B |
|---|---|---|---|---|
| Listas de precios / pricing por segmento | Pricelists con reglas por fórmula, categoría de producto y cliente/lista; motor de descuentos combinable | Esquemas de precio y descuento por Business Partner, listas especiales | Tiered/volume pricing por price level + reglas de segmentación de cliente | Catálogos y listas de precios específicas por "company" B2B, con precios netos por comprador |
| Aprobación de descuentos fuera de política | Reglas de aprobación en cotización (workflow) antes de confirmar | Flujo de aprobación configurable en documentos de venta (Approval Procedure) | Reglas de aprobación en NetSuite SuitFlow / Deal Desk para descuentos > umbral | Reglas de checkout B2B con límites de descuento por catálogo |
| Crédito del cliente (límite y bloqueo) | Límite de crédito por partner con bloqueo automático de la SO al superarlo | Límite de crédito con bloqueo de documento de venta y alerta en Business Partner Master Data | Credit limit + credit hold automático que congela pedidos hasta liberación por AR | Net terms gestionados por proveedores de crédito B2B (Shopify Balance / terceros) con límite dinámico |
| Portal de autoservicio B2B | Portal de cliente (Odoo Portal) para ver cotización, pedido, factura, pagar en línea | SAP B2B Self-Service Portal / Corevist: pedidos, historial, facturas, reordenar 24/7 | Customer Center portal: estado de pedido, facturas, pagos, tracking | Portal B2B nativo con catálogo, precios netos, reorden rápido y estado de cuenta |
| Vista operativa de pipeline de ventas | Kanban de cotizaciones por etapa + calendario de entregas | Vista de documentos de venta con dashboards Crystal Reports/SAP Analytics | Kanban/lista de órdenes por estado + dashboards SuiteAnalytics | Dashboard de pedidos B2B con estado de cumplimiento |
| Facturación electrónica integrada | Módulo de e-invoicing por país (incl. Latam vía localizaciones) | Localización fiscal electrónica por país | Localización electrónica (SuiteTax) por país | Delegado a proveedores de facturación electrónica locales |

### Prácticas confirmadas por la investigación

**Pricing y catálogo**
- Los líderes separan "precio de lista" de "precio neto de la transacción": la lista de precios se asigna por segmento de cliente (mayorista, distribuidor, minorista) y el vendedor no debe poder digitar un precio libre salvo excepción controlada.
- El pricing por volumen (tiered pricing) y por catálogo específico de cuenta es estándar en portales B2B modernos (Shopline, Virto Commerce).

**Control de crédito**
- El "credit hold" automático es la norma: al superar el límite de crédito o tener facturas vencidas más allá de X días, el sistema bloquea nuevos pedidos hasta liberación manual de Finanzas/Crédito, evitando que Ventas siga despachando a un cliente en mora.
- NetSuite y SAP B1 muestran el saldo de crédito disponible directamente en la pantalla de creación del pedido, no solo como reporte separado.

**Aprobaciones y deal desk**
- Los descuentos que exceden la política estándar requieren aprobación de un rol superior (supervisor/gerente) antes de confirmar el pedido — patrón "deal desk" que ya existe en herramientas de Quote-to-Cash dedicadas (CPQ) y se está replicando dentro de los ERP.

**Portal de autoservicio B2B**
- Es ya un diferenciador competitivo, no un "nice to have": SAP posiciona explícitamente el portal B2B como "revenue engine" — permite que el cliente vea/pague facturas, reordene y consulte el estado de su pedido sin llamar a un vendedor, liberando carga operativa.
- Los portales maduros incluyen: catálogo con precio neto ya aplicado, historial de pedidos con reorden en un clic, descarga de facturas/notas de crédito en PDF, y estado de cuenta (saldo, vencidos).

**UX operativa (vistas)**
- Kanban de cotizaciones/pedidos por etapa (borrador → enviado → confirmado → despachado → facturado) es el patrón dominante para que un supervisor de ventas vea de un vistazo dónde está cada pedido.
- Alertas visuales de stock insuficiente y de cliente sobre el límite de crédito se muestran en el momento de crear el pedido, no después.

**Cumplimiento fiscal (Ecuador)**
- La facturación electrónica es **obligatoria** en Ecuador desde hace varios años para la generalidad de contribuyentes, y el SRI ha anunciado/ejecutado en 2026 el paso a **transmisión inmediata** de comprobantes electrónicos (validación en tiempo real, no por lotes), endureciendo aún más el requisito de tener un XML firmado y autorizado antes de entregar la factura al cliente.
- Emitir una "factura" que solo genera PDF interno sin clave de acceso ni autorización del SRI no es válido fiscalmente en Ecuador — es un bloqueante legal para operar con clientes reales, no una mejora opcional de producto.

### Fuentes

- [How to Manage Credit Limits in Odoo 18 Accounting](https://home.mycbms.com/how-to-manage-credit-limits-in-odoo-18-accounting-sales-credit-in-odoo-18-accounting-odoo-18-cbms-odoo-erp/)
- [How to Set Sales Credit Limits for Partners in Odoo 18 Enterprise](https://web.srikeshinfotech.com/blog/odoo-3/how-to-set-sales-credit-limits-for-partners-in-odoo-18-enterprise-200)
- [Odoo Credit Limit Management: How to Set and Enforce Customer Credit Limits](https://www.browseinfo.com/blog/browseinfo-app-articles-3/odoo-customer-credit-limit-management-setup-enforce-516)
- [Odoo Pricelists: Customer Pricing, Discounts & Formulas (2026)](https://www.odooskillz.com/blog/odoo-skillz-insights-1/odoo-pricelists-advanced-pricing-rules-formulas-guide-357)
- [Beyond the Order Portal: SAP Business One as a Revenue Engine](https://focuspointsap.com/sap-business-one-intelligent-ecommerce-revenue-engine/)
- [SAP B2B Self-Service Portal](https://www.sap.com/products/crm/b2b-selfservice-portal.html)
- [Launch a B2B customer portal in weeks (SAP)](https://www.sap.com/documents/2025/07/18c537db-127f-0010-bca6-c68f7e60039b.html)
- [Customer Self-Service Portals for SAP Manufacturers | Corevist](https://www.corevist.com/)
- [What is NetSuite Order-to-Cash Process?](https://www.hyperbots.com/glossary/netsuite-order-to-cash-process)
- [NetSuite Order to Cash Process: Complete Workflow Guide (2026)](https://techivin.com/netsuite-order-to-cash-process-complete-workflow-guide-2026/)
- [NetSuite Order-to-Cash: Complete Process Design and Implementation Guide](https://yrkconsulting.com/blog/netsuite-order-to-cash-complete-process-guide)
- [Quote to Cash: Process, Steps & How to Optimize It (2026)](https://www.sifthub.io/blog/quote-to-cash-process)
- [B2B Pricing Strategy Guide: Tools & Implementation (2026)](https://www.shopline.com/blog/b2b-pricing-strategy-guide)
- [Top 8 Deal Desk Software Tools for B2B in 2026](https://scopicstudios.com/blog/top-8-deal-desk-software-tools-for-b2b-in-2026/)
- [B2B Quote Management Guide: From RFQ to Quote-to-Cash](https://virtocommerce.com/blog/b2b-ecommerce-quote-management)
- [Facturación electrónica obligatoria en Ecuador 2026: transmisión inmediata al SRI](https://ecuafact.com/blog/obligatoriedad-facturacion-electronica-ecuador-2026)
- [Proveedores de facturación electrónica deberán registrarse en el SRI de forma obligatoria](https://www.primicias.ec/economia/sri-facturacion-electronica-proveedores-contribuyentes-registro-comprobantes-129013/)
- [Facturación Electrónica Ecuador 2026: Guía Completa SRI | FacturaIA](https://facturaia.ec/blog/facturacion-electronica-sri-ecuador-guia-completa)
- [Requisitos para Facturación Electrónica en Ecuador 2026 | Factuplan](https://factuplan.com.ec/blog/requisitos-para-facturacion-electronica-ecuador)
- [Factura electrónica en Ecuador: requisitos, normativa | Edicom](https://edicomgroup.com/blog/electronic-invoicing-in-ecuador)

## 2. Nuestro estado actual (KallpaPro)

Ya implementado y confirmado en el código:

| Capacidad | Estado |
|---|---|
| Flujo cotización → pedido → confirmación con chequeo de stock disponible | ✅ Implementado |
| Listas de precios (el precio sale de la lista asignada, no se escribe a mano) | ✅ Implementado |
| "Venta rápida" tipo POS (pedido + reserva + despacho + factura en un solo paso) | ✅ Implementado |
| Despachos parciales de un mismo pedido con tracking de envío | ✅ Implementado |
| Factura con `dueDate` que alimenta el flujo de cobros de Tesorería | ✅ Implementado |
| COGS exacto por capa de inventario realmente consumida en el despacho (no promedio) | ✅ Implementado |
| Notas de crédito con documento sustento y reversos contables | ✅ Implementado |
| PDF de factura y nota de crédito | ✅ Implementado |
| Retención que el cliente practica al proveedor (normativa tributaria ecuatoriana) | ✅ Implementado |
| Roles diferenciados (GERENTE_VENTAS, SUPERVISOR_VENTAS, FUERZA_VENTAS) vía CASL | ✅ Implementado |
| Asiento contable automático por cada movimiento económico (`journal.service`) | ✅ Implementado |

Brecha ya conocida internamente y confirmada por la investigación como **bloqueante legal**:

- **Facturación electrónica SRI real** (XML firmado + autorización ante el SRI, clave de acceso) — no implementada. El PDF de factura actual no reemplaza el comprobante electrónico autorizado. Con el paso del SRI a transmisión inmediata en 2026, este corte se vuelve más urgente: sin este componente, KallpaPro no puede facturar legalmente a un cliente real ecuatoriano, independientemente de cuán completo esté el resto del flujo de ventas.

## 3. Diagnóstico: brechas frente al mercado

| Brecha | Impacto | Severidad |
|---|---|---|
| Sin facturación electrónica SRI (XML firmado + autorización) | Imposibilidad legal de operar con un cliente real en Ecuador | Crítica / bloqueante |
| Sin límite de crédito por cliente ni bloqueo automático de pedidos | Riesgo de seguir despachando a un cliente en mora; ya existe el dato de cartera vencida en Tesorería pero no está conectado a Ventas | Alta |
| Sin flujo de aprobación de descuentos fuera de política | Un vendedor de FUERZA_VENTAS puede aplicar cualquier precio si tiene acceso a listas alternativas, sin control jerárquico explícito en el pedido | Media-Alta |
| Sin portal de autoservicio para el cliente B2B | El cliente depende de llamar/escribir al vendedor para ver estado de pedido, factura o reordenar — carga operativa evitable | Media |
| Sin pricing por volumen/tramos dentro de una misma lista de precios | Las listas actuales asignan un precio fijo por cliente/lista, pero no manejan descuentos automáticos por cantidad dentro de la misma cotización | Media |
| Sin vista kanban de pipeline de pedidos por etapa | El seguimiento de cotización→pedido→despacho→factura depende de tablas/filtros, no de un tablero visual como el que ya existe en CRM | Media |

## 4. Propuestas de mejora

### Flujo de trabajo

- **Bloqueo de crédito automático**: al confirmar un pedido, validar `saldoDisponible = límiteCrédito - (facturasPendientes + pedidosNoFacturados)`; si el pedido lo excede, pasar el pedido a estado "Retenido por crédito" y notificar a Tesorería/GERENTE_VENTAS para liberación manual. Reutilizar el score de cartera vencida que Tesorería ya calcula.
- **Aprobación de descuentos**: si el descuento aplicado en una línea de cotización supera un umbral configurable por rol (ej. FUERZA_VENTAS máx. 5 %, SUPERVISOR_VENTAS máx. 15 %), la cotización pasa a "Pendiente de aprobación" antes de poder confirmarse como pedido.
- **Guía de facturación electrónica SRI**: emitir el comprobante (clave de acceso, XML firmado con certificado digital, envío y autorización ante el SRI, o vía proveedor autorizado tipo SERES/Edicom) como paso obligatorio antes de marcar la factura como "Emitida"; el PDF actual pasa a ser la representación impresa de un comprobante ya autorizado, no el comprobante en sí.
- **Reintento y contingencia SRI**: dado que el SRI avanza a validación inmediata, el flujo debe soportar el esquema de contingencia (offline) previsto por el SRI cuando el servicio no responde, sin bloquear la operación de venta.

### Sistema de organización / configuración

- **Segmentos de cliente configurables**: permitir asignar una lista de precios por segmento (mayorista/distribuidor/minorista/VIP) a nivel de configuración de empresa, no solo cliente por cliente, para que escalar a nuevos clientes de un segmento no requiera configuración manual repetida.
- **Parámetros de crédito por cliente**: límite de crédito, días de gracia y comportamiento al exceder (bloquear vs. alertar) configurables por cliente o por segmento por defecto.
- **Matriz de aprobación por rol**: tabla de configuración (umbral de descuento, monto de pedido) editable por GERENTE_VENTAS sin tocar código, apoyada en las políticas CASL ya existentes.
- **Catálogo de motivos de nota de crédito**: estandarizar los motivos (devolución, error de precio, descuento posterior) para reporting posterior, ya que hoy el documento sustento existe pero no hay taxonomía de motivo.

### Experiencia de usuario (frontend operativo)

- **Kanban de pedidos** (Borrador → Enviado → Aprobado → Confirmado → Despachado parcial/total → Facturado → Cobrado), con drag-and-drop restringido por permisos CASL, siguiendo el mismo patrón visual que Odoo/NetSuite y que ya se usa en el CRM interno de KallpaPro (@dnd-kit).
- **Semáforo de crédito visible en el pedido**: mostrar en la propia pantalla de creación del pedido el saldo de crédito disponible del cliente (verde/amarillo/rojo), no solo como reporte aparte — patrón confirmado en SAP B1 y NetSuite.
- **Portal de autoservicio B2B** (fase 1 mínima): vista de solo lectura para el cliente con sus cotizaciones, pedidos, facturas y notas de crédito en PDF, y estado de cuenta (saldo, vencidos) — reutilizando los PDFs y `dueDate` ya existentes. Fase 2: reorden en un clic desde el historial.
- **Indicador de stock en tiempo real dentro de la cotización**: mostrar disponible/reservado por bodega en la misma línea de producto al cotizar, para reducir el rechazo posterior por falta de stock.

### Actualizaciones futuras (mercado emergente / IA)

- **Sugerencia de reorden predictivo**: con base en el historial de compra del cliente, sugerir (con aceptar/rechazar humano-en-el-loop, igual patrón que el CRM-IA de KallpaPro) cuándo un cliente B2B probablemente necesite reordenar, y prellenar el pedido.
- **Detección de anomalías de precio/descuento**: alerta automática cuando un pedido se aparte significativamente del histórico de precio de ese cliente/producto, antes de confirmar.
- **Asistente de cobranza IA**: extensión del mismo agente de CRM hacia Tesorería/Ventas para generar recordatorios de pago personalizados según el perfil de mora del cliente (ya identificado como pendiente en la bitácora interna del proyecto).
- **Forecast de demanda por cliente/segmento**: proyección simple de ventas futuras por segmento para apoyar decisiones de compra/inventario, con el mismo patrón de "sugerencia visible, no automática por defecto".

## 5. Qué NO tocar

| Práctica de mercado | Por qué NO aplica a KallpaPro (pyme B2B ecuatoriana) |
|---|---|
| CPQ (Configure-Price-Quote) complejo con reglas de configuración de producto tipo Salesforce/Oracle | Las pymes objetivo venden catálogos relativamente simples (no ingeniería a medida ni configuración combinatoria); un CPQ completo añade complejidad de mantenimiento sin beneficio proporcional. |
| Múltiples monedas y consolidación multi-entidad (multi-company avanzado tipo NetSuite OneWorld) | El negocio es 1 empresa ecuatoriana operando en USD; construir multi-moneda/multi-entidad ahora es sobre-ingeniería para el segmento pyme actual. |
| Motores de precios dinámicos basados en IA (pricing algorítmico en tiempo real tipo retail/e-commerce masivo) | El pricing B2B pyme se negocia por relación comercial y volumen, no por demanda en tiempo real; un motor de precios dinámico generaría desconfianza en clientes B2B acostumbrados a precios pactados. |
| Portal B2B con checkout de autoservicio completo (compra sin intervención humana) desde el día uno | En la cultura comercial B2B ecuatoriana pyme, la relación con el vendedor sigue siendo central; conviene lanzar el portal como consulta/reorden asistido antes de un checkout 100 % self-service. |
| Integración nativa con marketplaces B2B globales (Amazon Business, Alibaba) | Fuera del alcance de negocio actual (ventas B2B directas a empresas locales), agregaría superficie de mantenimiento sin demanda real del cliente objetivo. |
