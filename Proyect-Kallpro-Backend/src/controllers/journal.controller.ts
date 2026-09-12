import { AuthRequest } from '../middleware/auth.middleware';
import * as svc from '../services/journal.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';
import { sendCsv } from '../utils/csv.helper';

export const listJournalEntries = asyncHandler(async (req: AuthRequest, res) => {
  const q = req.query as Record<string, string>;

  // Modo avanzado (Sprint 6): con `page` o `format=csv` usa la búsqueda con
  // filtros ricos + paginación. Sin ellos, respuesta legada (array plano).
  if (q.page || q.format === 'csv') {
    const filters: svc.JournalSearchFilters = {
      q: q.q, accountCode: q.accountCode, entityType: q.entityType, status: q.status,
      from: q.from, to: q.to,
      minAmount: q.minAmount ? Number(q.minAmount) : undefined,
      maxAmount: q.maxAmount ? Number(q.maxAmount) : undefined,
      page: q.page ? Number(q.page) : 1,
      pageSize: q.format === 'csv' ? 200 : (q.pageSize ? Number(q.pageSize) : 50),
    };
    if (q.format === 'csv') {
      // Export completo (hasta 5000 líneas): páginas de 200 hasta agotar
      const rows: unknown[][] = [];
      let page = 1;
      let result;
      do {
        result = await svc.searchJournalEntries(req.user!.companyId, { ...filters, page });
        for (const e of result.items) {
          for (const l of e.lines) {
            rows.push([
              e.entryNumber, new Date(e.entryDate).toISOString().slice(0, 10), e.status,
              e.entityType ?? '', e.description, l.accountCode, l.accountName,
              Number(l.debit), Number(l.credit), l.description ?? '',
            ]);
          }
        }
        page++;
      } while (page <= result.pages && rows.length < 5000);
      sendCsv(res, `libro-diario.csv`,
        ['Asiento', 'Fecha', 'Estado', 'Origen', 'Descripción', 'Cuenta', 'Nombre cuenta', 'Debe', 'Haber', 'Detalle'],
        rows);
      return;
    }
    res.json(await svc.searchJournalEntries(req.user!.companyId, filters));
    return;
  }

  const { entityType, entityId, from, to, status } = q;
  const entries = await svc.getJournalEntries(req.user!.companyId, { entityType, entityId, from, to, status });
  res.json(entries);
});

export const getJournalEntry = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const entry = await svc.getJournalEntryById(req.params.id, req.user!.companyId);
    res.json(entry);
  } catch (e: any) {
    if (e?.message?.includes('no encontrado')) throw AppError.notFound(e.message, 'NOT_FOUND');
    throw e;
  }
});

export const postEntry = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const { entityType, entityId } = req.params;
    const entry = await svc.autoPostEntry(req.user!.companyId, entityType, entityId);
    res.status(201).json(entry);
  } catch (e: any) {
    if (e?.message?.includes('no encontrad')) throw AppError.notFound(e.message, 'NOT_FOUND');
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST'); // default original: 400
  }
});
