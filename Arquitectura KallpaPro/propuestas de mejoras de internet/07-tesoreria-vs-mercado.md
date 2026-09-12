# 7. Tesorería — comparación con mejores prácticas de mercado

> 📍 Ubicación: Módulo 7 — Tesorería, dentro de `apps/backend` (servicios `treasury.service`, `bank-movement.service`, `journal.service`) y `apps/frontend` (`/tesoreria/*`).

## 1. Investigación: qué hacen los mejores sistemas de tesorería en 2026

| Práctica | Odoo 18 Accounting/Treasury | SAP Business One | Kyriba (referencia enterprise) | Plataformas de pago locales (Kushki, PayPhone, Deuna) |
|---|---|---|---|---|
| Conciliación bancaria | Bank feeds automáticos (sincronización directa con banco vía Plaid/Ponto en mercados que lo soportan) + "Reconciliation Models" que sugieren match con reglas configurables | Motor de conciliación por lote basado en reglas, menos automatización con IA | Conciliación con matching fuzzy asistido por ML, aprendizaje continuo de patrones de transacción | No aplica directamente (son pasarelas de cobro, no bancos) |
| Cash flow forecasting | Reportes de flujo de caja basados en facturas/pagos programados, sin IA predictiva nativa | Proyección de flujo de caja basada en CxC/CxP con vencimientos | Forecasting con IA/ML sobre series históricas + escenarios "what-if"; es el diferenciador central de la categoría en 2026 | No aplica |
| Gestión multi-cuenta/multi-banco | Múltiples diarios bancarios, dashboard consolidado de saldos | Múltiples cuentas bancarias por sucursal/moneda, consolidación a nivel de compañía | Visibilidad de liquidez global multi-banco/multi-entidad/multi-moneda en tiempo real, con "cash pooling" | No aplica |
| Pagos programados/recurrentes | Pagos por lote, órdenes de pago agrupadas | Propuesta de pago por lote con selección de facturas a vencer | Pagos recurrentes automatizados con reglas y aprobación previa | Cobro recurrente por suscripción vía botón de pago/token de tarjeta |
| Aprobación de pagos móvil | Aprobaciones vía Odoo Approvals, no es un flujo dedicado de tesorería | Flujo de aprobación configurable por monto/rol dentro de SAP B1 | App móvil dedicada para aprobar/rechazar pagos en camino, con biometría del dispositivo | No aplica |
| Archivos de banco / Cash Management | Exportación de archivos de pago genéricos (SEPA en Europa); en LatAm depende de localizaciones | Generación de archivos de pago por banco vía integraciones bancarias locales | Conectividad directa a más de 15,000 bancos vía red propia (Kyriba Payments Network), sin archivos manuales | No aplica (usan API REST propia, no archivos) |
| Open banking / API de pagos | Integraciones limitadas fuera de mercados con open banking maduro | Conectores certificados por banco, generalmente vía partner local | Pionero en open banking multibanco vía APIs certificadas | Kushki/PayPhone ofrecen APIs REST de cobro (botón de pago, tokenización), no de pago masivo a proveedores — el open banking bidireccional (pagos salientes) sigue sin estar disponible en la banca ecuatoriana |
| Revalorización multi-moneda | Ajuste automático de tipo de cambio al cierre contable | Revaluación de moneda extranjera automática en el cierre de período | Gestión de riesgo FX con cobertura y revalorización en tiempo real | No aplica |

### Prácticas confirmadas por la investigación

**Cash flow forecasting con IA**
- El consenso 2026 (Kognitos, ChatFin, Transformance) es que el forecasting de caja pasó de ser "extrapolación de historial" a modelos que combinan series de tiempo con eventos conocidos (facturas por vencer, nómina programada, impuestos) para proyectar saldo de caja a 30/60/90 días con bandas de confianza, y alertar proactivamente sobre riesgo de iliquidez antes de que ocurra.
- La tendencia es agentes de IA que generan el forecast pero un humano (tesorero/CFO) lo valida antes de tomar decisiones — no reemplazo total del criterio financiero.

