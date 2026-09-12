# Módulo SRI Ecuador — KallpaPro
> Importación automática de facturas electrónicas SRI Ecuador via PDF (RIDE) o XML.
> Fase 1: upload → parse → match OC → review → confirm → inventario.

---

## Flujo completo

```
1. Usuario sube PDF (RIDE) o XML
        ↓
2. sri-parser.service.ts parsea el archivo
   - PDF: pdf-parse v1.1.1 + nextNumber() para RIDE two-column layout
   - XML: xml2js parseStringPromise
        ↓
3. Decodifica clave de acceso (49 dígitos)
   → extrae: fecha, tipo doc, RUC emisor, ambiente, estab, ptoEmi, secuencial
        ↓
4. Verifica no duplicado (@@unique [companyId, claveAcceso])
        ↓
5. Busca Supplier por rucEmisor en BD
        ↓
6. findMatchingPO() — busca OC pendiente del mismo proveedor
   → Calcula confidence score según tolerancia de monto
        ↓
7. Crea SriDocument con status: PENDING_REVIEW
   → Crea SriDocumentItem[] por cada ítem de la factura
        ↓
8. Usuario revisa en /sri/:id
   → Puede editar tipoItem (PRODUCTO/SERVICIO) por línea
   → Puede asignar productId por línea (mapeo a producto ERP)
   → Puede cambiar proveedor o OC asignada
        ↓
9. Usuario hace clic en "Confirmar y cargar inventario"
        ↓
10. confirmSriDocument():
    → Para cada ítem con tipoItem=PRODUCTO y productId asignado:
       registerMovement(IN) → actualiza avgCost + ProductStock
    → Si hay OC: cambia estado a RECEIVED o PARTIAL
    → SriDocument.status → CONFIRMED
```

---

## Estructura Clave de Acceso SRI (49 dígitos)

```
Posición  1- 8: Fecha emisión (ddmmaaaa)
Posición  9-10: Tipo documento (01=Factura, 04=NotaCredito, 05=NotaDebito, 07=Retencion)
Posición 11-23: RUC emisor (13 dígitos)
Posición 24:    Ambiente (1=Pruebas, 2=Producción)
Posición 25-27: Establecimiento (001)
Posición 28-30: Punto de emisión (001)
Posición 31-39: Secuencial (9 dígitos, ej: 000001305)
Posición 40-47: Código numérico (8 dígitos aleatorios)
Posición 48:    Tipo emisión (1=Normal, 2=Contingencia)
Posición 49:    Dígito verificador (Módulo 11)

Ejemplo:
1004202501179186082900120130010000001305000000111 2
[fecha ][tp][    RUC    ][a][est][pto][secuencial ][codigoNum][em][dv]
```

---

## Parseo PDF (RIDE)

### Problema del layout two-column
Los RIDE PDF tienen dos columnas. `pdf-parse` lee el texto en orden y separa etiquetas de valores en líneas distintas.

**Solución: función `nextNumber()`**

```typescript
// Busca el label en el texto, luego el primer número decimal dentro de 80 chars
const nextNumber = (label: string, maxChars = 80): number => {
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const idx = t.search(re);
  if (idx === -1) return 0;
  const slice = t.substring(idx + label.length, idx + label.length + maxChars);
  const m = slice.match(/([\d,]+\.\d{2})/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
};

// Uso:
const subtotal15 = nextNumber('SUBTOTAL 15%');
const iva = nextNumber('IVA 15%');
const total = nextNumber('VALOR TOTAL');
```

### Extracción de RUC emisor
```typescript
// Busca "R.U.C.:" seguido del número
const rucMatch = t.match(/R\.U\.C\.[\s:]+(\d{13})/);
// Fallback: primer número de 13 dígitos en el texto
```

### Dependencia crítica
```
pdf-parse@1.1.1   ← DEBE ser esta versión
                     v2.x exporta clase, no función → error "pdfParse is not a function"
```

---

## Parseo XML (SRI)

El XML nativo SRI (descargado del portal o enviado por el emisor):

```typescript
// Nodo raíz variable según tipo de documento:
const root = result.factura || result.notaCredito || result.notaDebito || result.retencion;
const info = root.infoFactura[0] || root.infoNotaCredito[0] ...;
```

### Mapeo codigoPorcentaje → tarifa IVA
```
codigoPorcentaje → tarifaIva
0  → 0%
2  → 12%
5  → 15%   (vigente desde junio 2024)
7  → 8%    (construcción)
4  → NO_OBJETO
6  → EXENTO
```

---

## Algoritmo de Matching OC

