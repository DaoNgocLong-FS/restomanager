import React, { createContext, useContext, useEffect, useState } from 'react';
import { Api, AuthEvents, loadConfig, setToken, setRefreshToken, setUser, clearAuth, getApiBase } from './api';
import { connectSocket, disconnectSocket } from './socket';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [user, setUserState] = useState(null);
  const [apiBase, setBaseState] = useState(null);

  useEffect(() => {
    // BOOT_FAILSAFE: nếu Api.me() treo (network/server chậm) → vẫn dừng spinner sau 8s,
    // điều hướng vào màn Login. fetch trong api.js cũng đã có timeout 8s.
    const _bootTimer = setTimeout(() => {
      console.warn('[boot] failsafe timeout, booting=false');
      setBooting(false);
    }, 8500);
    (async () => {
      try {
        const cfg = await loadConfig();
        setBaseState(cfg.base);
        if (cfg.base && cfg.token) {
          try {
            const me = await Api.me();   // request() đã có refresh-retry + timeout 8s
            setUserState(me);
            connectSocket();
          } catch (e) {
            console.warn('[boot] Api.me failed:', e && e.message);
            await clearAuth();
          }
        }
      } finally {
        clearTimeout(_bootTimer);
        setBooting(false);
      }
    })();

    // Khi cả refresh cũng hỏng → force logout
    const off = AuthEvents.on('session-expired', async () => {
      try { disconnectSocket(); } catch (_) {}
      await clearAuth();
      setUserState(null);
    });
    return () => { try { off(); } catch (_) {} };
  }, []);

  const login = async (username, password) => {
    const data = await Api.login(username, password);
    // Api.login đã tự lưu token/refresh/user vào AsyncStorage
    if (data && data.user) setUserState(data.user);
    connectSocket();
    return data && data.user;
  };

  const logout = async () => {
    try { disconnectSocket(); } catch (_) {}
    await Api.logout();
    await clearAuth();
    setUserState(null);
  };

  const updateBase = (b) => setBaseState(b);

  return (
    <AuthCtx.Provider value={{ booting, user, apiBase, login, logout, updateBase, apiBaseGetter: getApiBase }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
