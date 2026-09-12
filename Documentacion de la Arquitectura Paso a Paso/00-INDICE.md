# KallpaPro — Índice de Documentación

> Documentación de arquitectura para respaldo, migración de PC y continuidad entre sesiones.
> **Actualizado: 2026-07-23 (cierre del Sprint 12).**

---

## ⚠️ Empieza por aquí

1. **`/CLAUDE.md`** (raíz del proyecto) — se carga solo en cada sesión: estado actual, las 7
   reglas transversales, comandos, trampas del entorno y backlog priorizado.
2. **`Arquitectura KallpaPro/flujo-trabajo-erp.md`** — documento maestro **VIVO**: el ciclo
   completo del ERP con estado ✅/🟡/❌ por etapa. Se lee antes de desarrollar y se actualiza al terminar.
3. Esta carpeta es el **histórico por sprint** (cómo se construyó cada cosa y por qué).

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Runtime | Node.js | 20.x |
| Backend | Express.js + TypeScript | 4.18 / 5.x |
| ORM | Prisma | 5.22 |
| Base de datos | PostgreSQL (Docker `kallpapro-db`, puerto **5433**) | 15-alpine |
| Autenticación | JWT + bcrypt + 2FA (TOTP) | 9.x / 2.x |
| Frontend | React + TypeScript | 18.x |
| Build tool | Vite (puerto 3001) | 5.x |
| Estilos | Tailwind CSS (design system propio) | 3.x |
| Estado global | Zustand · máquinas de estado XState | 4.x / 5.x |
| Permisos | CASL | 7.x |
| Paleta de comandos | cmdk | 1.x |
| Tests | Jest (backend) · Vitest + RTL (frontend) | — |
| OS / Shell | Windows 11 / PowerShell | — |

---

## Mapa de Documentación

### Documentos vivos — `Arquitectura KallpaPro/`
| Archivo | Contenido |
|---|---|
| `flujo-trabajo-erp.md` | **Maestro.** Ciclo completo dinero→mercadería→dinero, estado por etapa, 7 reglas transversales |
| `plan-mejoras-odoo18.md` | Plan A1→D1 inspirado en Odoo 18 + hallazgos de la exploración en vivo de la instancia QA (§6) + registro de avance |
| `calidad-produccion-iso-arcsa.md` | Producción y calidad: ISO 9001, ISO 22000/HACCP y ARCSA; reglas duras y backlog |
| `tesoreria-nomina-biometrico.md` | Tesorería, nómina Ecuador 2026 y asistencia biométrica |

### Histórico por sprint — esta carpeta
| # | Archivo | Contenido |
|---|---------|-----------|
| 00 | `00-INDICE.md` | Este archivo |
| 01 | `01-ARQUITECTURA-GENERAL.md` | Diagrama, módulos, patrones de diseño |
| 02 | `02-CONFIGURACION-ENTORNO.md` | Instalación desde cero en Windows |
| 03 | `03-BASE-DE-DATOS.md` | Schema Prisma, modelos, migraciones |
| 04 | `04-MODULO-AUTH.md` | Autenticación JWT, registro, login |
| 05 | `05-MODULO-INVENTARIO.md` | Productos, bodegas, kardex, promedio ponderado |
| 06 | `06-MODULO-COMPRAS.md` | Órdenes de compra, proveedores, recepción |
| 07 | `07-MODULO-FINANCIERO.md` | Facturas internas, cuentas por cobrar/pagar |
| 08 | `08-MODULO-SRI.md` | Facturas electrónicas Ecuador, parseo PDF/XML |
| 09 | `09-FRONTEND-ESTRUCTURA.md` | Rutas, auth store, cliente Axios |
| 10 | `10-FRONTEND-MODULOS.md` | Páginas, componentes, patrones UI |
| 11 | `11-CREDENCIALES-Y-CONEXIONES.md` | Contraseñas y URLs |
| 12 | `12-PROMPTS-PARA-RECREAR.md` | Prompts para recrear módulo por módulo |
| 13 | `13-ERRORES-Y-SOLUCIONES.md` | Errores encontrados y sus soluciones |
| 14 | `14-PROMPTS-MAESTROS.txt` | Prompts en texto plano |
| 15 | `15-SKILLS-Y-PLUGINS.txt` | Skills reutilizables |
| 16 | `16-PLAN-DE-MEJORAS-Y-FLUJO-DE-TRABAJO.md` | Plan Maestro V3 reconciliado al código real |
| 17 | `17-SPRINT-1.5-Y-BACKLOG-TECNICO.md` | Cierre de calidad del P0 (numeración, singleton Prisma, tests) |
| 18 | `18-SPRINT-2-PRICELIST-WITHHOLDING-2FA.md` | Listas de precios, retenciones de venta, 2FA + sesiones |
| 19 | `19-SPRINT-6-CONTABILIDAD.md` | Contabilidad Pro: períodos fiscales, balanza v2, roles Auditor/Tributario |
| 20 | `20-REVISION-ODOO-FACTURAS-NC.md` | Referencia Odoo (facturas/NC) + documento sustento en Notas de Crédito |
| 21 | `21-REVISION-ODOO-INVENTARIO.md` | Referencia Odoo (inventario) + trazabilidad asiento/movimiento en ajustes |
| 22 | `22-REVISION-ODOO-REQUISICIONES.md` | Referencia Odoo (requisiciones); el flujo de KallpaPro ya es superior |
| 23 | `23-AUDITORIA-INVENTARIO-BACKLOG-Y-ERRORES.md` | Auditoría de código + bug de costeo FIFO/LIFO (**ya corregido**) |
| 24 | `24-SPRINTS-7-A-12-...md` | **Sprints 7–12**: tests front, nómina, tesorería + conciliación, UX Odoo (Ctrl+K/smart buttons/chatter), declaraciones SRI por casillas, calidad en producción |

