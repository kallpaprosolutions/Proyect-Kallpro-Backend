/**
 * Servicio de parseo de documentos electrónicos SRI Ecuador
 * Soporta: PDF (RIDE) y XML (formato SRI)
 *
 * Estructura clave de acceso (49 dígitos):
 * [1-8]  fechaEmision ddmmaaaa
 * [9-10] tipoComprobante (01=Factura, 04=NotaCredito, 05=NotaDebito, 06=GuiaRemision, 07=Retencion, 08=LiquidacionCompra)
 * [11-23] ruc (13 dígitos)
 * [24]   tipoAmbiente (1=Pruebas, 2=Produccion)
 * [25-30] serie (estab 3 + ptoEmi 3)
 * [31-39] secuencial (9 dígitos)
 * [40-47] codigoNumerico (8 dígitos)
 * [48]   tipoEmision (1=Normal, 2=Contingencia)
 * [49]   digitoVerificador (modulo 11)
 */

import { parseStringPromise } from 'xml2js';

export interface SriParsedDocument {
  claveAcceso: string;
  tipoDocumento: string;
  rucEmisor: string;
  razonSocialEmisor: string;
  nombreComercial?: string;
  dirEmisor?: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad: boolean;

  estab: string;
  ptoEmi: string;
  secuencial: string;
  numeroDoc: string;

  fechaEmision: Date;
  fechaAutorizacion?: Date;
  ambiente: string;
  tipoEmision: string;

  tipoIdComprador?: string;
  idComprador?: string;
  razonSocialComprador?: string;
  dirComprador?: string;

  subtotal0: number;
  subtotal8: number;
  subtotal12: number;
  subtotal15: number;
  subtotalNoObj: number;
  subtotalExento: number;
  totalDescuento: number;
  ice: number;
  iva: number;
  irbpnr: number;
  propina: number;
  total: number;

  formaPago?: string;
  valorFormaPago?: number;

  // Documento sustento (modificado): solo presente en NOTA_CREDITO / NOTA_DEBITO. Viene del
  // XML (infoNotaCredito/infoNotaDebito: codDocModificado, numDocModificado,
  // fechaEmisionDocSustento) — no se infiere, no aplica a facturas.
  docModificadoTipo?: string;
  docModificadoNumero?: string;
  docModificadoFecha?: Date;

  items: SriParsedItem[];
  parseConfidence: number;
  parseWarnings: string[];
}

export interface SriParsedItem {
  linea: number;
  codPrincipal: string;
  codAuxiliar?: string;
  descripcion: string;
  detAdicional?: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotal: number;
  codigoTarifa: string;
  tarifaIva: number;
  valorIva: number;
}

// ============================================================
// PARSEO CLAVE DE ACCESO
// ============================================================

const TIPO_DOC_MAP: Record<string, string> = {
  '01': 'FACTURA',
  '03': 'LIQUIDACION_COMPRA',
  '04': 'NOTA_CREDITO',
  '05': 'NOTA_DEBITO',
  '06': 'GUIA_REMISION',
  '07': 'RETENCION',
  '08': 'LIQUIDACION_COMPRA',
};

export function parseClaveAcceso(clave: string) {
  if (clave.length !== 49) return null;
  const day = clave.substring(0, 2);
  const month = clave.substring(2, 4);
  const year = clave.substring(4, 8);
  return {
    fechaEmision: new Date(`${year}-${month}-${day}T00:00:00`),
    tipoDocumento: TIPO_DOC_MAP[clave.substring(8, 10)] ?? 'FACTURA',
    ruc: clave.substring(10, 23),
    ambiente: clave.substring(23, 24) === '2' ? 'PRODUCCION' : 'PRUEBAS',
    estab: clave.substring(24, 27),
    ptoEmi: clave.substring(27, 30),
    secuencial: clave.substring(30, 39),
    tipoEmision: clave.substring(47, 48) === '1' ? 'NORMAL' : 'CONTINGENCIA',
  };
}

// ============================================================
// PARSEO PDF (RIDE)
// Extrae texto raw y aplica patrones regex
// ============================================================

