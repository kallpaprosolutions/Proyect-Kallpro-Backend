# Normativa tributaria, contable y societaria — SRI, NIIF y Superintendencia de Compañías

> 📍 Documento VIVO de investigación normativa, complementario a `plan-contabilidad-tributaria-sri.md`
> (que define la ARQUITECTURA/etapas de facturación electrónica) y a
> `propuestas de mejoras de internet/06-contabilidad-vs-mercado.md` (que compara contra Odoo/SAP/NetSuite).
> Este documento es el **catálogo normativo**: qué formularios existen, qué NIIF aplica, qué
> porcentajes de retención rigen, qué formato/extensión de archivo exige cada plataforma
> gubernamental (SRI, SCVS, IESS) y qué falta implementar en KallpaPro para cumplir con todo eso.
> Generado: 2026-09-11, a pedido directo del usuario, investigado como lo haría un contador
> senior ecuatoriano implementando un ERP. Verificar siempre contra la resolución SRI/SCVS vigente
> antes de hardcodear un porcentaje o una fecha — esta es la razón de la Etapa 0 del backlog (§6).

## 0. Cómo usar este documento (para Claude Code)

Este archivo es **backlog de conocimiento + implementación**, no solo referencia. La sección §6
"Backlog de implementación" está ordenada por prioridad y pensada para ejecutarse **una fila a la
vez** en sesiones sucesivas, siguiendo `protocolo-mejoras.md`:
1. Tomar el ítem ❌ de mayor prioridad no bloqueado.
2. Implementarlo citando la norma exacta (columna "Base normativa") — no adivinar el porcentaje o
   la regla, viene de las tablas de este documento.
3. Marcarlo 🟡 si abarca más de una sesión, ✅ con fecha y archivo real al terminar.
4. Si en el camino se descubre que la norma cambió (el SRI resuelve nuevos porcentajes con
   frecuencia), actualizar la tabla correspondiente de este documento, no solo el código.

## 1. Marco normativo aplicable (jerarquía)

| Nivel | Norma | Aplica a |
|---|---|---|
| 1 | Constitución + Código Tributario | Principios generales (legalidad, no confiscatoriedad) |
| 2 | Ley Orgánica de Régimen Tributario Interno (LORTI) + su Reglamento (RALRTI) | Impuesto a la Renta, retenciones, IVA, ICE |
| 3 | Ley de Compañías + Reglamento sobre juntas, información societaria | Obligaciones societarias, EEFF anuales ante SCVS |
| 4 | Resoluciones NAC-DGERCGC del SRI (cambian con frecuencia) | Porcentajes de retención, fichas técnicas de comprobantes electrónicos, plazos |
| 5 | Resoluciones de la Superintendencia de Compañías, Valores y Seguros (SCVS) | Adopción de NIIF/NIIF para PYMES, plazos de presentación, catálogo de cuentas |
| 6 | Normas Internacionales de Información Financiera (NIIF/IFRS) y NIIF para PYMES, emitidas por el IASB | Reconocimiento, medición y presentación contable — la SCVS las adopta por resolución, no las crea |

**Punto clave para el diseño del ERP**: el SRI cambia porcentajes de retención y fichas técnicas
por **resolución administrativa**, no por ley — pueden cambiar varias veces al año. Ningún
porcentaje de este documento debe quedar quemado en código; todo pasa por una tabla configurable
con vigencia (`validFrom`/`validTo`), igual que ya se hace con `AccountMapping` (posting setup).

### Clasificación NIIF completas vs. NIIF para PYMES (SCVS)
La Superintendencia de Compañías clasifica a las empresas en 3 segmentos y asigna el marco
contable aplicable:
- **NIIF completas**: compañías cotizadas o de interés público, y compañías que superen ciertos
  umbrales de activos/ingresos/empleados definidos por resolución SCVS vigente (los umbrales
  exactos se revisan periódicamente — verificar la resolución de clasificación vigente al
  implementar el selector, no asumir un monto fijo).
- **NIIF para PYMES**: la mayoría de compañías medianas y pequeñas — es el marco que aplica al
  perfil de cliente objetivo de KallpaPro.
- **NIIF para microempresas** (Sección simplificada dentro de NIIF PYMES en algunos casos):
  compañías bajo el umbral menor.