**Conciliación bancaria automática con matching fuzzy**
- El estado del arte (Optimus, Atlar, ReconArt) usa matching difuso: no solo importe exacto, sino combinación de monto ± tolerancia, fecha ± ventana de días, y similitud de texto en la glosa/beneficiario, con score de confianza. Transacciones con score alto se auto-concilian; las de score medio se sugieren para aprobación humana (aceptar/rechazar); las de score bajo quedan pendientes de revisión manual.
- Este patrón de "sugerencia con score + aceptar/rechazar" es exactamente el patrón humano-en-el-loop que KallpaPro ya usa en su CRM — es el patrón correcto a replicar aquí, no una automatización ciega.

**Gestión de liquidez multi-cuenta/multi-banco**
- Kyriba y plataformas equivalentes centran su propuesta de valor en dar visibilidad consolidada de saldos across bancos y monedas en un solo dashboard, con drill-down por cuenta — esto es aplicable a pymes con 3-5 cuentas bancarias en distintos bancos ecuatorianos, no solo a multinacionales.

**Pagos programados y aprobación móvil**
- Los pagos recurrentes (nómina, arriendos, servicios) con aprobación previa configurable por monto/rol son estándar en SAP B1 y Kyriba. La aprobación desde app móvil (con notificación push cuando un pago espera aprobación) es un diferenciador de experiencia que reduce fricción para gerentes que viajan.

**Cash Management por archivo bancario y open banking**
- Confirmado: en Ecuador (Achek, MN Desarrollo Web, NM Tech Studio) las pasarelas de pago como Kushki, PayPhone y Deuna exponen API REST solo para el lado de **cobro** (botón de pago, links de pago, QR), no para pagos masivos salientes a proveedores — la banca ecuatoriana empresarial tradicional (Pichincha, Produbanco, etc.) sigue operando sobre archivos planos de carga masiva (Cash Management) en sus portales de banca empresarial, confirmando que el diseño de adaptador por archivo + futuro conector de cobro vía Kushki/PayPhone es la estrategia correcta para este mercado, no un salto directo a open banking bidireccional que el sistema bancario local aún no ofrece.

