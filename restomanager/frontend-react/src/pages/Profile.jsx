// =============================================================================
//  Profile — thông tin user + nút đăng xuất
// =============================================================================
import React from 'react';
import { LogOut, Server, Info } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useConfirm } from '../components/Confirm';
import { useToast } from '../components/Toast';

export default function Profile() {
  const { user, logout } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();

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
    <div className="max-w-md mx-auto px-4 py-4">
      <div className="card p-6 text-center mb-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mb-3">
          {(user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="font-bold text-lg text-on-surface">{user?.full_name || user?.username}</div>
        <div className="text-sm text-muted capitalize">{user?.role}</div>
      </div>

      <div className="card divide-y divide-border-soft">
        <Item icon={Server} label="API" value="/api (proxy)" />
        <Item icon={Info}   label="Phiên bản" value="2.0.0 (React)" />
      </div>

      <button onClick={onLogout}
        className="w-full mt-6 h-12 rounded-xl bg-red-50 text-red-700 font-semibold flex items-center justify-center gap-2 hover:bg-red-100 transition">
        <LogOut className="w-5 h-5" /> Đăng xuất
      </button>
    </div>
  );
}

function Item({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="w-4 h-4 text-muted" />
      <span className="text-sm text-on-surface flex-1">{label}</span>
      <span className="text-xs text-muted">{value}</span>
    </div>
  );
}
