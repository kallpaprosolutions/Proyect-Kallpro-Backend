# 5. Nómina + Asistencia Biométrica — comparación con mejores prácticas de mercado

> 📍 Ubicación: Módulo 5 — Nómina, dentro de `apps/backend` (servicios `payroll.service`, `attendance.service`, `journal.service`) y `apps/frontend` (`/nomina/*`, `/nomina/calendario`).

## 1. Investigación: qué hacen los mejores sistemas de nómina y HR en 2026

| Práctica | Odoo 18 HR/Payroll | BambooHR | Rippling | Sistemas locales EC (Nominapp, Aleluya-EC, TAGLINE, Peigo) |
|---|---|---|---|---|
| Self-service del empleado | Portal ESS (`website_hr_ess`) para ver recibo, solicitar ausencias, actualizar datos personales desde móvil | Portal fuerte de "employee self-service", firma digital de documentos, app móvil nativa | Portal + app móvil, "Rippling Recognition", solicitud de time-off con aprobación automática por política | La mayoría ofrece portal web básico; pocos tienen app móvil nativa |
| Payroll-as-a-Service / motor de reglas | Reglas salariales (`hr.salary.rule`) configurables por país, estructura salarial versionable | Motor de reglas por estado/país (EE.UU.), integraciones con proveedores de nómina tercerizados | Motor "Rippling Unity" que corre nómina, beneficios, TI e impuestos desde una sola base de datos de empleado; cálculo de impuestos multi-estado automático | Modelo SaaS por número de empleados, actualizaciones normativas automáticas incluidas en la suscripción (valor central del pitch comercial) |
| Cumplimiento normativo automatizado | Localización EC no oficial vía comunidad/partners; reglas se deben mantener manualmente | Cumplimiento fuerte en EE.UU., limitado fuera | Motor de compliance en tiempo real: cambia automáticamente cuando cambia una ley laboral o tasa de impuesto | Es su propuesta de valor #1: mantienen el motor de cálculo de IESS/SRI/código de trabajo actualizado como servicio administrado |
| Biométrico / asistencia | Integración con terminales vía módulos de terceros o API; check-in/check-out manual nativo | Integraciones con relojes vía partners; horas trabajadas sincronizadas a nómina | Rippling tiene su propio hardware de reloj biométrico (Rippling Time Clock) con sincronización en tiempo real a nómina | Integraciones directas con ZKTeco/Suprema vía SDK o webhook, no solo CSV |
| Analítica de ausentismo | Reportes básicos de dashboard RRHH | Dashboards de ausentismo, rotación, tendencias por departamento | Analítica avanzada con IA: predicción de rotación, alertas de patrones de ausentismo | Reportes de asistencia/ausentismo por período, poco análisis predictivo |
| Calendario / turnos | Vista de calendario de asistencia y ausencias, planificación de turnos en módulo separado (Planning) | Calendario de equipo, vista de ausencias superpuesta | Rippling Scheduling con drag-and-drop, reglas de turno automáticas y alertas de choque de horario | Generalmente no tienen módulo de calendario visual de turnos |
| Aprobación de solicitudes | Flujo de aprobación configurable (1 o 2 niveles) vía Odoo Approvals | Flujo de aprobación por manager, notificaciones push | Flujo de aprobación configurable por política, con escalamiento automático | Aprobación simple (jefe directo), pocos con doble aprobación jerárquica |
| Liquidación de beneficios locales (décimos, fondos de reserva) | No nativo para Ecuador; requiere localización de terceros | No aplica (EE.UU.) | No aplica directamente, soporta configuración de "supplemental pay" genérica | Es funcionalidad núcleo: liquidación automática de decimotercero (diciembre) y decimocuarto (Sierra/Amazonía: marzo: Costa/Galápagos: agosto), con provisión mensual opcional |

### Prácticas confirmadas por la investigación

