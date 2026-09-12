import forge from 'node-forge';
import { inspectP12 } from '../src/services/finance/engines/p12-inspector.engine';

/** Genera un .p12 autofirmado en memoria (equivalente de prueba a un certificado real del SRI). */
function buildTestP12(password: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(1024); // pequeño: solo para test, no se usa para firmar nada real
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2027-01-01T00:00:00Z');
  const attrs = [{ name: 'commonName', value: 'PRUEBA CERTIFICADO KALLPAPRO' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password);
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, 'binary');
}

describe('p12-inspector.engine', () => {
  it('extrae vigencia y CN de un .p12 válido con la contraseña correcta', () => {
    const p12 = buildTestP12('clave123');
    const info = inspectP12(p12, 'clave123');
    expect(info.subjectCN).toBe('PRUEBA CERTIFICADO KALLPAPRO');
    expect(info.validFrom.getUTCFullYear()).toBe(2026);
    expect(info.validTo.getUTCFullYear()).toBe(2027);
  });

  it('rechaza una contraseña incorrecta con mensaje apto para el usuario', () => {
    const p12 = buildTestP12('clave-correcta');
    expect(() => inspectP12(p12, 'clave-incorrecta')).toThrow(/Contraseña incorrecta/);
  });

  it('rechaza un archivo que no es un .p12', () => {
    expect(() => inspectP12(Buffer.from('esto no es un certificado'), 'x')).toThrow(/formato/);
  });
});
