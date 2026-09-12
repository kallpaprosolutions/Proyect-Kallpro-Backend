# Protocolo de Mejoras — ciclo de vida de una mejora propuesta

> 📍 Meta-documento: cómo se propone, se prioriza, se ejecuta y se registra una mejora.
> El contenido REAL del backlog vive en `plan-mejoras-odoo18.md` y en la sección
> "Mejoras propuestas" de cada archivo de `Modulos/` — esto es solo el proceso.

## 1. Ciclo de vida de una mejora
```
❌ Propuesta  →  🟡 En progreso  →  ✅ Ejecutada
```
- **❌ Propuesta**: nace de (a) una brecha detectada al desarrollar algo relacionado,
  (b) un patrón de Odoo que falta (va a `plan-mejoras-odoo18.md`), o (c) feedback directo
  del usuario. Se anota en la sección "Mejoras propuestas" del módulo afectado en `Modulos/`.
- **🟡 En progreso**: se está implementando en la sesión actual. Anótalo así solo si abarca
  más de una sesión; si se completa en la misma sesión, salta directo a ✅.
- **✅ Ejecutada**: cambia el símbolo, agrega **fecha** y el **"Dónde"** (archivo/función real,
  no una descripción vaga). Si vino de `plan-mejoras-odoo18.md`, márcala ✅ ahí también
  (§5 "Registro de avance") sin borrar la fila.

## 2. Dónde se registra cada tipo de mejora
| Origen de la mejora | Se registra en |
|---|---|
| Brecha específica de UN módulo (ej. "falta stock negativo en Inventario") | `Modulos/<módulo>.md` → "Mejoras propuestas" |
| Patrón de Odoo 18 no implementado (afecta UX transversal o un módulo) | `plan-mejoras-odoo18.md` (Fase A-D) + referencia cruzada en el módulo |
| Deuda técnica (no es una feature, es una corrección estructural) | `arquitectura-tecnica.md` o `CLAUDE.md §7`, según si es de patrón o puntual |
| Feedback directo del usuario sobre UX ("esto parece repostería") | Se ejecuta y se documenta en el módulo afectado, citando el feedback como motivo (ej. ver `Modulos/08-analisis-financiero-cxp-cxc.md`, caso CxPWorkbench) |

## 3. Formato de una entrada de "Registro de avance" (en `plan-mejoras-odoo18.md`)
```
| Fecha | Ítem | Estado |
|---|---|---|
| AAAA-MM-DD | Descripción concreta (qué cambió, qué archivo/función, cuántos tests) | ✅ |
```
Una entrada útil dice: motivo (por qué se hizo), qué se construyó (componentes/servicios
reales), y evidencia de verificación (tests pasando, e2e validado). Una entrada inútil solo
dice "se mejoró X" sin dónde ni cómo se comprobó.

## 4. Antes de proponer una mejora nueva
1. Revisa que no exista ya en el módulo afectado o en `plan-mejoras-odoo18.md` (evita
   duplicados con distinto nombre).
2. Si es de UX transversal, revisa el orden recomendado ya definido (A5→A3→...) antes de
   agregarla suelta — las prioridades están en [[../00 - Inicio|00 - Inicio.md]].
3. Si toca dinero/asientos, recuerda la regla transversal 2 (todo pasa por
   `journal.service`) — una mejora que la viole no se acepta tal cual.

## 5. Al cerrar una sesión donde se ejecutó una mejora
Adicional a lo de arriba, agrega una entrada en `Bitacora-de-Sesiones.md` (ver esa nota
para el formato) — el protocolo de mejoras registra el QUÉ técnico, la bitácora registra
el ESTADO de la sesión para continuar después.

## Ver también
- [[protocolo-documentacion|Protocolo de documentación]]
- [[../Bitacora-de-Sesiones|Bitácora de Sesiones]]
- [[../plan-mejoras-odoo18|Plan de mejoras Odoo 18]]
