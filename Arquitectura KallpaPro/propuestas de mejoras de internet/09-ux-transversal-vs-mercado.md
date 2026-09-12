# 9. UX transversal — comparación con mejores prácticas de mercado

> 📍 Este documento es transversal: no pertenece a un módulo de negocio (Inventario, Compras, Financiero, Ventas o Logística) sino a la **capa de interfaz que atraviesa los 12 documentos del lote**. Aplica a toda pantalla, tabla, formulario y flujo de KallpaPro, sin importar el módulo que se esté usando.

## 1. Investigación: qué hacen los mejores ERP en UX/frontend en 2026

| Patrón de UX | Odoo 18 | SAP Fiori (design system) | Microsoft Dynamics 365 Business Central | NetSuite | Salesforce Lightning |
|---|---|---|---|---|---|
| Navegación entre vistas de un mismo dato | Botones conmutables Lista ↔ Kanban ↔ Calendario ↔ Gráfico ↔ Pivote en la misma barra de control, con breadcrumbs apilables (cada registro abierto agrega un nivel) | Launchpad de "tiles" (mosaicos) agrupados por rol/espacio de trabajo; cada tile abre una app Fiori independiente, no un menú jerárquico | Menú de "Role Center" con listas embebidas (List Parts) y navegación por páginas de documento con FactBoxes laterales | Menú de módulo + "Shortcuts" personalizables por el usuario; dashboards NetSuite embebidos por rol | App Builder de componentes arrastrables (Lightning Components) sobre un layout de página configurable sin código |
| Bandeja de tareas pendientes / aprobaciones | Widget global "Activities" (icono de reloj) visible en TODAS las vistas de lista y en cada registro: próxima actividad, tipo (llamada, email, reunión), responsable, fecha vencida en rojo | "My Inbox" — bandeja unificada de aprobaciones (compras, viajes, vacaciones) con acción aceptar/rechazar sin salir de la bandeja | "Copilot"-driven action feeds + notificaciones de flujo de aprobación (Power Automate) en el centro de notificaciones de la campana | Centro de aprobaciones NetSuite con workflows configurables por SuiteFlow | "Approval History" component embebido en el layout de registro + notificaciones en la campana de Lightning |
| Registro de cambios / colaboración en un documento | "Chatter" — hilo de mensajes + LOG AUTOMÁTICO de cada cambio de campo relevante ("Estado: Cotización → Orden de venta") + lista de "seguidores" que reciben notificación de cada evento | "Feed" de comentarios en objetos de negocio clave (menos granular que Chatter, enfocado en colaboración, no en auditoría campo a campo) | "Notes" y "Record Links" en FactBox lateral; el log de cambios detallado vive en tablas de auditoría, no es visible directamente en el documento | Campo de notas y archivos adjuntos por transacción; el historial de cambios detallado requiere el módulo de auditoría, no aparece inline | "Chatter" (Salesforce también lo llama Chatter) — feed de actividad con menciones @usuario y seguidores por registro |
| Dashboards / Home | Vista "Home" por app configurable, KPIs en tiles con clic-to-drill hacia la lista filtrada | Launchpad = home por rol: cada usuario ve solo los tiles de su espacio de trabajo asignado; tiles dinámicos muestran un número en vivo (ej. "12 facturas vencidas") | "Role Center" — página de inicio distinta por rol (contable, vendedor, gerente) con Cues (KPIs numéricos grandes) que abren la lista filtrada al hacer clic | Dashboard NetSuite con portlets arrastrables (KPI Scorecard, Trend Graph, Reminders) personalizables por el propio usuario | Lightning Home Page component-based, distinta por perfil de Salesforce, con componentes de IA (Einstein) sugiriendo la siguiente acción |
| Mobile / trabajo de campo | App Odoo móvil con escáner de código de barras nativo para Inventario y POS; diseño responsive que colapsa Kanban a tarjetas apiladas | Fiori es "responsive by design": la misma app se adapta a escritorio, tablet y teléfono sin versión separada (principio "Adaptive") | App Business Central móvil con captura de gastos por foto y aprobaciones desde el teléfono | App NetSuite móvil enfocada en aprobaciones y consulta, no en captura operativa pesada | Salesforce Mobile App generado automáticamente desde la misma configuración de Lightning App Builder (un solo diseño, dos salidas) |
| Accesibilidad | Cumplimiento parcial WCAG, foco en atajos de teclado en vistas de lista | Fiori sigue WCAG 2.1 AA como requisito de certificación del design system; contraste, navegación por teclado y lector de pantalla probados por componente | Cumplimiento WCAG 2.1 AA declarado en la documentación de accesibilidad de Business Central | Declaración de conformidad de accesibilidad de Oracle (VPAT) para NetSuite | Salesforce publica Accessibility Conformance Reports (VPAT) por producto Lightning |
| IA visible en la interfaz | Campos de "IA" puntuales (ej. sugerencia de categorización), sin copiloto conversacional transversal aún generalizado | "Joule" — copiloto conversacional embebido en el shell de Fiori, invocable desde cualquier pantalla, responde preguntas sobre el documento abierto y ejecuta acciones con confirmación explícita del usuario | "Copilot" embebido por página: sugiere líneas de documento, categoriza gastos, redacta descripciones, resume categorías de pago — siempre con panel de sugerencia que el usuario acepta o descarta, nunca automatismo silencioso | Asistentes de IA generativa en SuiteAnalytics para explicar variaciones de KPI en lenguaje natural | "Einstein Copilot" en el panel lateral de cualquier registro Lightning, con acciones sugeridas mostradas como tarjetas aceptar/editar/descartar |

