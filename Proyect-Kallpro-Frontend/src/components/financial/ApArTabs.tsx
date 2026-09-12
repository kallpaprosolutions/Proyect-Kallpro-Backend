import CxPWorkbench from './CxPWorkbench';
import CxCWorkbench from './CxCWorkbench';

/**
 * Cuentas por Pagar (CxP) y Cuentas por Cobrar (CxC) — submódulos operativos de
 * Contabilidad. Ambos son mesas de trabajo (cola priorizada + panel de detalle con
 * acciones inline) en vez de tarjetas de KPI pasivas — ver CxPWorkbench.tsx / CxCWorkbench.tsx.
 */

export function CuentasPorPagarTab({ canPay }: { canPay: boolean }) {
  return <CxPWorkbench canPay={canPay} />;
}

export function CuentasPorCobrarTab({ canCollect }: { canCollect: boolean }) {
  return <CxCWorkbench canCollect={canCollect} />;
}
