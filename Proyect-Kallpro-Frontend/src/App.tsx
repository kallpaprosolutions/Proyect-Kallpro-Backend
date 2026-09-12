import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import AiAssistant from './components/AiAssistant';
import SmartAlertsPanel from './components/SmartAlertsPanel';
import MainLayout from './components/layout/MainLayout';
import { AbilityProvider } from './components/AbilityProvider';
import UiKitShowcase from './pages/UiKitShowcase';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import InventoryPage from './pages/inventory/InventoryPage';
import InventoryValuationPage from './pages/inventory/InventoryValuationPage';
import NewProductPage from './pages/inventory/NewProductPage';
import ProductDetailPage from './pages/inventory/ProductDetailPage';
import WarehousesPage from './pages/inventory/WarehousesPage';
import CategoriesPage from './pages/inventory/CategoriesPage';
import WarehouseTransferPage from './pages/inventory/WarehouseTransferPage';
import InventoryAnalyticsPage from './pages/inventory/InventoryAnalyticsPage';
import PhysicalCountPage from './pages/inventory/PhysicalCountPage';
import QuickEntryPage from './pages/inventory/QuickEntryPage';
import InventoryAdjustmentsPage from './pages/inventory/InventoryAdjustmentsPage';
import ReplenishmentPage from './pages/inventory/ReplenishmentPage';
import PurchasesPage from './pages/purchases/PurchasesPage';
import ProcurementHubPage from './pages/purchases/ProcurementHubPage';
import SuppliersPage from './pages/purchases/SuppliersPage';
import NewOrderPage from './pages/purchases/NewOrderPage';
import OrderDetailPage from './pages/purchases/OrderDetailPage';
import FinanzasPage from './pages/financial/FinanzasPage';
import ContabilidadPage from './pages/contabilidad/ContabilidadPage';
import NewInvoicePage from './pages/financial/NewInvoicePage';
import FinancialPage from './pages/financial/FinancialPage';
import InvoiceDetailPage from './pages/financial/InvoiceDetailPage';
import SriDocumentsPage from './pages/financial/SriDocumentsPage';
import NewSriDocumentPage from './pages/financial/NewSriDocumentPage';
import SriDocumentReviewPage from './pages/financial/SriDocumentReviewPage';
import RecurringInvoicesPage from './pages/financial/RecurringInvoicesPage';
import FixedAssetsPage from './pages/financial/FixedAssetsPage';
import RequisitionsPage from './pages/purchases/RequisitionsPage';
import NewRequisitionPage from './pages/purchases/NewRequisitionPage';
import RequisitionDetailPage from './pages/purchases/RequisitionDetailPage';
import QuotationComparePage from './pages/purchases/QuotationComparePage';
import SalesPage from './pages/sales/SalesPage';
import QuickSalePage from './pages/sales/QuickSalePage';
import LogisticsPage from './pages/logistics/LogisticsPage';
import ShipmentDetailPage from './pages/logistics/ShipmentDetailPage';
import NewQuotationPage from './pages/sales/NewQuotationPage';
import SalesOrderDetailPage from './pages/sales/SalesOrderDetailPage';
import PriceListsPage from './pages/sales/PriceListsPage';
import SecurityPage from './pages/settings/SecurityPage';
import CustomersPage from './pages/sales/CustomersPage';
import CustomerKYCWizard from './pages/sales/CustomerKYCWizard';
import CustomerProfilePage from './pages/sales/CustomerProfilePage';
import ApprovalDashboard from './pages/purchases/ApprovalDashboard';
import SupplierRankingPage from './pages/purchases/SupplierRankingPage';
import SupplierProfilePage from './pages/purchases/SupplierProfilePage';
import SpendAnalyticsPage from './pages/purchases/SpendAnalyticsPage';
import SupplierKYCWizard from './pages/purchases/SupplierKYCWizard';
import JournalEntriesPage from './pages/financial/JournalEntriesPage';
import UsersPage from './pages/admin/UsersPage';
import RoleProtectedRoute from './components/RoleProtectedRoute';
// Portal (auth propia — sin MainLayout)
import PortalLoginPage from './pages/portal/PortalLoginPage';
import PortalDashboard from './pages/portal/PortalDashboard';
import PortalRFQsPage from './pages/portal/PortalRFQsPage';
import PortalQuotePage from './pages/portal/PortalQuotePage';
import PortalOrdersPage from './pages/portal/PortalOrdersPage';
// Production
import ProductionPage from './pages/production/ProductionPage';
import NewProductionOrderPage from './pages/production/NewProductionOrderPage';
import ProductionOrderDetailPage from './pages/production/ProductionOrderDetailPage';
// Reports
import ReportsPage from './pages/reports/ReportsPage';
// Nómina (RRHH)
import EmployeesPage from './pages/rrhh/EmployeesPage';
import PayrollPage from './pages/rrhh/PayrollPage';
import AttendancePage from './pages/rrhh/AttendancePage';
import HrCalendarPage from './pages/rrhh/HrCalendarPage';
import OrgChartPage from './pages/rrhh/OrgChartPage';
// Tesorería
import TesoreriaPage from './pages/tesoreria/TesoreriaPage';
// Research
import ResearchPage from './pages/research/ResearchPage';
// Finance v2
// Settings
import CompanySettingsPage from './pages/settings/CompanySettingsPage';
// CRM
import CRMDashboard from './pages/crm/CRMDashboard';
import InboxView from './pages/crm/InboxView';
import PipelineView from './pages/crm/PipelineView';
import AgentsView from './pages/crm/AgentsView';
import ForecastView from './pages/crm/ForecastView';
import ContactsPage from './pages/crm/ContactsPage';
import DealsPage from './pages/crm/DealsPage';
import LeadsPage from './pages/crm/LeadsPage';
import CrmSettingsPage from './pages/crm/config/CrmSettingsPage';

