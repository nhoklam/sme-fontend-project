import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import AppLayout from '@/components/layout/AppLayout';
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
import ReportsPage from '@/pages/ReportsPage';
import SettingsPage from '@/pages/SettingsPage';
import CategoriesPage from '@/pages/CategoriesPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

// 1. Tạo component điều hướng thông minh dựa vào Role
function IndexRedirect() {
  const isCashier = useAuthStore((s) => s.isCashier());
  // Thu ngân thì vào trang Bán hàng (POS), Quản lý/Admin thì vào Dashboard
  return <Navigate to={isCashier ? "/pos" : "/dashboard"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

        {/* Private — inside AppLayout */}
        <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          
          {/* 2. Áp dụng luồng điều hướng thông minh ở đây */}
          <Route index element={<IndexRedirect />} />
          
          <Route path="dashboard"      element={<DashboardPage />} />
          <Route path="pos"            element={<POSPage />} />
          <Route path="orders"         element={<OrdersPage />} />
          <Route path="orders/:id"     element={<OrderDetailPage />} />
          <Route path="products"       element={<ProductsPage />} />
          <Route path="inventory"      element={<InventoryPage />} />
          <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="transfers"      element={<TransfersPage />} />
          <Route path="customers"      element={<CustomersPage />} />
          <Route path="suppliers"      element={<SuppliersPage />} />
          <Route path="finance"        element={<FinancePage />} />
          <Route path="reports"        element={<ReportsPage />} />
          <Route path="settings"       element={<SettingsPage />} />
          <Route path="categories"      element={<CategoriesPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}