```typescript
// Busca OC abiertas del mismo proveedor
const openPOs = await prisma.purchaseOrder.findMany({
  where: { companyId, supplierId, status: { in: ['SENT', 'PARTIAL', 'DRAFT'] } },
});

// Calcula confidence por diferencia de monto
const diff = Math.abs(poTotal - totalFactura) / totalFactura;
let confidence = 40; // base: mismo proveedor
if (diff <= 0.01) confidence = 95;      // ±1%  → Coincidencia alta
else if (diff <= 0.05) confidence = 80; // ±5%  → Coincidencia media
else if (diff <= 0.10) confidence = 65; // ±10% → Coincidencia baja-media
else if (diff <= 0.20) confidence = 50; // ±20% → Coincidencia baja
// else → 40 (solo mismo proveedor)
```

---

## Heurística tipoItem (PRODUCTO vs SERVICIO)

Al crear el documento, cada ítem se clasifica automáticamente:

```typescript
const cod = item.codPrincipal.toUpperCase();
const esServicio = /^KTR|^SRV|^SERV|^MO-/.test(cod);
tipoItem = esServicio ? 'SERVICIO' : 'PRODUCTO';
```

El usuario puede cambiar esta clasificación en la pantalla de revisión.

---

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/sri/upload | Subir PDF/XML → parsear → crear SriDocument |
| GET | /api/sri | Listar documentos (filtro por status) |
| GET | /api/sri/kpis | KPIs: pendientes, confirmados, total compras, IVA |
| GET | /api/sri/catalogs | IVA tariffs + retention catalog |
| GET | /api/sri/:id | Detalle de un documento |
| PATCH | /api/sri/:id | Actualizar (proveedor, OC, observaciones, ítems) |
| POST | /api/sri/:id/confirm | Confirmar → actualiza inventario |
| POST | /api/sri/:id/reject | Rechazar con motivo |
| DELETE | /api/sri/:id | Eliminar (solo si no está CONFIRMED) |

---

## Multer — Upload de archivos

```typescript
// Configuración en sri-document.routes.ts
const storage = multer.memoryStorage(); // no guarda en disco
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf', 'application/xml', 'text/xml'].includes(file.mimetype)
      || file.originalname.endsWith('.xml') || file.originalname.endsWith('.pdf');
    cb(null, ok);
  },
});

// Route:
router.post('/upload', authMiddleware, upload.single('file'), uploadDocument);
```

---

## Catálogos tributarios (seed)

### IVA (6 registros)
| Código | Descripción | Porcentaje |
|--------|-------------|-----------|
| 0 | Tarifa 0% | 0.00 |
| 8 | Tarifa 8% (construcción) | 8.00 |
| 12 | Tarifa 12% (hasta mayo 2024) | 12.00 |
| 15 | Tarifa 15% (vigente) | 15.00 |
| NO_OBJETO | No Objeto de IVA | 0.00 |
| EXENTO | Exento de IVA | 0.00 |

### Retenciones (42 registros)
- **30 retenciones IR** (Impuesto a la Renta): códigos 303 al 3491
  - Honorarios profesionales: 10%
  - Servicios predomina intelectual: 8%
  - Servicios prevalece mano de obra: 2%
  - Bienes inmuebles: 8%
  - Bienes muebles: 1%
  - Otros servicios: 2%
  - ... (ver seed-tax.ts para lista completa)
- **12 retenciones IVA**: códigos 721 al 734
  - 721: Retención IVA 30% — bienes
  - 723: Retención IVA 70% — servicios
  - 725: Retención IVA 100% — servicios profesionales

---

## KPIs SRI

```typescript
GET /api/sri/kpis

{
  pendientes: number,              // status = PENDING_REVIEW
  confirmados: number,             // status = CONFIRMED
  rechazados: number,              // status = REJECTED
  total: number,                   // todos
  totalCompras: number,            // suma total de docs CONFIRMED
  totalIVACreditoFiscal: number    // suma IVA de docs CONFIRMED
}
```

---

## Pantalla de revisión (SriDocumentReviewPage.tsx)

- Muestra datos del emisor + datos del comprobante
- Tabla de ítems con columna editable `tipoItem` (PRODUCTO/SERVICIO)
- Campo para asignar productId por ítem (dropdown de productos ERP)
- Si hay match con OC: muestra badge con porcentaje de confianza
- Si parseConfidence < 70: muestra advertencias de parseo
- Botones: ✓ Confirmar / ✗ Rechazar / 🗑 Eliminar

---

## Archivos del módulo

```
Backend:
  src/routes/sri-document.routes.ts
  src/controllers/sri-document.controller.ts
  src/services/sri-document.service.ts
  src/services/sri-parser.service.ts
  prisma/seed-tax.ts

Frontend:
  src/api/sriDocuments.ts
  src/pages/financial/SriDocumentsPage.tsx
  src/pages/financial/SriDocumentReviewPage.tsx
```
