// =============================================================================
//  LoginPage — đăng nhập + redirect theo role (validate bằng react-hook-form)
// =============================================================================
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from './AuthContext';
import { useToast } from '../components/Toast';
import { Utensils, LogIn, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { user, login, booting } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [authErr, setAuthErr] = useState('');   // lỗi trả từ server (sai pass...)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { username: '', password: '' },
    mode: 'onSubmit',         // validate khi submit, không quá phiền lúc gõ
    reValidateMode: 'onChange',
  });

  // Đã login thì đẩy về trang chính
  useEffect(() => {
    if (user && !booting) {
      const from = location.state?.from || defaultPath(user.role);
      navigate(from, { replace: true });
    }
  }, [user, booting]); // eslint-disable-line

  const onSubmit = async ({ username, password }) => {
    setAuthErr('');
    try {
      const me = await login(username.trim(), password);
      toast.ok('Đăng nhập thành công', me?.full_name || me?.username);
      navigate(defaultPath(me.role), { replace: true });
    } catch (e) {
      setAuthErr(e.message || 'Đăng nhập thất bại');
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

        <form onSubmit={handleSubmit(onSubmit)} className="card p-6" noValidate>
          <h2 className="text-lg font-bold text-on-surface mb-4">Đăng nhập</h2>

          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Tên đăng nhập
          </label>
          <input
            className={'field ' + (errors.username ? 'border-danger' : '')}
            autoComplete="username"
            autoFocus
            placeholder=""
            {...register('username', {
              required: 'Vui lòng nhập tên đăng nhập',
              minLength: { value: 1, message: 'Tên đăng nhập không hợp lệ' },
              setValueAs: (v) => (v ?? '').trim(),
            })}
          />
          {errors.username && (
            <p className="mt-1 text-xs text-danger">{errors.username.message}</p>
          )}

          <label className="block text-xs font-semibold text-on-surface-variant mb-1 mt-3">
            Mật khẩu
          </label>
          <input
            className={'field ' + (errors.password ? 'border-danger' : '')}
            type="password"
            autoComplete="current-password"
            placeholder=""
            {...register('password', {
              required: 'Vui lòng nhập mật khẩu',
              minLength: { value: 1, message: 'Mật khẩu không hợp lệ' },
            })}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
          )}

          {/* Lỗi từ server (sai mật khẩu, tài khoản khoá, mạng lỗi…) */}
          {authErr && <div className="mt-3 text-sm text-danger">{authErr}</div>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full mt-5 h-12 text-base"
          >
            {isSubmitting
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <><LogIn className="w-5 h-5" /> Đăng nhập</>}
          </button>
        </form>
      </div>
    </div>
  );
}

function defaultPath(role) {
  if (role === 'admin')   return '/admin/dashboard';
  if (role === 'cashier') return '/cashier/tables';
  if (role === 'waiter')  return '/waiter/tables';
  return '/login';
}
