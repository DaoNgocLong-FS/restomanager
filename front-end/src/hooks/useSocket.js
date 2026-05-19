// =============================================================================
//  useSocket — kết nối socket.io với token hiện tại + cấp event listener
// =============================================================================
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { tokenStore, AuthEvents } from '../api/client';

let _sock = null;

function ensureSocket() {
  if (_sock && _sock.connected) return _sock;
  if (_sock) return _sock; // đang reconnect
  _sock = io({
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    auth: { token: tokenStore.token || '' },
  });
  _sock.on('connect',    () => console.log('[socket] connected', _sock.id));
  _sock.on('disconnect', (r) => console.log('[socket] disconnect', r));
  _sock.on('connect_error', (err) => {
    console.warn('[socket] error:', err.message);
  });
  return _sock;
}

// Khi token đổi (refresh thành công), cần reconnect với token mới.
// Ở đây nghe session-expired là đủ — sẽ disconnect và để useSocket tự reconnect khi user login lại.
AuthEvents.on('session-expired', () => {
  if (_sock) { try { _sock.disconnect(); } catch (_) {} _sock = null; }
});

/**
 * Subscribe many events at once. Tự động cleanup khi unmount.
 * @param {Record<string, (payload:any)=>void>} handlers
 */
export function useSocket(handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!tokenStore.token) return;
    const sock = ensureSocket();
    const wrapped = {};
    Object.keys(handlers || {}).forEach((evt) => {
      wrapped[evt] = (payload) => {
        const h = ref.current && ref.current[evt];
        if (typeof h === 'function') h(payload);
      };
      sock.on(evt, wrapped[evt]);
    });
    return () => {
      Object.entries(wrapped).forEach(([evt, fn]) => sock.off(evt, fn));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function disconnectSocket() {
  if (_sock) { try { _sock.disconnect(); } catch (_) {} _sock = null; }
}
