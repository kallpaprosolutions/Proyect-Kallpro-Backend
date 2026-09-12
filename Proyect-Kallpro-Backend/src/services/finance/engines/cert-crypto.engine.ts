import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Cifrado en reposo del certificado .p12 y su contraseña (AES-256-GCM). Motor puro: no toca
// BD ni red, así que se prueba con datos en memoria. La clave de aplicación (CERT_ENCRYPTION_KEY)
// nunca es la contraseña del usuario — es un secreto de despliegue, igual que JWT_SECRET.
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function deriveKey(appKey: string): Buffer {
  // scrypt permite usar cualquier string como CERT_ENCRYPTION_KEY (no exige exactamente 32 bytes)
  return scryptSync(appKey, 'kallpapro-fiscal-cert', 32);
}

/** Cifra un buffer (archivo .p12) → concatena iv(12) + tag(16) + ciphertext. */
export function encryptBuffer(plain: Buffer, appKey: string): Buffer {
  const key = deriveKey(appKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

/** Descifra el resultado de `encryptBuffer`. Lanza si la clave no coincide o el dato fue alterado. */
export function decryptBuffer(payload: Buffer, appKey: string): Buffer {
  const key = deriveKey(appKey);
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Cifra un string (contraseña del .p12) → "iv:tag:ciphertext" en hex. */
export function encryptString(plain: string, appKey: string): string {
  const encrypted = encryptBuffer(Buffer.from(plain, 'utf8'), appKey);
  return encrypted.toString('hex');
}

/** Descifra el resultado de `encryptString`. */
export function decryptString(payload: string, appKey: string): string {
  return decryptBuffer(Buffer.from(payload, 'hex'), appKey).toString('utf8');
}
