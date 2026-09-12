import { AuthRequest } from '../types/index';
import { z } from 'zod';
import * as ai from '../services/ai/structured.service';
import { getChartOfAccounts } from '../services/finance/accounting.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const structuredStatus = asyncHandler(async (_req: AuthRequest, res) => {
  res.json(await ai.aiStructuredPing());
});

export const extractInvoice = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = z.object({ text: z.string().min(10) }).safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Se requiere "text" (mínimo 10 caracteres)', 'VALIDATION_ERROR');
  try {
    res.json(await ai.extractInvoice(parsed.data.text));
  } catch (e: any) {
    throw new AppError('Fallo de extracción IA: ' + (e?.message ?? String(e)), 502, 'AI_EXTRACTION_FAILED');
  }
});

export const suggestAccount = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = z.object({
    description: z.string().min(2),
    candidates: z.array(z.object({ code: z.string(), name: z.string() })).optional(),
  }).safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Se requiere "description"', 'VALIDATION_ERROR');
  try {
    let candidates = parsed.data.candidates;
    if (!candidates || candidates.length === 0) {
      const chart = await getChartOfAccounts(req.user!.companyId);
      candidates = chart.map((c: any) => ({ code: c.code, name: c.name }));
    }
    if (candidates.length === 0) throw AppError.badRequest('No hay plan de cuentas. Inicialízalo primero.', 'NO_CHART_OF_ACCOUNTS');
    res.json(await ai.suggestAccount(parsed.data.description, candidates));
  } catch (e: any) {
    if (e instanceof AppError) throw e; // no envolver validaciones propias
    throw new AppError('Fallo de sugerencia IA: ' + (e?.message ?? String(e)), 502, 'AI_SUGGESTION_FAILED');
  }
});

export const priceAnomaly = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = z.object({
    productName: z.string().min(1),
    newPrice: z.number(),
    historicalPrices: z.array(z.number()).optional(),
  }).safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Se requieren "productName" y "newPrice"', 'VALIDATION_ERROR');
  try {
    res.json(await ai.checkPriceAnomaly({
      productName: parsed.data.productName,
      newPrice: parsed.data.newPrice,
      historicalPrices: parsed.data.historicalPrices ?? [],
    }));
  } catch (e: any) {
    throw new AppError('Fallo de análisis IA: ' + (e?.message ?? String(e)), 502, 'AI_ANALYSIS_FAILED');
  }
});
