-- Fix del costeo FIFO/LIFO (doc 23): el costo unitario real del despacho se captura en la
-- línea del envío para que la factura de ese envío contabilice el COGS exacto (capas
-- consumidas), en vez de aproximar con product.avgCost. 0 = envíos legados (fallback a avgCost).
ALTER TABLE "shipment_items" ADD COLUMN "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0;
