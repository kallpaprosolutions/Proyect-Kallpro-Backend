/**
 * Activos fijos y depreciación (B4 del plan de mejoras). El registro del activo NO
 * contabiliza la adquisición (eso ya lo hace la factura de compra por su cuenta); genera el
 * asiento MENSUAL de depreciación en línea recta vía journal.service, auto-posteado
 * (status POSTED, como el resto de asientos automáticos del sistema — no hay "revisión"
 * humana para una depreciación de rutina). Sin cron: se dispara bajo demanda, mismo patrón
 * perezoso que las facturas recurrentes (B3).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { getNextDocumentNumber } from '../../utils/sequence.helper';
import { createDepreciationEntry } from '../journal.service';
import {
  FIXED_ASSET_CATEGORIES, FixedAssetCategory, computeDueDepreciationPeriods, computeMonthlyDepreciation, periodKey,
} from './engines/fixed-asset.engine';

export interface FixedAssetInput {
  name: string;
  category: FixedAssetCategory;
  acquisitionDate: Date;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeYears: number;
  supplierId?: string | null;
  notes?: string;
}

function assertValidAssetInput(data: FixedAssetInput) {
  if (!data.name?.trim()) throw new Error('VALIDATION: el nombre del activo es obligatorio');
  if (!FIXED_ASSET_CATEGORIES[data.category]) throw new Error(`VALIDATION: categoría no reconocida (${data.category})`);
  if (!(data.acquisitionCost > 0)) throw new Error('VALIDATION: el costo de adquisición debe ser mayor a cero');
  if (data.residualValue < 0) throw new Error('VALIDATION: el valor residual no puede ser negativo');
  if (data.residualValue >= data.acquisitionCost) throw new Error('VALIDATION: el valor residual debe ser menor al costo de adquisición');
  if (data.usefulLifeYears < 0) throw new Error('VALIDATION: la vida útil no puede ser negativa');
  if (data.category !== 'TERRENO' && data.usefulLifeYears === 0) throw new Error('VALIDATION: solo los terrenos pueden tener vida útil 0 (no deprecian)');
}

export async function listFixedAssets(companyId: string) {
  return prisma.fixedAsset.findMany({
    where: { companyId },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getFixedAssetById(id: string, companyId: string) {
  const asset = await prisma.fixedAsset.findFirst({
    where: { id, companyId },
    include: { supplier: { select: { id: true, name: true } } },
  });
  if (!asset) return null;
  const entries = await prisma.journalEntry.findMany({
    where: { companyId, entityType: 'FIXED_ASSET', entityId: id },
    select: { id: true, entryNumber: true, entryDate: true, totalDebit: true, description: true },
    orderBy: { entryDate: 'desc' },
  });
  return { ...asset, depreciationEntries: entries };
}

export async function createFixedAsset(companyId: string, data: FixedAssetInput, actorId?: string) {
  assertValidAssetInput(data);
  if (data.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, companyId } });
    if (!supplier) throw new Error('VALIDATION: proveedor no encontrado');
  }
  const info = FIXED_ASSET_CATEGORIES[data.category];

  return prisma.$transaction(async (tx) => {
    const assetNumber = await getNextDocumentNumber(tx, companyId, 'FIXED_ASSET', 'ACT-');
    return tx.fixedAsset.create({
      data: {
        companyId,
        assetNumber,
        name: data.name.trim(),
        category: data.category,
        accountCode: info.accountCode,
        acquisitionDate: data.acquisitionDate,
        acquisitionCost: new Prisma.Decimal(data.acquisitionCost),
        residualValue: new Prisma.Decimal(data.residualValue),
        usefulLifeYears: data.usefulLifeYears,
        supplierId: data.supplierId || null,
        notes: data.notes,
        createdBy: actorId,
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
  });
}

export async function updateFixedAsset(id: string, companyId: string, data: Partial<Pick<FixedAssetInput, 'name' | 'residualValue' | 'usefulLifeYears' | 'notes'>>) {
  const existing = await prisma.fixedAsset.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error('FIXED_ASSET_NOT_FOUND');
  if (existing.status !== 'ACTIVE') throw new Error('FIXED_ASSET_NOT_ACTIVE');
  const residualValue = data.residualValue ?? Number(existing.residualValue);
  const usefulLifeYears = data.usefulLifeYears ?? existing.usefulLifeYears;
  if (residualValue >= Number(existing.acquisitionCost)) throw new Error('VALIDATION: el valor residual debe ser menor al costo de adquisición');
  if (existing.category !== 'TERRENO' && usefulLifeYears <= 0) throw new Error('VALIDATION: solo los terrenos pueden tener vida útil 0 (no deprecian)');

  return prisma.fixedAsset.update({
    where: { id },
    data: {
      name: data.name?.trim() ?? existing.name,
      residualValue: new Prisma.Decimal(residualValue),
      usefulLifeYears,
      notes: data.notes ?? existing.notes,
    },
    include: { supplier: { select: { id: true, name: true } } },
  });
}

/** Da de baja un activo (venta, obsolescencia, siniestro) — deja de depreciar. No revierte
 * la depreciación ya contabilizada (regla 5: lo contabilizado no se edita). */
