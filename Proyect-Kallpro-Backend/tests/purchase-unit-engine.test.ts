import {
  hasUnitConversion, purchaseToStockQuantity, purchaseToStockUnitPrice, stockToPurchaseQuantity,
} from '../src/services/purchases/engines/purchase-unit.engine';

describe('purchase-unit.engine', () => {
  describe('hasUnitConversion', () => {
    it('false si no hay purchaseUnit configurado', () => {
      expect(hasUnitConversion({ purchaseUnit: null, purchaseConversionFactor: 1, stockUnit: 'UNIDAD' })).toBe(false);
    });

    it('false si purchaseUnit es igual a la unidad de stock', () => {
      expect(hasUnitConversion({ purchaseUnit: 'UNIDAD', purchaseConversionFactor: 1, stockUnit: 'UNIDAD' })).toBe(false);
    });

    it('false si el factor es 1 (aunque el nombre difiera, no hay conversión real)', () => {
      expect(hasUnitConversion({ purchaseUnit: 'CAJA', purchaseConversionFactor: 1, stockUnit: 'UNIDAD' })).toBe(false);
    });

    it('true cuando hay unidad distinta y factor real', () => {
      expect(hasUnitConversion({ purchaseUnit: 'CAJA', purchaseConversionFactor: 24, stockUnit: 'UNIDAD' })).toBe(true);
    });
  });

  describe('purchaseToStockQuantity', () => {
    it('multiplica por el factor de conversión', () => {
      expect(purchaseToStockQuantity(3, 24)).toBe(72);
    });

    it('redondea a entero (POItem.quantity es Int)', () => {
      expect(purchaseToStockQuantity(1.5, 10)).toBe(15);
      expect(purchaseToStockQuantity(1, 8.33)).toBe(8);
    });
  });

  describe('purchaseToStockUnitPrice', () => {
    it('divide el precio de compra entre el factor', () => {
      expect(purchaseToStockUnitPrice(24, 24)).toBe(1);
      expect(purchaseToStockUnitPrice(12, 24)).toBe(0.5);
    });

    it('redondea a 2 decimales (columna Decimal(12,2))', () => {
      expect(purchaseToStockUnitPrice(25, 24)).toBe(1.04); // 1.0416... → 1.04
    });

    it('devuelve el precio tal cual si el factor es 0 o negativo (dato inválido, no revienta)', () => {
      expect(purchaseToStockUnitPrice(10, 0)).toBe(10);
    });
  });

  describe('stockToPurchaseQuantity', () => {
    it('es la inversa de purchaseToStockQuantity para factores exactos', () => {
      expect(stockToPurchaseQuantity(72, 24)).toBe(3);
    });

    it('devuelve la cantidad de stock tal cual si el factor es inválido', () => {
      expect(stockToPurchaseQuantity(50, 0)).toBe(50);
    });
  });
});