KallpaPro debe permitir seleccionar el marco NIIF aplicable por empresa (`CompanyFiscalConfig`,
ya definido en `plan-contabilidad-tributaria-sri.md` §2 Etapa 1) porque cambia qué notas y qué
detalle de revelación son obligatorios en los estados financieros.

## 2. Catálogo completo de formularios SRI

| Formulario | Nombre | Periodicidad | Quién declara | Estado actual en KallpaPro |
|---|---|---|---|---|
| **101** | Declaración de Impuesto a la Renta y presentación de balances — Sociedades | Anual | Todas las sociedades | Existe (según `06-contabilidad-vs-mercado.md` §3, listado como brecha "sin Formulario 101" — **falta**) |
| **102 / 102A** | Impuesto a la Renta Personas Naturales y Sucesiones Indivisas (obligadas/no obligadas a llevar contabilidad) | Anual | Personas naturales | Fuera de alcance típico de un ERP B2B, pero relevante para socios/accionistas que reciben dividendos |
| **102 RIMPE** | Declaración anual simplificada — régimen RIMPE Emprendedor | Anual | Contribuyentes RIMPE Emprendedor | No existe soporte de régimen RIMPE — **falta** (ver §4) |
| **103** | Retenciones en la Fuente del Impuesto a la Renta | Mensual | Agentes de retención | Existe — "Formulario 103 por casillas" (`plan-contabilidad-tributaria-sri.md` §0) |
| **104** | Declaración del IVA (contribuyentes con derecho a crédito tributario) | Mensual | Sociedades y personas obligadas a contabilidad | Existe |
| **104A** | Declaración del IVA para personas naturales no agentes de retención | Mensual/Semestral | Personas naturales sin agencia de retención | Existe (mencionado junto con 104) |
| **105** | Declaración del Impuesto a los Consumos Especiales (ICE) | Mensual | Fabricantes/importadores de bienes ICE | No aplica al perfil actual de clientes de KallpaPro — evaluar solo si se atiende a ese nicho |
| **106** | Formulario Múltiple de Pagos (multas, intereses, valores por convenios de pago) | A demanda | Cualquier contribuyente | No existe — **falta** (bajo impacto, uso ocasional) |
| **107** | Comprobante de Retenciones en la Fuente del Impuesto a la Renta por Ingresos del Trabajo en Relación de Dependencia | Anual (por cada empleado) | Empleadores | Vinculado al módulo de Nómina, no al de Contabilidad — verificar con `payroll.service.ts` |
| **108** | Declaración del Impuesto a la Renta sobre Ingresos Provenientes de Herencias, Legados y Donaciones | Ocasional | Personas naturales | Existe (mencionado en `06-contabilidad-vs-mercado.md`), bajo impacto para B2B |
| **115** | Anticipo de Impuesto a la Renta | Según cronograma (cuotas jul/sept) | Sociedades obligadas al anticipo | No existe — **falta**; el cálculo del anticipo bajo el nuevo régimen (fórmula patrimonio/activos/ingresos/costos vigente) debe ser configurable, cambia por resolución |
| **116** | Anticipo/retención por espectáculos públicos ocasionales | Ocasional | Organizadores de eventos | Fuera de alcance |
| **110** | Impuesto a los Activos en el Exterior | Mensual (entidades financieras) | Sector financiero | Fuera de alcance para KallpaPro (perfil pyme B2B no financiero) |
| **111** | Impuesto a las Tierras Rurales | Anual | Propietarios de predios rurales | Fuera de alcance salvo cliente agroindustrial con tierras propias — evaluar caso a caso |

### Anexos informativos (no son "formularios" de pago, pero son obligación declarativa)

