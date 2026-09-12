import forge from 'node-forge';
import { signComprobante, looksSigned, describeSigningError } from '../src/services/finance/engines/xml-signer.engine';
import { buildFacturaXml, FacturaXmlInput } from '../src/services/finance/engines/factura-xml.engine';
import { buildClaveAcceso } from '../src/services/finance/engines/clave-acceso.engine';

/** Genera un .p12 autofirmado en memoria — equivalente de prueba a un certificado real del SRI (misma técnica que p12-inspector-engine.test.ts). */
function buildTestP12(password: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048); // RSA 2048: el mínimo que muchos verificadores XAdES esperan
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2027-01-01T00:00:00Z');
  const attrs = [{ name: 'commonName', value: 'FIRMANTE DE PRUEBA KALLPAPRO' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password);
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, 'binary');
}

function buildUnsignedFacturaXml(): string {
  const claveAcceso = buildClaveAcceso({
    fechaEmision: new Date('2026-09-15T00:00:00Z'),
    tipoComprobante: 'FACTURA',
    ruc: '1790012345001',
    ambiente: 'PRUEBAS',
    estab: '001',
    ptoEmi: '001',
    secuencial: '000000001',
    codigoNumerico: '12345678',
  });
  const input: FacturaXmlInput = {
    ambiente: 'PRUEBAS',
    claveAcceso,
    emisor: {
      ruc: '1790012345001',
      razonSocial: 'Comercial Prueba S.A.',
      dirMatriz: 'Av. Amazonas N34-451, Quito',
      obligadoContabilidad: true,
    },
    estab: '001',
    ptoEmi: '001',
    secuencial: '000000001',
    fechaEmision: new Date('2026-09-15T00:00:00Z'),
    comprador: { tipoIdentificacion: 'CEDULA', identificacion: '1712345678', razonSocial: 'Juan Pérez' },
    items: [{ codigoPrincipal: 'PROD-001', descripcion: 'Tornillo M6', cantidad: 10, precioUnitario: 1, ivaCodigo: '15' }],
  };
  return buildFacturaXml(input);
}

describe('xml-signer.engine — signComprobante', () => {
  it('firma una factura y produce un XML con nodo de firma XAdES-BES', () => {
    const p12 = buildTestP12('clave123');
    const unsigned = buildUnsignedFacturaXml();
    const signed = signComprobante('FACTURA', unsigned, p12, 'clave123');

    expect(looksSigned(signed)).toBe(true);
    expect(signed).toContain('<claveAcceso>'); // el contenido original de la factura sigue intacto
    expect(signed.length).toBeGreaterThan(unsigned.length); // la firma se anexó, no reemplazó nada
  });

  it('el XML firmado sigue siendo XML bien formado (parseable)', () => {
    const p12 = buildTestP12('clave123');
    const signed = signComprobante('FACTURA', buildUnsignedFacturaXml(), p12, 'clave123');
    // Un parser XML real (no regex) confirma que la inserción de la firma no rompió la estructura.
    const { DOMParser } = require('@xmldom/xmldom');
    const parseErrors: string[] = [];
    const doc = new DOMParser({ onError: (level: string, msg: string) => parseErrors.push(`${level}: ${msg}`) }).parseFromString(signed, 'text/xml');
    expect(parseErrors).toEqual([]);
    expect(doc.documentElement.tagName).toBe('factura');
  });

  it('rechaza una contraseña de certificado incorrecta con un mensaje apto para el usuario', () => {
    const p12 = buildTestP12('clave-correcta');
    expect(() => signComprobante('FACTURA', buildUnsignedFacturaXml(), p12, 'clave-incorrecta')).toThrow();
    try {
      signComprobante('FACTURA', buildUnsignedFacturaXml(), p12, 'clave-incorrecta');
    } catch (e) {
      expect(describeSigningError(e)).toMatch(/certificado|contraseña/i);
    }
  });

  it('dos firmas del mismo documento no son idénticas (el sello de tiempo cambia)', () => {
    const p12 = buildTestP12('clave123');
    const xml = buildUnsignedFacturaXml();
    const a = signComprobante('FACTURA', xml, p12, 'clave123');
    const b = signComprobante('FACTURA', xml, p12, 'clave123');
    expect(a).not.toBe(b);
  });
});
