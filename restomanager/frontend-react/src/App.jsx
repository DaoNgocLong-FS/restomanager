// =============================================================================
//  App.jsx — Router chính
//  Routes:
//    /login                  → LoginPage
//    /cashier/tables         → CashierTables (có context menu quản lý bàn)
//    /cashier/detail/:code   → CashierDetail (xem + sửa + thanh toán)
//    /cashier/orders         → CashierOrders (đơn hôm nay)
//    /cashier/stats          → CashierStats
//    /waiter/tables          → WaiterTables (xem bàn, không context menu)
//    /waiter/menu/:code      → WaiterMenu (chọn món, gửi đơn)
//
//  Admin: redirect sang /admin.html (giữ vanilla, chưa migrate trong sprint này)
// =============================================================================
import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import LoginPage      from './auth/LoginPage';
import AppShell       from './components/AppShell';
import CashierTables  from './pages/CashierTables';
import CashierDetail  from './pages/CashierDetail';
import CashierOrders  from './pages/CashierOrders';
import CashierStats   from './pages/CashierStats';
import WaiterTables   from './pages/WaiterTables';
import WaiterMenu     from './pages/WaiterMenu';
import Profile        from './pages/Profile';

function ProtectedRoute({ children, role }) {
  const { user, booting } = useAuth();
  const loc = useLocation();
  if (booting) {
    return (
      <div className="h-screen flex items-center justify-center bg-primary text-white">
        <div className="animate-pulse">Đang tải…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (role && user.role !== role && user.role !== 'admin') {
    return <Navigate to={defaultPath(user.role)} replace />;
  }
  return children;
}

function defaultPath(role) {
  if (role === 'cashier' || role === 'admin') return '/cashier/tables';
  if (role === 'waiter') return '/waiter/tables';
  return '/login';
}

function HomeRedirect() {
  const { user, booting } = useAuth();
  if (booting) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={defaultPath(user.role)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/cashier/tables"   element={<ProtectedRoute role="cashier"><CashierTables /></ProtectedRoute>} />
        <Route path="/cashier/detail/:code" element={<ProtectedRoute role="cashier"><CashierDetail /></ProtectedRoute>} />
        <Route path="/cashier/orders"   element={<ProtectedRoute role="cashier"><CashierOrders /></ProtectedRoute>} />
        <Route path="/cashier/stats"    element={<ProtectedRoute role="cashier"><CashierStats /></ProtectedRoute>} />
        <Route path="/waiter/tables"    element={<ProtectedRoute role="waiter"><WaiterTables /></ProtectedRoute>} />
        <Route path="/waiter/menu/:code" element={<ProtectedRoute role="waiter"><WaiterMenu /></ProtectedRoute>} />
        <Route path="/profile"          element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