export async function parsePdf(buffer: Buffer): Promise<SriParsedDocument> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
  const { text } = await pdfParse(buffer);
  return parseRideText(text);
}

function parseRideText(text: string): SriParsedDocument {
  const warnings: string[] = [];
  let confidence = 100;

  // Normalizar: unificar saltos de línea
  const t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  /**
   * Busca una etiqueta en el texto y retorna el SIGUIENTE número decimal
   * encontrado dentro de los próximos `maxChars` caracteres.
   * Funciona tanto si el valor está en la misma línea como en la siguiente.
   */
  const nextNumber = (label: string, maxChars = 80): number => {
    const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const idx = t.search(re);
    if (idx === -1) return 0;
    const slice = t.substring(idx + label.length, idx + label.length + maxChars);
    const m = slice.match(/([\d,]+\.\d{2})/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
  };

  // --- Clave de acceso (49 dígitos) ---
  const claveMatch = t.match(/\b(\d{49})\b/);
  if (!claveMatch) {
    warnings.push('No se encontró clave de acceso de 49 dígitos');
    confidence -= 40;
  }
  const claveAcceso = claveMatch?.[1] ?? '';
  const claveData = claveAcceso ? parseClaveAcceso(claveAcceso) : null;

  // --- Número de factura (NNN-NNN-NNNNNNNNN) ---
  const numMatch = t.match(/(\d{3}-\d{3}-\d{9})/);
  const numeroDoc = numMatch?.[1] ?? (claveData
    ? `${claveData.estab}-${claveData.ptoEmi}-${claveData.secuencial}`
    : '');
  if (!numMatch) warnings.push('Número de factura estimado desde clave de acceso');

  // --- RUC emisor ---
  // El RUC puede aparecer en la misma línea de "R.U.C.:" o en la línea siguiente
  let rucEmisor = claveData?.ruc ?? '';
  const rucSameLineMatch = t.match(/R\.U\.C\.:\s*(\d{13})/i);
  if (rucSameLineMatch) {
    rucEmisor = rucSameLineMatch[1];
  } else {
    // Buscar cualquier número de 13 dígitos que comience con los dígitos del RUC de la clave
    const ruc13Match = t.match(/\b(\d{13})\b/);
    if (ruc13Match) rucEmisor = ruc13Match[1];
    warnings.push('RUC emisor estimado desde clave de acceso');
    confidence -= 3;
  }

  // --- Razón social emisor ---
  // Estrategia: buscar el RUC en el texto y tomar la línea siguiente no vacía
  let razonSocialEmisor = '';
  if (rucEmisor) {
    const rucIdx = t.indexOf(rucEmisor);
    if (rucIdx !== -1) {
      const afterRuc = t.substring(rucIdx + rucEmisor.length);
      const nextLines = afterRuc.split('\n').map(l => l.trim()).filter(l => l.length > 3);
      // Primera línea no numérica y que no sea una clave
      const rsLine = nextLines.find(l => /[A-ZÁÉÍÓÚÑ]/.test(l) && !/^\d+$/.test(l) && l.length < 120);
      razonSocialEmisor = rsLine ?? '';
    }
  }
  if (!razonSocialEmisor) {
    // Fallback: buscar patrón de nombre de empresa conocido
    const empMatch = t.match(/\b(EMPRESA\s+.+?(?:CIA|LTDA|S\.A|INC|CORP).+?)(?:\n|$)/i);
    razonSocialEmisor = empMatch?.[1]?.trim() ?? 'Ver documento original';
    if (!empMatch) { warnings.push('Razón social emisor no encontrada'); confidence -= 5; }
  }

  // --- Fecha y hora de autorización ---
  const fechaAuthMatch = t.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/);
  let fechaAutorizacion: Date | undefined;
  if (fechaAuthMatch) {
    const [d, m, y] = fechaAuthMatch[1].split('/');
    fechaAutorizacion = new Date(`${y}-${m}-${d}T${fechaAuthMatch[2]}`);
  }

  // --- Fecha emisión (desde clave o autorización) ---
  const fechaEmision = claveData?.fechaEmision ?? fechaAutorizacion ?? new Date();

  // --- Ambiente ---
  const ambienteMatch = t.match(/AMBIENTE[:\s]+(PRODUCCI[OÓ]N|PRUEBAS)/i);
  const ambiente = claveData?.ambiente
    ?? (ambienteMatch?.[1]?.toUpperCase().replace('Ó', 'O').replace('Ó', 'O') ?? 'PRODUCCION');

  // --- Contribuyente especial ---
  const contribMatch = t.match(/Contribuyente\s+Especial\s+(\d+)/i);
  const contribuyenteEspecial = contribMatch?.[1];

  // --- Obligado a llevar contabilidad ---
  const obligadoMatch = t.match(/OBLIGADO.*?CONTABILIDAD[\s\S]{0,20}(SI|NO)\b/i);
  const obligadoContabilidad = obligadoMatch?.[1]?.toUpperCase() === 'SI';

  // --- Cliente (receptor) ---
  // Buscar "Razón Social / Nombres" con valor en la misma línea o siguiente
  const clienteRSIdx = t.search(/Raz[oó]n\s+Social\s*\/\s*Nombres\s+y\s+Apellidos/i);
  let razonSocialComprador: string | undefined;
  if (clienteRSIdx !== -1) {
    const afterLabel = t.substring(clienteRSIdx);
    const nextLine = afterLabel.split('\n').slice(1).map(l => l.trim()).find(l => l.length > 2 && /[A-Z]/.test(l));
    const sameLine = afterLabel.match(/Razón Social.*?:\s*(.+)/i);
    razonSocialComprador = sameLine?.[1]?.trim() || nextLine;
  }

  const idCompradorMatch = t.match(/Identificaci[oó]n\s*[\n\s]*(\d{10,13})/i);
  const idComprador = idCompradorMatch?.[1];

  const dirCompradorMatch = t.match(/Direcci[oó]n:\s*(.+)/i);
  const dirComprador = dirCompradorMatch?.[1]?.trim();

  let tipoIdComprador = 'CEDULA';
  if (idComprador?.length === 13) tipoIdComprador = 'RUC';

  // --- TOTALES (usando nextNumber que busca el primer decimal tras la etiqueta) ---
  const subtotal15    = nextNumber('SUBTOTAL 15%');
  const subtotal12    = nextNumber('SUBTOTAL 12%');
  const subtotal8     = nextNumber('SUBTOTAL 8%');
  const subtotal0     = nextNumber('SUBTOTAL 0%') || nextNumber('SUBTOTAL CERO');
  const subtotalNoObj = nextNumber('SUBTOTAL NO OBJETO DE IVA');
  const subtotalExento = nextNumber('SUBTOTAL EXENTO DE IVA');
  const totalDescuento = nextNumber('TOTAL DESCUENTO');
  const ice            = nextNumber('ICE');
  const iva15          = nextNumber('IVA 15%');
  const iva12          = nextNumber('IVA 12%');
  const iva            = iva15 || iva12 || nextNumber('IVA ');
  const irbpnr         = nextNumber('IRBPNR');
  const propina        = nextNumber('PROPINA');
  const total          = nextNumber('VALOR TOTAL');

  if (total === 0) {
    warnings.push('Total no encontrado en el PDF');
    confidence -= 20;
  }

  // Verificar coherencia
  const subtotalSum = subtotal0 + subtotal8 + subtotal12 + subtotal15 + subtotalNoObj + subtotalExento;
  if (subtotalSum > 0 && total > 0 && Math.abs(subtotalSum + iva - total) > 0.10) {
    warnings.push(`Inconsistencia: subtotal(${subtotalSum.toFixed(2)}) + IVA(${iva.toFixed(2)}) ≠ total(${total.toFixed(2)})`);
    confidence -= 10;
  }

  // --- Forma de pago ---
  const pagoMatch = t.match(/(\d{2}\s*-\s*[^\n]+?)\s+([\d,]+\.\d{2})\s*\n/i);
  const formaPago = pagoMatch?.[1]?.trim();
  const valorFormaPago = pagoMatch ? parseFloat(pagoMatch[2].replace(/,/g, '')) : undefined;

  // --- Ítems (mejor esfuerzo desde RIDE) ---
  const items = extractItemsFromRide(t, iva > 0 ? (subtotal15 > 0 ? 15 : subtotal12 > 0 ? 12 : 0) : 0);
  if (items.length === 0) {
    warnings.push('No se pudieron extraer ítems del PDF — requiere revisión manual');
    confidence -= 20;
  }

  return {
    claveAcceso,
    tipoDocumento: claveData?.tipoDocumento ?? 'FACTURA',
    rucEmisor,
    razonSocialEmisor,
    contribuyenteEspecial,
    obligadoContabilidad,
    dirEmisor: undefined,
    estab: claveData?.estab ?? '',
    ptoEmi: claveData?.ptoEmi ?? '',
    secuencial: claveData?.secuencial ?? '',
    numeroDoc,
    fechaEmision,
    fechaAutorizacion,
    ambiente,
    tipoEmision: claveData?.tipoEmision ?? 'NORMAL',
    tipoIdComprador,
    idComprador,
    razonSocialComprador,
    dirComprador,
    subtotal0,
    subtotal8,
    subtotal12,
    subtotal15,
    subtotalNoObj,
    subtotalExento,
    totalDescuento,
    ice,
    iva,
    irbpnr,
    propina,
    total,
    formaPago,
    valorFormaPago,
    items,
    parseConfidence: Math.max(0, confidence),
    parseWarnings: warnings,
  };
}

