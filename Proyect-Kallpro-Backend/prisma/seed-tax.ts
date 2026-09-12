/**
 * Seed de catálogos tributarios SRI Ecuador
 * Ejecutar: npx ts-node --project tsconfig.json prisma/seed-tax.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding catálogos tributarios SRI Ecuador...');

  // ============================================================
  // IVA TARIFFS
  // Ecuador ha tenido varias tarifas:
  // - 0%: bienes y servicios exentos (siempre)
  // - 12%: tarifa general hasta mayo 2024
  // - 15%: tarifa general desde mayo 2024
  // - 8%: sector construcción (desde 2024)
  // - NO_OBJETO: no objeto de IVA
  // - EXENTO: exento de IVA
  // ============================================================

  const ivaTariffs = [
    {
      codigo: '0',
      descripcion: 'Tarifa 0% — Bienes y servicios gravados con tarifa 0%',
      porcentaje: 0,
      activo: true,
      vigenciaDesde: new Date('2000-01-01'),
    },
    {
      codigo: '8',
      descripcion: 'Tarifa 8% — Sector construcción y obras civiles',
      porcentaje: 8,
      activo: true,
      vigenciaDesde: new Date('2024-01-01'),
    },
    {
      codigo: '12',
      descripcion: 'Tarifa 12% — Tarifa general IVA (hasta mayo 2024)',
      porcentaje: 12,
      activo: true,
      vigenciaDesde: new Date('2008-01-01'),
      vigenciaHasta: new Date('2024-05-31'),
    },
    {
      codigo: '15',
      descripcion: 'Tarifa 15% — Tarifa general IVA vigente (desde mayo 2024)',
      porcentaje: 15,
      activo: true,
      vigenciaDesde: new Date('2024-06-01'),
    },
    {
      codigo: 'NO_OBJETO',
      descripcion: 'No objeto de IVA — No está dentro del campo de aplicación',
      porcentaje: 0,
      activo: true,
      vigenciaDesde: new Date('2000-01-01'),
    },
    {
      codigo: 'EXENTO',
      descripcion: 'Exento de IVA — Excluido del pago del impuesto',
      porcentaje: 0,
      activo: true,
      vigenciaDesde: new Date('2000-01-01'),
    },
  ];

  for (const tariff of ivaTariffs) {
    await prisma.ivaTariff.upsert({
      where: { codigo: tariff.codigo },
      update: tariff,
      create: tariff,
    });
  }
  console.log(`✓ ${ivaTariffs.length} tarifas IVA`);

  // ============================================================
  // RETENCIONES EN LA FUENTE DEL IMPUESTO A LA RENTA (IR)
  // Tabla vigente SRI Ecuador 2024-2025
  // ============================================================

  const retentionsIR = [
    // Servicios profesionales
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
    { codigo: '325', descripcion: 'Pagos a deportistas, entrenadores, árbitros', porcentaje: 8, aplicaA: 'SERVICIOS' },
    { codigo: '327', descripcion: 'Loterías, rifas, apuestas y similares', porcentaje: 15, aplicaA: 'SERVICIOS' },
    { codigo: '332', descripcion: 'Compra de combustibles derivados de petróleo', porcentaje: 0.2, aplicaA: 'BIENES' },
    { codigo: '333', descripcion: 'Impuesto a la renta único — actividades agropecuarias', porcentaje: 1, aplicaA: 'BIENES' },
    { codigo: '334', descripcion: 'Energía eléctrica', porcentaje: 1, aplicaA: 'SERVICIOS' },
    { codigo: '340', descripcion: 'Suministros, repuestos y herramientas', porcentaje: 1.75, aplicaA: 'BIENES' },
    { codigo: '341', descripcion: 'Honorarios a extranjeros por servicios ocasionales', porcentaje: 22, aplicaA: 'SERVICIOS' },
    { codigo: '343', descripcion: 'Pago local de tarjetas al exterior', porcentaje: 0, aplicaA: 'AMBOS' },
    { codigo: '344', descripcion: 'Otras retenciones aplicables al 1%', porcentaje: 1, aplicaA: 'AMBOS' },
    { codigo: '345', descripcion: 'Otras retenciones aplicables al 2%', porcentaje: 2, aplicaA: 'AMBOS' },
    { codigo: '346', descripcion: 'Otras retenciones aplicables al 8%', porcentaje: 8, aplicaA: 'AMBOS' },
    { codigo: '347', descripcion: 'Otras retenciones aplicables al 10%', porcentaje: 10, aplicaA: 'AMBOS' },
    { codigo: '348', descripcion: 'Otras retenciones aplicables al 15%', porcentaje: 15, aplicaA: 'AMBOS' },
    { codigo: '349', descripcion: 'Otras retenciones aplicables al 22%', porcentaje: 22, aplicaA: 'AMBOS' },
    { codigo: '350', descripcion: 'Aplicables al tipo de cambio (operaciones en moneda extranjera)', porcentaje: 5, aplicaA: 'AMBOS' },
    // Actividades agropecuarias
    { codigo: '3440', descripcion: 'Compras de banano — productor a exportador', porcentaje: 2, aplicaA: 'BIENES' },
    { codigo: '3441', descripcion: 'Compras de banano — productor a otros', porcentaje: 1, aplicaA: 'BIENES' },
    // Construcción
    { codigo: '3490', descripcion: 'Servicios de construcción — contratos a favor de persona natural', porcentaje: 1, aplicaA: 'SERVICIOS' },
    { codigo: '3491', descripcion: 'Servicios de construcción — contratos a favor de sociedad', porcentaje: 2, aplicaA: 'SERVICIOS' },
  ];

  // ============================================================
  // RETENCIONES DEL IVA
  // ============================================================

  const retentionsIVA = [
    {
      codigo: '721',
      descripcion: 'Retención IVA 30% — Bienes (OLC, contribuyente especial, sector público)',
      porcentaje: 30,
      aplicaA: 'BIENES',
    },
    {
      codigo: '723',
      descripcion: 'Retención IVA 70% — Servicios (OLC, contribuyente especial, sector público)',
      porcentaje: 70,
      aplicaA: 'SERVICIOS',
    },
    {
      codigo: '724',
      descripcion: 'Retención IVA 100% — Bienes y servicios (liquidaciones de compra, servicios del exterior)',
      porcentaje: 100,
      aplicaA: 'AMBOS',
    },
    {
      codigo: '725',
      descripcion: 'Retención IVA 100% — Contribuyente especial a otro contribuyente especial',
      porcentaje: 100,
      aplicaA: 'AMBOS',
    },
    {
      codigo: '726',
      descripcion: 'Retención IVA 15% — Emisores de tarjetas de crédito (bienes)',
      porcentaje: 15,
      aplicaA: 'BIENES',
    },
    {
      codigo: '727',
      descripcion: 'Retención IVA 15% — Emisores de tarjetas de crédito (servicios)',
      porcentaje: 15,
      aplicaA: 'SERVICIOS',
    },
    {
      codigo: '728',
      descripcion: 'Retención IVA 30% — Compañías de seguros (bienes)',
      porcentaje: 30,
      aplicaA: 'BIENES',
    },
    {
      codigo: '729',
      descripcion: 'Retención IVA 70% — Compañías de seguros (servicios)',
      porcentaje: 70,
      aplicaA: 'SERVICIOS',
    },
    {
      codigo: '730',
      descripcion: 'Retención IVA 30% — Exportadores habituales (bienes)',
      porcentaje: 30,
      aplicaA: 'BIENES',
    },
    {
      codigo: '731',
      descripcion: 'Retención IVA 70% — Exportadores habituales (servicios)',
      porcentaje: 70,
      aplicaA: 'SERVICIOS',
    },
    {
      codigo: '733',
      descripcion: 'Retención IVA 30% — Sector construcción (bienes)',
      porcentaje: 30,
      aplicaA: 'BIENES',
    },
    {
      codigo: '734',
      descripcion: 'Retención IVA 70% — Sector construcción (servicios)',
      porcentaje: 70,
      aplicaA: 'SERVICIOS',
    },
  ];

  let createdRetentions = 0;

  for (const r of retentionsIR) {
    await prisma.retentionCatalog.upsert({
      where: { codigo: r.codigo },
      update: { ...r, tipo: 'RENTA', activo: true },
      create: { ...r, tipo: 'RENTA', activo: true },
    });
    createdRetentions++;
  }

  for (const r of retentionsIVA) {
    await prisma.retentionCatalog.upsert({
      where: { codigo: r.codigo },
      update: { ...r, tipo: 'IVA', activo: true },
      create: { ...r, tipo: 'IVA', activo: true },
    });
    createdRetentions++;
  }

  console.log(`✓ ${createdRetentions} retenciones (IR + IVA)`);
  console.log('Seed completado ✓');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
