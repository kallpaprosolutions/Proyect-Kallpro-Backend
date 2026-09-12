# 6. Contabilidad (NIIF · control interno) — comparación con mejores prácticas de mercado

> 📍 Módulo 6 — Contabilidad. Backend: `journal.service`, `AccountMapping` (posting setup), motor de cierres de período, declaraciones SRI (F103/F104), flujo de efectivo NIC 7. Frontend: tablero contable, diario, mayor, balanza de comprobación, Balance General y Estado de Resultados.

## 1. Investigación: qué hacen los mejores sistemas contables en 2026

| Práctica | Odoo 18 | SAP Business One | NetSuite | QuickBooks / Xero | Notas |
|---|---|---|---|---|---|
| Cierre continuo ("rolling close") | Conciliación bancaria diaria automática con modelos de reconciliación con IA sugerida | Cierre de período con checklist de cierre configurable | "Period Close Checklist" nativo con tareas asignadas y dependencias | Cierre mensual asistido, reconciliación bancaria diaria | El mercado migra de "cerrar el mes en 10 días" a cerrar continuamente: cada día se concilia lo que llega, el cierre formal es un evento pequeño |
| Checklist de cierre con dueños y fechas | Sí (actividades/to-do por usuario) | Sí (Cockpit de cierre) | Sí (Financial Close Management module) | Parcial (apps de terceros) | Estándar de facto: lista de tareas de cierre con responsable, estado y evidencia adjunta, auditable |
| Conciliación bancaria/contable con matching automático | Reglas de reconciliación + sugerencia IA con score de confianza | Reconciliación automática por referencia | Matching automático + IA (NetSuite AI) | Reglas de matching por reglas y ML | El patrón ganador es "sugerir + aceptar/rechazar" (human-in-the-loop), no automatización ciega |
| Segregación de funciones (SoD) a nivel de sistema | Grupos de seguridad con reglas de registro (record rules) a nivel de ORM/backend, no solo de menú | Autorizaciones a nivel de objeto de negocio (B1i, autorización de documentos) | Roles y permisos con "permission level" por transacción, validados en el motor SuiteScript/SuiteFlow (backend) | Roles limitados, débil comparado con ERP tier-1 | Los tres líderes de gama alta (Odoo, SAP B1, NetSuite) validan el permiso en el **servidor/motor de reglas**, no solo ocultando botones en el cliente |
| Log de auditoría inmutable | "mail.tracking" + log de cambios en campos críticos, versión Enterprise con audit log dedicado | Change Log nativo (tabla `OCLG`) inmutable por diseño, no editable ni por admin | System Notes + SuiteAnalytics con registro de quién/cuándo/qué campo cambió | Audit log limitado en planes altos | Un log de auditoría que el mismo rol que ejecuta la acción puede alterar no sirve como control; debe ser append-only y fuera del alcance de escritura de los roles operativos |
| Depreciación de activos fijos NIIF | Módulo de activos con métodos de depreciación, asiento automático mensual | Módulo de activos fijos integrado | Fixed Assets Management nativo | Complemento de terceros | Estándar de mercado, no diferenciador — su ausencia es una brecha real |
| Ingresos/gastos diferidos | Automatización de diferidos con reglas de reconocimiento | Reconocimiento de ingresos por reglas | Revenue Recognition Management (motor dedicado, incluso ASC 606/NIIF 15) | Básico o por app externa | Cada vez más exigido por auditores en NIIF por devengo |
| Reportes fiscales locales | Paquetes de localización fiscal por país mantenidos por la comunidad/partners | Add-ons de localización por país | SuiteTax + bundles de localización | Integraciones locales por país | Ningún ERP genérico llega "listo" para el Ecuador; siempre requiere paquete de localización (como el que KallpaPro ya construyó a medida) |

### Prácticas confirmadas por la investigación

**Cierre continuo y checklist de cierre**
El "financial close" moderno ya no es un sprint de fin de mes: la tendencia dominante en 2025-2026 es el **cierre continuo (continuous/rolling close)**, donde las conciliaciones y validaciones ocurren a diario o semanalmente a medida que llegan los datos, dejando el cierre formal como una confirmación final de pocas horas en vez de una carrera de días. El vehículo operativo de esta práctica es un **checklist de cierre** con tareas, responsables, fechas límite y evidencia adjunta, visible como tablero (no como lista de Excel).