/**
 * Intenta extraer ítems de la tabla del RIDE.
 * El texto PDF no es estructurado, hacemos nuestro mejor esfuerzo.
 */
function extractItemsFromRide(text: string, defaultTarifa: number): SriParsedItem[] {
  const items: SriParsedItem[] = [];

  // Buscar bloques que parecen líneas de ítem: código + descripción + números
  // Patrón: algo que parece código, cantidad, precio, total al final de línea
  const linePattern = /^([A-Z0-9\-]+)\s+([\d.]+)\s+(.+?)\s+([\d.]+)\s+0\.00\s+0\.00\s+0\.00\s+([\d.]+)$/gm;
  let match;
  let linea = 1;

  while ((match = linePattern.exec(text)) !== null) {
    const cantidad = parseFloat(match[2]);
    const precioUnitario = parseFloat(match[4]);
    const precioTotal = parseFloat(match[5]);

    if (isNaN(cantidad) || isNaN(precioUnitario) || isNaN(precioTotal)) continue;
    if (precioTotal <= 0) continue;

    const valorIva = precioTotal * (defaultTarifa / 100);

    items.push({
      linea: linea++,
      codPrincipal: match[1].trim(),
      descripcion: match[3].trim(),
      cantidad,
      precioUnitario,
      descuento: 0,
      precioTotal,
      codigoTarifa: String(defaultTarifa),
      tarifaIva: defaultTarifa,
      valorIva: Math.round(valorIva * 100) / 100,
    });
  }

  return items;
}

