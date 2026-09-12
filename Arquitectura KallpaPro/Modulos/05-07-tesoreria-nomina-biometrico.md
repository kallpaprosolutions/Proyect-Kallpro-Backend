# Arquitectura — Tesorería, Nómina y Asistencia Biométrica (Sprints 8–9)

> 📍 Módulos **5 (Nómina + Biométrico)** y **7 (Tesorería)** del ciclo operativo · [[flujo-trabajo-erp|← Router de módulos]]
> Fecha: julio 2026 · Estado: implementado y probado e2e. Ampliado 2026-09-02 con Calendario de TTHH (ver §-final).
> Este documento describe cómo se conectan los módulos a nivel de base de datos
> y qué queda preparado para futuras mejoras (APIs bancarias, biométrico en línea).

## 1. Visión: quién hace qué

| Módulo | Responsabilidad |
|---|---|
| **Contabilidad** | Parte contable, control interno, NIIF/NIC, plan de cuentas, cierres fiscales, ingreso de facturas de compra (CxP) y plazos de pago a proveedores. |
| **Ventas** | Vender el stock del sistema, fechas de cobro a clientes (dueDate de facturas) → flujo de ventas. |
| **Nómina** | Pagos al personal con todos los beneficios sociales (normativa Ecuador 2026) + horas del biométrico. |
| **Tesorería** | Ejecución del dinero: bancos, pagos (CxP, nómina, impuestos), cobros (CxC), SWIFT al exterior, flujo de caja por vencimientos. |
| **Financiero** | Decisiones gerenciales: cartera, presupuestos, flujo, **Ingresos & Egresos** (cuentas 4x/5x del diario). |

## 2. Modelo de datos (PostgreSQL · Prisma)

Todas las tablas son multi-tenant (`companyId` → `companies`, cascade delete).

### Tesorería
```
bank_accounts        cuenta bancaria (bankCode del catálogo, accountNumber, swiftCode/BIC,
                     iban, isForeign, openingBalance). Saldo = apertura + Σingresos − Σegresos.
bank_transactions    movimiento (INGRESO|EGRESO · TRANSFERENCIA|CHEQUE|EFECTIVO|SWIFT|TARJETA).
                     Vínculos de integración:
                       sourceType/sourceId → PAYROLL (payroll_periods) | AP_INVOICE/AR_INVOICE
                       (invoices) | TAX_SRI | TAX_IESS | MANUAL
                       journalEntryId → journal_entries (asiento generado)
```

### Nómina (Sprint 8)
```
employees            categoría JEFATURA|ASISTENTE|SERVICIOS, departmentId → departments
                     (mismo catálogo que Presupuestos/Requisiciones), flags de mensualización
                     de décimos y fondos de reserva, cargas y gastos proyectados (rebaja IR).
payroll_periods      DRAFT → PROCESSED → POSTED → PAID · journalEntryId + paymentEntryId.
payslips / payslip_lines   rol individual con líneas EARNING|DEDUCTION|EMPLOYER.
payroll_novelties    horas extras, bonos, anticipos, préstamos IESS, pensiones, multas.
attendance_records   marcaciones biométricas (1 por empleado/día, upsert idempotente).
```

## 3. Flujos integrados

### 3.1 Obligaciones (flujo de pagos) — `GET /api/treasury/obligations`
1. **CxP**: `invoices` tipo PURCHASE con saldo (`totalAmount − paidAmount`) y su `dueDate` (lo ingresa Contabilidad).
2. **Nómina**: `payroll_periods` en POSTED → neto pendiente (Σ `payslips.netPay`).
3. **Impuestos**: saldo contable de `2010701` (SRI) y `2010703` (IESS) desde `journal_entry_lines`.
   Vencimientos normativos: SRI según 9.º dígito del RUC (día 10…28; especiales día 9), IESS día 15
   (`src/data/bancosEcuador.ts → sriDueDay / IESS_DUE_DAY`).

### 3.2 Ingresos esperados (flujo de ventas) — `GET /api/treasury/receivables`
`invoices` tipo SALES con saldo y `dueDate` (lo pone Ventas al facturar).

