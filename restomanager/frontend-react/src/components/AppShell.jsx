// =============================================================================
//  AppShell — khung layout chung sau khi đăng nhập
//  Hiện thanh tab bottom-nav theo role (cashier/waiter)
//  Header + nội dung trang là <Outlet />
// =============================================================================
import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, Receipt, BarChart3, User, Utensils, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from './Confirm';
import { useToast } from './Toast';

const NAV_CASHIER = [
  { to: '/cashier/tables', label: 'Bàn',     icon: LayoutGrid },
  { to: '/cashier/orders', label: 'Đơn hàng', icon: Receipt },
  { to: '/cashier/stats',  label: 'Thống kê', icon: BarChart3 },
  { to: '/profile',        label: 'Cá nhân',  icon: User },
];
const NAV_WAITER = [
  { to: '/waiter/tables', label: 'Bàn',     icon: LayoutGrid },
  { to: '/profile',       label: 'Cá nhân', icon: User },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();

  const navItems = user?.role === 'waiter' ? NAV_WAITER : NAV_CASHIER;

  const onLogout = async () => {
    const ok = await confirm({
      title: 'Đăng xuất?',
      message: 'Bạn cần đăng nhập lại để dùng tiếp.',
      okText: 'Đăng xuất', danger: true,
    });
    if (!ok) return;
    await logout();
    toast.ok('Đã đăng xuất');
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Top bar */}
      <header className="bg-white border-b border-border-soft px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Utensils className="w-5 h-5 text-primary" />
          <span className="font-bold text-on-surface">RestoManager</span>
          <span className="text-xs text-muted ml-2">· {user?.full_name || user?.username}</span>
        </div>
        <button onClick={onLogout} className="text-muted hover:text-danger transition" title="Đăng xuất">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border-soft z-30">
        <div className="max-w-3xl mx-auto flex">
          {navItems.map(it => (
            <NavLink key={it.to} to={it.to}
              className={({ isActive }) =>
                'flex-1 flex flex-col items-center gap-1 py-3 transition ' +
                (isActive ? 'text-primary' : 'text-muted hover:text-on-surface')
              }
            >
              <it.icon className="w-5 h-5" />
              <span className="text-[11px] font-semibold">{it.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