// Wraps a page with auth check + shared MainLayout
function AppRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <AbilityProvider>
      <MainLayout>
        {children}
      </MainLayout>
    </AbilityProvider>
  );
}

// Floating AI assistant — shown on all authenticated non-portal pages
function AiAssistantWrapper() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const location = useLocation();
  const excluded = ['/login', '/register'];
  const isPortal = location.pathname.startsWith('/portal');
  if (!isAuthenticated || excluded.includes(location.pathname) || isPortal) return null;
  return (
    <>
      <AiAssistant />
      <SmartAlertsPanel />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AiAssistantWrapper />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* UI Kit showcase (solo dev) — sin auth para previsualizar componentes. Excluido del build de producción. */}
        {import.meta.env.DEV && <Route path="/ui-kit" element={<UiKitShowcase />} />}

        {/* Portal Proveedores — auth propia, sin MainLayout */}
        <Route path="/portal/login" element={<PortalLoginPage />} />
        <Route path="/portal/dashboard" element={<PortalDashboard />} />
        <Route path="/portal/rfqs" element={<PortalRFQsPage />} />
        <Route path="/portal/rfqs/:id/quote" element={<PortalQuotePage />} />
        <Route path="/portal/orders" element={<PortalOrdersPage />} />

        {/* ── Authenticated routes with MainLayout ── */}
        <Route path="/" element={<AppRoute><Dashboard /></AppRoute>} />

        {/* Inventory */}
        <Route path="/inventory" element={<AppRoute><InventoryPage /></AppRoute>} />
        <Route path="/inventario/valorizacion" element={<AppRoute><InventoryValuationPage /></AppRoute>} />
        <Route path="/inventory/products/new" element={<AppRoute><NewProductPage /></AppRoute>} />
        <Route path="/inventory/products/:id" element={<AppRoute><ProductDetailPage /></AppRoute>} />
        <Route path="/inventory/warehouses" element={<AppRoute><WarehousesPage /></AppRoute>} />
        <Route path="/inventory/categories" element={<AppRoute><CategoriesPage /></AppRoute>} />
        <Route path="/inventory/transfers" element={<AppRoute><WarehouseTransferPage /></AppRoute>} />
        <Route path="/inventory/analytics" element={<AppRoute><InventoryAnalyticsPage /></AppRoute>} />
        <Route path="/inventory/physical-count" element={<AppRoute><PhysicalCountPage /></AppRoute>} />
        <Route path="/inventory/quick-entry" element={<AppRoute><QuickEntryPage /></AppRoute>} />
        <Route path="/inventory/adjustments" element={<AppRoute><InventoryAdjustmentsPage /></AppRoute>} />
        <Route path="/inventory/replenishment" element={<AppRoute><ReplenishmentPage /></AppRoute>} />

        {/* Purchases */}
        <Route path="/purchases/analytics" element={<AppRoute><SpendAnalyticsPage /></AppRoute>} />
        <Route path="/purchases/suppliers/new" element={<AppRoute><SupplierKYCWizard /></AppRoute>} />
        <Route path="/purchases/suppliers/ranking" element={<AppRoute><SupplierRankingPage /></AppRoute>} />
        <Route path="/purchases/suppliers/:id/edit" element={<AppRoute><SupplierKYCWizard /></AppRoute>} />
        <Route path="/purchases/suppliers/:id" element={<AppRoute><SupplierProfilePage /></AppRoute>} />
        <Route path="/purchases/suppliers" element={<AppRoute><SuppliersPage /></AppRoute>} />
        <Route path="/purchases/new" element={<AppRoute><NewOrderPage /></AppRoute>} />
        <Route path="/purchases/requisitions/new" element={<AppRoute><NewRequisitionPage /></AppRoute>} />
        <Route path="/purchases/requisitions/:id/compare" element={<AppRoute><QuotationComparePage /></AppRoute>} />
        <Route path="/purchases/requisitions/:id" element={<AppRoute><RequisitionDetailPage /></AppRoute>} />
        <Route path="/purchases/requisitions" element={<AppRoute><RequisitionsPage /></AppRoute>} />
        <Route path="/purchases/:id" element={<AppRoute><OrderDetailPage /></AppRoute>} />
        <Route path="/compras" element={<AppRoute><ProcurementHubPage /></AppRoute>} />
        <Route path="/compras/ordenes" element={<AppRoute><PurchasesPage /></AppRoute>} />
        <Route path="/purchases" element={<AppRoute><PurchasesPage /></AppRoute>} />
        <Route path="/approvals" element={<AppRoute><ApprovalDashboard /></AppRoute>} />

        {/* Finanzas — módulo unificado */}
        <Route path="/finanzas" element={<AppRoute><FinanzasPage /></AppRoute>} />
        {/* Contabilidad — módulo dedicado del contador */}
        <Route path="/contabilidad" element={<AppRoute><ContabilidadPage /></AppRoute>} />
        {/* Rutas de detalle (se mantienen) */}
        <Route path="/financial/invoices" element={<AppRoute><FinancialPage /></AppRoute>} />
        <Route path="/financial/invoices/new" element={<AppRoute><NewInvoicePage /></AppRoute>} />
        <Route path="/financial/invoices/:id" element={<AppRoute><InvoiceDetailPage /></AppRoute>} />
        <Route path="/financial/journal-entries" element={<AppRoute><JournalEntriesPage /></AppRoute>} />
        <Route path="/sri" element={<AppRoute><SriDocumentsPage /></AppRoute>} />
        <Route path="/sri/new" element={<AppRoute><NewSriDocumentPage /></AppRoute>} />
        <Route path="/sri/recurrentes" element={<AppRoute><RecurringInvoicesPage /></AppRoute>} />
        <Route path="/contabilidad/activos-fijos" element={<AppRoute><FixedAssetsPage /></AppRoute>} />
        <Route path="/sri/:id" element={<AppRoute><SriDocumentReviewPage /></AppRoute>} />
        {/* Redirects de rutas antiguas a las pestañas del módulo */}
        <Route path="/financial/executive" element={<Navigate to="/finanzas?tab=resumen" replace />} />
        <Route path="/financial/analytics" element={<Navigate to="/finanzas?tab=analisis" replace />} />
        <Route path="/financial" element={<Navigate to="/finanzas?tab=operacion" replace />} />
        <Route path="/budget" element={<Navigate to="/finanzas?tab=presupuesto" replace />} />
        <Route path="/gerencial" element={<Navigate to="/finanzas?tab=gerencial" replace />} />

        {/* Sales */}
        <Route path="/sales/customers/new" element={<AppRoute><CustomerKYCWizard /></AppRoute>} />
        <Route path="/sales/customers/:id" element={<AppRoute><CustomerProfilePage /></AppRoute>} />
        <Route path="/sales/customers" element={<AppRoute><CustomersPage /></AppRoute>} />
        <Route path="/sales/quotations/new" element={<AppRoute><NewQuotationPage /></AppRoute>} />
        <Route path="/sales/price-lists" element={<AppRoute><PriceListsPage /></AppRoute>} />
        <Route path="/sales/orders/:id" element={<AppRoute><SalesOrderDetailPage /></AppRoute>} />
        <Route path="/sales" element={<AppRoute><SalesPage /></AppRoute>} />
        <Route path="/ventas/rapida" element={<AppRoute><QuickSalePage /></AppRoute>} />
        <Route path="/logistica" element={<AppRoute><LogisticsPage /></AppRoute>} />
        <Route path="/logistica/:id" element={<AppRoute><ShipmentDetailPage /></AppRoute>} />

        {/* Admin */}
        <Route path="/admin/users" element={
          <AppRoute>
            <RoleProtectedRoute roles={['ADMIN']}>
              <UsersPage />
            </RoleProtectedRoute>
          </AppRoute>
        } />

        {/* Production */}
        <Route path="/production/orders/new" element={<AppRoute><NewProductionOrderPage /></AppRoute>} />
        <Route path="/production/orders/:id" element={<AppRoute><ProductionOrderDetailPage /></AppRoute>} />
        <Route path="/production" element={<AppRoute><ProductionPage /></AppRoute>} />

        {/* Reports & Research */}
        <Route path="/reports" element={<AppRoute><ReportsPage /></AppRoute>} />
        <Route path="/nomina" element={<AppRoute><PayrollPage /></AppRoute>} />
        <Route path="/nomina/empleados" element={<AppRoute><EmployeesPage /></AppRoute>} />
        <Route path="/nomina/organigrama" element={<AppRoute><OrgChartPage /></AppRoute>} />
        <Route path="/nomina/asistencia" element={<AppRoute><AttendancePage /></AppRoute>} />
        <Route path="/nomina/calendario" element={<AppRoute><HrCalendarPage /></AppRoute>} />
        <Route path="/tesoreria" element={<AppRoute><TesoreriaPage /></AppRoute>} />
        <Route path="/research" element={<AppRoute><ResearchPage /></AppRoute>} />

        {/* CRM */}
        <Route path="/crm" element={<AppRoute><CRMDashboard /></AppRoute>} />
        <Route path="/crm/inbox" element={<AppRoute><InboxView /></AppRoute>} />
        <Route path="/crm/pipeline" element={<AppRoute><PipelineView /></AppRoute>} />
        <Route path="/crm/agents" element={<AppRoute><AgentsView /></AppRoute>} />
        <Route path="/crm/forecast" element={<AppRoute><ForecastView /></AppRoute>} />
        <Route path="/crm/contacts" element={<AppRoute><ContactsPage /></AppRoute>} />
        <Route path="/crm/deals" element={<AppRoute><DealsPage /></AppRoute>} />
        <Route path="/crm/leads" element={<AppRoute><LeadsPage /></AppRoute>} />
        <Route path="/crm/config" element={<AppRoute><CrmSettingsPage /></AppRoute>} />

        {/* Settings */}
        <Route path="/settings/empresa" element={<AppRoute><CompanySettingsPage /></AppRoute>} />
        <Route path="/settings/security" element={<AppRoute><SecurityPage /></AppRoute>} />

        {/* Legacy /dashboard redirect */}
        <Route path="/dashboard" element={<Navigate to="/" replace />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