### Prácticas confirmadas por la investigación

**Navegación**
- El patrón dominante en 2025-2026 es la **conmutación de vista sobre el mismo conjunto de datos** (lista ⇄ kanban ⇄ calendario ⇄ gráfico), no pantallas separadas por tipo de vista — Odoo lo aplica de forma uniforme en casi todos sus módulos.
- Los breadcrumbs se usan como pila de navegación (cada documento abierto se apila), no solo como "ruta actual".
- SAP Fiori reemplaza el menú jerárquico tradicional por un **Launchpad de tiles agrupado por rol**: el usuario nunca navega un árbol de módulos, entra directo a lo que su rol necesita.

**Notificaciones y actividades**
- El patrón "Activities" de Odoo (actividad programada sobre un documento + widget global "Mis actividades" agregando todas las pendientes de todos los documentos) es replicado conceptualmente por el "My Inbox" de SAP Fiori y los "Cues" combinados con notificaciones de Business Central: **todo ERP serio de 2025-2026 tiene un punto único donde el usuario ve "qué me falta hacer hoy"**, independiente de en qué documento está parado.
- La bandeja de aprobaciones unificada (Fiori "My Inbox") es el estándar para flujos de aprobación multinivel: aprobar/rechazar sin abrir el documento completo.

**Dashboards**
- El home por rol (Role Center de Business Central, Launchpad de Fiori, Lightning Home Page) es universal en los cinco sistemas comparados — ninguno de los cinco usa un dashboard genérico único para todos los usuarios.
- El drill-down de KPI a lista de registros (clic en el número → tabla filtrada que lo compone) es el patrón consistente en los cinco: Business Central "Cues", Fiori tiles dinámicos, NetSuite portlets, Lightning components, Odoo home KPIs.

**Mobile**
- El principio Fiori "Responsive" (una sola app se adapta a los tres tamaños de pantalla, no versiones separadas) es la dirección de la industria, frente al viejo patrón de "app móvil aparte con menos funciones".
- Para roles operativos (bodega, ventas de calle), el patrón ganador es **mobile-first con captura por cámara** (escáner de código de barras, foto de gasto/factura) integrada al flujo principal, no como función secundaria.

**Accesibilidad**
- WCAG 2.1 AA es el estándar de facto que los cuatro proveedores grandes (SAP, Microsoft, Oracle NetSuite, Salesforce) declaran públicamente vía VPAT o documentación de conformidad — no es un "nice to have", es una certificación exigida en licitaciones B2B/gobierno.

