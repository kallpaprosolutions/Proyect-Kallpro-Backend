# 1. Planificación y presupuesto

> 📍 Módulo **1** del ciclo operativo · [[flujo-trabajo-erp|← Router de módulos]]

## Flujo de trabajo
Presupuesto anual por departamento → punto de reorden en Inventario → control automático
al aprobar cada Requisición/OC en Compras.

## Ejecutado ✅
| Paso | Dónde |
|---|---|
| Presupuesto anual por departamento vs real | Financiero → Presupuestos (`BudgetControl`) |
| Control presupuestario al aprobar compras | `budget.service.checkBudget` |
| Punto de reorden + sugerencias | Inventario (reorder-suggestions) |

## Mejoras propuestas
- 🟡 **Predicción de demanda con IA** — parcial, depende de Ollama opcional (`aiEnabled`).

## Ver también
- [[02-compras|Módulo 2 · Compras]] (consume el presupuesto)
- [[03-inventario|Módulo 3 · Inventario]] (punto de reorden)
