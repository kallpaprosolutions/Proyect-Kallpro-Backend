import { prisma } from '../../lib/prisma';
// ============================================================
// Catálogos tributarios SRI Ecuador (fuente de verdad para seed + UI)
// ============================================================

export const IVA_TARIFFS = [
  { codigo: '0', descripcion: 'Tarifa 0% — Bienes y servicios gravados con tarifa 0%', porcentaje: 0, vigenciaDesde: new Date('2000-01-01') },
  { codigo: '8', descripcion: 'Tarifa 8% — Sector construcción y obras civiles', porcentaje: 8, vigenciaDesde: new Date('2024-01-01') },
  { codigo: '12', descripcion: 'Tarifa 12% — Tarifa general IVA (hasta mayo 2024)', porcentaje: 12, vigenciaDesde: new Date('2008-01-01'), vigenciaHasta: new Date('2024-05-31') },
  { codigo: '15', descripcion: 'Tarifa 15% — Tarifa general IVA vigente (desde mayo 2024)', porcentaje: 15, vigenciaDesde: new Date('2024-06-01') },
  { codigo: 'NO_OBJETO', descripcion: 'No objeto de IVA', porcentaje: 0, vigenciaDesde: new Date('2000-01-01') },
  { codigo: 'EXENTO', descripcion: 'Exento de IVA', porcentaje: 0, vigenciaDesde: new Date('2000-01-01') },
];

export const RETENTIONS_IR = [
  { codigo: '303', descripcion: 'Honorarios profesionales y dietas', porcentaje: 10, aplicaA: 'SERVICIOS' },
  { codigo: '304', descripcion: 'Servicios predomina intelecto (no 303)', porcentaje: 8, aplicaA: 'SERVICIOS' },
  { codigo: '307', descripcion: 'Servicios predomina mano de obra', porcentaje: 2, aplicaA: 'SERVICIOS' },
  { codigo: '308', descripcion: 'Servicios entre sociedades', porcentaje: 2, aplicaA: 'SERVICIOS' },
  { codigo: '309', descripcion: 'Servicios publicidad y comunicación', porcentaje: 2, aplicaA: 'SERVICIOS' },
  { codigo: '310', descripcion: 'Transporte privado de pasajeros', porcentaje: 1, aplicaA: 'SERVICIOS' },
  { codigo: '312', descripcion: 'Transferencia de bienes muebles de naturaleza corporal', porcentaje: 1.75, aplicaA: 'BIENES' },
  { codigo: '319', descripcion: 'Arrendamiento de bienes inmuebles', porcentaje: 8, aplicaA: 'SERVICIOS' },
  { codigo: '320', descripcion: 'Seguros y reaseguros (primas y cesiones)', porcentaje: 1, aplicaA: 'SERVICIOS' },
  { codigo: '322', descripcion: 'Rendimientos financieros (intereses y descuentos)', porcentaje: 2, aplicaA: 'SERVICIOS' },
  { codigo: '323', descripcion: 'Cánones, regalías, derechos de autor', porcentaje: 8, aplicaA: 'SERVICIOS' },
  { codigo: '332', descripcion: 'Compra de combustibles derivados de petróleo', porcentaje: 0.2, aplicaA: 'BIENES' },
  { codigo: '340', descripcion: 'Suministros, repuestos y herramientas', porcentaje: 1.75, aplicaA: 'BIENES' },
  { codigo: '341', descripcion: 'Honorarios a extranjeros por servicios ocasionales', porcentaje: 22, aplicaA: 'SERVICIOS' },
  { codigo: '344', descripcion: 'Otras retenciones aplicables al 1%', porcentaje: 1, aplicaA: 'AMBOS' },
  { codigo: '345', descripcion: 'Otras retenciones aplicables al 2%', porcentaje: 2, aplicaA: 'AMBOS' },
  { codigo: '346', descripcion: 'Otras retenciones aplicables al 8%', porcentaje: 8, aplicaA: 'AMBOS' },
  { codigo: '347', descripcion: 'Otras retenciones aplicables al 10%', porcentaje: 10, aplicaA: 'AMBOS' },
  { codigo: '3490', descripcion: 'Servicios de construcción — contratos a favor de persona natural', porcentaje: 1, aplicaA: 'SERVICIOS' },
  { codigo: '3491', descripcion: 'Servicios de construcción — contratos a favor de sociedad', porcentaje: 2, aplicaA: 'SERVICIOS' },
];

