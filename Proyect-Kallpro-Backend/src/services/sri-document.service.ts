import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { parsePdf, parseXml, SriParsedDocument } from './sri-parser.service';
import { computeManualSriDocument, ManualSriItemInput } from './sri-manual-entry.engine';
import { registerMovement } from './inventory.service';
import { validateThreeWayMatch } from './procurement-ai.service';
import { createRetentionEntry, createDirectPurchaseEntry, previewDirectPurchaseEntry } from './journal.service';
import { computeDueDate } from '../utils/payment-terms';
// ============================================================
// SUBIR Y PARSEAR DOCUMENTO
// ============================================================

/**
 * Persiste un documento ya "resuelto" en `SriParsedDocument` (venga de parsear un XML/PDF,
 * o de construirse a mano desde un formulario manual/asistido por IA — ver
 * `createManualSriDocument`). Comparte duplicados, match de OC y creación de ítems con el
 * flujo de carga de archivo, para no tener dos caminos de persistencia divergentes.
 */
async function persistParsedDocument(companyId: string, parsed: SriParsedDocument, fileType: string): Promise<any> {
  // Verificar duplicado (clave de acceso única por empresa)
  if (parsed.claveAcceso) {
    const existing = await prisma.sriDocument.findFirst({
      where: { companyId, claveAcceso: parsed.claveAcceso },
    });
    if (existing) {
      throw new Error(`Documento duplicado. Clave de acceso ya registrada (ID: ${existing.id})`);
    }
  }

  // Buscar proveedor por RUC
  const supplier = parsed.rucEmisor
    ? await prisma.supplier.findFirst({
        where: { companyId, ruc: parsed.rucEmisor, isActive: true },
      })
    : null;

  // Buscar OC matching si hay proveedor (solo aplica a facturas — una NC/ND no recibe mercadería)
  let matchedPO = null;
  let poConfidence = 0;
  if (supplier && parsed.tipoDocumento === 'FACTURA') {
    const result = await findMatchingPO(companyId, supplier.id, parsed.total);
    matchedPO = result.po;
    poConfidence = result.confidence;
  }

  // Detección de duplicados más allá de la clave de acceso exacta (B1 del backlog): mismo
  // proveedor+número de documento es un duplicado real (bloquea), mismo proveedor+monto
  // similar+fecha cercana es sospechoso (solo advierte, puede ser una compra legítima repetida).
  let possibleDuplicates: Awaited<ReturnType<typeof findPossibleDuplicates>> = [];
  if (supplier) {
    possibleDuplicates = await findPossibleDuplicates(companyId, supplier.id, parsed.numeroDoc, parsed.total, parsed.fechaEmision);
    const exactMatch = possibleDuplicates.find((d) => d.exact);
    if (exactMatch) {
      throw new Error(`Posible factura duplicada: el proveedor ya tiene el documento ${exactMatch.numeroDoc ?? exactMatch.id} registrado (ID: ${exactMatch.id})`);
    }
  }

  // Determinar tipo de cada ítem (PRODUCTO vs SERVICIO)
  const itemsWithType = parsed.items.map((item) => {
    const cod = item.codPrincipal.toUpperCase();
    // Heurística: códigos KTR son servicios, LH- son productos
    const esServicio = /^KTR|^SRV|^SERV|^MO-/.test(cod);
    return { ...item, tipoItem: esServicio ? 'SERVICIO' : 'PRODUCTO' };
  });

  // Crear el documento en BD
  const doc = await prisma.sriDocument.create({
    data: {
      companyId,
      status: 'PENDING_REVIEW',
      tipoDocumento: parsed.tipoDocumento,
      claveAcceso: parsed.claveAcceso || `MANUAL-${randomUUID()}`,
      rucEmisor: parsed.rucEmisor,
      razonSocialEmisor: parsed.razonSocialEmisor,
      nombreComercial: parsed.nombreComercial,
      dirEmisor: parsed.dirEmisor,
      contribuyenteEspecial: parsed.contribuyenteEspecial,
      obligadoContabilidad: parsed.obligadoContabilidad,
      estab: parsed.estab,
      ptoEmi: parsed.ptoEmi,
      secuencial: parsed.secuencial,
      numeroDoc: parsed.numeroDoc,
      fechaEmision: parsed.fechaEmision,
      fechaAutorizacion: parsed.fechaAutorizacion,
      ambiente: parsed.ambiente,
      tipoIdComprador: parsed.tipoIdComprador,
      idComprador: parsed.idComprador,
      razonSocialComprador: parsed.razonSocialComprador,
      dirComprador: parsed.dirComprador,
      subtotal0: new Prisma.Decimal(parsed.subtotal0),
      subtotal8: new Prisma.Decimal(parsed.subtotal8),
      subtotal12: new Prisma.Decimal(parsed.subtotal12),
      subtotal15: new Prisma.Decimal(parsed.subtotal15),
      subtotalNoObj: new Prisma.Decimal(parsed.subtotalNoObj),
      subtotalExento: new Prisma.Decimal(parsed.subtotalExento),
      totalDescuento: new Prisma.Decimal(parsed.totalDescuento),
      ice: new Prisma.Decimal(parsed.ice),
      iva: new Prisma.Decimal(parsed.iva),
      irbpnr: new Prisma.Decimal(parsed.irbpnr),
      propina: new Prisma.Decimal(parsed.propina),
      total: new Prisma.Decimal(parsed.total),
      formaPago: parsed.formaPago,
      valorFormaPago: parsed.valorFormaPago ? new Prisma.Decimal(parsed.valorFormaPago) : null,
      docModificadoTipo: parsed.docModificadoTipo,
      docModificadoNumero: parsed.docModificadoNumero,
      docModificadoFecha: parsed.docModificadoFecha,
      parseConfidence: parsed.parseConfidence,
      parseWarnings: JSON.stringify(parsed.parseWarnings),
      fileType,
      rawJson: parsed as any,
      supplierId: supplier?.id,
      purchaseOrderId: matchedPO?.id,
      items: {
        create: itemsWithType.map((item) => ({
          linea: item.linea,
          codPrincipal: item.codPrincipal,
          codAuxiliar: item.codAuxiliar,
          descripcion: item.descripcion,
          detAdicional: item.detAdicional,
          cantidad: new Prisma.Decimal(item.cantidad),
          precioUnitario: new Prisma.Decimal(item.precioUnitario),
          descuento: new Prisma.Decimal(item.descuento),
          precioTotal: new Prisma.Decimal(item.precioTotal),
          codigoTarifa: item.codigoTarifa,
          tarifaIva: new Prisma.Decimal(item.tarifaIva),
          valorIva: new Prisma.Decimal(item.valorIva),
          tipoItem: item.tipoItem,
        })),
      },
    },
    include: { items: true, supplier: true, purchaseOrder: true },
  });

  return {
    document: doc,
    poMatch: matchedPO
      ? { po: matchedPO, confidence: poConfidence, message: matchLabel(poConfidence) }
      : null,
    possibleDuplicates,
  };
}