---

## Estado del Proyecto — 2026-07-23

**Tests: backend 173/173 · frontend 72/72 · `tsc --noEmit` limpio en ambos proyectos.**

### Módulos implementados y validados e2e
- [x] Autenticación multi-tenant, RBAC con 19 roles, 2FA y sesiones revocables
- [x] Inventario multibodega: kardex, costeo AVG/FIFO/LIFO **por capas reales**, lotes y
      vencimientos, ubicaciones físicas, conteo físico, ajustes con doble autorización
- [x] Compras: requisiciones, RFQ, comparativo ponderado, aprobación multinivel L1–L5,
      OC con anticipo, recepción, portal de proveedores
- [x] SRI Ecuador: parseo PDF/XML, 3-way match, retenciones
- [x] Ventas: cotización → pedido → despachos parciales → factura, notas de crédito, POS,
      listas de precios, PDF de factura y NC
- [x] Logística: envíos, tracking, eventos
- [x] **Producción con calidad** (ISO 9001 · ISO 22000/HACCP · ARCSA): lote y vencimiento,
      costeo real, asiento de transformación, inspecciones, liberación de lote, CAPA, trazabilidad
- [x] Contabilidad NIIF: plan Supercías, diario/mayor/balanza, cierres de período,
      flujo de efectivo NIC 7, **declaraciones SRI por casillas (104/103)**, tablero accionable
- [x] Nómina Ecuador 2026 + asistencia biométrica
- [x] Tesorería: bancos con SWIFT, flujo de pagos/cobros, **conciliación bancaria** auto y semiauto
- [x] CRM: pipeline, contactos, oportunidades, pronóstico
- [x] UX transversal: búsqueda global Ctrl+K, smart buttons, chatter

### Pendiente (ver `/CLAUDE.md` §7 para el backlog completo)
- [ ] B1 · Detección de facturas de compra duplicadas
- [ ] A5 · Vistas kanban · A3 · Actividades programadas · A2.2 · Log de cambios en el chatter
- [ ] C1 · Reabastecimiento entre bodegas · C2 · Panel de operaciones de inventario
- [ ] ATS, activos fijos y depreciación, cierre de impuestos automático
- [ ] Facturación electrónica SRI (XML firmado + autorización)
- [ ] ESLint sin configuración en ambos proyectos (deuda técnica)

---

## Rutas del proyecto en este PC

```
Raíz:     C:\Users\ACER\OneDrive\Documentos\Archivos Claude\Proyect-Kallpro
Backend:  ...\Proyect-Kallpro-Backend      (puerto 5000)
Frontend: ...\Proyect-Kallpro-Frontend     (puerto 3001)
Docs vivos:  ...\Arquitectura KallpaPro
Histórico:   ...\Documentacion de la Arquitectura Paso a Paso
Base de datos: Docker `kallpapro-db` → PostgreSQL en localhost:5433
Login de pruebas: admin@gmail.com / 12345678
```
