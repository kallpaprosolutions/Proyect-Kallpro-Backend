# 4b. Módulo Logística — comparación con mejores prácticas de mercado

> 📍 Ubicación propuesta: `Proyect-Kallpro-Backend/src/modules/logistics` (a crear) + `Proyect-Kallpro-Frontend/src/features/logistica` (a crear). Hoy, la única funcionalidad relacionada vive dentro de Ventas (`src/modules/sales`): despachos parciales con envío y tracking básico. Logística está declarada en el alcance original de los 5 módulos de KallpaPro pero **no tiene desarrollo ni documentación propia**; este documento propone la estructura completa desde cero, no un diagnóstico de brechas sobre algo ya construido.

## 1. Investigación: qué hacen los mejores en logística/distribución B2B en 2026

| Práctica | Odoo 18 (Inventory/Delivery + apps de ruteo) | ERPs con TMS integrado (SuiteFleet-class) | ShipStation / ShipBob | ClickPost / agregadores de tracking |
|---|---|---|---|---|
| Ruteo de entregas / optimización de rutas | Apps de terceros (Delivery Route Optimizer) sobre Odoo Inventory que generan rutas óptimas por zona/vehículo | TMS dedicado con planificación de rutas multi-parada y reasignación dinámica | Reglas de envío por zona, no ruteo de flota propia (enfocado en paquetería) | No aplica (son agregadores de tracking, no ruteo) |
| Gestión de flota propia vs. tercerizada | Integraciones de flota (vehículos, choferes) + conector a couriers externos | Gestión combinada de flota propia y subcontratada con costeo diferenciado | Enfocado en couriers externos (UPS/FedEx/DHL), no flota propia | Agrega el tracking de múltiples couriers en una sola vista |
| Costeo de flete por envío | Cálculo de costo de envío por regla de peso/volumen/zona en el pedido de venta | Costeo de flete por ruta/vehículo/combustible, prorrateado por envío | Tarifas negociadas por carrier calculadas al momento de generar la guía | No aplica directamente (solo tracking) |
| Tracking visible para el cliente | Portal de cliente con estado de entrega | Notificaciones proactivas de ETA y excepciones al cliente final | Tracking number entregado al cliente, integrado con email/SMS | Tracking unificado multi-courier con página de seguimiento de marca propia |
| App móvil para repartidor/chofer | App de "Barcode"/entregas para confirmar entrega con firma/foto | App de conductor con navegación, checklist de entrega, POD (proof of delivery) | N/A (fulfillment centers, no reparto propio) | N/A |
| Documentos de transporte / cumplimiento fiscal | Localización por país para documentos de transporte | Generación de documentos de transporte integrados a la ruta | N/A (couriers internacionales) | N/A |
| IA aplicada | Sugerencia de secuencia de ruta | Predicción de ETA basada en histórico + tráfico | Selección automática de carrier más barato/rápido | Predicción de excepciones de entrega (retraso probable) |

### Prácticas confirmadas por la investigación

**Ruteo y última milla**
- Los líderes en última milla (Locus, Routific, SmartRoutes, Nuvizz) coinciden en un patrón común: planificación de ruta multi-parada optimizada por ventana horaria, capacidad de vehículo y zona geográfica, con reasignación en tiempo real cuando una parada se cae o se agrega.
- La optimización de rutas ya no es solo "ruta más corta": incluye restricciones reales (ventanas de entrega del cliente, capacidad del vehículo, prioridad del pedido).

**Flota propia vs. tercerizada (courier)**
- Un ERP logístico pyme moderno necesita soportar ambos modelos a la vez: reparto con flota propia (choferes, vehículos internos) y despacho vía transportista/courier externo (tercerizado) para zonas o volúmenes que no conviene cubrir con flota propia — el módulo debe permitir declarar el "modo de despacho" por envío.
- El costeo de flete se hace normalmente por envío (no solo por pedido), permitiendo prorratear combustible/tiempo/distancia o aplicar la tarifa pactada con el transportista externo.

**Tracking visible para el cliente**
- El estándar de mercado 2026 es tracking proactivo: no solo un número de guía que el cliente consulta, sino notificaciones automáticas de cambio de estado (despachado, en ruta, entregado, excepción) — patrón que agregadores como ClickPost popularizaron y que los ERP están internalizando.

**Apps móviles para repartidores**
- Las apps de conductor/repartidor de los líderes incluyen: lista de paradas del día, navegación al siguiente destino, checklist de entrega, y prueba de entrega (POD) con firma digital y/o foto — elemento crítico para resolver disputas de "no me llegó" en B2B.