**Fuentes**
- [Overview of Kyriba Liquidity Performance Platform](https://www.kyriba.com/resources/insights/liquidity-performance-platform/)
- [Intelligent treasury and cash management solutions — Kyriba](https://www.kyriba.com/products/treasury/)
- [Kyriba APIs for Treasury Management: 3 Powerful Pillars](https://www.kyriba.com/resource/kyriba-apis/)
- [Centralize enterprise-wide payments with Kyriba Payments](https://www.kyriba.com/resource/payments-network/)
- [Kyriba: Comprehensive 2026 Guide to Treasury Management, Payments, and Working Capital Solutions](https://successknocks.com/kyriba-comprehensive-2026-guide-to-treasury/)
- [Bank reconciliation — Odoo 18.0 documentation](https://www.odoo.com/documentation/18.0/applications/finance/accounting/bank/reconciliation.html)
- [Reconciliation models — Odoo 18.0 documentation](https://www.odoo.com/documentation/18.0/applications/finance/accounting/bank/reconciliation_models.html)
- [Bank and cash accounts — Odoo 18.0 documentation](https://www.odoo.com/documentation/18.0/applications/finance/accounting/bank.html)
- [Comprehensive Guide to Finance in Odoo 18.0](https://www.cleverence.com/articles/odoo-documentation/finance-odoo-documentation-4827/)
- [The Top AI Cash Flow Forecasting Tools for Treasury Teams (2026) | Kognitos](https://www.kognitos.com/blog/top-ai-cash-flow-forecasting-tools-treasury-2026/)
- [Best AI Treasury Management & Cash Forecasting Tools 2026 | ChatFin](https://chatfin.ai/blog/best-ai-treasury-management-cash-forecasting-tools-2026/)
- [Treasury AI: Cash Flow Forecasting Agents for the CFO 2026 | ChatFin](https://chatfin.ai/guide/treasury-ai-cash-flow-forecasting-agents-for-the-cfo-2026/)
- [Cash Forecasting Tools Compared: 8 Options for 2026 | Transformance](https://www.transformance.ai/blog-posts/cash-forecasting-tools-compared-8-options-for-2026)
- [AI for Account Reconciliations: A Practical Guide](https://www.learnsignal.com/blog/ai-for-account-reconciliations/)
- [5 AI Reconciliation Tools Built for Modern Accounting in 2026 | Optimus](https://optimus.tech/blog/ai-reconciliation-tools-for-modern-accounting)
- [Fuzzy Matching Algorithms in Bank Reconciliation: When Exact Match Fails | Optimus](https://optimus.tech/blog/fuzzy-matching-algorithms-in-bank-reconciliation-when-exact-match-fails)
- [How AI Is Changing Bank Reconciliation | Atlar](https://www.atlar.com/guides/how-ai-is-changing-bank-reconciliation)
- [Fuzzy matching in financial reconciliation | ReconArt](https://www.reconart.com/blog/fuzzy-matching-in-financial-reconciliation/)
- [Automated Treasury Payment Solution | HighRadius](https://www.highradius.com/product/treasury-payment-solutions/)
- [The New Mobile Treasury: Why Your CFO Needs a Mobile-First Strategy Now | Ripple Treasury](https://treasury.ripple.com/posts/treasury-mobile-app)
- [Centralized Payment Workflow & Approval Software For Treasury Payments | HighRadius](https://www.highradius.com/software/treasury-risk/treasury-payment/payment-workflow-and-approval/)
- [Approval Flows | Payment Authorisation Workflows | Embat](https://www.embat.io/corporate-payments/approval-flows)
- [Botón de Pagos en Ecuador: Comparativa 2026 (Payphone vs. Kushki vs. PlaceToPay) | Achek](https://achek.ec/boton-de-pagos-en-ecuador-comparativa-2026-payphone-vs-kushki-vs-placetopay/)
- [Pasarelas de Pago Ecuador 2026: PayPhone, Kushki y Datafast Comparados | NM Tech Studio](https://www.nmtechstudio.com/blog/pasarelas-pago-ecuador-2026-comparativa)
- [Deuna para Negocios Ecuador 2026: QR, Botón de Pago y Web | NM Tech Studio](https://www.nmtechstudio.com/blog/deuna-para-negocios-cobrar-qr-web-ecuador-2026)

## 2. Nuestro estado actual (KallpaPro)

- Cuentas bancarias con catálogo de 21 instituciones ecuatorianas (bancos privados, públicos, cooperativas) + código SWIFT/BIC verificado para las principales. Soporta cuentas en el exterior (`isForeign`) que exigen SWIFT/BIC en cada pago.
- Movimiento bancario tipado (ingreso/egreso, transferencia/cheque/efectivo/SWIFT/tarjeta) vinculado a su origen: nómina, factura CxP, factura CxC, impuesto SRI, impuesto IESS, o manual — y a su asiento contable.
- Flujo de "Obligaciones" (pagos pendientes): consolida CxP con saldo, nómina en estado POSTED pendiente de pago, e impuestos SRI/IESS pendientes, todo con su fecha de vencimiento normativa (SRI según noveno dígito del RUC, IESS día 15).
- Flujo de "Ingresos esperados" (cobros pendientes): CxC con saldo y fecha de vencimiento.
- Ejecutar un pago o cobro dispara automáticamente el efecto en su módulo de origen (marca nómina como pagada, actualiza saldo de factura, etc.) y el asiento contable, todo enlazado y trazable. Un movimiento con asiento no se puede anular desde Tesorería (hay que reversar el asiento en Contabilidad).
- Reportería gerencial de Ingresos & Egresos: serie mensual desde las cuentas contables 4x/5x.
- Diseño ya preparado (pero no construido) para adaptadores bancarios futuros: archivo de Cash Management (CSV por banco), Open Banking, o pasarela de pago (Kushki/PayPhone para cobros).

## 3. Diagnóstico: brechas frente al mercado

| Brecha | Impacto | Confirmado por investigación |
|---|---|---|
| Sin subcuentas bancarias en el plan de cuentas (todo el efectivo va a una cuenta contable genérica) | Imposible ver el saldo contable real por banco/cuenta sin reconciliar manualmente contra el módulo de tesorería | Sí — Odoo, SAP B1 y Kyriba modelan cada cuenta bancaria como su propia subcuenta contable, condición previa para consolidación multi-banco confiable |
| Sin generación de archivos de Cash Management por banco (Pichincha/Produbanco) | Los pagos masivos (nómina, proveedores) se siguen cargando manualmente al portal bancario | Sí — confirmado que la banca ecuatoriana empresarial sigue dependiendo de archivos planos, por lo que este es el gap de automatización de mayor impacto inmediato |
| Sin conciliación bancaria automática (importar estado de cuenta + match automático) | Alto esfuerzo manual mensual, riesgo de discrepancias no detectadas a tiempo | Sí — es la categoría de innovación más activa en 2026 (matching fuzzy con score de confianza) |
| Sin revalorización contable de multi-moneda | Cuentas en el exterior (`isForeign`) acumulan diferencial cambiario sin ajuste automático al cierre | Sí — Odoo y SAP B1 lo hacen de forma nativa en el cierre de período |
| Sin forecasting de flujo de caja proyectado (solo reportería histórica) | El gerente no tiene visibilidad de saldo proyectado a 30/60/90 días combinando Obligaciones + Ingresos esperados | Sí — es el diferenciador #1 de la categoría de tesorería moderna |
| Sin aprobación de pagos por rol/monto antes de ejecutar | Riesgo de control interno: cualquier usuario con acceso a Tesorería puede ejecutar un pago sin doble validación | Sí — SAP B1 y Kyriba tratan el flujo de aprobación como funcionalidad núcleo, no opcional |
| Sin pagos/cobros recurrentes programados | Pagos repetitivos (arriendo, servicios) se registran manualmente cada mes | Sí — es estándar en plataformas de tesorería medianas y grandes |

## 4. Propuestas de mejora

### Flujo de trabajo
- Implementar **conciliación bancaria semiautomática**: importar el estado de cuenta (CSV/Excel del banco) y correr un motor de matching por score (monto ± tolerancia, fecha ± ventana, similitud de glosa) contra los movimientos ya registrados; matches de score alto se auto-concilian, los de score medio se muestran como sugerencia para aceptar/rechazar (mismo patrón ya usado en CRM), y los de score bajo quedan para registro manual.
- Añadir **flujo de aprobación de pagos por monto/rol** antes de la ejecución: un pago sobre un umbral configurable pasa a estado PENDIENTE_APROBACION y requiere un segundo usuario (ej. Gerencia Financiera) antes de generar el movimiento y el asiento — reutilizando el patrón de máquina de estados que ya funciona en Nómina (doble aprobación).
- Habilitar **pagos y cobros recurrentes**: plantillas de obligación/ingreso que se regeneran automáticamente cada período (arriendo, servicios básicos, cuotas de préstamo) alimentando el flujo de "Obligaciones" sin captura manual repetida.
- Construir el **conector de generación de archivo Cash Management** (formato Pichincha/Produbanco) como primer adaptador real, aprovechando el diseño ya preparado — es el gap de mayor impacto/menor esfuerzo confirmado por el mercado local.

### Sistema de organización / configuración
- Modelar **subcuentas contables por cuenta bancaria** (una subcuenta 1.1.02.xxx por cada cuenta bancaria registrada) en lugar de la cuenta genérica de caja/bancos, permitiendo conciliación contable directa banco-por-banco.
- Configurar **reglas de tolerancia de matching** (monto, días, similitud de texto) como parámetro de empresa ajustable, no como constante de código — igual que el motor de reglas salariales propuesto en Nómina.
- Definir **umbrales de aprobación de pago por rol y monto** como tabla de configuración (ej. Tesorería puede ejecutar hasta $500, Gerencia Financiera sin límite), reutilizable también en Compras a futuro.
- Diseñar el **catálogo de tasas de cambio con vigencia** para soportar la futura revalorización multi-moneda al cierre.

### Experiencia de usuario (frontend operativo)
- **Dashboard de liquidez consolidada**: saldo actual por cada cuenta bancaria en una sola vista (estilo Kyriba), con total consolidado y variación proyectada a 30 días combinando Obligaciones e Ingresos esperados ya existentes.
- **Vista de conciliación con aceptar/rechazar**: pantalla estilo "bandeja de sugerencias" donde el usuario revisa cada match propuesto por el motor de conciliación con su score de confianza visible, un clic para aceptar o rechazar — consistente con el patrón visual que KallpaPro ya usa en CRM.
- **Bandeja de pagos pendientes de aprobación** visible para el rol aprobador, con notificación al entrar un pago que supera el umbral — extensión natural del calendario/bandejas ya usados en Nómina.
- **Widget de proyección de caja** (30/60/90 días) en el dashboard principal de Tesorería, mostrando la curva de saldo proyectado con las obligaciones e ingresos ya registrados como eventos conocidos (sin necesidad de IA todavía, solo agregación temporal).

### Actualizaciones futuras (mercado emergente / IA)
- **Cash flow forecasting con IA**: una vez exista suficiente historial, incorporar un modelo simple de proyección (además de la agregación determinística de obligaciones/ingresos conocidos) que estime variabilidad y alerte de riesgo de iliquidez con anticipación — siempre con validación humana antes de cualquier decisión.
- **Conector de cobro vía Kushki/PayPhone/Deuna** para que las facturas CxC generen automáticamente un link o botón de pago, y la confirmación de cobro cierre el ciclo en Tesorería sin conciliación manual.
- **Matching de conciliación con aprendizaje continuo**: que el motor de score ajuste sus pesos según las decisiones de aceptar/rechazar del usuario a lo largo del tiempo (feedback loop simple, no necesariamente ML complejo desde el día uno).
- **Revalorización cambiaria automática** al cierre de período para cuentas en el exterior, generando el asiento de diferencial cambiario sin intervención manual.
- Explorar **app móvil ligera (PWA)** para aprobación de pagos en movimiento, siguiendo el patrón de "mobile-first treasury" confirmado como tendencia 2026.

## 5. Qué NO tocar

- **Open banking bidireccional (pagos salientes vía API bancaria)**: confirmado por la investigación que la banca ecuatoriana empresarial no expone estas APIs hoy; construir esa integración sería trabajo especulativo sin banco que lo soporte — mantener el adaptador por archivo Cash Management como estrategia principal.
- **Cash pooling multi-entidad y gestión de riesgo FX con coberturas (hedging) al estilo Kyriba**: son funcionalidades de tesorería corporativa multinacional; ninguna pyme objetivo de KallpaPro opera múltiples entidades legales con necesidad de barrido de saldos entre cuentas propias ni instrumentos de cobertura cambiaria.
- **Red de conectividad bancaria propia (tipo Kyriba Payments Network con 15,000+ bancos)**: es una infraestructura de nivel enterprise que requiere acuerdos bancarios directos; fuera de alcance y de necesidad para el mercado ecuatoriano de pymes, donde 21 instituciones ya cubren el universo relevante.
- **IA generativa para "asesoría financiera conversacional"**: es funcionalidad de marketing en plataformas grandes; el valor real y accionable para esta pyme está en la conciliación semiautomática y el forecasting simple, no en un chatbot financiero.
- **Módulo de gestión de deuda/instrumentos financieros complejos (bonos, derivados)**: no aplica al perfil de pyme/mediana empresa B2B ecuatoriana; el alcance de Tesorería debe mantenerse en cuentas bancarias, pagos, cobros y conciliación.