**Segregación de funciones (SoD) a nivel de sistema, no de interfaz**
Esta es la práctica más consistente y mejor documentada en la industria: la separación de funciones (SoD) debe aplicarse **como control de sistema**, verificado en cada transacción por el motor/backend, no como una convención de "quién ve qué botón". Sage Intacct documenta SoD y seguridad de acceso como un área de auditoría formal con controles verificables, y las guías de control interno (Securends, Numeric, Hyperbots) coinciden en que sin aplicación a nivel de sistema, la SoD es solo una política en papel que un auditor de sistemas (ITGC) puede tumbar en la primera prueba.

**Autorización de funciones — el hallazgo de seguridad se confirma como patrón de riesgo conocido en la industria**
El estándar de la industria para APIs (OWASP API Security Top 10, categoría **API5:2023 — Broken Function Level Authorization**) describe exactamente el patrón detectado en KallpaPro: un endpoint que solo verifica autenticación (¿quién eres?) pero no autorización de función (¿tienes permiso para *esta* acción?), confiando en que la UI oculte el botón al rol equivocado. OWASP clasifica esto como una vulnerabilidad crítica porque **cualquier cliente HTTP (Postman, curl, un script) puede invocar el endpoint directamente, sin pasar por el frontend**, y en un sistema financiero esto no es solo un bug de seguridad: es una falla de control interno auditable (permite a un usuario sin autorización de posteo manual —`postManual`— reclasificar asientos o tocar CxC/CxP saltándose la aprobación). Las guías de seguridad de APIs financieras (APIsec, Lightspark, Oso) son unánimes: **la autorización debe re-verificarse en cada capa de la petición en el servidor**, nunca asumirse porque "el frontend ya la aplicó". SAP Business One, NetSuite y Odoo Enterprise validan el permiso en el motor de reglas del servidor (record rules, permission levels, autorizaciones B1i) precisamente por esto: la UI es una conveniencia, no un control.

**Log de auditoría inmutable**
Los ERP maduros mantienen un registro de cambios que ningún rol operativo — ni siquiera el administrador funcional del módulo — puede editar o borrar (SAP B1: tabla `OCLG` de Change Log; Odoo Enterprise: audit log dedicado; NetSuite: System Notes). Esto es lo que permite reconstruir "quién reclasificó este asiento y cuándo" ante un auditor o el SRI.

**Activos fijos, depreciación y diferidos bajo NIIF**
Son funcionalidades estándar en todo ERP de gama media-alta (NIC 16 / NIF C-6 para activos fijos con métodos de depreciación configurables; reconocimiento de ingresos/gastos diferidos). Su ausencia no es un diferenciador competitivo, es una casilla vacía frente a cualquier competidor serio.