**Documentos de transporte y cumplimiento fiscal (Ecuador)**
- El SRI de Ecuador exige la **guía de remisión** para sustentar el traslado de mercancías fuera del establecimiento del contribuyente, y como el resto de comprobantes, tiene una modalidad **electrónica** (clave de acceso, XML firmado, autorización del SRI) que las empresas obligadas deben emitir junto con o en lugar de la guía física — este es un requisito legal para cualquier despacho que salga del local del vendedor, sea con flota propia o con transportista tercerizado.
- Es un bloqueante equivalente al de la factura electrónica en Ventas: sin guía de remisión electrónica válida, el transporte de la mercancía puede considerarse no sustentado ante un control del SRI en carretera.

**Logística inversa (devoluciones)**
- Reverse logistics ganó peso como componente formal del módulo de logística (no solo de Ventas): flujo de solicitud de devolución, autorización, recolección/recepción física, inspección de estado del producto devuelto y reingreso o descarte en inventario, con trazabilidad separada de la nota de crédito contable que ya vive en Ventas/Financiero.

**IA con humano en el loop**
- El patrón que domina en 2026 no es ruteo 100 % autónomo, sino sugerencia con aceptar/rechazar: el sistema propone la ruta óptima o la ETA estimada, y un despachador humano confirma o ajusta — mismo patrón de "sugerencia visible" que KallpaPro ya usa en su CRM-IA.
- La predicción de ETA basada en histórico de tiempos reales de entrega (no solo distancia) es la mejora de mayor impacto percibido por el cliente final, según los proveedores de TMS consultados.

### Fuentes