export async function uploadSriDocument(
  companyId: string,
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<any> {
  let parsed: SriParsedDocument;
  let fileType: string;

  if (mimeType === 'application/xml' || mimeType === 'text/xml' || originalName.endsWith('.xml')) {
    parsed = await parseXml(buffer);
    fileType = 'XML';
  } else {
    parsed = await parsePdf(buffer);
    fileType = 'PDF';
  }

  return persistParsedDocument(companyId, parsed, fileType);
}

// ============================================================
// INGRESO MANUAL / SEMI-AUTOMÁTICO (sin PDF/XML del SRI)
// ============================================================
// Cubre el caso de una factura, nota de crédito o nota de débito que llega en papel, por
// WhatsApp como foto, o cuyo XML no se puede conseguir: el usuario la escribe directamente
// (manual) o pega el texto y deja que la IA la pre-llene para solo revisar/completar
// (semi-automático) — en ambos casos el formulario del frontend termina llamando aquí con
// la misma forma de datos; la única diferencia es si `source` es 'MANUAL' o 'IA'.

export interface ManualSriDocumentInput {
  tipoDocumento: 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO' | 'LIQUIDACION_COMPRA';
  supplierId?: string;
  rucEmisor: string;
  razonSocialEmisor: string;
  numeroDoc?: string;
  fechaEmision: string; // ISO date
  formaPago?: string;
  // Solo NOTA_CREDITO / NOTA_DEBITO: la factura que modifican.
  docModificadoTipo?: string;
  docModificadoNumero?: string;
  docModificadoFecha?: string;
  items: ManualSriItemInput[];
  source: 'MANUAL' | 'IA';
  aiConfidence?: number;
}

export async function createManualSriDocument(companyId: string, input: ManualSriDocumentInput): Promise<any> {
  if (!input.rucEmisor?.trim()) throw new Error('VALIDATION: el RUC del emisor es obligatorio');
  if (!input.razonSocialEmisor?.trim()) throw new Error('VALIDATION: la razón social del emisor es obligatoria');
  if (!input.fechaEmision) throw new Error('VALIDATION: la fecha de emisión es obligatoria');
  const isCreditOrDebit = input.tipoDocumento === 'NOTA_CREDITO' || input.tipoDocumento === 'NOTA_DEBITO';
  if (isCreditOrDebit && !input.docModificadoNumero?.trim()) {
    throw new Error('VALIDATION: indica el documento que esta nota modifica');
  }

  let supplier = null;
  if (input.supplierId) {
    supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, companyId } });
    if (!supplier) throw new Error('VALIDATION: proveedor no encontrado');
  }

  const { items: computedItems, totals } = computeManualSriDocument(input.items);

  const parsed: SriParsedDocument = {
    claveAcceso: '', // vacío → persistParsedDocument arma un MANUAL-<uuid> único
    tipoDocumento: input.tipoDocumento,
    rucEmisor: supplier?.ruc ?? input.rucEmisor.trim(),
    razonSocialEmisor: supplier?.razonSocial ?? supplier?.name ?? input.razonSocialEmisor.trim(),
    obligadoContabilidad: false,
    estab: input.numeroDoc?.split('-')[0] ?? '',
    ptoEmi: input.numeroDoc?.split('-')[1] ?? '',
    secuencial: input.numeroDoc?.split('-')[2] ?? '',
    numeroDoc: input.numeroDoc || '',
    fechaEmision: new Date(input.fechaEmision),
    ambiente: 'PRODUCCION',
    tipoEmision: 'NORMAL',
    subtotal0: totals.subtotal0,
    subtotal8: totals.subtotal8,
    subtotal12: totals.subtotal12,
    subtotal15: totals.subtotal15,
    subtotalNoObj: totals.subtotalNoObj,
    subtotalExento: totals.subtotalExento,
    totalDescuento: 0,
    ice: 0,
    iva: totals.iva,
    irbpnr: 0,
    propina: 0,
    total: totals.total,
    formaPago: input.formaPago,
    docModificadoTipo: isCreditOrDebit ? (input.docModificadoTipo || 'FACTURA') : undefined,
    docModificadoNumero: isCreditOrDebit ? input.docModificadoNumero : undefined,
    docModificadoFecha: isCreditOrDebit && input.docModificadoFecha ? new Date(input.docModificadoFecha) : undefined,
    items: computedItems.map((it) => ({
      linea: it.linea,
      codPrincipal: `MANUAL-${it.linea}`,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      descuento: it.descuento ?? 0,
      precioTotal: it.precioTotal,
      codigoTarifa: it.codigoTarifa,
      tarifaIva: it.tarifaIva,
      valorIva: it.valorIva,
    })),
    parseConfidence: input.source === 'IA' ? (input.aiConfidence ?? 60) : 100,
    parseWarnings: input.source === 'IA'
      ? ['Datos pre-llenados por IA a partir de texto pegado — revisados y confirmados por el usuario']
      : [],
  };

  const result = await persistParsedDocument(companyId, parsed, input.source === 'IA' ? 'MANUAL_IA' : 'MANUAL');

  // El match por RUC de persistParsedDocument puede no encontrar el proveedor si el RUC no
  // coincide exacto; si el usuario ya lo eligió explícitamente en el formulario, se respeta
  // esa elección por sobre el auto-match.
  if (supplier && result.document.supplierId !== supplier.id) {
    result.document = await prisma.sriDocument.update({
      where: { id: result.document.id },
      data: { supplierId: supplier.id },
      include: { items: true, supplier: true, purchaseOrder: true },
    });
  }

  return result;
}