**Self-service y experiencia móvil**
- El estándar de mercado 2025-2026 es que el empleado nunca necesite pedirle un PDF a RRHH: descarga su propio rol de pagos, ve su historial de vacaciones/permisos y solicita ausencias desde el celular, con notificación push al aprobador. Rippling y BambooHR lo tratan como tabla de apuestas mínima, no como diferenciador.
- Firma digital de documentos (contrato, políticas, finiquitos) integrada al mismo portal.

**Payroll-as-a-Service y compliance automatizado**
- La tendencia dominante para 2026 (Paychex, ADP, ChatFin) es "compliance-as-a-feature": el proveedor de nómina absorbe el riesgo regulatorio actualizando automáticamente tasas, topes y fórmulas legales sin que el cliente tenga que parchear su sistema. Para jugadores locales ecuatorianos (Nominapp, Aleluya, TAGLINE) esto es el argumento de venta #1 frente a hojas de Excel.
- Multi-jurisdicción: motores como el de Rippling calculan impuestos de nómina automáticamente según el estado/país del empleado sin configuración manual del usuario final.

**Biométrico en tiempo real**
- El estado del arte ya no es "importar CSV al final del día": es webhook/push desde el reloj o SDK en tiempo real, de forma que el registro de marcación aparece en el sistema segundos después del check-in, permitiendo alertas de tardanza en vivo y dashboards de "quién está en planta ahora".
- Reconciliación automática entre el reloj y el calendario de turnos planificado (si el empleado marcó pero no tenía turno asignado, se genera una excepción para revisión humana).

**Analítica de ausentismo con IA**
- Los líderes ya ofrecen predicción de ausentismo/rotación basada en patrones históricos (ausencias recurrentes los lunes, cerca de fin de mes, etc.), no solo reportes descriptivos.

**Cumplimiento normativo Ecuador 2026 (confirmado por fuentes locales)**
- El Código de Trabajo ecuatoriano distingue explícitamente tres recargos sobre horas trabajadas fuera de la jornada ordinaria: horas suplementarias (+50%, de lunes a sábado hasta las 24h00, dentro de las primeras 4 horas adicionales), horas extraordinarias (+100%, aplican en días de descanso obligatorio —sábado/domingo— y feriados, o pasada la medianoche en día laborable), y el recargo nocturno (+25% adicional) para toda jornada ordinaria trabajada entre 19h00 y 06h00, sea o no hora extra — esto es distinto e independiente del recargo por hora extra.
- El salario básico unificado 2026 confirmado por fuentes es de $482, base para el cálculo de la hora ordinaria (sueldo/240) y de los décimos.
- Decimocuarto sueldo: se liquida y paga hasta el 15 de marzo en Sierra y Amazonía, y hasta el 15 de agosto en Costa y Galápagos (confirmado, con provisión mensual opcional durante el año). Decimotercero: se liquida hasta el 24 de diciembre, calculado sobre todo lo percibido entre diciembre del año anterior y noviembre del año en curso.
- El noveno dígito del RUC sigue determinando la fecha de vencimiento de declaraciones SRI (dato ya usado en el módulo de Tesorería, relevante también para el cronograma de obligaciones patronales).