- [Delivery Route Optimization for Odoo](https://ecosire.com/apps/odoo/delivery-route-optimization)
- [Delivery Route Optimizer | Odoo Apps Store](https://apps.odoo.com/apps/modules/18.0/delivery_optimizer)
- [Odoo for Logistics & Warehousing - Features, Modules & Benefits](https://www.odoo-bs.com/odoo-for-logistics)
- [Odoo for Logistics: Complete Digital Transformation of Supply Chain and Fleet Management](https://nexeves.com/blog/odoo/odoo-for-logistics-complete-digital-transformation-of-supply-chain-and-fleet-management)
- [Odoo Courier Management: Last Mile Delivery Software Guide](https://www.botspotinfoware.com/blog/industry-based-blogs-3/odoo-courier-management-last-mile-delivery-software-guide-22)
- [Optimize Last Mile Logistics with Odoo and Guraify TMS](https://guraify.com/en_GB/blog/guraiblog-1/odoo-tms-last-mile-logistics-26)
- [Best Last Mile Delivery Software in 2026: 6 Top Platforms | SmartRoutes](https://smartroutes.io/blogs/best-last-mile-delivery-software/)
- [Top 10 Last Mile Routing Software for Enterprises in 2026 | Locus](https://locus.sh/blogs/last-mile-routing-software/)
- [Best Last-Mile Delivery Software for Growing Businesses (2026) | Routific](https://www.routific.com/blog/best-last-mile-delivery-software)
- [Best TMS System in 2026: 10 Systems Mapped | SuiteFleet](https://www.suitefleet.com/blog/best-tms-system-in-2026)
- [Top 20 Transportation Management Systems (2026) | SuiteFleet](https://www.suitefleet.com/blog/top-20-transportation-management-systems-2026)
- [Best Real-Time Shipment Tracking APIs for E-Commerce: 2026](https://nextbillion.ai/feeds/blog/compare-real-time-shipment-tracking-apis-e-commerce)
- [Top 10 ShipStation Alternatives & Competitors in 2026 | ClickPost](https://www.clickpost.ai/shipstation-competitors-alternatives)
- [Tracking | ShipBob Developer API](https://developer.shipbob.com/guides/tracking)
- [Reverse Logistics Best Practices for 2026 | Opendock](https://blog.opendock.com/reverse-logistics-best-practices)
- [Reverse Logistics: Best Practices Guide 2026 | SKUTOPIA](https://www.skutopia.com/blog/what-is-reverse-logistics)
- [Managing Returns & Reverse Logistics in Inventory: Guide 2026](https://zapro.ai/inventory-management/return-and-reverse-logistics/)
- [AI-Driven Route Optimization in 2026 | NextBillion.ai](https://nextbillion.ai/blog/ai-route-optimization-tools-and-algorithms)
- [AI Route Optimization for Smarter Last-Mile Delivery | Descartes](https://www.descartes.com/resources/knowledge-center/ai-route-optimization-enhancing-delivery-efficiency)
- [Last-Mile Delivery Optimization Trends for 2026 | Fleetrabbit](https://fleetrabbit.com/blogs/post/last-mile-delivery-trends-2026)
- [Guía de remisión electrónica en Ecuador 2026: guía completa | Factuplan](https://factuplan.com.ec/blog/guia-remision-electronica-ecuador-2026)
- [Guia de Remision SRI Ecuador: Requisitos y Cuando Usarla 2026](https://facturaia.ec/blog/guia-remision-sri-ecuador-requisitos)
- [Emite tus guías de remisión electrónicas con SERES](https://www.groupseres.com/es-ec/guia-de-remision-electronicas)
- [Transporte comercial Ecuador: cambios del SRI en 2026](https://llbsolutions.com/es/transporte-comercial-ecuador-resolucion-sri-2026/)

## 2. Nuestro estado actual (KallpaPro)

Logística **no es un módulo desarrollado ni documentado por separado hoy**. Lo único confirmado en el código, y que vive dentro de Ventas, es:

| Capacidad | Estado | Dónde vive |
|---|---|---|
| Despachos parciales de un pedido de venta | ✅ Implementado | `src/modules/sales` |
| Registro de envío asociado a un despacho | ✅ Implementado (básico) | `src/modules/sales` |
| Tracking de envío | ✅ Implementado (básico, alcance no confirmado en detalle) | `src/modules/sales` |

No confirmado / no existente actualmente (no se debe asumir que existe):

- Gestión de flota propia (vehículos, choferes).
- Costeo de flete o tarifas de transportista.
- Ruteo/optimización de rutas de entrega.
- Integración con couriers/transportistas externos.
- Guía de remisión electrónica.
- App móvil para repartidor.
- Logística inversa / gestión formal de devoluciones físicas.
- Portal de tracking dedicado para el cliente (más allá de lo que Ventas exponga).

Esto confirma lo señalado en la bitácora interna del proyecto: *"Logística es el módulo con menos documentación propia — ¿necesita una sesión de descubrimiento dedicada?"*. Este documento responde a esa pregunta abierta con una propuesta de estructura completa.

## 3. Diagnóstico: brechas frente al mercado

Al no existir el módulo como tal, el "diagnóstico" es de **ausencia estructural**, no de brechas puntuales sobre algo construido:

| Brecha | Impacto | Severidad |
|---|---|---|
| Sin guía de remisión electrónica | Igual que la factura electrónica en Ventas: bloqueante legal para transportar mercancía sustentada ante el SRI | Crítica / bloqueante |
| Sin costeo de flete por envío | Los despachos actuales no capturan el costo real de transporte, afectando el margen real de venta (fuera de COGS de producto) | Alta |
| Sin gestión de transportistas/couriers externos | Cada despacho tercerizado se coordina manualmente, sin trazabilidad de tarifa ni SLA de entrega | Alta |
| Sin ruteo de entregas ni vista de flota | Los despachos con flota propia (si existieran) no tienen planificación de ruta ni visibilidad de vehículos/choferes disponibles | Media-Alta |
| Sin app/vista para el repartidor | El chofer no tiene forma digital de confirmar entrega (POD) — el "tracking básico" en Ventas depende de actualización manual | Media |
| Sin logística inversa formal | Las devoluciones físicas dependen del flujo de nota de crédito de Ventas, sin proceso de recolección/inspección propio | Media |
| Sin portal de tracking dedicado para el cliente | El cliente B2B no tiene una vista de "dónde está mi pedido" separada de contactar al vendedor | Media |

## 4. Propuestas de mejora (propuesta de módulo completo)

### Flujo de trabajo

- **Despacho como entidad logística propia**: cuando Ventas confirma un despacho, Logística lo recibe como una "orden de entrega" con: modo de transporte (flota propia / transportista tercerizado / retiro en bodega por el cliente), dirección de entrega, ventana horaria solicitada y prioridad.
- **Asignación a ruta**: las órdenes de entrega del día se agrupan en rutas por zona/vehículo/chofer (flota propia) o se despachan a un transportista externo con generación de guía; ambos casos deben quedar sobre el mismo modelo de datos ("Envío") para no duplicar lógica.
- **Guía de remisión electrónica obligatoria**: todo envío que sale del establecimiento debe generar la guía de remisión (electrónica cuando aplique la normativa del SRI) antes de que el vehículo/transportista salga, con la misma lógica de clave de acceso/XML firmado/autorización que la factura electrónica de Ventas.
- **Confirmación de entrega (POD)**: el chofer/transportista marca el envío como entregado, con firma digital y/o foto y hora real de entrega; esto retroalimenta el estado del pedido en Ventas.
- **Logística inversa**: flujo de solicitud de devolución → autorización → recolección/recepción física → inspección de estado → reingreso a inventario o descarte, enlazado (no fusionado) con la nota de crédito contable que ya existe en Ventas/Financiero.
- **Costeo de flete por envío**: capturar costo real (combustible/tiempo/km para flota propia, tarifa pactada para transportista externo) y asociarlo al despacho para análisis de margen real de venta.

### Sistema de organización / configuración

- **Catálogo de transportistas/couriers**: ficha de transportista con tarifario, zonas de cobertura, SLA de entrega pactado y datos de contacto — configurable sin tocar código.
- **Catálogo de flota propia**: vehículos (placa, capacidad, tipo) y choferes, con disponibilidad y asignación diaria.
- **Zonas de reparto y ventanas horarias**: definición de zonas geográficas de cobertura propia y ventanas horarias estándar de entrega, reutilizables al planificar rutas.
- **Reglas de costeo de flete**: configurables por zona/peso/volumen/transportista, en la misma lógica de "reglas configurables" que ya usan las listas de precios de Ventas.
- **Roles de Logística en CASL**: definir roles propios (ej. SUPERVISOR_LOGISTICA, DESPACHADOR, REPARTIDOR) alineados al esquema de 19 roles ya existente, en vez de reutilizar roles de Ventas por defecto.

### Experiencia de usuario (frontend operativo)

- **Tablero de despachos del día** (kanban o lista agrupada por ruta/transportista), mostrando estado: pendiente de asignar → asignado a ruta → en tránsito → entregado → con excepción — mismo patrón visual kanban que Ventas y CRM.
- **Vista de mapa de rutas**: visualización de las paradas del día por vehículo/chofer sobre un mapa, con secuencia sugerida — patrón confirmado en todos los líderes de última milla investigados.
- **App/vista móvil para el repartidor**: lista de paradas asignadas, navegación al siguiente destino, checklist de entrega y captura de POD (firma/foto), pensada mobile-first dado que se usa en calle, no en oficina.
- **Portal de tracking para el cliente**: extensión del portal de autoservicio B2B de Ventas con una vista de "dónde está mi pedido" (estado del envío, ETA estimada, y confirmación de entrega con foto/firma si aplica).
- **Panel de costos de flete**: vista para Logística/Financiero que muestre costo de flete real vs. cobrado al cliente, por transportista y por zona, para decisiones de tarifa.

### Actualizaciones futuras (mercado emergente / IA)

- **Sugerencia de ruta óptima (humano en el loop)**: el sistema propone el agrupamiento de paradas y el orden de la ruta; el despachador confirma o reordena manualmente antes de asignar — mismo patrón de "sugerencia visible con aceptar/rechazar" que el CRM-IA de KallpaPro.
- **Predicción de fecha/hora de entrega**: estimación de ETA basada en el histórico real de tiempos de entrega por zona/transportista (no solo distancia en línea recta), mostrada al cliente en el portal de tracking.
- **Detección de excepciones probables**: alerta temprana cuando un envío tiene alta probabilidad de retraso (por zona, clima, volumen del día), para que el despachador pueda reasignar antes de que ocurra el incumplimiento.
- **Elección asistida de transportista**: sugerencia del transportista más económico/rápido disponible para una zona/volumen dado, dejando la decisión final al despachador.

## 5. Qué NO tocar

| Práctica de mercado | Por qué NO aplica a KallpaPro (pyme B2B ecuatoriana) |
|---|---|
| Optimización de rutas con algoritmos de vehicle routing problem (VRP) avanzados multi-restricción tipo enterprise (Locus, Descartes) | Una pyme con flota reducida (pocos vehículos, pocas paradas diarias) no necesita un solver VRP complejo; una heurística simple de agrupación por zona/ventana horaria cubre el caso de uso real sin ese costo de desarrollo/mantenimiento. |
| Integración simultánea con decenas de couriers internacionales (estilo ShipStation/ClickPost para e-commerce global) | El negocio es distribución B2B local/nacional en Ecuador; conviene priorizar 2-3 transportistas locales relevantes antes que un agregador multi-courier internacional. |
| Gestión de flota a nivel de telemetría/IoT (sensores de vehículo, mantenimiento predictivo de flota) | Es una capa de gestión de activos de transporte, no de un ERP comercial pyme; el objetivo aquí es visibilidad de entrega, no fleet maintenance management. |
| Checkout logístico 100% automatizado sin intervención de despachador (asignación y salida de ruta sin revisión humana) | El volumen y la naturaleza de la pyme B2B ecuatoriana hacen preferible mantener a un despachador humano confirmando cada ruta, al menos en las primeras versiones del módulo, para evitar errores costosos de asignación. |
| Redes de fulfillment centers distribuidos (modelo ShipBob de almacenamiento en múltiples nodos) | KallpaPro pyme opera típicamente desde una o pocas bodegas propias; un modelo de fulfillment multi-nodo es una capa de complejidad de otro segmento de mercado (e-commerce a gran escala). |