// ============================================================
// DETECCIÓN DE FACTURAS DUPLICADAS (B1)
// ============================================================

/**
 * Heurística de duplicado: mismo proveedor + mismo número de documento (exacto, bloquea) o
 * mismo proveedor + monto dentro de ±1% + fecha de emisión dentro de ±5 días (sospechoso,
 * solo advierte). Complementa el chequeo exacto por claveAcceso, que no detecta el caso
 * típico de un XML re-descargado con clave distinta o un PDF cargado dos veces manualmente.
 */
export async function findPossibleDuplicates(
  companyId: string,
  supplierId: string,
  numeroDoc: string | null,
  total: number,
  fechaEmision: Date | null,
) {
  const orConditions: Prisma.SriDocumentWhereInput[] = [];
  if (numeroDoc) orConditions.push({ numeroDoc });
  if (fechaEmision) {
    const start = new Date(fechaEmision.getTime() - 5 * 86_400_000);
    const end = new Date(fechaEmision.getTime() + 5 * 86_400_000);
    orConditions.push({ fechaEmision: { gte: start, lte: end } });
  }
  if (orConditions.length === 0) return [];

  const candidates = await prisma.sriDocument.findMany({
    where: {
      companyId,
      supplierId,
      status: { not: 'REJECTED' },
      OR: orConditions,
    },
    select: { id: true, numeroDoc: true, total: true, fechaEmision: true, status: true },
    take: 20,
  });

  return candidates
    .map((c) => {
      const sameNumero = !!(numeroDoc && c.numeroDoc === numeroDoc);
      const amountDiff = total > 0 ? Math.abs(Number(c.total) - total) / total : 1;
      const sameAmount = amountDiff <= 0.01;
      if (!sameNumero && !sameAmount) return null;
      return {
        id: c.id,
        numeroDoc: c.numeroDoc,
        total: Number(c.total),
        fechaEmision: c.fechaEmision,
        status: c.status,
        exact: sameNumero,
        reason: sameNumero ? 'Mismo número de documento y proveedor' : 'Mismo proveedor, monto similar y fecha cercana',
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);
}

// ============================================================
// BUSCAR OC MATCHING
// ============================================================

async function findMatchingPO(
  companyId: string,
  supplierId: string,
  totalFactura: number,
): Promise<{ po: any | null; confidence: number }> {
  const openPOs = await prisma.purchaseOrder.findMany({
    where: {
      companyId,
      supplierId,
      status: { in: ['SENT', 'PARTIAL', 'DRAFT'] },
    },
    include: { supplier: true, items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (openPOs.length === 0) return { po: null, confidence: 0 };

  let bestPO = null;
  let bestConf = 0;

  for (const po of openPOs) {
    const poTotal = Number(po.totalAmount);
    const diff = Math.abs(poTotal - totalFactura) / totalFactura;
    let conf = 40; // base: mismo proveedor

    if (diff <= 0.01) conf = 95;
    else if (diff <= 0.05) conf = 80;
    else if (diff <= 0.10) conf = 65;
    else if (diff <= 0.20) conf = 50;

    if (conf > bestConf) {
      bestConf = conf;
      bestPO = po;
    }
  }

  return { po: bestPO, confidence: bestConf };
}

function matchLabel(confidence: number): string {
  if (confidence >= 90) return 'Coincidencia alta';
  if (confidence >= 70) return 'Coincidencia media';
  if (confidence >= 50) return 'Coincidencia baja';
  return 'Solo mismo proveedor';
}

// ============================================================
// LISTAR DOCUMENTOS
// ============================================================

export async function getSriDocuments(companyId: string, status?: string) {
  return prisma.sriDocument.findMany({
    where: { companyId, ...(status ? { status } : {}) },
    include: {
      supplier: true,
      purchaseOrder: true,
      items: { include: { product: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Asiento sugerido para el "centro de trabajo" del detalle — solo lectura, no persiste.
 * `null` cuando no aplica: documento vinculado a OC (el pasivo ya se registró en la
 * recepción) o tipo de documento sin tratamiento directo aún (p.ej. NOTA_CREDITO).
 */
export async function previewJournalEntry(id: string, companyId: string) {
  const doc = await prisma.sriDocument.findFirst({ where: { id, companyId } });
  if (!doc) throw new Error('Documento no encontrado');
  if (doc.purchaseOrderId) return null;
  if (!['FACTURA', 'LIQUIDACION_COMPRA', 'NOTA_DEBITO'].includes(doc.tipoDocumento)) return null;
  return previewDirectPurchaseEntry(companyId, id);
}

export async function getSriDocumentById(id: string, companyId: string) {
  return prisma.sriDocument.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      purchaseOrder: { include: { supplier: true, items: { include: { product: true } } } },
      items: { include: { product: true } },
      retentions: true,
    },
  });
}

// ============================================================
// ACTUALIZAR DOCUMENTO (asignar proveedor, OC, mapear ítems)
// ============================================================

export async function updateSriDocument(
  id: string,
  companyId: string,
  data: {
    supplierId?: string;
    purchaseOrderId?: string;
    observaciones?: string;
    items?: { id: string; tipoItem: string; productId?: string | null }[];
  },
) {
  const doc = await prisma.sriDocument.findFirst({ where: { id, companyId } });
  if (!doc) throw new Error('Documento no encontrado');
  if (doc.status === 'CONFIRMED') throw new Error('El documento ya está confirmado');

  // Actualizar ítems si se enviaron
  if (data.items?.length) {
    for (const itemUpd of data.items) {
      await prisma.sriDocumentItem.update({
        where: { id: itemUpd.id },
        data: {
          tipoItem: itemUpd.tipoItem,
          productId: itemUpd.productId ?? null,
        },
      });
    }
  }

  return prisma.sriDocument.update({
    where: { id },
    data: {
      supplierId: data.supplierId,
      purchaseOrderId: data.purchaseOrderId,
      observaciones: data.observaciones,
    },
    include: {
      supplier: true,
      purchaseOrder: true,
      items: { include: { product: true } },
    },
  });
}

// ============================================================
// CONFIRMAR DOCUMENTO → actualizar inventario
// ============================================================

export async function confirmSriDocument(
  id: string,
  companyId: string,
  userId?: string,
  opts?: { override?: boolean; overrideReason?: string },
) {
  const doc = await prisma.sriDocument.findFirst({
    where: { id, companyId },
    include: {
      items: { include: { product: true } },
      purchaseOrder: true,
    },
  });

  if (!doc) throw new Error('Documento no encontrado');
  if (doc.status === 'CONFIRMED') throw new Error('Documento ya confirmado');

  // ── Conciliación 3 vías obligatoria cuando hay OC vinculada ──
  // Bloquea la confirmación si hay discrepancia fuera de tolerancia,
  // salvo override explícito con motivo.
  if (doc.purchaseOrderId) {
    const match = await validateThreeWayMatch(id, companyId);
    if (match && match.status === 'DISCREPANCY' && !opts?.override) {
      const err: any = new Error('MATCH_DISCREPANCY');
      err.matchResult = match;
      throw err;
    }
  }

  const inventoryResults: string[] = [];
  const poReceived = doc.purchaseOrder && ['RECEIVED', 'PARTIAL'].includes(doc.purchaseOrder.status);

  // El inventario se carga en la RECEPCIÓN de la OC. Si el documento está
  // vinculado a una OC, NO volvemos a cargar inventario (evita doble conteo).
  // Solo cargamos cuando es una factura directa sin OC.
  if (doc.purchaseOrderId) {
    inventoryResults.push(
      poReceived
        ? 'ℹ Inventario ya cargado en la recepción de la OC vinculada. No se duplica.'
        : 'ℹ Documento vinculado a una OC. El inventario se carga al recibir la OC.',
    );
  } else {
    const warehouse = await prisma.warehouse.findFirst({
      where: { companyId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (!warehouse) throw new Error('No hay bodega activa. Crea una bodega primero.');

    for (const item of doc.items) {
      if (item.tipoItem !== 'PRODUCTO' || !item.productId) continue;
      try {
        await registerMovement(companyId, {
          productId: item.productId,
          warehouseId: warehouse.id,
          type: 'IN',
          quantity: Number(item.cantidad),
          unitCost: Number(item.precioUnitario),
          reference: doc.numeroDoc ?? doc.claveAcceso,
          notes: `Factura SRI ${doc.numeroDoc} — ${doc.razonSocialEmisor}`,
          createdBy: userId,
        });
        inventoryResults.push(`✓ ${item.descripcion} (${item.cantidad} unidades)`);
      } catch (err: any) {
        inventoryResults.push(`✗ ${item.descripcion}: ${err.message}`);
      }
    }
  }

  // Asiento de la factura (DR Inventario/Gasto + IVA crédito / CR Cuentas por Pagar).
  // Con OC vinculada, el pasivo ya se registró en la recepción de la OC (createPOReceiptEntry)
  // — aquí solo cubre la factura DIRECTA sin OC, que antes quedaba sin asiento en absoluto
  // (el inventario se cargaba físicamente pero sin contrapartida contable). Es bloqueante:
  // a diferencia de las retenciones, un hecho económico sin asiento viola la regla 2 del
  // proyecto (contabilidad como columna vertebral) — no se confirma el documento sin él.
  // NOTA_CREDITO queda fuera (reduce el CxP, no lo genera) — reverso pendiente en fase futura.
  if (!doc.purchaseOrderId && ['FACTURA', 'LIQUIDACION_COMPRA', 'NOTA_DEBITO'].includes(doc.tipoDocumento)) {
    await createDirectPurchaseEntry(companyId, id);
  }

  // Asiento de retenciones (non-blocking: ya se registró el pasivo arriba, esto solo lo ajusta)
  try { await createRetentionEntry(companyId, id); }
  catch (e) { logger.warn('[sri] createRetentionEntry failed (non-fatal)', { err: e }); }

  // Marcar documento como confirmado (guarda motivo de override si aplica)
  const confirmed = await prisma.sriDocument.update({
    where: { id },
    data: {
      status: 'CONFIRMED',
      ...(opts?.override && opts.overrideReason
        ? { observaciones: `[Override 3 vías] ${opts.overrideReason}` }
        : {}),
    },
    include: {
      supplier: true,
      items: { include: { product: true } },
    },
  });

  return { document: confirmed, inventoryResults };
}

// ============================================================
// CUENTAS POR PAGAR — facturas de compra confirmadas
// ============================================================

export async function getPayables(companyId: string) {
  const [docs, creditNotes] = await Promise.all([
    prisma.sriDocument.findMany({
      where: { companyId, status: 'CONFIRMED', tipoDocumento: { in: ['FACTURA', 'LIQUIDACION_COMPRA', 'NOTA_DEBITO'] } },
      include: { supplier: true, purchaseOrder: { select: { id: true, poNumber: true } } },
      orderBy: { fechaEmision: 'desc' },
    }),
    // NC de proveedor confirmadas: netean el saldo por pagar (antes ignoradas por completo).
    prisma.sriDocument.findMany({
      where: { companyId, status: 'CONFIRMED', tipoDocumento: 'NOTA_CREDITO' },
      select: { supplierId: true, docModificadoNumero: true, total: true },
    }),
  ]);

  // Crédito disponible por documento enlazado (docModificadoNumero → numeroDoc) y, si no hay
  // enlace, un remanente por proveedor que se aplica al primer documento con saldo.
  const creditByDoc = new Map<string, number>();
  const creditBySupplier = new Map<string, number>();
  for (const nc of creditNotes) {
    const amount = Number(nc.total);
    if (nc.docModificadoNumero) {
      creditByDoc.set(nc.docModificadoNumero, (creditByDoc.get(nc.docModificadoNumero) ?? 0) + amount);
    } else if (nc.supplierId) {
      creditBySupplier.set(nc.supplierId, (creditBySupplier.get(nc.supplierId) ?? 0) + amount);
    }
  }

  return docs.map((d) => {
    const dueDate = computeDueDate(d.fechaEmision, d.supplier?.paymentTerms);
    let balance = Number(d.total) - Number(d.paidAmount);
    let creditApplied = 0;
    const linkedCredit = d.numeroDoc ? creditByDoc.get(d.numeroDoc) ?? 0 : 0;
    if (linkedCredit > 0) {
      creditApplied = Math.min(linkedCredit, balance);
    } else if (d.supplierId) {
      const remaining = creditBySupplier.get(d.supplierId) ?? 0;
      if (remaining > 0) {
        creditApplied = Math.min(remaining, balance);
        creditBySupplier.set(d.supplierId, remaining - creditApplied);
      }
    }
    balance = Math.max(0, balance - creditApplied);
    return {
      id: d.id,
      numeroDoc: d.numeroDoc,
      rucEmisor: d.rucEmisor,
      supplierName: d.supplier?.razonSocial ?? d.supplier?.name ?? d.razonSocialEmisor,
      supplierId: d.supplierId,
      paymentTerms: d.supplier?.paymentTerms ?? null,
      fechaEmision: d.fechaEmision,
      dueDate,
      total: Number(d.total),
      paidAmount: Number(d.paidAmount),
      creditApplied,
      balance,
      paymentStatus: d.paymentStatus,
      paidAt: d.paidAt,
      poNumber: d.purchaseOrder?.poNumber ?? null,
    };
  });
}

/**
 * Marca un documento como pagado (total) delegando en payment.service para que quede
 * historial real (Payment + PaymentApplication), en vez del toggle booleano anterior.
 * Se mantiene la firma `paid: boolean` por compatibilidad con /sri/:id/pay (usado por
 * ApAgingView en Financiero).
 */
export async function markPayablePaid(id: string, companyId: string, paid: boolean) {
  const doc = await prisma.sriDocument.findFirst({ where: { id, companyId }, include: { retentions: true } });
  if (!doc) throw new Error('Documento no encontrado');
  if (doc.status !== 'CONFIRMED') throw new Error('Solo se pueden pagar facturas confirmadas');

  if (!paid) {
    // Revertir a PENDING solo tiene sentido si aún no se aplicó ningún pago parcial real.
    return prisma.sriDocument.update({ where: { id }, data: { paymentStatus: 'PENDING', paidAt: null } });
  }

  const balance = Number(doc.total) - Number(doc.paidAmount);
  if (balance <= 0.01) return doc;

  const { createPayment } = await import('./payment.service');
  if (doc.supplierId) {
    await createPayment(companyId, {
      entityType: 'SUPPLIER',
      entityId: doc.supplierId,
      paymentMethod: 'OTHER',
      totalAmount: balance,
      notes: `Pago total documento ${doc.numeroDoc ?? doc.id}`,
      applications: [{ sriDocumentId: id, amountApplied: balance }],
    });
  } else {
    // Sin proveedor vinculado: no hay entidad para el Payment, se mantiene el toggle directo.
    await prisma.sriDocument.update({
      where: { id },
      data: { paidAmount: new Prisma.Decimal(Number(doc.total)), paymentStatus: 'PAID', paidAt: new Date() },
    });
  }

  // Asiento de pago a proveedor (neto = total - retenciones) si la OC ya registró CxP. Non-blocking.
  if (doc.purchaseOrderId) {
    try {
      const retTotal = (doc.retentions ?? []).reduce((s, r) => s + Number(r.valor ?? 0), 0)
        || (Number(doc.retencionRenta ?? 0) + Number(doc.retencionIva ?? 0));
      const neto = balance - retTotal;
      const { createSupplierPaymentEntry } = await import('./journal.service');
      await createSupplierPaymentEntry(companyId, {
        amount: neto, reference: doc.numeroDoc ?? undefined, supplierName: doc.razonSocialEmisor,
      });
    } catch (e) {
      logger.warn('[sri] createSupplierPaymentEntry failed (non-fatal)', { err: e });
    }
  }

  return prisma.sriDocument.findFirst({ where: { id } });
}

// ============================================================
// ELIMINAR DOCUMENTO (solo si NO está confirmado)
// ============================================================

export async function deleteSriDocument(id: string, companyId: string) {
  const doc = await prisma.sriDocument.findFirst({ where: { id, companyId } });
  if (!doc) throw new Error('Documento no encontrado');
  if (doc.status === 'CONFIRMED') throw new Error('No se puede eliminar un documento ya confirmado en inventario');
  await prisma.sriDocument.delete({ where: { id } });
  return { ok: true };
}

// ============================================================
// RECHAZAR DOCUMENTO
// ============================================================

export async function rejectSriDocument(id: string, companyId: string, motivo?: string) {
  const doc = await prisma.sriDocument.findFirst({ where: { id, companyId } });
  if (!doc) throw new Error('Documento no encontrado');
  if (doc.status === 'CONFIRMED') throw new Error('No se puede rechazar un documento confirmado');

  return prisma.sriDocument.update({
    where: { id },
    data: { status: 'REJECTED', observaciones: motivo },
  });
}

// ============================================================
// KPIs SRI
// ============================================================

export async function getSriKpis(companyId: string) {
  const [pending, confirmed, rejected, total] = await Promise.all([
    prisma.sriDocument.count({ where: { companyId, status: 'PENDING_REVIEW' } }),
    prisma.sriDocument.count({ where: { companyId, status: 'CONFIRMED' } }),
    prisma.sriDocument.count({ where: { companyId, status: 'REJECTED' } }),
    prisma.sriDocument.count({ where: { companyId } }),
  ]);

  const confirmedDocs = await prisma.sriDocument.findMany({
    where: { companyId, status: 'CONFIRMED' },
    select: { total: true, iva: true, retencionRenta: true, retencionIva: true },
  });

  const totalCompras = confirmedDocs.reduce((s, d) => s + Number(d.total), 0);
  const totalIVACreditoFiscal = confirmedDocs.reduce((s, d) => s + Number(d.iva), 0);

  return {
    pendientes: pending,
    confirmados: confirmed,
    rechazados: rejected,
    total,
    totalCompras: Math.round(totalCompras * 100) / 100,
    totalIVACreditoFiscal: Math.round(totalIVACreditoFiscal * 100) / 100,
  };
}

// ============================================================
// CATÁLOGOS TRIBUTARIOS
// ============================================================

export async function getIvaTariffs() {
  return prisma.ivaTariff.findMany({ where: { activo: true }, orderBy: { porcentaje: 'asc' } });
}

export async function getRetentionCatalog(tipo?: string) {
  return prisma.retentionCatalog.findMany({
    where: { activo: true, ...(tipo ? { tipo } : {}) },
    orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }],
  });
}
