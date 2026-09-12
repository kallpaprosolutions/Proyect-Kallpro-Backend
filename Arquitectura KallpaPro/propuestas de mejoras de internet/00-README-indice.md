# Propuestas de mejoras de Internet — índice

> 📍 Carpeta de investigación externa, **complementaria** a `Modulos/` — no reemplaza ni edita esos
> archivos. Aquí se contrasta cada módulo YA CONSTRUIDO de KallpaPro contra lo que hacen Odoo 18,
> SAP Business One, NetSuite, Microsoft Dynamics 365 Business Central y especialistas del rubro
> (Kyriba, HighRadius, Rippling, Salesforce/HubSpot, etc.) en 2025-2026, con fuentes reales.
> Generado: 2026-09-05 · 12 documentos, uno por módulo del ciclo operativo + UX transversal.

## Cómo se hizo
Cada documento sigue el mismo método que ya usó este proyecto en `Modulos/10-crm.md` (Sprint 13):
investigación web con fuentes citadas → contraste contra lo que YA está implementado (tomado
literal de `Modulos/*.md`, sin inventar) → diagnóstico de brechas reales → propuestas organizadas
en 4 frentes (flujo de trabajo, organización/configuración, frontend operativo, IA futura) → qué
NO conviene copiar del mercado para no sobre-construir para una pyme ecuatoriana B2B.

## Qué hacer con esto (según `protocolo-mejoras.md` del proyecto)
Esto es **backlog de investigación**, no ejecución. Cuando se decida implementar una propuesta:
1. Si es específica de un módulo → pasa a la sección "Mejoras propuestas" de `Modulos/<módulo>.md`.
2. Si es un patrón transversal de UX → pasa a `plan-mejoras-odoo18.md` (Fase A-D) con referencia cruzada.
3. Si toca autorización/backend → revisar primero la regla transversal 2 del proyecto (todo asiento
   pasa por `journal.service`) y el hallazgo de seguridad del punto 1 de la tabla de abajo.

## Índice de documentos

| # | Módulo | Documento | Hallazgo más importante |
|---|---|---|---|
| 1 | Planificación y Presupuesto | [`01-planificacion-presupuesto-vs-mercado.md`](./01-planificacion-presupuesto-vs-mercado.md) | Falta rolling forecast / triple capa presupuestado-comprometido-ejecutado y alertas proactivas de sobregiro. |
| 2 | Compras | [`02-compras-vs-mercado.md`](./02-compras-vs-mercado.md) | Ya supera el estándar en comparativo ponderado e IA en el centro SRI; falta scorecard de proveedor, homologación y aprobación por política. |
| 3 | Inventario | [`03-inventario-vs-mercado.md`](./03-inventario-vs-mercado.md) | Faltan reglas de reabastecimiento automático (push/pull), unidad de compra≠venta, cuenta contable por producto y cycle counting por ABC. |
| 3b | Producción y Calidad | [`03b-produccion-calidad-vs-mercado.md`](./03b-produccion-calidad-vs-mercado.md) | Ya cumple ISO 9001/22000 en lo esencial; falta maestro de equipos calibrados (§7.1.5), auditorías internas (§9.2) y trazabilidad hacia adelante en un clic. |
| 4 | Ventas | [`04-ventas-vs-mercado.md`](./04-ventas-vs-mercado.md) | Facturación electrónica SRI confirmada como bloqueante legal, no solo mejora de UX, para vender a clientes reales en Ecuador. |
| 4b | Logística | [`04b-logistica-vs-mercado.md`](./04b-logistica-vs-mercado.md) | Módulo sin desarrollo propio — propuesta de estructura completa desde cero, incluida la guía de remisión electrónica del SRI. |
| 5 | Nómina + Biométrico | [`05-nomina-biometrico-vs-mercado.md`](./05-nomina-biometrico-vs-mercado.md) | Falta recargo nocturno (+25%) y feriados nacionales en el cálculo de horas extra — riesgo legal directo, no solo brecha de producto. |
| 6 | Contabilidad | [`06-contabilidad-vs-mercado.md`](./06-contabilidad-vs-mercado.md) | El hallazgo de autorización solo-en-frontend coincide con **OWASP API5:2023 (Broken Function Level Authorization)** — riesgo de seguridad clasificado, no solo interno. |
| 7 | Tesorería | [`07-tesoreria-vs-mercado.md`](./07-tesoreria-vs-mercado.md) | Conciliación bancaria y generación de archivo Cash Management (Pichincha/Produbanco) son el gap de mayor impacto/menor esfuerzo confirmado para el mercado ecuatoriano. |
| 8 | Análisis financiero CxP/CxC | [`08-analisis-financiero-cxp-cxc-vs-mercado.md`](./08-analisis-financiero-cxp-cxc-vs-mercado.md) | Recordatorios de cobranza automáticos (dunning) son funcionalidad núcleo en toda plataforma de AP/AR automation comparada. |
| 9 | UX transversal | [`09-ux-transversal-vs-mercado.md`](./09-ux-transversal-vs-mercado.md) | El sistema de permisos (CASL, 19 roles) es invisible para el usuario — ningún líder de mercado esconde el rol del usuario de su propia interfaz. Propone panel "Mis permisos" + home por rol. |
| 10 | CRM | [`10-crm-vs-mercado.md`](./10-crm-vs-mercado.md) | Scoring predictivo con ML sobre conversión histórica es la brecha que más rápido erosiona la ventaja competitiva si no se cierra (ya estándar en Salesforce/HubSpot/Odoo 18). |

## Los tres hallazgos que cruzan varios módulos

1. **Seguridad**: la autorización de acciones en Contabilidad (CxP/CxC) solo vive en el frontend —
   confirmado como OWASP API5:2023. Ver `06-contabilidad-vs-mercado.md` §3.
2. **IA visible, no automática**: los cinco ERP comparados (Odoo, SAP, Dynamics, NetSuite,
   Salesforce) coinciden en un mismo patrón — sugerencia con aceptar/editar/descartar, nunca
   ejecución silenciosa. KallpaPro ya lo hace bien en el CRM; la propuesta transversal es
   extenderlo a Inventario, Compras, Contabilidad y Tesorería sin inventar un patrón nuevo.
3. **El usuario no ve sus propios límites**: ninguna plataforma comparada oculta el rol del
   usuario de su propia interfaz (Fiori literalmente construye la navegación a partir del rol).
   Es la brecha más citada en `09-ux-transversal-vs-mercado.md` y responde directo al pedido de
   "que el usuario sepa sus funciones y limitaciones dentro del sistema".

## Ver también
- [[../flujo-trabajo-erp|Router de módulos]] · [[../plan-mejoras-odoo18|Plan de mejoras Odoo 18]]
- [[../Modulos/09-ux-transversal|09-ux-transversal (interno)]] — brechas ya priorizadas A5→A3→A2.2
- Bitácora de diagnóstico previa (sesión Claude, 2026-09-05): flujo, cortes de continuidad y
  sistema de roles — sirvió de base para encargar este lote de investigación.