export const RETENTIONS_IVA = [
  { codigo: '721', descripcion: 'Retención IVA 30% — Bienes (OLC, contribuyente especial, sector público)', porcentaje: 30, aplicaA: 'BIENES' },
  { codigo: '723', descripcion: 'Retención IVA 70% — Servicios (OLC, contribuyente especial, sector público)', porcentaje: 70, aplicaA: 'SERVICIOS' },
  { codigo: '724', descripcion: 'Retención IVA 100% — Bienes y servicios (liquidaciones, servicios del exterior)', porcentaje: 100, aplicaA: 'AMBOS' },
  { codigo: '725', descripcion: 'Retención IVA 100% — Contribuyente especial a otro contribuyente especial', porcentaje: 100, aplicaA: 'AMBOS' },
  { codigo: '731', descripcion: 'Retención IVA 70% — Exportadores habituales (servicios)', porcentaje: 70, aplicaA: 'SERVICIOS' },
  { codigo: '733', descripcion: 'Retención IVA 30% — Sector construcción (bienes)', porcentaje: 30, aplicaA: 'BIENES' },
  { codigo: '734', descripcion: 'Retención IVA 70% — Sector construcción (servicios)', porcentaje: 70, aplicaA: 'SERVICIOS' },
];

// ============================================================
// SEED idempotente (global, los catálogos SRI no son por empresa)
// ============================================================
export async function seedTaxCatalogs() {
  for (const t of IVA_TARIFFS) {
    await prisma.ivaTariff.upsert({
      where: { codigo: t.codigo },
      update: { ...t, activo: true },
      create: { ...t, activo: true },
    });
  }
  for (const r of RETENTIONS_IR) {
    await prisma.retentionCatalog.upsert({
      where: { codigo: r.codigo },
      update: { ...r, tipo: 'RENTA', activo: true },
      create: { ...r, tipo: 'RENTA', activo: true },
    });
  }
  for (const r of RETENTIONS_IVA) {
    await prisma.retentionCatalog.upsert({
      where: { codigo: r.codigo },
      update: { ...r, tipo: 'IVA', activo: true },
      create: { ...r, tipo: 'IVA', activo: true },
    });
  }
  return {
    iva: IVA_TARIFFS.length,
    retentions: RETENTIONS_IR.length + RETENTIONS_IVA.length,
  };
}

// ============================================================
// LECTURA / CRUD
// ============================================================
export async function listIvaTariffs() {
  return prisma.ivaTariff.findMany({ orderBy: { codigo: 'asc' } });
}
export async function listRetentions(tipo?: string) {
  return prisma.retentionCatalog.findMany({
    where: tipo ? { tipo } : {},
    orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }],
  });
}

export async function upsertIvaTariff(data: { codigo: string; descripcion: string; porcentaje: number; activo?: boolean; vigenciaDesde?: string; vigenciaHasta?: string | null }) {
  return prisma.ivaTariff.upsert({
    where: { codigo: data.codigo },
    update: {
      descripcion: data.descripcion, porcentaje: data.porcentaje,
      ...(data.activo !== undefined ? { activo: data.activo } : {}),
      ...(data.vigenciaDesde ? { vigenciaDesde: new Date(data.vigenciaDesde) } : {}),
      ...(data.vigenciaHasta !== undefined ? { vigenciaHasta: data.vigenciaHasta ? new Date(data.vigenciaHasta) : null } : {}),
    },
    create: {
      codigo: data.codigo, descripcion: data.descripcion, porcentaje: data.porcentaje,
      activo: data.activo ?? true, vigenciaDesde: data.vigenciaDesde ? new Date(data.vigenciaDesde) : new Date(),
      vigenciaHasta: data.vigenciaHasta ? new Date(data.vigenciaHasta) : null,
    },
  });
}

export async function upsertRetention(data: { codigo: string; tipo: string; descripcion: string; porcentaje: number; aplicaA: string; activo?: boolean }) {
  return prisma.retentionCatalog.upsert({
    where: { codigo: data.codigo },
    update: { tipo: data.tipo, descripcion: data.descripcion, porcentaje: data.porcentaje, aplicaA: data.aplicaA, ...(data.activo !== undefined ? { activo: data.activo } : {}) },
    create: { codigo: data.codigo, tipo: data.tipo, descripcion: data.descripcion, porcentaje: data.porcentaje, aplicaA: data.aplicaA, activo: data.activo ?? true },
  });
}

export async function setRetentionActive(codigo: string, activo: boolean) {
  return prisma.retentionCatalog.update({ where: { codigo }, data: { activo } });
}
export async function setIvaActive(codigo: string, activo: boolean) {
  return prisma.ivaTariff.update({ where: { codigo }, data: { activo } });
}