| Anexo | Nombre completo | Periodicidad | Extensión de archivo | Estado en KallpaPro |
|---|---|---|---|---|
| **ATS** | Anexo Transaccional Simplificado | Mensual | **XML comprimido** (se genera en el DIMM Anexos o en un sistema propio que produzca el XML válido contra el esquema oficial, y se sube en línea al portal SRI — el DIMM Formularios para declaraciones 101/102/103/104 ya está obsoleto, esas se presentan 100% en línea) | Existe una **aproximación** (`ats.engine.ts` según `plan-contabilidad-tributaria-sri.md` §0, ítem 8) — falta el desglose real de IVA por línea, que la Etapa 7 de ese plan ya programa resolver cuando exista facturación electrónica real |
| **RDEP** | Anexo de Retenciones en la Fuente bajo Relación de Dependencia | Anual (ene-feb) | XML (vía DIMM Anexos o generador propio) | No existe — vinculado a Nómina, no a Contabilidad pura |
| **REOC** | Anexo de Retenciones en la Fuente por Otros Conceptos (cuando no aplica ATS) | Según caso | XML | No existe — bajo impacto, ATS cubre la mayoría de casos B2B |
| **Anexo Gastos Personales (AGP)** | Gastos personales de empleados para deducción de IR | Anual | XML | Fuera de alcance de Contabilidad (es de Nómina/RRHH) |
| **Anexo de Dividendos (ADI)** | Reporte de dividendos distribuidos a accionistas/socios | Anual | XML | No existe — relevante si KallpaPro modela distribución de utilidades a accionistas |
| **Anexo ISD** | Detalle de Impuesto a la Salida de Divisas retenido/pagado | Mensual/trimestral | En línea (declaración + anexo cuando aplica) | No existe — bajo impacto salvo clientes con pagos frecuentes al exterior |

## 3. Tabla de retenciones en la fuente (referencia — verificar vigencia antes de implementar)

> ⚠️ Estos porcentajes se establecen por resolución del SRI (actualmente bajo el marco de la
> Resolución NAC-DGERCGC20-00000057 y sus reformas posteriores) y **cambian con relativa
> frecuencia**. La tabla siguiente es la fotografía vigente a la fecha de este documento
> (sept. 2026) tomada de fuentes especializadas — antes de codificar un valor, confirmar contra
> la tabla oficial publicada en sri.gob.ec.

### Retención en la fuente del Impuesto a la Renta (códigos más usados en B2B)

| Código | Concepto | % |
|---|---|---|
| 303 | Honorarios profesionales y dietas | 10% |
| 304 | Servicios predominantemente intelectuales | 8% |
| 307 | Servicios donde predomina la mano de obra | 2% |
| 312 | Compra de bienes muebles | 1.75% |
| 320 | Arrendamiento de bienes inmuebles | 8% |
| 323 | Rendimientos financieros / intereses | 2% |
| 332 | Compras no sujetas a retención | 0% |

(La tabla completa del SRI incluye decenas de códigos adicionales — honorarios a no residentes,
transporte, publicidad, seguros, etc. — con tasas de 0% a 37%; el backlog de §6 propone modelar
esto como catálogo configurable, no una lista fija en código.)

### Retención de IVA (agentes de retención)

| Código | Concepto | % |
|---|---|---|
| 721 | Adquisición de bienes muebles | 10% |
| 723 | Prestación de servicios gravados | 20% |
| 725 | Honorarios / servicios profesionales | 50% |
| 727 | Servicios donde predomina la mano de obra | 70% |
| 729 | Liquidación de compras (100%) | 100% |

