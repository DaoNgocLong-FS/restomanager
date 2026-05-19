// =============================================================================
//  AdminShell — layout sidebar cho khu vực admin (khác POS dùng bottom-nav)
//  Sidebar trái + main content phải, responsive (mobile collapse sidebar)
// =============================================================================
import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UtensilsCrossed, Grid3x3,
  Receipt, History, LogOut, Menu as MenuIcon, X, Utensils,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from './Confirm';
import { useToast } from './Toast';

const NAV = [
  { to: '/admin/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/admin/users',     label: 'Nhân viên', icon: Users },
  { to: '/admin/menu',      label: 'Thực đơn',  icon: UtensilsCrossed },
  { to: '/admin/tables',    label: 'Bàn',       icon: Grid3x3 },
  { to: '/admin/invoices',  label: 'Hoá đơn',   icon: Receipt },
  { to: '/admin/logs',      label: 'Nhật ký',   icon: History },
];

export default function AdminShell() {
  const { user, logout } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);   // mobile sidebar drawer

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
    <div className="min-h-screen bg-surface flex">
      {/* Sidebar (desktop fixed, mobile drawer) */}
      <aside className={
        'fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-border-soft flex flex-col ' +
        'transition-transform lg:translate-x-0 ' +
        (open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
      }>
        <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-on-surface">RestoManager</div>
              <div className="text-xs text-muted">Admin Panel</div>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-muted hover:text-on-surface"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(it => (
            <NavLink
              key={it.to} to={it.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ' +
                (isActive
                  ? 'bg-primary text-white font-semibold'
                  : 'text-on-surface hover:bg-surface-low')
              }
            >
              <it.icon className="w-5 h-5" />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border-soft">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center font-semibold text-on-surface">
              {(user?.full_name || user?.username || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-on-surface truncate">
                {user?.full_name || user?.username}
              </div>
              <div className="text-xs text-muted capitalize">{user?.role}</div>
            </div>
            <button
              onClick={onLogout}
              className="text-muted hover:text-danger transition"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop khi mở drawer mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top bar mobile-only */}
        <header className="lg:hidden bg-white border-b border-border-soft px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <button
            onClick={() => setOpen(true)}
            className="text-on-surface"
            aria-label="Mở menu"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
          <div className="font-bold text-on-surface">RestoManager Admin</div>
          <div className="w-6" />
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