### 3.3 Ejecución de un pago/cobro — `POST /api/treasury/transactions`
Cada movimiento dispara el efecto en su módulo Y el asiento contable, todo enlazado:
- `PAYROLL` → `payroll.payPeriod()` (marca PAID + asiento DR 2010704 / CR 10101)
- `AP_INVOICE` → `payment.createPayment()` (actualiza paidAmount/estado) + asiento DR AP / CR CASH
- `AR_INVOICE` → `payment.createPayment()` + asiento DR CASH / CR AR
- `TAX_SRI` / `TAX_IESS` → asiento DR 2010701|2010703 / CR CASH
- `MANUAL` → solo movimiento bancario (conciliación posterior)
Todos los asientos usan la numeración AST- atómica y **respetan los cierres de período fiscal**.
Un movimiento con asiento NO se puede anular desde Tesorería (hay que reversar el asiento en Contabilidad).

### 3.4 Biométrico → horas extras (normativa CT)
1. Importa CSV del reloj (`POST /api/treasury/attendance/import`): `cedula;fecha;entrada;salida`
   (formato de export estándar ZKTeco). Descuenta 1h de almuerzo en jornadas > 5h.
2. Clasificación por día (`attendance.service.classifyDay`):
   lun–vie > 8h → **suplementarias +50%** · sábado/domingo → **extraordinarias +100%**.
3. `POST /attendance/apply-overtime {year,month}` → crea `payroll_novelties` etiquetadas
   `[Biométrico]` (idempotente: borra las previas del período) → el rol se recalcula con
   hora = sueldo/240 y los recargos legales.

### 3.5 Reportería gerencial — `GET /api/treasury/income-expense`
Serie mensual: ingresos = Σ(haber−debe) cuentas `4*`, egresos = Σ(debe−haber) cuentas `5*`
(excluye asientos REVERSED). UI: Financiero → pestaña **📈 Ingresos & Egresos**.

## 4. Integración bancaria (nacional y exterior)

- **Catálogo** (`src/data/bancosEcuador.ts`): 21 instituciones (bancos privados, públicos,
  cooperativas) con BIC verificado para los principales (PICHECEQ, GUAYECEG, PACIECEG,
  PRODECEQ, BBOLECEG, BINTECEQ, CITIECEQ…).
- **Exterior**: cuentas `isForeign` exigen SWIFT/BIC; los pagos con método `SWIFT` exigen el
  BIC del banco destino y guardan la referencia (MT103).
- **Realidad del mercado**: los bancos ecuatorianos NO exponen APIs públicas de pagos; el canal
  operativo es la banca empresarial (carga de archivos de Cash Management). El diseño deja el
  punto de extensión listo:

```
  Obligación → registerTransaction() ──→ BankTransaction (+ asiento)
                                   └──→ [FUTURO] BankAdapter.dispatch(tx)
       adapters posibles: CashManagementFileAdapter (CSV por banco),
       OpenBankingAdapter (cuando exista), ButtonPSPAdapter (Kushki/PayPhone para cobros)
```

## 4.5 Calendario de TTHH (2026-09-02, ampliado 2026-09-04)

Agenda real en `/nomina/calendario` (`HrCalendarPage.tsx`, `react-big-calendar` + `date-fns`), tres audiencias:
- **TTHH** (rol nuevo, `Subject: 'HR'` con `manage` completo): ve turnos/biométrico/permisos de toda la
  empresa, aprueba solicitudes en última instancia, gestiona plantillas de turno (`ShiftTemplate`) y
  asignaciones (`ShiftAssignment`, reprogramables por drag-and-drop).
- **Jefatura directa** (`Employee.managerId`, auto-relación): ve a su equipo, aprueba primero las
  solicitudes de sus reportes directos.
- **Resto de colaboradores**: solo su propio calendario; solicitan permisos/vacaciones (`LeaveRequest`).

**Doble aprobación** (máquina de estados pura, `leave.service.ts`, testeada sin BD):
`PENDIENTE_JEFATURA → PENDIENTE_TTHH → APROBADO` (o `RECHAZADO` en cualquier etapa). Sin `managerId`, salta
directo a `PENDIENTE_TTHH`. Visibilidad resuelta en `hr-scope.service.ts` (`hasFullHrAccess`,
`resolveVisibleEmployeeIds`, `getOwnEmployeeId`).

