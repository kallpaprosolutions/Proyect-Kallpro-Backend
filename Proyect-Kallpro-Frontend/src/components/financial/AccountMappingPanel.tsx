import { useEffect, useState } from 'react';
import { financialApi } from '../../api/financial';
import { useToast } from '../ui/Toast';
import { AccountSelect } from './ChartOfAccountsTree';

interface Mapping { id: string; key: string; accountCode: string; accountName: string; }

const KEY_LABELS: Record<string, string> = {
  CASH: 'Caja / Bancos', INVENTORY: 'Inventario', AR: 'Cuentas por Cobrar (clientes)',
  AP: 'Cuentas por Pagar (proveedores)', IVA_CREDIT: 'IVA Crédito (compras)', IVA_DEBIT: 'IVA Débito (ventas)',
  RETENTION_PAYABLE_RENTA: 'Retención IR por pagar', RETENTION_PAYABLE_IVA: 'Retención IVA por pagar',
  RETENTION_ASSET: 'Crédito por retención (a favor)', SALES: 'Ingresos por ventas', COGS: 'Costo de ventas',
  INV_ADJUST_GAIN: 'Ajuste positivo inventario', INV_WRITEOFF: 'Merma / baja inventario',
  SUPPLIER_ADVANCE: 'Anticipos a proveedores',
  PAYROLL_SALARY_EXPENSE: 'Nómina: gasto sueldos y remuneraciones',
  PAYROLL_IESS_EXPENSE: 'Nómina: gasto aportes IESS y fondos de reserva',
  PAYROLL_BENEFITS_EXPENSE: 'Nómina: gasto beneficios sociales (décimos, vacaciones)',
  PAYROLL_IESS_PAYABLE: 'Nómina: obligaciones con el IESS',
  PAYROLL_BENEFITS_PAYABLE: 'Nómina: netos y beneficios por pagar',
  PAYROLL_IR_PAYABLE: 'Nómina: retención IR empleados por pagar',
};

export default function AccountMappingPanel() {
  const toast = useToast();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    financialApi.getAccountMappings().then((r) => setMappings(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const update = async (key: string, accountCode: string) => {
    try {
      await financialApi.updateAccountMapping(key, accountCode);
      toast.success('Cuenta actualizada', '✓');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo actualizar', 'Error');
    }
  };

  if (loading) return <div className="flex items-center justify-center py-8"><div className="animate-spin w-6 h-6 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-5 space-y-3">
      <div>
        <h3 className="font-semibold text-surface-900 dark:text-white">Configuración de cuentas (posting setup)</h3>
        <p className="text-sm text-surface-500">Define qué cuenta del plan usa cada evento del ERP al generar asientos automáticos.</p>
      </div>
      {mappings.length === 0 ? (
        <p className="text-sm text-surface-400">Inicializa el plan de cuentas para cargar la configuración por defecto.</p>
      ) : (
        <div className="space-y-2">
          {mappings.map((m) => (
            <div key={m.id} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
              <span className="text-sm text-surface-700 dark:text-surface-300">{KEY_LABELS[m.key] ?? m.key}</span>
              <AccountSelect value={m.accountCode} onChange={(code) => update(m.key, code)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
