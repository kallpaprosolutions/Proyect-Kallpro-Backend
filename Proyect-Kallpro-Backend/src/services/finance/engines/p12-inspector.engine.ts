import forge from 'node-forge';

// Inspecciona un certificado .p12 SIN guardarlo ni firmar nada: valida que la contraseña
// abra el archivo (falla rápido en la subida, no el día que se intenta firmar una factura
// real) y extrae la vigencia para avisar antes de que caduque. Motor puro: recibe bytes en
// memoria, no toca disco/BD/red — se puede probar con un .p12 de prueba generado en el test.
export interface P12Info {
  validFrom: Date;
  validTo: Date;
  subjectCN: string | null;
  issuerCN: string | null;
}

/** Lanza un Error con mensaje apto para el usuario si la contraseña es incorrecta o el archivo no es un .p12 válido. */
export function inspectP12(fileBuffer: Buffer, password: string): P12Info {
  let p12Asn1;
  try {
    const der = forge.util.createBuffer(fileBuffer.toString('binary'));
    p12Asn1 = forge.asn1.fromDer(der);
  } catch {
    throw new Error('El archivo no tiene un formato .p12/.pfx válido');
  }

  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  } catch {
    throw new Error('Contraseña incorrecta para este certificado, o archivo dañado');
  }

  const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBags = bags[forge.pki.oids.certBag] ?? [];
  if (certBags.length === 0) {
    throw new Error('El archivo .p12 no contiene ningún certificado');
  }
  // El certificado de firma (con clave privada) suele ser el primero sin CA conocida propia;
  // para el propósito de mostrar vigencia al usuario tomamos el primero, que en un .p12 de
  // firma electrónica personal/empresarial es el certificado del titular.
  const cert = certBags[0].cert!;

  return {
    validFrom: cert.validity.notBefore,
    validTo: cert.validity.notAfter,
    subjectCN: cert.subject.getField('CN')?.value ?? null,
    issuerCN: cert.issuer.getField('CN')?.value ?? null,
  };
}
