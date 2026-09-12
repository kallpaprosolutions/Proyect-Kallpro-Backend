-- Enlace directo del ajuste de inventario al asiento contable que generó al aplicarse
-- (trazabilidad; patrón de referencia visto en Odoo: "Asientos contables" clickeable
-- desde el propio documento de ajuste de inventario).
ALTER TABLE "inventory_adjustments" ADD COLUMN "journalEntryId" TEXT;