**Fuentes**
- [Odoo HR & Payroll | Capabilities & Review (2026) | ERP Research](https://www.erpresearch.com/erp/odoo/hr-payroll)
- [Odoo - Employee Self Service | Odoo Apps Store](https://apps.odoo.com/apps/modules/18.0/website_hr_ess)
- [Discover Odoo 18's HR Module: Transforming Employee Management | Wan Buffer](https://wanbuffer.com/blogs/odoo-18s-hr-module-new-features-that-transform-employee-management/)
- [Odoo Payroll 2026 – HR & Payroll Automation](https://bssuniversal.com/odoo-payroll-features-benefits/)
- [Rippling vs. BambooHR: 2025 Definitive Comparison for HCM and Payroll | Rippling](https://www.rippling.com/blog/rippling-vs-bamboohr-hcm-payroll-comparison)
- [Honest Rippling Payroll Review 2026 | Rippling](https://www.rippling.com/blog/rippling-payroll-review)
- [Rippling vs. BambooHR Comparison: Which Is Best in 2026?](https://www.business.com/articles/rippling-vs-bamboohr/)
- [Top 8 Payroll Trends That Will Shape 2026 | Leapsome](https://www.leapsome.com/blog/payroll-trends)
- [12 Payroll Industry Trends To Watch for 2026 | Paychex](https://www.paychex.com/articles/payroll-taxes/new-year-payroll-trends)
- [The 2026 HR Trends Small Businesses Can't Ignore | ADP](https://www.adp.com/spark/articles/2026/03/the-2026-hr-trends-small-businesses-cant-ignore.aspx)
- [9 HR Technology Trends for 2026 | Paychex](https://www.paychex.com/articles/hcm/technology-trends-in-hr)
- [Nuevo salario básico de $482 en Ecuador... 2026 | El Diario](https://www.eldiario.ec/?p=208335)
- [Recargo Nocturno vs. Horas Extras Ecuador 2026 | Tagline Soluciones](https://tagline-soluciones.com/blog/talento-humano/recargo-nocturno-ecuador-calculo/)
- [Cálculo de horas extras Ecuador 2026: Guía completa | Tagline Soluciones](https://tagline-soluciones.com/blog/talento-humano/calculo-de-horas-extras-ecuador/)
- [Jornada Laboral en Ecuador 2026 | FiniquitoJusto](https://finiquitojusto.com/derechos-laborales/jornada-laboral-ecuador/)
- [Horas Extra Ecuador 2026: Cálculo, 50% y 100% | FiniquitoJusto](https://finiquitojusto.com/derechos-laborales/horas-extras-calculo-ecuador/)
- [Leyes sobre horas extras en Ecuador | Código de Trabajo — Jibble](https://www.jibble.io/es/legislacion-laboral/ecuador/horas-extras)
- [Décimo cuarto sueldo 2026 Ecuador: cálculo y fecha de pago | El Diario](https://www.eldiario.ec/ecuador/decimo-cuarto-sueldo-ecuador-pago-calculo-03082026/)
- [Décimo cuarto sueldo en Ecuador: ¿cambió la fecha de pago en la Sierra y Amazonía? | El Diario](https://www.eldiario.ec/negocios/decimo-cuarto-sueldo-ecuador-fecha-pago-sierra-amazonia-2026-27062026/)
- [¿Hasta cuándo se paga el décimo cuarto sueldo en Ecuador...? | Primicias](https://www.primicias.ec/economia/decimo-cuarto-sueldo2026-marzo-fecha-calculo-ecuador-116637/)
- [Cómo calcular el decimocuarto sueldo en Ecuador 2026 | Peigo](https://www.peigo.com.ec/blog/como-calcular-el-decimocuarto-sueldo-en-ecuador)
- [Décimo Cuarto Sueldo 2026: Cuándo se Paga, Valor $482 y Cálculo | Tagline Soluciones](https://tagline-soluciones.com/blog/talento-humano/decimo-cuarto-sueldo/)

## 2. Nuestro estado actual (KallpaPro)

- Empleados por categoría (Jefatura/Asistente/Servicios), con flags de mensualización de décimos y fondos de reserva, cargas familiares y gastos proyectados para rebaja de Impuesto a la Renta.
- Período de nómina: DRAFT → PROCESSED → POSTED → PAID, con asiento contable y asiento de pago vinculados.
- Rol de pagos individual con líneas de ingreso/deducción/aporte patronal.
- Novedades: horas extra, bonos, anticipos, préstamos IESS, pensiones alimenticias, multas.
- Asistencia biométrica: importación de CSV del reloj biométrico (formato ZKTeco), 1 registro por empleado/día, idempotente.
- Clasificación automática de horas extra: lunes-viernes después de 8h = suplementarias +50%; sábado/domingo = extraordinarias +100%. Descuenta 1h de almuerzo en jornadas >5h.
- Cálculo automático: hora = sueldo/240 + recargos legales, generado como novedad de nómina marcada [Biométrico], idempotente por período.
- Calendario de RRHH (`/nomina/calendario`, con react-big-calendar): plantillas de turno y asignaciones reprogramables por arrastrar-soltar. Tres audiencias: TTHH (ve todo, aprueba en última instancia), jefatura directa (ve a su equipo, aprueba primero), colaborador (ve solo lo suyo).
- Doble aprobación de solicitudes de permiso: máquina de estados PENDIENTE_JEFATURA → PENDIENTE_TTHH → APROBADO/RECHAZADO; sin jefe directo salta a TTHH directo.
- Vinculación de un Employee a un User del sistema (login real), probado con 3 usuarios reales en 3 roles distintos.

## 3. Diagnóstico: brechas frente al mercado

| Brecha | Impacto | Confirmado por investigación |
|---|---|---|
| No se calcula el recargo nocturno (+25%) independiente del recargo por hora extra | Sub-liquidación legal para turnos nocturnos (ej. seguridad, producción 24h) — riesgo laboral/legal directo | Sí — es una obligación distinta y acumulable, no cubierta por la lógica actual de suplementarias/extraordinarias |
| Feriados nacionales no se contemplan en la clasificación de horas extra (solo se distingue fin de semana) | Trabajar en feriado debería recargar +100% aunque caiga en día laborable — hoy se calcularía como suplementaria (+50%) por error | Sí — el feriado equivale a día de descanso obligatorio para efectos de recargo |
| Sin liquidación automática de décimos acumulados | Proceso manual en marzo/agosto (decimocuarto) y diciembre (decimotercero), alto riesgo de error humano y de fechas | Sí — es funcionalidad núcleo en soluciones ecuatorianas competidoras (Nominapp, Aleluya, Peigo) |
| Biométrico solo por CSV manual, sin push en tiempo real | Retraso operativo, no hay alertas de tardanza en vivo ni visibilidad de "quién está en planta ahora" | Sí — el estándar de mercado 2026 es webhook/SDK en tiempo real |
| Sin portal de autoservicio del empleado para descargar su propio rol de pagos o ver su historial | Carga administrativa innecesaria en TTHH para tareas repetitivas de bajo valor | Sí — es tabla de apuestas mínima en Odoo ESS, BambooHR y Rippling |
| Sin analítica de ausentismo (tendencias, predicción) | Se pierden señales tempranas de rotación o abuso de permisos | Sí — Rippling y BambooHR ya lo ofrecen como estándar, no como premium |
| Motor de reglas legales "hardcodeado" en vez de configurable/versionado | Cada cambio normativo (como el ajuste de salario básico o fechas de décimos) requiere intervención de desarrollo | Sí — el modelo payroll-as-a-service depende de que las reglas sean datos versionados, no lógica fija |

## 4. Propuestas de mejora

### Flujo de trabajo
- Incorporar el **recargo nocturno (+25%)** como cálculo independiente y acumulable sobre el recargo de hora extra correspondiente, aplicado a todo minuto trabajado entre 19h00 y 06h00 detectado en el registro biométrico.
- Añadir un **catálogo de feriados nacionales y locales de Ecuador** (mantenible por año, con feriados trasladables por decreto) que la clasificación de horas extra consulte antes de aplicar +50%/+100%: si la fecha es feriado, siempre +100% sin importar el día de la semana.
- Construir el **proceso de liquidación de décimos** como un nuevo tipo de "período especial" dentro del mismo flujo DRAFT → PROCESSED → POSTED → PAID que ya existe para nómina mensual, reutilizando el motor de asientos contables: decimocuarto con corte por región (Sierra/Amazonía vs. Costa/Galápagos) y decimotercero con acumulado diciembre-noviembre.
- Agregar una etapa de **excepción de marcación**: si el biométrico registra un check-in sin turno asignado en el calendario de RRHH (o viceversa), generar una tarea de revisión para el jefe directo en vez de solo importar el dato ciego.

### Sistema de organización / configuración
- Externalizar las fórmulas legales (recargos, décimos, fondos de reserva, topes IESS) a una **tabla de "reglas salariales" versionada por vigencia** (similar a `hr.salary.rule` de Odoo), de modo que un cambio de ley (ej. nuevo salario básico $482, o cambio de fecha de décimo) se resuelva con un registro de configuración y no con un despliegue de código.
- Definir el **catálogo de feriados** como configuración de empresa (año, tipo nacional/local, si es trasladable), editable por TTHH sin intervención técnica.
- Modelar el **calendario de turnos con soporte de turno nocturno explícito** (hora inicio/fin que cruza medianoche) para que el recargo nocturno se calcule sobre la jornada planificada, no solo sobre el registro crudo del reloj.

### Experiencia de usuario (frontend operativo)
- **Portal de autoservicio del empleado** dentro del rol "colaborador" ya existente en `/nomina`: descarga de su propio rol de pagos en PDF, historial de vacaciones/permisos, saldo de vacaciones acumulado, todo sin pasar por TTHH.
- **Dashboard de asistencia en vivo** para jefatura/TTHH: quién marcó entrada hoy, tardanzas del día, excepciones pendientes de revisión — aprovechando el mismo calendario de react-big-calendar ya construido, agregando una vista "hoy" tipo tablero.
- **Widget de analítica de ausentismo** en el dashboard de TTHH: ausencias por departamento/mes, empleados con patrones recurrentes (ej. ausencias los lunes), como serie de tiempo simple — no requiere IA todavía, solo agregación de los datos que ya se capturan.
- Notificación push/email al aprobador cuando una solicitud de permiso entra a su bandeja (hoy la máquina de estados existe pero conviene confirmar que dispara notificación, no solo cambio de estado silencioso).

### Actualizaciones futuras (mercado emergente / IA)
- **Conector biométrico en tiempo real** (webhook o SDK ZKTeco) como reemplazo gradual del CSV manual, manteniendo el CSV como plan de contingencia/respaldo.
- **Predicción de ausentismo con IA humano-en-el-loop**: modelo simple que marque empleados con probabilidad alta de ausencia futura (basado en historial), mostrado como sugerencia al jefe directo, no como decisión automática — mismo patrón que KallpaPro ya usa en CRM (sugerir/aceptar/rechazar).
- **Firma digital de documentos laborales** (contrato, políticas, finiquito) integrada al portal de autoservicio, evitando el ciclo de imprimir-firmar-escanear.
- Explorar app móvil ligera (PWA) para marcación por geolocalización/selfie como respaldo del biométrico físico para personal de campo o ventas externas, siguiendo el patrón de Rippling Time Clock.

## 5. Qué NO tocar

- **Motor de nómina multi-país / multi-moneda al estilo Rippling**: KallpaPro opera pymes ecuatorianas con nómina 100% en dólares y bajo un único código de trabajo; construir un motor de reglas por país/estado añade complejidad sin cliente que la use.
- **Hardware propio de reloj biométrico (como Rippling Time Clock)**: las pymes ecuatorianas ya tienen inversión hundida en relojes ZKTeco/Suprema; KallpaPro debe seguir integrando con hardware existente, no vender ni fabricar terminal propio.
- **Módulo de beneficios (seguros médicos, 401k, stock options) al estilo BambooHR/Rippling**: no existe ese mercado de beneficios flexibles en la pyme ecuatoriana promedio; el beneficio relevante (IESS, décimos, fondos de reserva) ya está cubierto por el módulo actual.
- **IA generativa para "redactar políticas de RRHH" o chatbots de HR**: es una funcionalidad de marketing en las plataformas grandes con bajo uso real reportado; no es prioritario frente a las brechas normativas concretas (recargo nocturno, feriados, décimos) que si generan riesgo legal inmediato.
- **Compliance multi-jurisdicción como servicio administrado global**: KallpaPro no necesita replicar el modelo de ADP/Paychex de "seguimos 50 jurisdicciones por ti" — con mantener actualizado el motor de reglas ecuatoriano (como configuración, no como código) es suficiente para el mercado objetivo.
