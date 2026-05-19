// =============================================================================
//  AuthContext — quản lý user/token, lắng nghe session-expired để redirect
// =============================================================================
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Api, AuthEvents, tokenStore } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokenStore.user);
  const [booting, setBooting] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  // Khi mount: nếu có token → gọi /auth/me để verify còn sống và lấy user mới nhất
  useEffect(() => {
    (async () => {
      if (tokenStore.token) {
        try {
          const me = await Api.me();
          if (me) { tokenStore.user = me; setUser(me); }
        } catch (_) { /* refresh-token sẽ tự xử lý hoặc clear */ }
      }
      setBooting(false);
    })();
  }, []);

  // Subscribe: server từ chối refresh → đẩy về login
  useEffect(() => {
    const off = AuthEvents.on('session-expired', () => {
      setUser(null);
      toast.err('Phiên đã hết hạn', 'Vui lòng đăng nhập lại.');
      navigate('/login', { replace: true });
    });
    return off;
  }, [navigate, toast]);

  const login = useCallback(async (username, password) => {
    const data = await Api.login(username, password);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await Api.logout(); } catch (_) {}
    tokenStore.clear();
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthCtx.Provider value={{ user, booting, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
