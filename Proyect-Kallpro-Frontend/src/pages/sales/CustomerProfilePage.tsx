import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BackButton from '../../components/ui/BackButton';
import { salesApi } from '../../api/sales';
import { ArAgingView } from '../../components/finance/AgingViews';
import AccountStatement from '../../components/finance/AccountStatement';
import { CustomerCollectionPanel } from '../../components/finance/CollectionRadar';

type Tab = 'info' | 'orders' | 'aging' | 'statement' | 'collection';

function fieldRow(k: string, v: any) {
  if (v === null || v === undefined || v === '') return null;
  return (
    <div key={k} className="flex justify-between gap-2 py-1.5 border-b border-surface-100 dark:border-surface-700/50 last:border-b-0">
      <dt className="text-sm text-surface-500">{k}</dt>
      <dd className="text-sm text-surface-800 dark:text-white text-right">{String(v)}</dd>
    </div>
  );
}

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('info');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    salesApi.getCustomer(id)
      .then((r) => setCustomer(r.data))
      .catch(() => setError('No se pudo cargar el cliente.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );
  if (error || !customer) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-red-600 dark:text-red-400">{error || 'Cliente no encontrado'}</p>
      <BackButton fallback="/sales/customers" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <BackButton fallback="/sales/customers" label="Clientes" />
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">👤</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">{customer.razonSocial || customer.name}</h1>
            <p className="text-sm text-surface-500 flex items-center gap-2">
              {customer.ruc && <span className="font-mono">{customer.ruc}</span>}
              {customer.kycCompletedAt ? (
                <span className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">✓ KYC UAFE</span>
              ) : (
                <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full font-medium">⚠ KYC pendiente</span>
              )}
              {customer.isPEP && <span className="text-[10px] bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">PEP</span>}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Línea de crédito', value: `$${Number(customer.creditLimit || 0).toLocaleString('es', { minimumFractionDigits: 2 })}`, color: 'text-brand-600 dark:text-brand-400' },
          { label: 'Saldo actual', value: `$${Number(customer.balance || 0).toLocaleString('es', { minimumFractionDigits: 2 })}`, color: Number(customer.balance) > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400' },
          { label: 'Crédito disponible', value: `$${(Number(customer.creditLimit || 0) - Number(customer.balance || 0)).toLocaleString('es', { minimumFractionDigits: 2 })}`, color: 'text-surface-800 dark:text-white' },
          { label: 'Cliente desde', value: customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('es') : '—', color: 'text-surface-600 dark:text-surface-300', small: true },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-surface-800 rounded-xl p-4 border border-surface-200 dark:border-surface-700 shadow-soft">
            <p className="text-xs text-surface-500 uppercase tracking-wider">{kpi.label}</p>
            <p className={`${kpi.small ? 'text-base' : 'text-xl'} font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft mb-6">
        <div className="flex border-b border-surface-100 dark:border-surface-700 px-2">
          {([
            { key: 'info',   label: '📋 Información KYC' },
            { key: 'orders', label: '🛒 Pedidos' },
            { key: 'aging',  label: '💰 AR Aging' },
            { key: 'statement', label: '📄 Estado de cuenta' },
            { key: 'collection', label: '📞 Cobranza' },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <section>
              <h3 className="font-semibold text-surface-700 dark:text-surface-300 mb-3 text-sm uppercase tracking-wider">Identificación</h3>
              <dl>
                {fieldRow('Tipo persona', customer.personType)}
                {fieldRow('Documento', customer.documentType && customer.ruc ? `${customer.documentType} ${customer.ruc}` : customer.ruc)}
                {fieldRow('Razón social', customer.razonSocial)}
                {fieldRow('Nombre comercial', customer.nombreComercial || customer.name)}
                {fieldRow('Email', customer.email)}
                {fieldRow('Teléfono', customer.phone)}
                {fieldRow('Dirección', customer.address)}
                {fieldRow('Ciudad', customer.city)}
                {fieldRow('País', customer.country)}
              </dl>
            </section>

            <section>
              <h3 className="font-semibold text-surface-700 dark:text-surface-300 mb-3 text-sm uppercase tracking-wider">KYC UAFE</h3>
              <dl>
                {customer.personType === 'NATURAL' && (
                  <>
                    {fieldRow('Nacimiento', customer.birthDate ? new Date(customer.birthDate).toLocaleDateString('es') : null)}
                    {fieldRow('Nacionalidad', customer.nationality)}
                    {fieldRow('Estado civil', customer.maritalStatus)}
                    {fieldRow('Cónyuge', customer.spouseName)}
                    {fieldRow('Ocupación', customer.occupation)}
                    {fieldRow('Empresa', customer.employerName)}
                  </>
                )}
                {customer.personType === 'JURIDICA' && (
                  <>
                    {fieldRow('Representante legal', customer.legalRepName)}
                    {fieldRow('Doc. representante', customer.legalRepDocument)}
                    {fieldRow('CIIU', customer.ciiuCode ? `${customer.ciiuCode} — ${customer.ciiuDescription}` : null)}
                    {fieldRow('Beneficiarios', customer.beneficialOwners ? `${customer.beneficialOwners.length} registrados` : null)}
                  </>
                )}
                {fieldRow('Ingresos anuales', customer.annualIncome ? `$${Number(customer.annualIncome).toLocaleString('es')}` : null)}
                {fieldRow('Patrimonio', customer.estimatedPatrimony ? `$${Number(customer.estimatedPatrimony).toLocaleString('es')}` : null)}
                {fieldRow('PEP', customer.isPEP ? `Sí — ${customer.pepPosition} (${customer.pepRelationship || 'N/A'})` : 'No')}
                {fieldRow('Contribuyente especial', customer.contribuyenteEspecial ? 'Sí' : 'No')}
                {fieldRow('Obligado contabilidad', customer.obligadoContabilidad ? 'Sí' : 'No')}
                {fieldRow('KYC completado', customer.kycCompletedAt ? new Date(customer.kycCompletedAt).toLocaleString('es') : 'Pendiente')}
              </dl>
            </section>

            {customer.personType === 'JURIDICA' && customer.beneficialOwners && customer.beneficialOwners.length > 0 && (
              <section className="md:col-span-2">
                <h3 className="font-semibold text-surface-700 dark:text-surface-300 mb-3 text-sm uppercase tracking-wider">Beneficiarios finales</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-surface-500 uppercase border-b border-surface-200 dark:border-surface-700">
                      <th className="text-left py-2">Nombre</th>
                      <th className="text-left py-2">Documento</th>
                      <th className="text-right py-2">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                    {customer.beneficialOwners.map((b: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2 text-surface-800 dark:text-white">{b.name}</td>
                        <td className="py-2 text-surface-600 dark:text-surface-300 font-mono">{b.document}</td>
                        <td className="py-2 text-right font-mono font-semibold">{Number(b.percentage).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="p-5">
            {customer.salesOrders && customer.salesOrders.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-surface-500 uppercase border-b border-surface-200 dark:border-surface-700">
                    <th className="text-left py-2">Pedido</th>
                    <th className="text-left py-2">Fecha</th>
                    <th className="text-right py-2">Total</th>
                    <th className="text-center py-2">Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {customer.salesOrders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30">
                      <td className="py-2 font-mono text-brand-600 dark:text-brand-400">{o.orderNumber}</td>
                      <td className="py-2 text-surface-500">{new Date(o.createdAt).toLocaleDateString('es')}</td>
                      <td className="py-2 text-right font-mono">${Number(o.total).toFixed(2)}</td>
                      <td className="py-2 text-center"><span className="text-xs bg-surface-100 dark:bg-surface-700 px-2 py-0.5 rounded-full">{o.status}</span></td>
                      <td className="py-2"><Link to={`/sales/orders/${o.id}`} className="text-brand-500 text-sm">Ver →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center text-surface-400 py-8">Sin pedidos registrados para este cliente.</p>
            )}
          </div>
        )}

        {tab === 'aging' && (
          <div className="p-5">
            <p className="text-sm text-surface-500 mb-4">Resumen de cuentas por cobrar.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-3 border border-surface-200 dark:border-surface-700">
                <p className="text-xs text-surface-500">Saldo total</p>
                <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">${Number(customer.balance || 0).toLocaleString('es', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-3 border border-surface-200 dark:border-surface-700">
                <p className="text-xs text-surface-500">Línea de crédito</p>
                <p className="text-lg font-bold text-brand-600 dark:text-brand-400">${Number(customer.creditLimit || 0).toLocaleString('es', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-3 border border-surface-200 dark:border-surface-700">
                <p className="text-xs text-surface-500">Uso del crédito</p>
                <p className="text-lg font-bold text-surface-800 dark:text-white">
                  {Number(customer.creditLimit) > 0
                    ? `${Math.round((Number(customer.balance) / Number(customer.creditLimit)) * 100)}%`
                    : '—'}
                </p>
              </div>
              <div className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-3 border border-surface-200 dark:border-surface-700">
                <p className="text-xs text-surface-500">Términos de pago</p>
                <p className="text-lg font-bold text-surface-800 dark:text-white">{customer.paymentTerms || '—'}</p>
              </div>
            </div>
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-surface-800 dark:text-white mb-3">Cartera del cliente (facturas pendientes)</h3>
              <ArAgingView customerId={customer.id} />
            </div>
          </div>
        )}

        {tab === 'statement' && (
          <div className="p-5">
            <AccountStatement kind="customer" entityId={customer.id} />
          </div>
        )}

        {tab === 'collection' && (
          <div className="p-5">
            <CustomerCollectionPanel customerId={customer.id} customerName={customer.razonSocial || customer.name} />
          </div>
        )}
      </div>
    </div>
  );
}