#### Fuentes
- [Segregation of Duties: Key to Fraud Prevention — Numeric](https://www.numeric.io/blog/segregation-of-duties-accounting)
- [Segregation of Duties in Accounts Payable — Securends](https://www.securends.com/blog/segregation-of-duties-in-accounts-payable/)
- [Segregation of Duties in Internal Controls: Framework and Best Practices — Securends](https://www.securends.com/blog/segregation-of-duties-in-internal-controls/)
- [What is Segregation of Duties (Close)? — Hyperbots](https://www.hyperbots.com/glossary/segregation-of-duties-close)
- [Introducing the Continuous Close — Rillet](https://info.rillet.com/continuous-close)
- [Best Financial Close Software for 2026 — Xenett](https://www.xenett.com/blog/financial-close-software)
- [Segregation of duties and access security — Sage Intacct](https://www.intacct.com/ia/docs/en_US/help_action/More/Compliance/Audit_areas_and_controls/segregation-duties-access-security.htm)
- [API5:2023 Broken Function Level Authorization — OWASP](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
- [API5:2023 Broken Function Level Authorization — Indusface](https://www.indusface.com/learning/owasp-api-top-10-broken-function-level-authorization/)
- [Financial Services API Security Compliance Guide — APIsec](https://www.apisec.ai/blog/financial-services-api-security-compliance)
- [Role-Based Access Control: The Core of Fintech Security — Lightspark](https://www.lightspark.com/glossary/role-based-access-control-)
- [How to Build a Role-Based Access Control Layer — Oso](https://www.osohq.com/learn/rbac-role-based-access-control)
- [How to validate RBAC in financial software — Should I Test That](https://shoulditestthat.com/2025/04/18/how-to-validate-role-based-access-control-rbac-in-financial-software/)
- [Odoo Accounting • Features](https://www.odoo.com/app/accounting-features)
- [Highly Impactful Features of Odoo 18 Accounting — SerpentCS](https://www.serpentcs.com/blog/odoo-guide-378/odoo-18-accounting-features-608)
- [Year-end closing — Odoo 18.0 documentation](https://www.odoo.com/documentation/18.0/applications/finance/accounting/reporting/year_end.html)
- [Overview of Odoo 18 Accounting Reconciliation Models — Cybrosys](https://www.cybrosys.com/blog/overview-of-odoo-18-accounting-reconciliation-models)
- [Odoo Reconciliation: A Complete Guide for 2026 — Optimus](https://optimus.tech/blog/odoo-reconciliation-guide)
- [NIC 16 y NIF C-6: Guía para el registro, valuación y depreciación de activos fijos — IDC](https://idconline.mx/practica-contable/2026/04/14/nic-16-y-nif-c-6-guia-para-el-registro-valuacion-y-depreciacion-de-activos-fijos)
- [NIF C-6 Propiedades, Planta y Equipo: Guía Completa 2026 — CPCON](https://cpcongroup.mx/insights/nif-c-6-propiedades-planta-y-equipo-mexico)
- [Checklist de auditoría para el cierre contable y fiscal — Logaritmo](https://logaritmoec.com/auditoria-sin-sorpresas-checklist-clave/)

## 2. Nuestro estado actual (KallpaPro)

- Plan de cuentas Supercías (Ecuador) de 301 cuentas, con posting setup editable (`AccountMapping`).
- Diario con búsqueda avanzada, mayor contable, balanza de comprobación por nivel.
- Balance General y Estado de Resultados bajo NIIF.
- Cierres de período que **bloquean** nuevos asientos y reversos en el período cerrado.
- Declaraciones SRI (Ecuador): Formulario 104 (IVA) y 103 (retenciones) por casillas, con selector de período.
- Tablero contable accionable: tarjetas clicables de documentos SRI por revisar, CxC/CxP vencidas, asientos del mes, estado del período.
- Flujo de efectivo bajo NIC 7, método directo.
- Roles AUDITOR y TRIBUTARIO con vistas específicas por perfil.
- Asiento automático de factura de compra directa (sin orden de compra), con split proporcional del IVA por tipo de ítem.
- Todo asiento pasa por `journal.service` (regla transversal, numeración atómica AST-, respeta cierres de período).

## 3. Diagnóstico: brechas frente al mercado

| Brecha | Severidad | Confirmada por investigación |
|---|---|---|
| Autorización de `/financial/ap/*`, `/financial/ar/*`, `/financial/journal-entries/reclassify` solo exige autenticación, no el permiso `postManual` en backend | **Crítica** | Sí — coincide exactamente con OWASP API5:2023 (Broken Function Level Authorization); es el patrón de riesgo #1 documentado para APIs financieras |
| Sin log de auditoría inmutable independiente del rol operativo | Alta | Sí — todos los ERP de referencia (SAP B1, Odoo Enterprise, NetSuite) lo tratan como control obligatorio, no opcional |
| Sin cierre continuo / checklist de cierre con tareas y responsables | Media-Alta | Sí — es tendencia dominante 2025-2026, con producto dedicado en NetSuite (Financial Close Management) |
| Sin conciliación bancaria con matching sugerido (score de confianza) | Media | Sí — Odoo, SAP B1 y NetSuite ya lo ofrecen como estándar, con patrón "sugerir + aceptar/rechazar" |
| Sin activos fijos ni depreciación NIIF | Media | Sí — funcionalidad base en todo ERP de gama media-alta (NIC 16) |
| Sin diferidos (ingresos/gastos) | Media | Sí — exigido cada vez más por auditores bajo devengo NIIF |
| Sin ATS ni Formulario 101 | Alta (para Ecuador específicamente) | No aplica a mercado global, pero es obligación local ineludible |
| Sin asiento propio para reverso de nota de crédito de compra | Baja-Media | Coherente con la necesidad de trazabilidad contable completa que exige todo el resto del diseño (`journal.service`) |

## 4. Propuestas de mejora

### Flujo de trabajo
1. **Cerrar la brecha de autorización en backend de inmediato** (antes que cualquier otra mejora de este módulo): todo endpoint de `/financial/ap/*`, `/financial/ar/*` y `/financial/journal-entries/reclassify` debe validar el permiso `postManual` (u otros permisos CASL equivalentes) **en el middleware del servidor**, replicando la misma regla que ya existe en el frontend, no como sustituto de ella. Añadir pruebas de integración que llamen a estos endpoints directamente (sin frontend) con un rol sin el permiso, esperando 403.
2. Registrar cada reclasificación, ajuste de saldo/write-off y aplicación manual de nota de crédito en un log de auditoría **append-only**, separado de las tablas operativas, con actor, timestamp, valores antes/después y motivo obligatorio (campo de texto) cuando la acción sea sensible (reversos, reclasificaciones, write-offs).
3. Introducir un checklist de cierre de período: lista de tareas predefinidas (conciliar bancos, revisar CxC/CxP vencidas, validar IVA de compras/ventas, revisar asientos pendientes de aprobación) con responsable asignado y estado, visible en el tablero contable antes de permitir el cierre del período.
4. Mover el cierre de "evento de fin de mes" a "revisión continua": permitir marcar transacciones como "conciliado/revisado" día a día dentro del período abierto, de forma que el cierre formal sea una confirmación, no una reconstrucción.

### Sistema de organización / configuración
5. Extender el posting setup (`AccountMapping`) para cubrir depreciación de activos fijos y diferidos, manteniendo el mismo patrón ya usado (cuentas configurables, no quemadas).
6. Añadir un catálogo de "motivos obligatorios" configurable para reversos y reclasificaciones (para cumplir con evidencia de auditoría sin fricción excesiva).
7. Definir en el sistema de roles una matriz explícita de SoD: qué rol puede crear una factura, cuál puede aprobarla, cuál puede posteo manual — y que esa matriz sea la misma fuente de verdad tanto en frontend como en backend (una sola definición de permisos, dos consumidores).

### Experiencia de usuario (frontend operativo)
8. Panel de conciliación bancaria con sugerencias de matching (por monto + fecha + referencia) y botones **Aceptar / Rechazar** por línea, siguiendo el patrón "IA sugiere, humano decide" que KallpaPro ya usa en CRM — sin automatizar el posteo sin revisión.
9. Widget de "checklist de cierre" en el tablero contable, con barra de progreso y bloqueo visual de las tareas pendientes antes de habilitar el botón de cierre de período.
10. Vista de auditoría de cambios accesible para el rol AUDITOR: línea de tiempo de reclasificaciones y ajustes con filtro por usuario/fecha/cuenta.

### Actualizaciones futuras (mercado emergente / IA)
11. Motor de reglas de conciliación con score de confianza (como los modelos de reconciliación de Odoo): reglas aprendidas de conciliaciones pasadas que sugieren la cuenta o el asiento con mayor probabilidad, siempre con aceptar/rechazar.
12. Depreciación automática mensual vía job programado que genere el asiento de depreciación del período, respetando el motor de cierres existente.
13. Evaluar en el roadmap el Anexo Transaccional Simplificado (ATS) y el Formulario 101, dado que son las brechas de cumplimiento local más citadas y de mayor riesgo regulatorio en Ecuador.

## 5. Qué NO tocar

- **Revenue Recognition Management tipo NetSuite (motor dedicado NIIF 15/ASC 606 con múltiples elementos de contrato)**: es una funcionalidad orientada a empresas con contratos de servicio complejos y reconocimiento escalonado (SaaS, licencias, contratos plurianuales). Para pymes B2B ecuatorianas con ciclos de venta de bienes/servicios simples, un módulo de diferidos básico (ya propuesto arriba) cubre el caso de uso real sin la complejidad de un motor de reconocimiento por hitos.
- **SuiteTax / localización multi-país tipo NetSuite**: KallpaPro está diseñado y optimizado para el marco fiscal ecuatoriano (SRI, Supercías). Construir un motor de impuestos multi-jurisdicción sería sobre-ingeniería para el mercado objetivo actual; si se expande a otro país andino, se evalúa entonces.
- **Cierre de auditoría externa integrado (workflow con firma digital de auditores externos, como algunos add-ons de NetSuite/SAP)**: las pymes objetivo no suelen tener auditoría externa obligatoria recurrente; el rol AUDITOR interno con vistas de solo lectura ya cubre la necesidad real sin construir un flujo de colaboración externo completo.
- **Consolidación multi-entidad/multi-moneda a nivel de grupo empresarial**: es una capacidad de ERP tier-1 para grupos corporativos con múltiples subsidiarias; el negocio objetivo (pyme/mediana empresa individual) no la necesita todavía, y añadirla ahora complicaría el modelo de datos sin beneficio inmediato.
