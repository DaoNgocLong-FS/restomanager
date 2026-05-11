// =============================================================================
//  LoginPage — đăng nhập + redirect theo role
// =============================================================================
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useToast } from '../components/Toast';
import { Utensils, LogIn, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { user, login, booting } = useAuth();
  const [u, setU] = useState('cashier');
  const [p, setP] = useState('123');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // Đã login thì đẩy về trang chính
  useEffect(() => {
    if (user && !booting) {
      const from = location.state?.from || defaultPath(user.role);
      navigate(from, { replace: true });
    }
  }, [user, booting]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const me = await login(u.trim(), p);
      toast.ok('Đăng nhập thành công', me?.full_name || me?.username);
      navigate(defaultPath(me.role), { replace: true });
    } catch (e) {
      setErr(e.message || 'Đăng nhập thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary to-primary-dark">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto bg-white/15 rounded-2xl flex items-center justify-center mb-3 backdrop-blur">
            <Utensils className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">RestoManager</h1>
          <p className="text-sm text-white/75 mt-1">Hệ thống quản lý nhà hàng</p>
        </div>

        <form onSubmit={submit} className="card p-6">
          <h2 className="text-lg font-bold text-on-surface mb-4">Đăng nhập</h2>

          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Tên đăng nhập
          </label>
          <input className="field" autoComplete="username" autoFocus
            value={u} onChange={(e) => setU(e.target.value)} placeholder="cashier / waiter"/>

          <label className="block text-xs font-semibold text-on-surface-variant mb-1 mt-3">
            Mật khẩu
          </label>
          <input className="field" type="password" autoComplete="current-password"
            value={p} onChange={(e) => setP(e.target.value)} placeholder="••••"/>

          {err && <div className="mt-3 text-sm text-danger">{err}</div>}

          <button type="submit" disabled={busy}
            className="btn-primary w-full mt-5 h-12 text-base">
            {busy
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <><LogIn className="w-5 h-5" /> Đăng nhập</>}
          </button>

          <p className="text-xs text-muted text-center mt-4">
            Tài khoản admin nên đăng nhập qua trang quản trị (admin.html)
          </p>
        </form>
      </div>
    </div>
  );
}

function defaultPath(role) {
  if (role === 'cashier' || role === 'admin') return '/cashier/tables';
  if (role === 'waiter') return '/waiter/tables';
  return '/login';
}
