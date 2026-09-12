-- Documento sustento (modificado) para notas de crédito/débito de proveedores recibidas por SRI.
-- Viene directo del XML (infoNotaCredito/infoNotaDebito: codDocModificado, numDocModificado,
-- fechaEmisionDocSustento) — ver sri-parser.service.ts.
ALTER TABLE "sri_documents" ADD COLUMN "docModificadoTipo" TEXT;
ALTER TABLE "sri_documents" ADD COLUMN "docModificadoNumero" TEXT;
ALTER TABLE "sri_documents" ADD COLUMN "docModificadoFecha" TIMESTAMP(3);