Fuentes de esta sección: [Tabla de Retenciones — Siigo Contífico](https://www.siigo.com/ec/blog/obligaciones-fiscales/tabla-de-retenciones-en-la-fuente/), [Tributos.org](https://tributos.org/es/herramientas/tabla-retenciones-la-fuente-ecuador-2026), [Deltech Audit](https://deltechaudit.ec/retenciones-ecuador-2026-porcentajes-sri/), [BP One](https://bp-one.com/ecuador-tabla-de-retenciones-en-la-fuente-2026-actualizada-segun-las-ultimas-resoluciones-del-sri/), [Dergest](https://dergest.com/blog/tablas-retenciones-ecuador-2026.html), [EasyTax EC](https://easytaxec.com/blog/porcentajes-de-retencion-en-la-fuente/).

## 4. Régimen RIMPE (impacto directo en facturación y retenciones)

Desde 2022 buena parte de las pymes ecuatorianas migraron al **RIMPE** (Régimen Impositivo para
Microempresas), con dos categorías que KallpaPro debe poder representar como atributo de la
empresa cliente y del propio tenant (`CompanyFiscalConfig.regimen`):

| Categoría | Ingresos anuales | Forma de facturar | Declaraciones | Nota para el ERP |
|---|---|---|---|---|
| **RIMPE Negocio Popular** | Hasta USD 20,000 | Nota de venta **sin IVA discriminado** | IR fijo anual por actividad, **sin declarar IVA** | Un cliente/proveedor en este régimen no genera crédito tributario de IVA — el motor de impuestos debe reconocerlo para no calcular retención de IVA sobre estas facturas |
| **RIMPE Emprendedor** | USD 20,000.01–300,000 (naturales); sociedades hasta 300,000 | Factura con IVA | IVA mensual (104/104A) + IR anual con tabla progresiva propia (no la tabla general de sociedades) | Generalmente **no actúa como agente de retención** — el motor de retenciones debe permitir marcar una empresa como "no agente de retención" y omitir la generación de comprobante de retención en sus compras |
| **Régimen General** | Sin tope o > USD 300,000 | Factura con IVA, retenciones completas | 101/103/104 mensual/anual | Es el régimen ya cubierto hoy por KallpaPro |

Superar USD 300,000 obliga a transitar al régimen general — el ERP debería poder alertar cuando
los ingresos acumulados del año se acercan al umbral (mejora propuesta en §6).

Fuentes: [Factuplan — RIMPE 2026](https://factuplan.com.ec/blog/rimpe-emprendedores-negocio-popular-ecuador-2026), [Siigo Contífico — RIMPE](https://www.siigo.com/ec/blog/obligaciones-fiscales/rimpe-emprendedores-negocios-populares/), [VerifacturaEC — RIMPE](https://www.verifacturaec.com/guias/sri/regimen-rimpe).

## 5. Formato/extensión de archivo por plataforma gubernamental

Esta es la respuesta directa a "qué tipos de extensiones usan las diferentes plataformas
gubernamentales" — tabla resumen para diseñar los exportadores del ERP:

| Plataforma | Trámite | Formato/extensión exigido | Vía de envío |
|---|---|---|---|
| **SRI — Comprobantes electrónicos** | Factura, NC, ND, guía de remisión, retención | **XML firmado con XAdES-BES** (esquema de la Ficha Técnica vigente — última versión pública identificada: **2.31**, sucesora de 2.26; confirmar versión exacta vigente al implementar cada builder) | Web service SOAP (`RecepcionComprobantesOffline` + `AutorizacionComprobantesOffline`) contra `celcer.sri.gob.ec` (pruebas) / `cel.sri.gob.ec` (producción) — ya detallado en `plan-contabilidad-tributaria-sri.md` §1.1 |
| **SRI — Declaraciones (101, 102, 103, 104)** | Impuesto a la Renta, retenciones, IVA | **Ninguna** — se presentan 100% en línea en el portal "SRI en línea" (formulario web, no archivo). El antiguo DIMM Formularios está obsoleto | Portal web SRI en línea (sesión autenticada con clave o certificado) |
| **SRI — Anexos (ATS, RDEP, REOC, Gastos Personales, Dividendos)** | Anexos informativos | **XML comprimido**, generado por el DIMM Anexos o por un sistema propio que produzca un XML válido contra el esquema oficial del anexo | Subida del archivo XML en el portal SRI en línea |
| **Superintendencia de Compañías (SCVS) — Estados financieros anuales** | Balance/EEFF bajo NIIF + anexos societarios | **PDF** — con restricción técnica explícita: máx. 150 KB por página, escaneado en blanco y negro, resolución máxima 300 ppp | Sistema de Portal SCVS (módulo "Presentación de información financiera y societaria") |
| **SCVS — Anexos societarios** (notas a EEFF, informe del representante legal, informe del comisario, informe de auditoría externa si aplica, nómina de accionistas, acta de junta que aprueba EEFF) | Adjuntos al mismo trámite anual | PDF (mismas restricciones de tamaño/resolución) | Mismo portal |
| **IESS** (referencia — módulo de Nómina, no de Contabilidad) | Planillas de aportes | Generación en línea / archivo plano según trámite | Portal IESS en línea |

Fuentes: [Ficha Técnica Comprobantes Electrónicos — SRI (v2.26/v2.31)](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/ed555352-46c7-4917-9f61-011b6a9f4600/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.26.pdf), [Studocu — Ficha Técnica v2.31](https://www.studocu.com/ec/document/servicio-nacional-de-contratacion-publica/contratacion-publica/ficha-te-cnica-comprobantes-electro-nicos-esquema-offline-versio-n-231/123927844), [Quipuy — DIMM SRI 2026](https://quipuy.com/blog/dimm-sri-que-es-como-instalarlo), [SCVS — Presentación anual de EEFF](https://www.gob.ec/scvs/tramites/presentacion-anual-estados-financieros-anexos), [SCVS — Instructivo bajo NIIF](https://appscvsmovil.supercias.gob.ec/guiasUsuarios/images/guias/info_fin/otros/Instructivo%20bajo%20NIIF.pdf).

## 6. Calendario tributario (referencia — noveno dígito del RUC)

| Noveno dígito | Plazo máximo (mes siguiente) |
|---|---|
| 1 | 10 |
| 2 | 12 |
| 3 | 14 |
| 4 | 16 |
| 5 | 18 |
| 6 | 20 |
| 7 | 22 |
| 8 | 24 |
| 9 | 26 |
| 0 | 28 |

- **Contribuyentes especiales**: día 9 uniforme, independiente del noveno dígito.
- **Sector público**: día 20 uniforme.
- **Galápagos**: día 28 uniforme.
- **Formulario 101** (sociedades, IR anual): abril, según noveno dígito.
- **Formulario 102/102A** (personas naturales, IR anual): marzo, según noveno dígito.
- **RDEP**: enero-febrero, según noveno dígito.
- **Multas**: proporcionales a la fracción básica desgravada / salario básico unificado vigente
  (USD 482 en 2026 según la fuente consultada — confirmar el valor vigente cada año, cambia por
  decreto).

Este calendario debe alimentar recordatorios/alertas en el tablero contable (ya existe un tablero
accionable según `06-contabilidad-vs-mercado.md` §2 — es una extensión natural, no una
funcionalidad nueva desde cero).

Fuente: [Calendario tributario SRI 2026 — Factuplan](https://factuplan.com.ec/blog/calendario-tributario-sri-2026-noveno-digito).

## 7. Backlog de implementación (ordenado por prioridad e impacto legal)

| # | Ítem | Base normativa | Severidad | Dónde probablemente vive | Estado |
|---|---|---|---|---|---|
| 1 | Modelar tabla configurable de porcentajes de retención (IR + IVA) con vigencia (`validFrom/validTo`), reemplazando cualquier porcentaje fijo en `withholding.service.ts` | Resoluciones NAC-DGERCGC (cambian sin aviso largo) | Alta | `withholding.service.ts` | ❌ Propuesta |
| 2 | Soporte de régimen fiscal por empresa (`General` / `RIMPE Emprendedor` / `RIMPE Negocio Popular`) en `CompanyFiscalConfig`, afectando: si se calcula retención de IVA, si se discrimina IVA en factura, y qué tabla de IR anual aplica | LORTI + resoluciones RIMPE | Alta | `CompanyFiscalConfig` (ya planificado en `plan-contabilidad-tributaria-sri.md` Etapa 1) — agregar el campo `regimen` con estos 3 valores explícitos | ❌ Propuesta |
| 3 | Formulario 101 (Impuesto a la Renta sociedades) generado desde el mayor/balance de comprobación, con las conciliaciones tributarias básicas (gastos no deducibles, participación trabajadores 15%, base imponible) | LORTI Art. 10 y RALRTI | Alta | Nuevo, análogo a `reports.service.ts` + los engines de 103/104 ya existentes | ❌ Propuesta |
| 4 | Cálculo del Anticipo de Impuesto a la Renta (Formulario 115) con la fórmula vigente (patrimonio, activos, ingresos, costos y gastos deducibles) | RALRTI, fórmula reformada varias veces — confirmar vigente antes de codificar | Media | Nuevo, se apoya en balance de comprobación ya calculado | ❌ Propuesta |
| 5 | Completar el desglose real de IVA por línea en las facturas (bloqueado hoy por falta de facturación electrónica real) para que el ATS deje de ser una aproximación | Ficha Técnica SRI + LORTI | Alta (ya identificada) | Ya programado como Etapa 7 en `plan-contabilidad-tributaria-sri.md` — **no duplicar aquí, solo referenciar** | 🟡 Ya en el plan de arquitectura |
| 6 | Anexo de Dividendos (ADI) cuando el módulo de patrimonio permita registrar distribución de utilidades a accionistas | LORTI, obligación anual si hay distribución | Media | Nuevo — depende de que exista un módulo de accionistas/capital social | ❌ Propuesta |
| 7 | Alerta de proximidad al umbral RIMPE (USD 300,000 acumulado en el año) para avisar la migración obligatoria a régimen general antes de que ocurra | Resoluciones RIMPE | Media | Tablero contable / `dashboard.service.ts` | ❌ Propuesta |
| 8 | Exportador de Estados Financieros anuales a PDF con las restricciones técnicas exactas de SCVS (máx. 150 KB/página, blanco y negro, 300 ppp) — hoy el Balance/Resultados existen en pantalla pero no hay un exportador que cumpla el formato de subida | Reglamento SCVS de presentación de información | Alta (bloqueante para el trámite anual real) | Nuevo — reusa el generador de PDF de Sprint 5 (RIDE) con perfil de exportación distinto | ❌ Propuesta |
| 9 | Selector de marco NIIF por empresa (NIIF completas / NIIF para PYMES) que ajuste qué notas y revelaciones se exigen en el paquete de estados financieros | Resolución de clasificación SCVS | Media | `CompanyFiscalConfig` (extender) + motor de notas a EEFF (ya identificado como faltante en `06-contabilidad-vs-mercado.md` §3) | ❌ Propuesta |
| 10 | Calendario tributario configurable (noveno dígito + contribuyentes especiales + Galápagos) integrado al tablero de recordatorios | Calendario SRI anual (cambia cada año por resolución) | Media | `dashboard.service.ts` / nuevo `tax-calendar.service.ts` | ❌ Propuesta |
| 11 | Formulario 106 (Múltiple de Pagos) para registrar/generar pagos de multas e intereses ligados a un período fiscal cerrado, dejando trazabilidad contable del gasto no deducible correspondiente | LORTI (multas e intereses no son deducibles) | Baja | Nuevo, bajo uso | ❌ Propuesta |
| 12 | Anexo RDEP y Formulario 107 (relación de dependencia) — evaluar si viven en Contabilidad o se coordinan con el módulo de Nómina existente (`payroll.service.ts`) antes de construir en duplicado | LORTI, obligación anual del empleador | Media | Coordinar con Nómina — **no construir sin revisar `payroll.service.ts` primero** | ❌ Propuesta (requiere decisión de alcance) |

## 8. Qué NO construir todavía (deliberado)

- **Formularios de nicho que no aplican al perfil de cliente objetivo** (ICE-105, activos en el
  exterior-110, tierras rurales-111, regalías mineras-113): construir solo si un cliente real de
  ese sector lo pide — añadirlos hoy es sobre-ingeniería para el mercado pyme B2B general.
- **Presentación automática de declaraciones al portal del SRI o del formulario SCVS**: ya
  documentado como límite deliberado en `plan-contabilidad-tributaria-sri.md` §3 — el SRI no
  ofrece API pública de presentación de declaraciones para terceros (solo de comprobantes
  electrónicos), y la SCVS no confirma una API pública de carga en 2026. KallpaPro genera el
  archivo/formulario listo; la carga al portal la hace el usuario.
- **Multi-jurisdicción fuera de Ecuador**: ya excluido en `06-contabilidad-vs-mercado.md` §5 por
  la misma razón — el foco es el marco fiscal ecuatoriano.

## 9. Fuentes consultadas

- [Guía de utilización de formularios del SRI — Rivadeneira](https://www.rivadeneiraaa.com.ec/es/formularios-para-tramites-legales/guia-de-utilizacion-de-formularios-del-sri)
- [Calendario tributario SRI 2026 por noveno dígito — Factuplan](https://factuplan.com.ec/blog/calendario-tributario-sri-2026-noveno-digito)
- [Anexo RDEP — gob.ec](https://www.gob.ec/sri/tramites/anexo-retenciones-fuente-relacion-dependencia-rdep)
- [Tabla de Retenciones en la Fuente Ecuador 2026 — Siigo Contífico](https://www.siigo.com/ec/blog/obligaciones-fiscales/tabla-de-retenciones-en-la-fuente/)
- [Tabla de retenciones en la fuente Ecuador 2026 — Tributos.org](https://tributos.org/es/herramientas/tabla-retenciones-la-fuente-ecuador-2026)
- [Retenciones Ecuador 2026: tabla actualizada — Deltech Audit](https://deltechaudit.ec/retenciones-ecuador-2026-porcentajes-sri/)
- [Ecuador: Tabla de retenciones en la fuente 2026 — BP One](https://bp-one.com/ecuador-tabla-de-retenciones-en-la-fuente-2026-actualizada-segun-las-ultimas-resoluciones-del-sri/)
- [Tabla de Retenciones IVA e Impuesto a la Renta 2026 — Dergest](https://dergest.com/blog/tablas-retenciones-ecuador-2026.html)
- [Porcentajes de retención en la fuente 2026 — EasyTax EC](https://easytaxec.com/blog/porcentajes-de-retencion-en-la-fuente/)
- [Ficha Técnica Comprobantes Electrónicos Esquema Offline v2.26 — SRI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/ed555352-46c7-4917-9f61-011b6a9f4600/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.26.pdf)
- [Ficha Técnica Comprobantes Electrónicos Offline v2.31 — Studocu](https://www.studocu.com/ec/document/servicio-nacional-de-contratacion-publica/contratacion-publica/ficha-te-cnica-comprobantes-electro-nicos-esquema-offline-versio-n-231/123927844)
- [Instructivo formularios de presentación bajo NIIF — SCVS](https://appscvsmovil.supercias.gob.ec/guiasUsuarios/images/guias/info_fin/otros/Instructivo%20bajo%20NIIF.pdf)
- [Presentación anual de estados financieros y sus anexos — gob.ec/SCVS](https://www.gob.ec/scvs/tramites/presentacion-anual-estados-financieros-anexos)
- [Manual de Usuario Externo — Presentación de Información Financiera y Societaria — SCVS](https://appscvsmovil.supercias.gob.ec/guiasUsuarios/images/guias/info_fin/MANUAL_%20PRESENTACION_INF_FINYSOC.pdf)
- [RIMPE 2026: emprendedores y negocios populares — Factuplan](https://factuplan.com.ec/blog/rimpe-emprendedores-negocio-popular-ecuador-2026)
- [RIMPE Ecuador: Emprendedores vs. Negocios Populares — Siigo Contífico](https://www.siigo.com/ec/blog/obligaciones-fiscales/rimpe-emprendedores-negocios-populares/)
- [Régimen RIMPE Ecuador explicado para contadores — SRIFlow](https://www.sriflow.com/blog/regimen-rimpe-ecuador-explicado-para-contadores/)
- [DIMM del SRI: qué es y cuándo ya no lo necesitas (2026) — Quipuy](https://quipuy.com/blog/dimm-sri-que-es-como-instalarlo)
- [Ficha Técnica Anexo Transaccional Simplificado — SRI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/72d717c2-88ed-47b7-baba-50b87b7198b7/Ficha%20Tecnica%20Transaccional%20Simplificado%20ATS.pdf)
- [Qué es el Anexo Transaccional Simplificado (ATS) 2026 — Naranjilla](https://facturadorsri.com/blog/que-es-anexo-transaccional-simplificado-ats)

## 10. Registro de avance

| Fecha | Ítem | Estado |
|---|---|---|
| 2026-09-11 | Documento creado — investigación de formularios SRI, retenciones, régimen RIMPE, formato de archivo por plataforma (SRI/SCVS) y backlog priorizado de 12 ítems | ✅ |

## Ver también
- [[plan-contabilidad-tributaria-sri|Plan de arquitectura — Contabilidad/Tributaria robusta]] — etapas de facturación electrónica, motor XML/firma/SOAP
- [[propuestas de mejoras de internet/06-contabilidad-vs-mercado|Contabilidad vs. mercado]] — brechas frente a Odoo/SAP/NetSuite
- [[protocolo-mejoras|Protocolo de mejoras]] — cómo se ejecuta y registra cada ítem del backlog §7