**2026-09-04 — vincular `Employee` a un `User` del ERP**: `updateEmployee`/`createEmployee`
(`payroll.service.ts`) aceptan `userId` con validación de unicidad (un `User` solo puede representar a un
`Employee` por empresa — si no, `resolveVisibleEmployeeIds`/`getOwnEmployeeId` serían ambiguos). Nuevo
endpoint `GET /payroll/employees/linkable-users` y selector "Usuario del sistema" en `EmployeesPage.tsx`.
Validado e2e con 3 usuarios reales logueados por separado en el navegador (colaborador → jefatura → TTHH).
De paso se corrigió un bug real: el rol **TTHH faltaba en el selector de "Nuevo Usuario"**
(`src/pages/admin/UsersPage.tsx`) — el backend lo soportaba pero no se podía crear un usuario TTHH desde la
interfaz.

## 4.6 Organigrama visual (2026-09-06)

Submódulo nuevo `/nomina/organigrama` (`OrgChartPage.tsx`), inspirado en Miro/Odoo pero sin
tabla nueva: el árbol se arma a partir de datos que **ya existían** (`Employee.managerId`,
`Employee.departmentId`, `Employee.position`) — cero migración.

- **Endpoints propios, separados de "Empleados"** (`GET/PUT /payroll/org-chart[/:id]`,
  declarados en `payroll.routes.ts` **antes** del `router.use(requireRole(PAYROLL_ROLES))`
  general, mismo patrón que `hr-calendar.routes.ts`): `getOrgChart` devuelve una vista recortada
  del empleado (sin cédula, sueldo ni datos de tributación — TTHH no debe ver información
  salarial) más `canEdit` calculado server-side según el rol de quien pide (`ORG_CHART_EDIT_ROLES
  = ['ADMIN','TTHH']`), igual que `canManage` en `GET /hr/calendar`. `ORG_CHART_VIEW_ROLES`
  añade TTHH a los roles de nómina existentes para la vista; `ORG_CHART_EDIT_ROLES` es más
  angosto — la reasignación de jefe (`PUT /org-chart/:id`) solo la aceptan ADMIN y TTHH.
- **Árbol** (`buildOrgForest` en `src/lib/orgChartTree.ts`, frontend, con tests unitarios):
  agrupa empleados por `managerId`; un empleado cuyo jefe no está en la lista (inactivo o
  inexistente) se dibuja como raíz, así el árbol nunca queda roto por un dato huérfano.
  Tarjetas con color por departamento (`departmentColor`, hash determinístico del id) y
  anillo por categoría (JEFATURA/ASISTENTE/SERVICIOS); nodos colapsables.
- **Editar / Guardar / Cancelar / Imprimir** (2026-09-06, feedback directo del usuario tras la
  primera versión: el arrastre persistía en cada suelta, sin forma de deshacer un movimiento
  accidental). El árbol es de solo lectura por defecto; "✏️ Editar" (visible solo si
  `canEdit`) clona el estado a un borrador local y habilita el arrastre — cada suelta solo
  cambia el borrador en memoria, nada llega al backend todavía. "💾 Guardar (N)" envía en
  paralelo un `PUT /org-chart/:id` por cada empleado cuyo `managerId` cambió respecto al
  borrador original (diff simple, no hay endpoint batch); "Cancelar" descarta el borrador sin
  tocar el servidor. "🖨️ Imprimir" es `window.print()` con `print:hidden` en los controles.
  El cliente además bloquea visualmente soltar sobre el propio empleado o sus descendientes
  (`collectDescendants`) — el servidor sigue siendo la barrera real.
- **Motor de ciclos** (`src/services/payroll/engines/org-chart.engine.ts`, backend,
  `wouldCreateCycle`, con tests): antes solo se validaba "no ser jefe de uno mismo" — el
  organigrama visual hace mucho más fácil arrastrar sin querer una tarjeta sobre un
  descendiente (ciclo indirecto), así que `updateEmployee` ahora recorre la cadena de jefes
  completa antes de aceptar el cambio.
