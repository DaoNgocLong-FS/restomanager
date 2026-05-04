// =============================================================================
//  Realtime client (Socket.IO) cho mobile.
//  - Chia sẻ apiBase với module api.js (REST)
//  - Auto-reconnect; xác thực bằng JWT (cùng secret với REST API)
//  - useRealtime(events) hook đăng ký nhanh handler trong screen
// =============================================================================
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getApiBase, getToken } from './api';

let _socket = null;

function _origin(base) {
  if (!base) return null;
  return base.replace(/\/api\/?$/, '').replace(/\/+$/, '');
}

export function getSocket() { return _socket; }

export function connectSocket() {
  if (_socket && _socket.connected) return _socket;
  const base = getApiBase();
  const origin = _origin(base);
  if (!origin) return null;
  if (_socket) { try { _socket.disconnect(); } catch (_) {} _socket = null; }

  _socket = io(origin, {
    path: '/socket.io',
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    timeout: 10000,
    auth: { token: getToken() || '' },
  });

  _socket.on('connect',     () => console.log('[socket] connected', _socket.id));
  _socket.on('disconnect',  (r) => console.log('[socket] disconnect', r));
  _socket.on('connect_error', (e) => console.warn('[socket] error', e && e.message));
  return _socket;
}

export function disconnectSocket() {
  if (_socket) { try { _socket.disconnect(); } catch (_) {} _socket = null; }
}

/**
 * useRealtime({ 'tables:changed': fn, 'orders:changed': fn })
 *  - Tự kết nối khi mount (nếu chưa)
 *  - Tự gỡ listener khi unmount
 *  - KHÔNG ngắt socket khi unmount để các screen khác vẫn dùng tiếp
 */
export function useRealtime(handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const sock = connectSocket();
    if (!sock) return;
    const wrapped = {};
    Object.keys(handlers || {}).forEach((ev) => {
      wrapped[ev] = (...args) => {
        const fn = ref.current && ref.current[ev];
        if (typeof fn === 'function') fn(...args);
      };
      sock.on(ev, wrapped[ev]);
    });
    return () => {
      Object.keys(wrapped).forEach((ev) => sock.off(ev, wrapped[ev]));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
