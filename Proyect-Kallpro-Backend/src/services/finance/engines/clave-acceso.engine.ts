/**
 * Clave de acceso SRI (Ficha Técnica de Comprobantes Electrónicos): 49 dígitos =
 *   8  fecha de emisión (ddmmaaaa)
 *   2  tipo de comprobante (01=factura, 04=nota de crédito, 05=nota de débito,
 *      06=guía de remisión, 07=comprobante de retención)
 *  13  RUC del emisor
 *   1  ambiente (1=pruebas, 2=producción)
 *   3  establecimiento + 3 punto de emisión (serie)
 *   9  secuencial
 *   8  código numérico (aleatorio, elegido por el emisor — evita colisiones entre
 *      comprobantes con la misma fecha/serie/secuencial si algo se reintenta)
 *   1  tipo de emisión (1=normal, 2=contingencia)
 *   1  dígito verificador (módulo 11 sobre los 48 dígitos anteriores)
 * Motor puro: sin fechas "ahora", sin BD — recibe todo como input.
 */

/** Módulo 11 sobre 48 dígitos: pesos 2..7 cíclicos de derecha a izquierda. Mismo algoritmo del dígito verificador de cédula/RUC. */
export function computeVerificationDigit(digits48: string): number {
  if (!/^\d{48}$/.test(digits48)) {
    throw new Error(`Se requieren exactamente 48 dígitos para calcular el verificador (recibidos: ${digits48.length})`);
  }
  const weights = [2, 3, 4, 5, 6, 7];
  let sum = 0;
  for (let i = 0; i < 48; i++) {
    const digit = Number(digits48[47 - i]); // de derecha a izquierda
    sum += digit * weights[i % 6];
  }
  const remainder = sum % 11;
  const verificador = 11 - remainder;
  if (verificador === 11) return 0;
  if (verificador === 10) return 1;
  return verificador;
}

export type TipoComprobanteSri = 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO' | 'GUIA_REMISION' | 'RETENCION';

const COD_DOC: Record<TipoComprobanteSri, string> = {
  FACTURA: '01',
  NOTA_CREDITO: '04',
  NOTA_DEBITO: '05',
  GUIA_REMISION: '06',
  RETENCION: '07',
};

export interface ClaveAccesoInput {
  fechaEmision: Date;
  tipoComprobante: TipoComprobanteSri;
  ruc: string; // 13 dígitos
  ambiente: 'PRUEBAS' | 'PRODUCCION';
  estab: string; // 3 dígitos
  ptoEmi: string; // 3 dígitos
  secuencial: string; // 9 dígitos
  codigoNumerico: string; // 8 dígitos
  tipoEmision?: 'NORMAL' | 'CONTINGENCIA'; // default NORMAL
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildClaveAcceso(input: ClaveAccesoInput): string {
  if (!/^\d{13}$/.test(input.ruc)) throw new Error('El RUC del emisor debe tener 13 dígitos');
  if (!/^\d{3}$/.test(input.estab)) throw new Error('El establecimiento debe ser de 3 dígitos');
  if (!/^\d{3}$/.test(input.ptoEmi)) throw new Error('El punto de emisión debe ser de 3 dígitos');
  if (!/^\d{9}$/.test(input.secuencial)) throw new Error('El secuencial debe tener 9 dígitos');
  if (!/^\d{8}$/.test(input.codigoNumerico)) throw new Error('El código numérico debe tener 8 dígitos');

  const d = input.fechaEmision;
  const fecha = `${pad2(d.getUTCDate())}${pad2(d.getUTCMonth() + 1)}${d.getUTCFullYear()}`;
  const ambiente = input.ambiente === 'PRODUCCION' ? '2' : '1';
  const tipoEmision = input.tipoEmision === 'CONTINGENCIA' ? '2' : '1';

  const base48 = [
    fecha,
    COD_DOC[input.tipoComprobante],
    input.ruc,
    ambiente,
    input.estab,
    input.ptoEmi,
    input.secuencial,
    input.codigoNumerico,
    tipoEmision,
  ].join('');

  if (base48.length !== 48) {
    throw new Error(`Clave de acceso mal formada: ${base48.length} dígitos en vez de 48`);
  }
  return `${base48}${computeVerificationDigit(base48)}`;
}

/** Código numérico aleatorio de 8 dígitos exigido por la clave de acceso (no es un secreto, solo evita colisiones). */
export function randomCodigoNumerico(): string {
  return String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
}