**IA en la interfaz**
- El patrón consistente en 2025-2026 (Copilot de Business Central, Joule de SAP, Einstein Copilot de Salesforce) es: **sugerencia visible en un panel o tarjeta lateral, con botones explícitos de aceptar/editar/descartar** — ninguno de los líderes de mercado ejecuta cambios de datos de forma automática y silenciosa; la IA siempre deja al usuario como aprobador final de la acción.
- El copiloto se invoca de forma **contextual al documento abierto** (responde sobre la factura/orden que se está viendo), no como un chat genérico aislado del contexto de trabajo.

**Fuentes**
- [Activities — Odoo 18.0 documentation](https://www.odoo.com/documentation/18.0/applications/essentials/activities.html)
- [Chatter — Odoo 18.0 documentation](https://www.odoo.com/documentation/18.0/applications/productivity/discuss/chatter.html)
- [Odoo 18 Basics | All View Types at a Glance](https://muchconsulting.com/blog/odoo-2/odoo-view-types-33)
- [Odoo 18 Release Notes | Odoo](https://www.odoo.com/odoo-18-release-notes)
- [SAP Fiori Design Principles](https://www.sap.com/design-system/fiori-design-ios/discover/sap-design-system/vision-and-mission/sap-fiori-design-principles)
- [Design Principles — SAP Fiori Design Web](https://www.sap.com/design-system/fiori-design-web/v1-96/discover/sap-design-system/vision-and-mission/design-principles)
- [SAP Fiori Design Principles — The Five Ideas Behind Every SAP App](https://rakeshnarayan.com/articles/sap-fiori-design-principles-the-five-ideas-behind-every-sap-app/)
- [What is SAP Fiori? Applications, Elements, Launchpad & Design](https://pathlock.com/blog/sap-fiori/)
- [Copilot FAQ - Business Central | Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/business-central/copilot-overview)
- [Dynamics 365 Business Central - Copilot and agents | Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/release-plan/2025wave2/smb/dynamics365-business-central/copilot-agents)
- [Agents, Copilot, and AI capabilities in Dynamics 365 apps | Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/copilot/ai-get-started)
- [Generative AI with SAP – Part 3: Joule, SAP's Generative AI Copilot](https://community.sap.com/t5/technology-blog-posts-by-sap/generative-ai-with-sap-part-3-joule-sap-s-generative-ai-copilot/ba-p/13581304)
- [Joule, the AI Copilot for SAP | SAP Community](https://pages.community.sap.com/topics/joule)
- [NetSuite Applications Suite - Business Intelligence](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1529089901.html)
- [NetSuite SuiteAnalytics Reporting & Dashboards | NetSuite](https://www.netsuite.com/portal/products/business-intelligence.shtml)
- [Dashboards | SuiteAnalytics | NetSuite Solution Provider | Rand Group](https://www.randgroup.com/oracle-netsuite/suiteanalytics/suiteanalytics-dashboards/)
- [Dashboard UI design: From KPIs to layouts that convert | Setproduct Blog](https://www.setproduct.com/blog/dashboard-ui-design)
- [Dashboard Design UX Patterns Best Practices - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)
- [Enterprise UX Design Guide 2026 | Best Practices & Examples](https://fuselabcreative.com/enterprise-ux-design-guide-2026-best-practices/)
- [UX Best Practices for ERP Software (2026)](https://www.sowaanerp.ae/erp-software-ux-what-makes-an-erp-actually-easy-to-use-in-2026/)
- [Mobile Warehouse Management: Features That Actually Matter - Bizowie](https://bizowie.com/mobile-warehouse-management-features-that-actually-matter)
- [Barcode Scanning for Warehouses: Complete Implementation Guide - Bizowie](https://bizowie.com/barcode-scanning-for-warehouses-complete-implementation-guide)
- [Push notifications vs. in-app messaging: making the right choice for your product | Knock](https://knock.app/blog/push-notifications-vs-in-app-messaging)
- [Push Notifications vs. In-App Notifications: Which to choose | Sendbird](https://sendbird.com/blog/push-notifications-vs-in-app-notifications)
- [RBAC in practice: Implementing secure authorization for your application · Logto blog](https://blog.logto.io/rbac-in-practice)
- [Role-based Access Control (RBAC) - Preset Docs](https://docs.preset.io/docs/role-based-access-security-rbac)

## 2. Nuestro estado actual (KallpaPro)

Lo que ya está implementado y probado en producción, según la bitácora del proyecto:

- **Búsqueda global Ctrl+K** (`cmdk`) que busca clientes, proveedores, productos, órdenes de compra, facturas, pedidos, requisiciones y menús — equivalente al patrón "command palette" que hoy es estándar en aplicaciones profesionales de escritorio.
- **Smart buttons**: contadores de documentos vinculados visibles en el detalle de una orden de compra/pedido/factura (ej. "3 recepciones", "2 pagos") que navegan al hacer clic — el mismo patrón que Odoo llama "smart buttons" en la cabecera de sus formularios.
- **Chatter ligero**: hilo de mensajes/comentarios dentro de una orden de compra, factura, pedido o requisición.
- **Calendario de RRHH** con `react-big-calendar`, turnos reprogramables por arrastrar-soltar.
- **CRM** (módulo aparte, ya con UX avanzada): bandeja de leads con score explicado campo por campo, panel de configuración con pestañas editables (etapas del pipeline, reglas de puntaje, formularios, asignación, agentes de IA con modo de autonomía autopilot/setter_closer/semi_assisted/manual), pronóstico con categorías y cobertura vs cuota.
- **Sistema de roles**: 19 roles operativos gobernados por CASL, hoy usado únicamente para ocultar/mostrar botones en el frontend.
- **Stack disponible sin usar aún a fondo**: `@dnd-kit` (drag-and-drop/kanban), `@tanstack/react-table` (tablas), `recharts` (gráficos), `XState` (máquinas de estado), `pdfkit` y `exceljs` en backend (exportación de reportes).

## 3. Diagnóstico: brechas frente al mercado

| Brecha | Por qué importa (evidencia de mercado) | Severidad |
|---|---|---|
| No hay vistas Kanban conmutables en Pedidos, Facturas ni Requisiciones (solo el CRM las tiene) | Los 5 sistemas comparados usan conmutación de vista sobre el mismo dataset como patrón base de navegación; el usuario de KallpaPro hoy solo tiene tabla plana fuera del CRM | Alta |
| No existe "Actividades programadas" por documento ni un widget global "Mis actividades" | Es el patrón más citado por los propios usuarios internos como "lo que más se nota frente a Odoo" — sin él, el seguimiento de tareas vive fuera del sistema (chat, memoria) | Alta |
| El Chatter no registra automáticamente los cambios de campo ni tiene seguidores/notificaciones | Odoo lo identifica como su feature de colaboración más valorada; sin log automático, el chatter de KallpaPro es solo un chat manual, no un historial de auditoría legible | Alta |
| Búsqueda insensible a acentos no habilitada | Búsqueda es el primer punto de contacto del usuario (Ctrl+K ya existe) — buscar "tornilleria" y no encontrar "tornillería" rompe la confianza en la función más usada del sistema | Media |
| **El sistema de permisos (CASL, 19 roles) es invisible para el usuario final** | Ninguno de los 5 sistemas comparados esconde el rol del usuario: Fiori muestra literalmente solo los tiles de su rol (el permiso ES la navegación), Business Central tiene un Role Center distinto por perfil. En KallpaPro el permiso solo oculta botones sin explicar límites — contradice el pedido explícito del dueño del proyecto de que "el usuario sepa sus funciones y limitaciones" | **Crítica** |
| No hay home/dashboard distinto por rol | Los 5 sistemas comparados tienen home personalizado por rol como elemento base, no opcional | Alta |
| No hay centro de reportería con exportación, pese a tener `pdfkit`/`exceljs` instalados | El drill-down de KPI a lista es un patrón universal en los 5 sistemas; hoy KallpaPro no tiene ni el punto de entrada (centro de reportes) ni el drill-down | Alta |

## 4. Propuestas de mejora

### Flujo de trabajo

- **Conmutador de vista Lista ⇄ Kanban** en Pedidos, Facturas y Requisiciones, reutilizando `@dnd-kit` (ya usado en el Pipeline del CRM como referencia interna) y `@tanstack/react-table` para la vista de lista subyacente — un solo control de tres botones (Lista/Kanban/Calendario) en la barra superior de cada listado, con el estado de la vista elegida persistido por usuario en `localStorage` o en el perfil del usuario.
- **Widget global "Mis actividades"** en el header de la aplicación (junto al ícono de notificaciones), que consulta actividades programadas de todos los módulos (compras, ventas, logística, inventario) y las agrupa por vencidas/hoy/próximas — modelado como una nueva máquina de estados en `XState` (`activityMachine`) que orquesta la creación, snooze y completado de una actividad, reutilizable desde cualquier documento.
- **Actividades programadas por documento**: un botón "Programar actividad" en la cabecera de cada orden de compra/pedido/factura/requisición (mismo patrón que los smart buttons ya existentes), con tipo (llamada, verificación, seguimiento de pago), responsable y fecha — persistido igual que el chatter actual, en la misma tabla relacional del documento.
- **Breadcrumbs apilables**: cuando el usuario navega desde un smart button (ej. de una orden de compra a sus 3 recepciones), el breadcrumb agrega un nivel en vez de reemplazar la ruta — así el usuario regresa con un clic al documento origen, replicando el patrón de pila de Odoo.

### Sistema de organización / configuración

- **Panel "Mis permisos"** accesible desde el menú de usuario: lista en lenguaje simple qué puede y qué no puede hacer el usuario actual, generado dinámicamente a partir de las reglas CASL ya definidas (`ability.can(...)` evaluado contra un catálogo de acciones legibles, no contra nombres técnicos de permiso). Responde directamente al pedido del dueño del proyecto de que el usuario sepa sus funciones y limitaciones — es la brecha crítica identificada en el diagnóstico.
- **Home distinto por rol**: en vez de un dashboard genérico, una pantalla de inicio configurada por rol (comprador, vendedor, bodeguero, contador, gerente) que muestra solo los KPIs, accesos directos y actividades relevantes a ese rol — mismo principio que el Role Center de Business Central y el Launchpad de Fiori. Técnicamente: un registro de "widgets disponibles por rol" evaluado con las mismas `abilities` de CASL que ya gobiernan los botones, de forma que el mismo motor de permisos decida tanto qué se ve como qué se puede hacer.
- **Onboarding contextual por rol**: al primer login (o al cambiar de rol), un tour corto de 3-4 pasos con `cmdk`-style overlay señalando los accesos directos y el widget de actividades relevantes a ese rol específico — evita el punto ciego actual donde todos entran al mismo lugar sin guía.
- **Activación de la extensión `unaccent` de PostgreSQL** en el motor de búsqueda global (Ctrl+K) y en las búsquedas de listas (`@tanstack/react-table` con filtro de texto), para que "tornilleria" encuentre "tornillería" — cambio de backend de bajo costo con alto impacto en la función más usada del sistema.

### Experiencia de usuario (frontend operativo)

- **Kanban en Pedidos/Facturas/Requisiciones** con `@dnd-kit`: columnas por estado del documento (ej. Requisición: Borrador → Aprobación → Convertida en OC), tarjetas arrastrables que disparan la misma transición de estado que hoy ocurre por botón — mapeado 1:1 a los estados ya definidos en las máquinas `XState` existentes, sin crear un modelo de estado paralelo.
- **Chatter con log automático de cambios + seguidores**: cada cambio de campo relevante (estado, monto, fecha de entrega) genera una entrada automática en el hilo del chatter existente ("Estado: Solicitado → Orden de compra — por Juan Pérez, 14:32"), y un sistema de "seguidores" por documento (el creador y quien lo aprueba se agregan automáticamente) que reciben la notificación en el centro de notificaciones — se apoya en la infraestructura de chatter ya construida, solo se agrega el disparador automático de eventos y la tabla de seguidores.
- **Centro de reportería con drill-down**: una pantalla nueva "Reportes" por módulo, con gráficos `recharts` (ya instalado) donde cada KPI/barra es clickeable y abre la tabla `@tanstack/react-table` filtrada con los registros que lo componen (mismo patrón que los Cues de Business Central o los tiles dinámicos de Fiori) — con botón de exportación a PDF (`pdfkit`) y Excel (`exceljs`), ambos ya instalados en el backend y sin usar todavía.
- **Captura mobile-first para bodega y ventas de calle**: formularios de recepción de mercadería y toma de pedidos optimizados para pantalla angosta, con el escáner `@zxing` ya integrado como primer campo del formulario (escanear antes que escribir), y controles grandes tipo lista táctil en vez de tablas densas — siguiendo el principio Fiori de "una sola app responsive" en vez de una versión móvil reducida aparte.
- **Notificaciones in-app como canal primario**, con email solo para resúmenes diarios/semanales y push reservado a eventos críticos de campo (ej. "aprobación urgente pendiente") — evita la fatiga de email que la industria identifica como el error más común en centros de notificación empresarial.

### Actualizaciones futuras (IA en la interfaz)

- **Copiloto contextual por documento**: un panel lateral (no un chat flotante genérico) que responde preguntas sobre la orden de compra/factura/pedido abierto y sugiere la siguiente acción (ej. "esta factura vence en 2 días y no tiene pago registrado, ¿programar recordatorio?"), replicando el patrón de Copilot de Business Central y Joule de SAP: sugerencia con botones explícitos de aceptar/editar/descartar, nunca ejecución automática silenciosa.
- **Extensión del modo de autonomía del CRM (autopilot/setter_closer/semi_assisted/manual) a Compras y Ventas**: el mismo patrón de graduación de autonomía de IA ya validado en el CRM (agentes de IA con niveles de autonomía) se traslada a sugerencias de reorden de inventario, aprobación de requisiciones de bajo monto y priorización de pedidos — reutilizando el mismo concepto de configuración, no un motor de IA nuevo.
- **Resumen de KPI en lenguaje natural** en el centro de reportería propuesto arriba (ej. "las ventas del módulo cayeron 12% esta semana, principalmente por la categoría X") — mismo patrón que los asistentes de IA generativa de NetSuite SuiteAnalytics para explicar variaciones.

## 5. Qué NO tocar

- **No adoptar un framework de componentes de terceros (MUI, Ant Design, Chakra, etc.)** — decisión de diseño ya tomada explícitamente por el proyecto de mantener su propio design system sobre Tailwind. Ningún patrón de este documento requiere un framework de componentes: Kanban, tablas, calendarios, command palette y gráficos ya se resuelven con las librerías headless instaladas (`@dnd-kit`, `@tanstack/react-table`, `react-big-calendar`, `cmdk`, `recharts`), que dejan el estilo visual completamente en manos del design system propio.
- **No copiar el menú jerárquico de módulos "a la antigua"** que Odoo todavía mantiene como respaldo — la dirección de mercado (Fiori Launchpad, Role Center) es reemplazarlo por accesos directos organizados por rol, no por profundizar el árbol de menús.
- **No construir un chat de IA genérico desconectado del documento** — los tres líderes de mercado (Copilot, Joule, Einstein) coinciden en que el copiloto debe ser contextual a la pantalla abierta; un chat flotante aislado sin contexto del documento actual repite el error que la industria ya superó.
- **No automatizar acciones de IA sin confirmación del usuario** — ningún proveedor grande ejecuta cambios de datos de forma silenciosa; toda sugerencia de IA en este documento se implementa como tarjeta de aceptar/editar/descartar, nunca como automatismo ciego, siguiendo el pedido explícito de "flujo de trabajo semiautomático" (no automático) del dueño del proyecto.
- **No introducir una app móvil nativa separada** — el patrón de mercado ganador es responsive/PWA de una sola base de código (principio Fiori "Adaptive"), no mantener dos frontends distintos.
