# Protocolo de Documentación — cómo se mantiene organizado esto

> 📍 Meta-documento: no describe el ERP, describe **cómo documentar el ERP** para que no
> vuelva a desordenarse. Léelo si vas a crear un archivo nuevo o no sabes dónde anotar algo.

## 1. Un solo lugar canónico por tipo de información

| Tipo de información | Dónde va | NO va en |
|---|---|---|
| Qué está ejecutado/pendiente de un módulo de negocio | `Modulos/<archivo>.md` (sección correspondiente) | `flujo-trabajo-erp.md` (eso es solo índice) |
| Cómo está construido el código (capas, patrones, stack) | `arquitectura-tecnica.md` | Dentro de un archivo de `Modulos/` |
| Backlog estratégico inspirado en Odoo/mercado | `plan-mejoras-odoo18.md` | Duplicado dentro de cada módulo (solo referencia cruzada) |
| Cómo correr el proyecto, puertos, secretos | `Credenciales/00-ACCESOS-Y-ENTORNO.md` | Archivos sueltos nuevos en `Credenciales/` |
| Qué se hizo en la última sesión / qué sigue | `Bitacora-de-Sesiones.md` | Memoria de Claude únicamente (la memoria es de Claude, la bitácora es del proyecto y la lee cualquiera) |
| Historia congelada de cómo se construyó (Sprint 1-24) | `Documentacion de la Arquitectura Paso a Paso/` | No se edita retroactivamente — es un registro histórico |

**Regla de oro**: antes de crear un archivo `.md` nuevo, pregúntate si ya existe uno de los
6 de arriba donde esto encaja. Casi siempre la respuesta es sí.

## 2. Cuándo actualizar qué (checklist al terminar una tarea)
1. ¿Cambió el estado de un módulo de negocio (❌→✅, o nueva brecha)? →
   actualiza **solo** el archivo de ese módulo en `Modulos/`.
2. ¿Cambió un patrón estructural (nueva capa, nueva librería base, cambio de convención)? →
   actualiza `arquitectura-tecnica.md`.
3. ¿Se implementó algo del backlog de `plan-mejoras-odoo18.md`? → marca ✅ con fecha en su
   "Registro de avance" (§5 de ese archivo) — no borres la fila, así queda el historial.
4. ¿Cambiaron puertos, variables de entorno o usuarios de prueba? →
   `Credenciales/00-ACCESOS-Y-ENTORNO.md`.
5. **Siempre**, al cerrar una sesión de trabajo real (no una pregunta rápida): agrega una
   entrada en `Bitacora-de-Sesiones.md` — ver [[protocolo-mejoras]] para el formato.
6. Si agregaste o quitaste un MÓDULO completo del ciclo (no un paso dentro de uno
   existente): actualiza la tabla índice de `flujo-trabajo-erp.md`.

## 3. Convenciones de nomenclatura
- Archivos de módulo: `NN-nombre-corto.md` (número = etapa del ciclo en `flujo-trabajo-erp.md`).
- Nunca crear `.md` sueltos en la raíz del proyecto — o van en `Modulos/`, o en
  `Credenciales/`, o son uno de los 5 documentos raíz (`00 - Inicio.md`,
  `Bitacora-de-Sesiones.md`, `CLAUDE.md`, `README.md`, `QUICKSTART.md`).
- Contenido exploratorio/descartado/versiones viejas → `_Archivo/` (dentro de la carpeta
  que corresponda), nunca se borra sin preguntar, pero tampoco se mezcla con lo vivo.
- Usar wikilinks `[[archivo]]` entre documentos de Obsidian — así el grafo refleja
  conexiones reales en vez de quedar disperso (motivo original de esta limpieza).

## 4. Qué NO hacer
- No dupliques una tabla de estado en dos archivos — enlaza, no copies.
- No documentes en un módulo lo que pertenece a otro "por si acaso" — un hecho, un lugar.
- No dejes un documento "vivo" sin fecha de última actualización en el encabezado.
- No generes logs automáticos que nadie lee (ver el hallazgo del hook roto en
  [[../Bitacora-de-Sesiones|Bitácora de Sesiones]], §2026-09-05) — si algo se automatiza,
  verificar primero que funciona.

## Ver también
- [[protocolo-mejoras|Protocolo de documentación de mejoras]]
- [[flujo-trabajo-erp|Router de módulos]]