// ============================================================
// PARSEO XML (formato SRI oficial)
// ============================================================

// Mapeo codigoPorcentaje → tarifa IVA
const IVA_CODIGO_MAP: Record<string, { tarifa: number; codigo: string }> = {
  '0':  { tarifa: 0,  codigo: '0' },
  '2':  { tarifa: 12, codigo: '12' },
  '3':  { tarifa: 14, codigo: '14' },
  '4':  { tarifa: 0,  codigo: 'NO_OBJETO' },
  '5':  { tarifa: 15, codigo: '15' },
  '6':  { tarifa: 0,  codigo: 'EXENTO' },
  '7':  { tarifa: 8,  codigo: '8' },
  '8':  { tarifa: 0,  codigo: 'DIFERENCIAL' },
  '10': { tarifa: 15, codigo: '15' },
};

const TIPO_DOC_COD_MAP: Record<string, string> = {
  '01': 'FACTURA',
  '03': 'LIQUIDACION_COMPRA',
  '04': 'NOTA_CREDITO',
  '05': 'NOTA_DEBITO',
  '06': 'GUIA_REMISION',
  '07': 'RETENCION',
};

export async function parseXml(buffer: Buffer): Promise<SriParsedDocument> {
  const xmlStr = buffer.toString('utf-8');
  const warnings: string[] = [];
  let confidence = 100;

  // El SRI puede entregar el XML envuelto en una respuesta de autorización
  // Detectar y extraer el comprobante interno si es necesario
  let xmlToParse = xmlStr;
  if (xmlStr.includes('<autorizacion>')) {
    const innerMatch = xmlStr.match(/<comprobante><!\[CDATA\[([\s\S]+?)\]\]><\/comprobante>/);
    if (innerMatch) {
      xmlToParse = innerMatch[1];
    }
  }

  const parsed = await parseStringPromise(xmlToParse, {
    explicitArray: false,
    ignoreAttrs: false,
    trim: true,
  });

  // Detectar tipo de comprobante
  let root: any = null;
  let tipoDocumento = 'FACTURA';
  if (parsed.factura) { root = parsed.factura; tipoDocumento = 'FACTURA'; }
  else if (parsed.notaCredito) { root = parsed.notaCredito; tipoDocumento = 'NOTA_CREDITO'; }
  else if (parsed.notaDebito) { root = parsed.notaDebito; tipoDocumento = 'NOTA_DEBITO'; }
  else if (parsed.comprobanteRetencion) { root = parsed.comprobanteRetencion; tipoDocumento = 'RETENCION'; }
  else if (parsed.liquidacionCompra) { root = parsed.liquidacionCompra; tipoDocumento = 'LIQUIDACION_COMPRA'; }
  else {
    warnings.push('Tipo de comprobante XML no reconocido');
    confidence -= 30;
    root = parsed[Object.keys(parsed)[0]];
  }

  if (!root) throw new Error('XML no contiene un comprobante SRI válido');

  const info = root.infoTributaria ?? {};
  const infoDoc = root.infoFactura ?? root.infoNotaCredito ?? root.infoNotaDebito ?? root.infoCompRetencion ?? root.infoLiquidacionCompra ?? {};

  // --- Clave de acceso ---
  const claveAcceso: string = info.claveAcceso ?? '';
  const claveData = claveAcceso ? parseClaveAcceso(claveAcceso) : null;

  // --- Emisor ---
  const rucEmisor: string = info.ruc ?? '';
  const razonSocialEmisor: string = info.razonSocial ?? '';
  const nombreComercial: string | undefined = info.nombreComercial || undefined;
  const dirEmisor: string | undefined = info.dirMatriz || undefined;
  const contribuyenteEspecial: string | undefined = info.contribuyenteEspecial || undefined;
  const obligadoContabilidad = (info.obligadoContabilidad ?? '').toUpperCase() === 'SI';
  const estab: string = info.estab ?? '';
  const ptoEmi: string = info.ptoEmi ?? '';
  const secuencial: string = info.secuencial ?? '';
  const numeroDoc = `${estab}-${ptoEmi}-${secuencial}`;
  const tipoDocCod: string = info.codDoc ?? '01';
  tipoDocumento = TIPO_DOC_COD_MAP[tipoDocCod] ?? tipoDocumento;

  // --- Ambiente ---
  const ambienteCod: string = info.ambiente ?? '2';
  const ambiente = ambienteCod === '2' ? 'PRODUCCION' : 'PRUEBAS';
  const tipoEmisionCod: string = info.tipoEmision ?? '1';
  const tipoEmision = tipoEmisionCod === '1' ? 'NORMAL' : 'CONTINGENCIA';

  // --- Fecha emisión ---
  const fechaStr: string = infoDoc.fechaEmision ?? '';
  let fechaEmision = claveData?.fechaEmision ?? new Date();
  if (fechaStr) {
    const [d, m, y] = fechaStr.split('/');
    if (d && m && y) fechaEmision = new Date(`${y}-${m}-${d}T00:00:00`);
  }

  // --- Documento sustento (modificado): solo en infoNotaCredito/infoNotaDebito ---
  const codDocModificado: string | undefined = infoDoc.codDocModificado || undefined;
  const docModificadoTipo = codDocModificado ? (TIPO_DOC_COD_MAP[codDocModificado] ?? codDocModificado) : undefined;
  const docModificadoNumero: string | undefined = infoDoc.numDocModificado || undefined;
  let docModificadoFecha: Date | undefined;
  const fechaSustentoStr: string = infoDoc.fechaEmisionDocSustento ?? '';
  if (fechaSustentoStr) {
    const [ds, ms, ys] = fechaSustentoStr.split('/');
    if (ds && ms && ys) docModificadoFecha = new Date(`${ys}-${ms}-${ds}T00:00:00`);
  }

  // --- Cliente ---
  const idComprador: string | undefined = infoDoc.identificacionComprador || infoDoc.identificacionSujetoRetenido || undefined;
  const razonSocialComprador: string | undefined = infoDoc.razonSocialComprador || infoDoc.razonSocialSujetoRetenido || undefined;
  const dirComprador: string | undefined = infoDoc.direccionComprador || undefined;
  const tipoIdRaw: string = infoDoc.tipoIdentificacionComprador ?? '';
  const tipoIdMap: Record<string, string> = {
    '04': 'RUC', '05': 'CEDULA', '06': 'PASAPORTE', '07': 'CONS_FINAL', '08': 'ID_EXTERIOR',
  };
  const tipoIdComprador = tipoIdMap[tipoIdRaw] ?? tipoIdRaw;

  // --- Totales ---
  const totalSinImpuestos = parseFloat(infoDoc.totalSinImpuestos ?? '0');
  const totalDescuento = parseFloat(infoDoc.totalDescuento ?? '0');
  const importeTotal = parseFloat(infoDoc.importeTotal ?? infoDoc.valorTotal ?? '0');
  const propina = parseFloat(infoDoc.propina ?? '0');

  // Procesar totales por tarifa IVA
  let subtotal0 = 0, subtotal8 = 0, subtotal12 = 0, subtotal15 = 0;
  let subtotalNoObj = 0, subtotalExento = 0, iva = 0, ice = 0, irbpnr = 0;

  const totalConImpuestos = infoDoc.totalConImpuestos?.totalImpuesto;
  const impArray = totalConImpuestos
    ? (Array.isArray(totalConImpuestos) ? totalConImpuestos : [totalConImpuestos])
    : [];

  for (const imp of impArray) {
    const codigoCmp = String(imp.codigoPorcentaje ?? imp.codigo ?? '');
    const baseImp = parseFloat(imp.baseImponible ?? '0');
    const valor = parseFloat(imp.valor ?? '0');

    if (String(imp.codigo) === '2') {
      // IVA
      iva += valor;
      const mapped = IVA_CODIGO_MAP[codigoCmp];
      if (!mapped) { subtotal0 += baseImp; }
      else if (mapped.codigo === '0') { subtotal0 += baseImp; }
      else if (mapped.codigo === '8') { subtotal8 += baseImp; }
      else if (mapped.codigo === '12') { subtotal12 += baseImp; }
      else if (mapped.codigo === '15') { subtotal15 += baseImp; }
      else if (mapped.codigo === 'NO_OBJETO') { subtotalNoObj += baseImp; }
      else if (mapped.codigo === 'EXENTO') { subtotalExento += baseImp; }
    } else if (String(imp.codigo) === '3') {
      ice += valor;
    } else if (String(imp.codigo) === '5') {
      irbpnr += valor;
    }
  }

  // Si no se procesaron impuestos, usar totalSinImpuestos vs importeTotal para estimar
  if (iva === 0 && importeTotal > totalSinImpuestos) {
    iva = Math.round((importeTotal - totalSinImpuestos - propina) * 100) / 100;
  }

  // --- Forma de pago ---
  const pagosRaw = infoDoc.pagos?.pago;
  const pagosArr = pagosRaw ? (Array.isArray(pagosRaw) ? pagosRaw : [pagosRaw]) : [];
  const formaPago = pagosArr[0]?.formaPago;
  const valorFormaPago = pagosArr[0] ? parseFloat(pagosArr[0].total ?? '0') : undefined;

  // --- Ítems (detalles) ---
  const detallesRaw = root.detalles?.detalle;
  const detallesArr = detallesRaw ? (Array.isArray(detallesRaw) ? detallesRaw : [detallesRaw]) : [];
  const items: SriParsedItem[] = [];

  detallesArr.forEach((det: any, idx: number) => {
    const cantidad = parseFloat(det.cantidad ?? '1');
    const precioUnitario = parseFloat(det.precioUnitario ?? '0');
    const descuento = parseFloat(det.descuento ?? '0');
    const precioTotalSinImp = parseFloat(det.precioTotalSinImpuesto ?? '0');

    // IVA del ítem
    const impuestosItem = det.impuestos?.impuesto;
    const impItemArr = impuestosItem
      ? (Array.isArray(impuestosItem) ? impuestosItem : [impuestosItem])
      : [];

    let codigoTarifa = '15';
    let tarifaIva = 15;
    let valorIva = 0;

    for (const imp of impItemArr) {
      if (String(imp.codigo) === '2') {
        tarifaIva = parseFloat(imp.tarifa ?? '15');
        valorIva = parseFloat(imp.valor ?? '0');
        const mappedT = IVA_CODIGO_MAP[String(imp.codigoPorcentaje ?? '')]?.codigo ?? String(tarifaIva);
        codigoTarifa = mappedT;
      }
    }

    // Inferir tipo: si el código está en lista de servicios comunes, marcarlo
    const cod = (det.codigoPrincipal ?? '').toUpperCase();
    const esServicio = /^KTR|^SRV|^SERV/.test(cod);

    items.push({
      linea: idx + 1,
      codPrincipal: det.codigoPrincipal ?? '',
      codAuxiliar: det.codigoAuxiliar || undefined,
      descripcion: det.descripcion ?? '',
      detAdicional: det.detallesAdicionales
        ? Object.values(det.detallesAdicionales).join(', ')
        : undefined,
      cantidad,
      precioUnitario,
      descuento,
      precioTotal: precioTotalSinImp,
      codigoTarifa,
      tarifaIva,
      valorIva: Math.round(valorIva * 100) / 100,
    });
  });

  if (items.length === 0) {
    warnings.push('XML no contiene detalles de ítems');
    confidence -= 10;
  }

  return {
    claveAcceso,
    tipoDocumento,
    rucEmisor,
    razonSocialEmisor,
    nombreComercial,
    dirEmisor,
    contribuyenteEspecial,
    obligadoContabilidad,
    estab,
    ptoEmi,
    secuencial,
    numeroDoc,
    fechaEmision,
    fechaAutorizacion: undefined,
    ambiente,
    tipoEmision,
    tipoIdComprador,
    idComprador,
    razonSocialComprador,
    dirComprador,
    subtotal0: Math.round(subtotal0 * 100) / 100,
    subtotal8: Math.round(subtotal8 * 100) / 100,
    subtotal12: Math.round(subtotal12 * 100) / 100,
    subtotal15: Math.round(subtotal15 * 100) / 100,
    subtotalNoObj: Math.round(subtotalNoObj * 100) / 100,
    subtotalExento: Math.round(subtotalExento * 100) / 100,
    totalDescuento: Math.round(totalDescuento * 100) / 100,
    ice: Math.round(ice * 100) / 100,
    iva: Math.round(iva * 100) / 100,
    irbpnr: Math.round(irbpnr * 100) / 100,
    propina: Math.round(propina * 100) / 100,
    total: Math.round(importeTotal * 100) / 100,
    formaPago,
    valorFormaPago,
    docModificadoTipo,
    docModificadoNumero,
    docModificadoFecha,
    items,
    parseConfidence: Math.max(0, confidence),
    parseWarnings: warnings,
  };
}
