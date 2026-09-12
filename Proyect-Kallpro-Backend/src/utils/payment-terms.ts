/**
 * Plazos de pago compartidos entre CxP (Supplier.paymentTerms) y CxC (Customer.paymentTerms).
 * Función pura, sin BD — testeada por separado.
 */
export const TERM_DAYS: Record<string, number> = {
  CONTADO: 0, '15_DIAS': 15, '30_DIAS': 30, '60_DIAS': 60, '90_DIAS': 90,
};

export function computeDueDate(issueDate: Date, paymentTerms: string | null | undefined): Date {
  const days = TERM_DAYS[paymentTerms ?? ''] ?? 0;
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + days);
  return dueDate;
}