export async function disposeFixedAsset(id: string, companyId: string, note: string) {
  const existing = await prisma.fixedAsset.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error('FIXED_ASSET_NOT_FOUND');
  if (existing.status === 'DISPOSED') throw new Error('FIXED_ASSET_ALREADY_DISPOSED');
  return prisma.fixedAsset.update({
    where: { id },
    data: { status: 'DISPOSED', disposedAt: new Date(), disposalNote: note },
  });
}

interface GenerateResult {
  generated: Array<{ assetId: string; assetNumber: string; name: string; amount: number; entryId: string }>;
  skipped: Array<{ assetId: string; name: string; reason: string }>;
}

/** Genera el asiento de depreciación de cada activo ACTIVO vencido a `asOf`. Cada activo se
 * procesa independiente — si uno falla, no bloquea el resto. */
export async function generateDueDepreciation(companyId: string, actorId?: string, asOf: Date = new Date()): Promise<GenerateResult> {
  const assets = await prisma.fixedAsset.findMany({ where: { companyId, status: 'ACTIVE' } });
  const result: GenerateResult = { generated: [], skipped: [] };

  for (const asset of assets) {
    const due = computeDueDepreciationPeriods(asset, asOf);
    if (!due) continue;
    try {
      const dep = computeMonthlyDepreciation(
        Number(asset.acquisitionCost), Number(asset.residualValue), asset.usefulLifeYears, Number(asset.accumulatedDepreciation), due.periodsElapsed,
      );
      if (dep.amount <= 0) {
        // Vida útil 0 (terreno) o ya totalmente depreciado: no genera asiento, pero sí marca
        // el período para no volver a evaluarlo cada vez que se dispare la generación.
        await prisma.fixedAsset.update({
          where: { id: asset.id },
          data: { lastDepreciatedPeriod: due.toPeriod, status: dep.fullyDepreciated ? 'FULLY_DEPRECIATED' : undefined },
        });
        continue;
      }

      const entry = await createDepreciationEntry(companyId, {
        assetId: asset.id, assetNumber: asset.assetNumber, assetName: asset.name,
        period: due.toPeriod, fromPeriod: due.periodsElapsed > 1 ? due.fromPeriod : undefined,
        amount: dep.amount, entryDate: asOf,
      });
      if (!entry) continue;

      await prisma.fixedAsset.update({
        where: { id: asset.id },
        data: {
          accumulatedDepreciation: new Prisma.Decimal(dep.newAccumulated),
          lastDepreciatedPeriod: due.toPeriod,
          status: dep.fullyDepreciated ? 'FULLY_DEPRECIATED' : 'ACTIVE',
        },
      });

      result.generated.push({ assetId: asset.id, assetNumber: asset.assetNumber, name: asset.name, amount: dep.amount, entryId: entry.id });
    } catch (e: any) {
      logger.warn('[fixed-asset] no se pudo depreciar un activo', { assetId: asset.id, err: e?.message });
      result.skipped.push({ assetId: asset.id, name: asset.name, reason: e?.message ?? 'Error desconocido' });
    }
  }

  if (actorId) {
    logger.info('[fixed-asset] generación de depreciación ejecutada', { companyId, actorId, generated: result.generated.length, skipped: result.skipped.length });
  }
  return result;
}
