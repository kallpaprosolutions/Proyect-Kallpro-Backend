import { prisma } from '../lib/prisma';
export interface LocationInput {
  warehouseId: string;
  zone?: string;
  rack?: string;
  level?: string;
  description?: string;
  code?: string;
}

/** Builds a composite code like "ZA-PB-P5" from zone/rack/level when not provided. */
function buildCode(data: LocationInput): string {
  if (data.code && data.code.trim()) return data.code.trim().toUpperCase();
  const parts = [
    data.zone ? `Z${data.zone}` : null,
    data.rack ? `P${data.rack}` : null,
    data.level ? `N${data.level}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join('-').toUpperCase() : 'LOC';
}

export async function listLocations(companyId: string, warehouseId?: string) {
  return prisma.storageLocation.findMany({
    where: { companyId, isActive: true, ...(warehouseId ? { warehouseId } : {}) },
    include: { warehouse: { select: { id: true, name: true, code: true } } },
    orderBy: [{ zone: 'asc' }, { rack: 'asc' }, { level: 'asc' }],
  });
}

export async function createLocation(companyId: string, data: LocationInput) {
  // validar que la bodega pertenezca a la empresa
  const wh = await prisma.warehouse.findFirst({ where: { id: data.warehouseId, companyId } });
  if (!wh) throw new Error('WAREHOUSE_NOT_FOUND');

  return prisma.storageLocation.create({
    data: {
      companyId,
      warehouseId: data.warehouseId,
      code: buildCode(data),
      zone: data.zone || null,
      rack: data.rack || null,
      level: data.level || null,
      description: data.description || null,
    },
    include: { warehouse: { select: { id: true, name: true, code: true } } },
  });
}

export async function updateLocation(id: string, companyId: string, data: Partial<LocationInput>) {
  const existing = await prisma.storageLocation.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error('LOCATION_NOT_FOUND');

  const merged = {
    warehouseId: data.warehouseId ?? existing.warehouseId,
    zone: data.zone ?? existing.zone ?? undefined,
    rack: data.rack ?? existing.rack ?? undefined,
    level: data.level ?? existing.level ?? undefined,
    code: data.code,
  };

  return prisma.storageLocation.update({
    where: { id },
    data: {
      zone: data.zone !== undefined ? (data.zone || null) : undefined,
      rack: data.rack !== undefined ? (data.rack || null) : undefined,
      level: data.level !== undefined ? (data.level || null) : undefined,
      description: data.description !== undefined ? (data.description || null) : undefined,
      code: buildCode(merged as LocationInput),
    },
    include: { warehouse: { select: { id: true, name: true, code: true } } },
  });
}

export async function deactivateLocation(id: string, companyId: string) {
  const existing = await prisma.storageLocation.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error('LOCATION_NOT_FOUND');
  return prisma.storageLocation.update({ where: { id }, data: { isActive: false } });
}
