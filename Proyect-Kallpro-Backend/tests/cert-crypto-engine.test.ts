import { encryptBuffer, decryptBuffer, encryptString, decryptString } from '../src/services/finance/engines/cert-crypto.engine';

describe('cert-crypto.engine', () => {
  const key = 'clave-de-prueba-no-usar-en-produccion';

  it('cifra y descifra un buffer (.p12) sin pérdida de datos', () => {
    const original = Buffer.from([0x30, 0x82, 0x01, 0x02, 0xff, 0x00, 0xab]);
    const encrypted = encryptBuffer(original, key);
    expect(encrypted.equals(original)).toBe(false);
    const decrypted = decryptBuffer(encrypted, key);
    expect(decrypted.equals(original)).toBe(true);
  });

  it('cifra y descifra un string (contraseña del .p12)', () => {
    const password = 'MiClaveSecreta123!';
    const encrypted = encryptString(password, key);
    expect(encrypted).not.toContain(password);
    expect(decryptString(encrypted, key)).toBe(password);
  });

  it('cada cifrado usa un IV distinto (mismo texto → salida distinta)', () => {
    const a = encryptString('hola', key);
    const b = encryptString('hola', key);
    expect(a).not.toBe(b);
  });

  it('falla al descifrar con la clave de aplicación equivocada', () => {
    const encrypted = encryptString('secreto', key);
    expect(() => decryptString(encrypted, 'otra-clave-distinta')).toThrow();
  });

  it('falla si el payload cifrado fue alterado (integridad GCM)', () => {
    const encrypted = encryptBuffer(Buffer.from('datos'), key);
    encrypted[encrypted.length - 1] ^= 0xff; // corrompe el último byte del ciphertext
    expect(() => decryptBuffer(encrypted, key)).toThrow();
  });
});
