import { Request } from 'express';
import {
  getSRIForms,
  getForm104Summary,
  getForm103Summary,
  getCalendarWarnings,
} from '../../services/finance/sri.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';
import { getForm104Casillas, getForm103Casillas } from '../../services/finance/sri-casillas.service';
import { getAccountingPanel } from '../../services/finance/accounting-panel.service';
import { getAtsReport, buildAtsXml } from '../../services/finance/ats.service';
import { getTaxClosingPreview, closeTaxPeriod } from '../../services/finance/tax-closing.service';

const assertPeriod = (period?: string) => {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw AppError.badRequest('Período inválido. Use formato YYYY-MM', 'INVALID_PERIOD');
  }
};

export const getSRIFormsHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const fiscalYear = req.query.year ? Number(req.query.year) : undefined;
  const forms = await getSRIForms(companyId, fiscalYear);
  res.json(forms);
});

export const getForm104Handler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const { period } = req.params;

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw AppError.badRequest('Período inválido. Use formato YYYY-MM', 'INVALID_PERIOD');
  }

  const summary = await getForm104Summary(companyId, period);
  res.json(summary);
});

export const getForm103Handler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const { period } = req.params;

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw AppError.badRequest('Período inválido. Use formato YYYY-MM', 'INVALID_PERIOD');
  }

  const summary = await getForm103Summary(companyId, period);
  res.json(summary);
});

/** Formulario 104 con estructura de casillas SRI (Sprint 11 — declaraciones estilo Odoo). */
export const getForm104CasillasHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  assertPeriod(req.params.period);
  res.json(await getForm104Casillas(companyId, req.params.period));
});

/** Formulario 103 con estructura de casillas SRI (Sprint 11). */
export const getForm103CasillasHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  assertPeriod(req.params.period);
  res.json(await getForm103Casillas(companyId, req.params.period));
});

/** Vista previa del cierre de impuestos (Etapa 6 del plan SRI): sin efectos secundarios. */
export const getTaxClosingPreviewHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  assertPeriod(req.params.period);
  res.json(await getTaxClosingPreview(companyId, req.params.period));
});

/** Cierra los impuestos del período: postea el asiento de liquidación y bloquea el mes. */
export const closeTaxPeriodHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const userId = (req as any).user?.userId;
  assertPeriod(req.params.period);
  res.json(await closeTaxPeriod(companyId, req.params.period, userId));
});

/** ATS (Anexo Transaccional Simplificado) — detalle de compras/ventas/retenciones del período. */
export const getAtsReportHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  assertPeriod(req.params.period);
  res.json(await getAtsReport(companyId, req.params.period));
});

/** ATS en XML (borrador — validar en DIMM Formularios del SRI antes de presentar). */
export const getAtsXmlHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  assertPeriod(req.params.period);
  const xml = await buildAtsXml(companyId, req.params.period);
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="ATS-${req.params.period}.xml"`);
  res.send(xml);
});

/** Tablero contable con contadores accionables (Sprint 11). */
export const getAccountingPanelHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  res.json(await getAccountingPanel(companyId));
});

export const getCalendarWarningsHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const warnings = await getCalendarWarnings(companyId);
  res.json(warnings);
});
