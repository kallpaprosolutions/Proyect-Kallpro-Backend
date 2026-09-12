import { useEffect, useState } from 'react';
import { financialApi } from '../../api/financial';

/**
 * Estado de cuenta (proveedor o cliente): cronología de cargos, pagos/cobros y notas de
 * crédito con saldo corrido — lo que un contador usa para conciliar contra el estado de
 * cuenta que envía el proveedor, o para enviar al cliente en gestión de cobranza.
 */

const money = (n: number) => `$${Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TYPE_LABELS: Record<string, string> = {
  CARGO: 'Factura',
  PAGO: 'Pago',
  COBRO: 'Cobro',
  NOTA_CREDITO: 'Nota de crédito',
};

const TYPE_TONE: Record<string, string> = {
  CARGO: 'text-surface-700 dark:text-surface-300',
  PAGO: 'text-green-600 dark:text-green-400',
  COBRO: 'text-green-600 dark:text-green-400',
  NOTA_CREDITO: 'text-blue-600 dark:text-blue-400',
};

interface Props {
  kind: 'supplier' | 'customer';
  entityId: string;
}

export default function AccountStatement({ kind, entityId }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    setError('');
    const fetcher = kind === 'supplier' ? financialApi.getSupplierStatement(entityId) : financialApi.getCustomerStatement(entityId);
    fetcher
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || 'No se pudo cargar el estado de cuenta'))
      .finally(() => setLoading(false));
  }, [kind, entityId]);

  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  if (error) return <p className="text-center text-red-500 text-sm py-8">{error}</p>;
  if (!data) return null;

  const entity = kind === 'supplier' ? data.supplier : data.customer;
  const balanceLabel = kind === 'supplier' ? 'Saldo a pagar' : 'Saldo por cobrar';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-surface-800 dark:text-white">Estado de cuenta — {entity?.name}</h3>
          <p className="text-xs text-surface-500">Cronología de cargos, {kind === 'supplier' ? 'pagos' : 'cobros'} y notas de crédito con saldo corrido.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono font-bold text-lg ${data.finalBalance > 0.01 ? 'text-orange-600 dark:text-orange-400' : 'text-surface-500'}`}>{money(data.finalBalance)}</span>
          <button onClick={() => window.print()}
            className="text-xs px-3 py-1.5 border border-surface-200 dark:border-surface-700 rounded-lg text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors">
            🖨️ Imprimir
          </button>
        </div>
      </div>

      {data.entries.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700">
          <p className="text-surface-400 text-sm">Sin movimientos registrados.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                <th className="text-left px-4 py-2.5">Fecha</th>
                <th className="text-left px-4 py-2.5">Tipo</th>
                <th className="text-left px-4 py-2.5">Descripción</th>
                <th className="text-right px-4 py-2.5">Cargo</th>
                <th className="text-right px-4 py-2.5">Abono</th>
                <th className="text-right px-4 py-2.5">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {data.entries.map((e: any, i: number) => (
                <tr key={`${e.sourceId}-${i}`}>
                  <td className="px-4 py-2 text-xs text-surface-500 whitespace-nowrap">{new Date(e.date).toLocaleDateString('es')}</td>
                  <td className={`px-4 py-2 text-xs font-medium ${TYPE_TONE[e.type] ?? ''}`}>{TYPE_LABELS[e.type] ?? e.type}</td>
                  <td className="px-4 py-2 text-surface-700 dark:text-surface-300">{e.description}</td>
                  <td className="px-4 py-2 text-right font-mono">{e.debit > 0 ? money(e.debit) : '—'}</td>
                  <td className="px-4 py-2 text-right font-mono text-green-600 dark:text-green-400">{e.credit > 0 ? money(e.credit) : '—'}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">{money(e.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-50 dark:bg-surface-900/50 font-semibold">
                <td colSpan={5} className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-300">{balanceLabel}</td>
                <td className="px-4 py-2.5 text-right font-mono text-surface-900 dark:text-white">{money(data.finalBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