- Sidebar: ítem "Organigrama" visible con `anySubject: ['Accounting', 'HR']` (nuevo campo en
  `NavItem`, OR entre subjects CASL) — antes un ítem solo podía declarar un `subject`, y
  Organigrama necesita ambos (roles de nómina vía `Accounting`, TTHH vía `HR`).

## 4.7 B2 — Import de extracto por archivo con preset de banco (2026-09-10)

La conciliación bancaria (ítem 3 de este backlog, cerrado desde Sprint 9.1) solo aceptaba
pegar texto en un formato fijo propio (`fecha;descripción;referencia;monto`) — el usuario tenía
que reformatear a mano el export real de su banco antes de pegarlo. Ahora `ReconciliationPanel`
acepta subir el archivo real:

- Motor puro `bank-statement-parser.engine.ts` (9 tests): detecta columnas por una lista amplia
  de alias en español (no depende de acertar el nombre EXACTO de la cabecera, que cambia entre
  versiones del portal bancario) — presets **Pichincha** y **Produbanco** (fecha DD/MM/AAAA,
  columna de valor con signo o débito/crédito separados) + **Genérico** (preserva el formato
  fijo anterior, sin encabezado, para no romper nada) + parser **OFX/QFX** (formato SGML típico
  de bancos, tags a menudo sin cierre).
- `POST /treasury/reconciliation/import-file` parsea el texto del archivo y llama a la MISMA
  función `reconciliation.importStatement` que ya existía — cero lógica de conciliación
  duplicada, el parser solo produce la forma `StatementLineInput[]` que el matcher automático/
  semiautomático de Sprint 9.1 ya consumía.
- UI: selector de preset + zona de carga de archivo (`.csv/.txt/.ofx/.qfx`, detecta OFX por
  extensión); el textarea de pegar texto se conserva plegado como fallback "Genérico".
- Verificado e2e real: un CSV con encabezado `Fecha,Concepto,Referencia,Valor` y fechas
  `DD/MM/AAAA` importado con el preset Pichincha se parseó y concilió correctamente contra una
  cuenta bancaria real (líneas visibles en el panel con fecha/monto/referencia exactos).

## 4.8 Participación de utilidades — 15% (2026-09-11)

Art. 97 del Código del Trabajo: 10% entre todos los trabajadores en proporción al tiempo
trabajado en el año, 5% en proporción a las cargas familiares (también ponderado por tiempo),
tope individual de 24 SBU (Ley de Justicia Laboral) con el excedente reportado para el IESS.
Motor puro `utilidades.engine.ts` (`computeUtilidades`/`daysWorkedInYear`, con tests
verificados a mano, no solo redondos) + `payroll/utilidades.service.ts` (toma los empleados
con relación laboral en el año — activos o salidos dentro del ejercicio — y sus
`familyBurdens` ya registrados en la ficha). Panel colapsable en `/nomina` (`GET
/payroll/utilidades?year&profit`): **solo calcula, no contabiliza** — es de referencia para
que el contador arme el asiento manual o lo use como insumo del acta de reparto. Verificado
e2e real con los 3 empleados demo: $100,000 de utilidad líquida → $15,000 a repartir ($10,000
por tiempo + $5,000 por cargas), tabla por trabajador con días trabajados y cargas exactos.

## 5. Futuras mejoras (backlog priorizado)
1. **Subcuentas bancarias en el plan** (1010102 Bancos por cuenta) — hoy todo va a la cuenta
   CASH del posting setup (10101); mapear cada `bank_accounts` a su subcuenta contable.
2. Generación de archivos Cash Management por banco (formato Pichincha/Produbanco) para pagos masivos.
3. Feriados nacionales en `classifyDay` (hoy solo fines de semana son extraordinarias) y
   jornada nocturna (+25%).
4. Conector biométrico en línea (ZKTeco SDK / push HTTP) en lugar de CSV manual.
5. Multi-moneda completa: hoy se guarda `currency` + `exchangeRate`; falta revalorización contable.
6. Décimos acumulados: liquidación automática en agosto (XIV sierra) y diciembre (XIII).
7. Más presets de banco a demanda (Banco Guayaquil, Bolivariano...) — el motor ya soporta
   agregar uno nuevo solo con su lista de alias de columna, sin tocar el resto del código.
