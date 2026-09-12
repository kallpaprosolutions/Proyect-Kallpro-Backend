# 🏠 KallpaPro — Panel de Inicio

> Abre esta nota primero en cada sesión. Los detalles de cada módulo NO están aquí — están
> en [[flujo-trabajo-erp|el router de módulos]], uno por archivo. Esta nota es solo el
> punto de entrada: qué hacer ahora y a dónde ir.
> **Antes de escribir código, revisa [[Bitacora-de-Sesiones|la última entrada de la Bitácora]]**
> — ahí está dónde quedó la sesión anterior.

## 🎯 Prioridades ahora mismo
> ✅ **Las Fases A, B y C completas del plan Odoo 18 están TERMINADAS** (cerradas 2026-09-11:
> UX transversal completa, contable/compras completa, inventario completo). Todo lo que este
> panel listaba antes como pendiente (A3/A5/A2.2/C1/C2/Fase4-5 CxP-CxC) ya está hecho — el
> detalle histórico vive en [[plan-mejoras-odoo18]] §5, marcado ✅ TERMINADO. No lo repitas.

**🔴 Con decisión YA confirmada por el usuario (no preguntar de nuevo, solo seguir la etapa)**:
[[plan-contabilidad-tributaria-sri|Facturación electrónica SRI + cierre de impuestos + NIIF/Supercías]]
— plan de 8 etapas, certificado .p12 disponible. **Etapa 1 (base normativa) sin empezar.**
Este es probablemente el candidato más fuerte a "próximo paso" si no hay otro pedido explícito.

**El resto, sin decisión tomada** (pregunta al usuario antes de arrancar cualquiera):
1. **Fase D** del plan Odoo: D1 company switcher (cambio grande, User↔Company N:M), D2
   dashboard configurable, D3 vista pivot/gráfico. Ver [[plan-mejoras-odoo18]].
2. Brechas puntuales por módulo (ninguna es urgente, son mejoras incrementales) — ver la
   tabla completa en [[flujo-trabajo-erp]] o el CLAUDE.md §7: Form 101 anual + diferidos
   (Contabilidad), comparativo presupuesto-vs-real y consolidación multiempresa (Análisis
   financiero), cuenta contable por producto (Inventario).
3. Deuda técnica: ESLint sin configurar en ambos proyectos; `FinancialPage.tsx` huérfana y
   `POST /sri/:id/pay` (pago legado) candidatos a eliminar juntos — ver [[06-contabilidad]].

> Fuente completa del backlog priorizado: [[plan-mejoras-odoo18]]. Fuente por módulo:
> [[flujo-trabajo-erp]] → cada fila "Mejoras propuestas". Modelos de datos: [[base-de-datos]].

## 🗂️ Accesos directos
- [[Bitacora-de-Sesiones|Bitácora de Sesiones]] — dónde quedó la última sesión y qué sigue.
- [[flujo-trabajo-erp|Router de módulos]] — el ciclo operativo completo + índice a `Modulos/`.
- [[arquitectura-tecnica|Arquitectura técnica]] — stack, capas, RBAC, convenciones (el CÓMO).
- [[base-de-datos|Base de Datos]] — 113 modelos Prisma agrupados por módulo + relaciones clave.
- [[plan-mejoras-odoo18|Plan de mejoras Odoo 18]] — backlog Fase A→D con fechas.
- [[protocolo-documentacion]] / [[protocolo-mejoras]] — cómo se mantiene esto ordenado.
- `Modulos/` — un archivo por módulo (ejecutado / flujo / mejoras propuestas).
- `Documentacion de la Arquitectura Paso a Paso/00-INDICE.md` — histórico por sprint (00–24).
- [[Credenciales/00-ACCESOS-Y-ENTORNO|Credenciales/00-ACCESOS-Y-ENTORNO.md]] — accesos, entorno y cifrado (no se sube a git).
- `Arquitectura KallpaPro/_Archivo/` — borradores legados (v1, propuesta comercial LOGIFI). No es lectura obligatoria.

## ⚙️ Comandos rápidos
```bash
# Backend (puerto 5001 — ver Credenciales/00-ACCESOS-Y-ENTORNO.md) — levantar con preview, no Bash directo
cd Proyect-Kallpro-Backend && npm run dev
npx jest && npx tsc --noEmit

# Frontend (puerto 3001)
cd Proyect-Kallpro-Frontend && npm run dev
npx vitest run && npx tsc --noEmit
```
Login de pruebas: `admin@gmail.com` / `12345678` · BD: Docker `kallpapro-db`, Postgres puerto 5433.

## ⚠️ Trampas conocidas del entorno
- `npx prisma migrate dev` falla con EPERM si nodemon está corriendo → **detén el backend
  antes de migrar**, luego `npx prisma generate` y vuelve a levantarlo.
- La búsqueda global es sensible a acentos ("tornilleria" no encuentra "tornillería") —
  pendiente extensión `unaccent` de PostgreSQL.
- `cmdk` necesita polyfills de `ResizeObserver`/`scrollIntoView` en jsdom (ya están en
  `src/test/setup.ts`).

## 🔄 Flujo de un sprint
1. Leer el archivo del módulo en `Modulos/` que vas a tocar (no el router completo).
2. Backend primero: motor puro + tests → servicio con BD → controlador → ruta.
3. Migración si toca schema (backend detenido antes).
4. Frontend: API wrapper → componente → montaje → test.
5. Verificar: `jest`+`tsc` back, `vitest`+`tsc` front.
6. Probar e2e en el navegador como usuario real.
7. Actualizar el archivo del módulo correspondiente en `Modulos/` (❌→✅), esta nota si
   cambian las prioridades, y **agregar una entrada en [[Bitacora-de-Sesiones]]** al cerrar.

## 📌 Las 7 reglas transversales
Viven en [[flujo-trabajo-erp]] (sección final) — aplican a todo desarrollo nuevo sin excepción.
