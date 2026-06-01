// =============================================================================
//  App.jsx — Router chính
//
//  Routes (theo role):
//
//    /login                    LoginPage
//
//    /admin/dashboard          AdminDashboard   ─┐
//    /admin/users              AdminUsers        │
//    /admin/menu               AdminMenu         ├─ bao trong AdminShell (sidebar)
//    /admin/tables             AdminTables       │
//    /admin/invoices           AdminInvoices     │
//    /admin/logs               AdminLogs        ─┘
//
//    /cashier/tables           CashierTables    ─┐
//    /cashier/detail/:code     CashierDetail     │
//    /cashier/orders           CashierOrders     ├─ bao trong AppShell (bottom-nav)
//    /cashier/stats            CashierStats      │
//    /waiter/tables            WaiterTables      │
//    /waiter/menu/:code        WaiterMenu        │
//    /profile                  Profile          ─┘
// =============================================================================
import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import LoginPage      from './auth/LoginPage';
import AppShell       from './components/AppShell';
import AdminShell     from './components/AdminShell';

import AdminDashboard from './pages/AdminDashboard';
import AdminUsers     from './pages/AdminUsers';
import AdminMenu      from './pages/AdminMenu';
import AdminTables    from './pages/AdminTables';
import AdminInvoices  from './pages/AdminInvoices';
import AdminLogs      from './pages/AdminLogs';

import CashierTables  from './pages/CashierTables';
import CashierDetail  from './pages/CashierDetail';
import CashierOrders  from './pages/CashierOrders';
import CashierStats   from './pages/CashierStats';
import WaiterTables   from './pages/WaiterTables';
import WaiterMenu     from './pages/WaiterMenu';
import Profile        from './pages/Profile';

function defaultPath(role) {
  if (role === 'admin')   return '/admin/dashboard';
  if (role === 'cashier') return '/cashier/tables';
  if (role === 'waiter')  return '/waiter/tables';
  return '/login';
}

function ProtectedRoute({ children, roles }) {
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
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={defaultPath(user.role)} replace />;
  }
  return children;
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

      {/* ── Admin (sidebar layout) ─────────────────────────────────────── */}
      <Route element={<ProtectedRoute roles={['admin']}><AdminShell /></ProtectedRoute>}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/users"     element={<AdminUsers />} />
        <Route path="/admin/menu"      element={<AdminMenu />} />
        <Route path="/admin/tables"    element={<AdminTables />} />
        <Route path="/admin/invoices"  element={<AdminInvoices />} />
        <Route path="/admin/logs"      element={<AdminLogs />} />
      </Route>

      {/* ── POS (bottom-nav layout) ────────────────────────────────────── */}
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/cashier/tables"      element={<ProtectedRoute roles={['cashier','admin']}><CashierTables /></ProtectedRoute>} />
        <Route path="/cashier/detail/:code" element={<ProtectedRoute roles={['cashier','admin']}><CashierDetail /></ProtectedRoute>} />
        <Route path="/cashier/orders"      element={<ProtectedRoute roles={['cashier','admin']}><CashierOrders /></ProtectedRoute>} />
        <Route path="/cashier/stats"       element={<ProtectedRoute roles={['cashier','admin']}><CashierStats /></ProtectedRoute>} />
        <Route path="/waiter/tables"       element={<ProtectedRoute roles={['waiter','admin']}><WaiterTables /></ProtectedRoute>} />
        <Route path="/waiter/menu/:code"   element={<ProtectedRoute roles={['waiter','cashier','admin']}><WaiterMenu /></ProtectedRoute>} />
        <Route path="/profile"             element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
