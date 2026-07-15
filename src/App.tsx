import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import AppLayout from '@/components/layout/AppLayout';
import RoleRoute from '@/components/RoleRoute';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import POSPage from '@/pages/POSPage';
import OrdersPage from '@/pages/OrdersPage';
import OrderDetailPage from '@/pages/OrderDetailPage';
import ProductsPage from '@/pages/ProductsPage';
import InventoryPage from '@/pages/InventoryPage';
import PurchaseOrdersPage from '@/pages/PurchaseOrdersPage';
import TransfersPage from '@/pages/TransfersPage';
import CustomersPage from '@/pages/CustomersPage';
import SuppliersPage from '@/pages/SuppliersPage';
import FinancePage from '@/pages/FinancePage';
import SettingsPage from '@/pages/SettingsPage';
import CategoriesPage from '@/pages/CategoriesPage';
import StockTakePage from '@/pages/StockTakePage';                 
import PromotionsPage from '@/pages/PromotionsPage';               
import CodReconciliationPage from '@/pages/CodReconciliationPage'; 
import AuditLogsPage from '@/pages/AuditLogsPage';                 
import UsersPage from '@/pages/UsersPage';                         
import WarehousesPage from '@/pages/WarehousesPage';               

import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}
function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}
function IndexRedirect() {
  const isCashier = useAuthStore((s) => s.isCashier());
  return <Navigate to={isCashier ? '/pos' : '/dashboard'} replace />;
}

const MANAGER_ADMIN = ['ROLE_ADMIN', 'ROLE_MANAGER'];
const ADMIN_ONLY    = ['ROLE_ADMIN'];

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />

        <Route path="/pos"   element={<PrivateRoute><POSPage /></PrivateRoute>} />
        <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route index element={<IndexRedirect />} />

          {/* Tất cả roles */}
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="orders"     element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="settings"   element={<SettingsPage />} />

          {/* Manager + Admin */}
          <Route path="products"        element={<RoleRoute roles={MANAGER_ADMIN}><ProductsPage /></RoleRoute>} />
          <Route path="inventory"       element={<RoleRoute roles={MANAGER_ADMIN}><InventoryPage /></RoleRoute>} />
          <Route path="purchase-orders" element={<RoleRoute roles={MANAGER_ADMIN}><PurchaseOrdersPage /></RoleRoute>} />
          <Route path="transfers"       element={<RoleRoute roles={MANAGER_ADMIN}><TransfersPage /></RoleRoute>} />
          <Route path="customers"       element={<RoleRoute roles={MANAGER_ADMIN}><CustomersPage /></RoleRoute>} />
          <Route path="suppliers"       element={<RoleRoute roles={MANAGER_ADMIN}><SuppliersPage /></RoleRoute>} />
          <Route path="finance"         element={<RoleRoute roles={MANAGER_ADMIN}><FinancePage /></RoleRoute>} />
          <Route path="categories"      element={<RoleRoute roles={MANAGER_ADMIN}><CategoriesPage /></RoleRoute>} />
          <Route path="stock-takes"     element={<RoleRoute roles={MANAGER_ADMIN}><StockTakePage /></RoleRoute>} />
          <Route path="promotions"      element={<RoleRoute roles={MANAGER_ADMIN}><PromotionsPage /></RoleRoute>} />
          <Route path="users"           element={<RoleRoute roles={MANAGER_ADMIN}><UsersPage /></RoleRoute>} />

          {/* Admin only — Quyền giám sát & quản trị hệ thống */}
          <Route path="cod-reconciliation" element={<RoleRoute roles={ADMIN_ONLY}><CodReconciliationPage /></RoleRoute>} />
          <Route path="audit-logs"         element={<RoleRoute roles={ADMIN_ONLY}><AuditLogsPage /></RoleRoute>} />
          <Route path="warehouses"         element={<RoleRoute roles={ADMIN_ONLY}><WarehousesPage /></RoleRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}