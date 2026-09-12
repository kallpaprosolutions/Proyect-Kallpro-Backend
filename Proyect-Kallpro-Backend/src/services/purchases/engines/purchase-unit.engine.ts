// Motor PURO (sin BD) — C3 (resto): unidad de compra ≠ unidad de venta/stock (brecha doc21).
// Se compra por CAJA/PAQUETE/PALETA pero el stock y las ventas siguen valorados y contados en
// la unidad de siempre (`Product.unit`). Este motor convierte entre ambas — el resto del flujo
// (recepción de OC, kardex, ProductStock) sigue operando 100% en unidad de stock, sin cambios.

export interface UnitConversionInfo {
  purchaseUnit: string | null;
  purchaseConversionFactor: number; // cuántas unidades de stock hay en 1 unidad de compra
  stockUnit: string;
}

/** true si el producto realmente tiene una unidad de compra distinta configurada (no solo el default). */
export function hasUnitConversion(p: UnitConversionInfo): boolean {
  return !!p.purchaseUnit && p.purchaseUnit !== p.stockUnit && p.purchaseConversionFactor > 0 && p.purchaseConversionFactor !== 1;
}

/** Cantidad en unidad de compra → cantidad en unidad de stock. Redondea a entero:
 * `POItem.quantity` es `Int` (el kardex siempre cuenta unidades enteras de stock). */
export function purchaseToStockQuantity(purchaseQty: number, conversionFactor: number): number {
  return Math.round(purchaseQty * conversionFactor);
}

/** Precio por unidad de compra → precio por unidad de stock (2 decimales, como la columna). */
export function purchaseToStockUnitPrice(purchaseUnitPrice: number, conversionFactor: number): number {
  if (conversionFactor <= 0) return purchaseUnitPrice;
  return Math.round((purchaseUnitPrice / conversionFactor) * 100) / 100;
}

/** Inversa: cantidad de stock → cantidad de compra (para mostrar "72 UNIDAD = 3 CAJA"). */
export function stockToPurchaseQuantity(stockQty: number, conversionFactor: number): number {
  if (conversionFactor <= 0) return stockQty;
  return Math.round((stockQty / conversionFactor) * 10000) / 10000;
}
