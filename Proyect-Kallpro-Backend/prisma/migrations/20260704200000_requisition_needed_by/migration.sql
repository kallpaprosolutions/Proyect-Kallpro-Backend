-- Fecha para la cual se necesita el material de la requisición (deadline operativo, distinto
-- de las fechas de aprobación). Patrón de referencia: "Fecha Límite de Requisición" en Odoo.
ALTER TABLE "requisitions" ADD COLUMN "neededBy" TIMESTAMP(3);
