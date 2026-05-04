// =============================================================================
//  API client cho mobile (React Native)
//  Envelope chuẩn: { success, data, message?, meta? } / { success:false, message, error }
//
//  V2: refresh token. Khi access JWT (15m) hết hạn:
//   - server trả 401 + code TOKEN_EXPIRED
//   - request() tự gọi POST /auth/refresh với refresh token đã lưu
//   - thành công → cập nhật cả 2 token + retry request gốc 1 lần
//   - thất bại → emit 'session-expired' qua AuthEvents để AuthContext logout.
// =============================================================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  base:    'rm_api_base',
  token:   'rm_token',
  refresh: 'rm_refresh',
  user:    'rm_user',
};

let _cache = { base: null, token: null, refresh: null, user: null };

// Pub/sub đơn giản cho session-expired để AuthContext lắng nghe
const _listeners = { 'session-expired': [] };
export const AuthEvents = {
  on(ev, fn) { (_listeners[ev] = _listeners[ev] || []).push(fn); return () => AuthEvents.off(ev, fn); },
  off(ev, fn){ if (_listeners[ev]) _listeners[ev] = _listeners[ev].filter(f => f !== fn); },
  emit(ev, payload) { (_listeners[ev] || []).forEach(fn => { try { fn(payload); } catch (_) {} }); },
};

export async function loadConfig() {
  const [b, t, r, u] = await Promise.all([
    AsyncStorage.getItem(KEYS.base),
    AsyncStorage.getItem(KEYS.token),
    AsyncStorage.getItem(KEYS.refresh),
    AsyncStorage.getItem(KEYS.user),
  ]);
  _cache.base    = b || null;
  _cache.token   = t || null;
  _cache.refresh = r || null;
  _cache.user    = u ? JSON.parse(u) : null;
  return { ..._cache };
}
export const getApiBase = () => _cache.base;
export async function setApiBase(url) {
  _cache.base = url;
  if (url) await AsyncStorage.setItem(KEYS.base, url);
  else await AsyncStorage.removeItem(KEYS.base);
}
export const getToken = () => _cache.token;
export async function setToken(tok) {
  _cache.token = tok;
  if (tok) await AsyncStorage.setItem(KEYS.token, tok);
  else await AsyncStorage.removeItem(KEYS.token);
}
export const getRefreshToken = () => _cache.refresh;
export async function setRefreshToken(tok) {
  _cache.refresh = tok;
  if (tok) await AsyncStorage.setItem(KEYS.refresh, tok);
  else await AsyncStorage.removeItem(KEYS.refresh);
}
export const getUser = () => _cache.user;
export async function setUser(u) {
  _cache.user = u;
  if (u) await AsyncStorage.setItem(KEYS.user, JSON.stringify(u));
  else await AsyncStorage.removeItem(KEYS.user);
}
export async function clearAuth() {
  _cache.token = null; _cache.refresh = null; _cache.user = null;
  await AsyncStorage.multiRemove([KEYS.token, KEYS.refresh, KEYS.user]);
}

// Đảm bảo nhiều request đồng thời chỉ gọi /auth/refresh một lần
let _refreshing = null;
async function _doRefresh() {
  if (_refreshing) return _refreshing;
  if (!_cache.base || !_cache.refresh) return false;
  _refreshing = (async () => {
    try {
      const url = _cache.base.replace(/\/+$/, '') + '/auth/refresh';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: _cache.refresh }),
      });
      const text = await res.text();
      let json; try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
      if (!res.ok || json.success === false) {
        await clearAuth();
        AuthEvents.emit('session-expired', { reason: (json.error && json.error.code) || 'REFRESH_FAILED' });
        return false;
      }
      const d = json.data || {};
      if (d.token)         await setToken(d.token);
      if (d.refresh_token) await setRefreshToken(d.refresh_token);
      if (d.user)          await setUser(d.user);
      return true;
    } catch (_) {
      AuthEvents.emit('session-expired', { reason: 'NETWORK_ERROR' });
      return false;
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

async function request(path, opts = {}) {
  const { method = 'GET', body, query, isForm, _retry = false, skipAuthRefresh = false } = opts;
  if (!_cache.base) {
    const e = new Error('Chưa cấu hình API. Vào Cài đặt để nhập URL.');
    e.code = 'NO_BASE'; throw e;
  }
  let url = _cache.base.replace(/\/+$/, '') + path;
  if (query) {
    const qs = Object.entries(query)
      .filter(([_,v]) => v !== undefined && v !== null && v !== '')
      .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  const reqOpts = { method, headers: {} };
  if (_cache.token) reqOpts.headers['Authorization'] = 'Bearer ' + _cache.token;
  if (body !== undefined) {
    if (isForm) reqOpts.body = body;
    else { reqOpts.headers['Content-Type'] = 'application/json'; reqOpts.body = JSON.stringify(body); }
  }
  // Hard timeout: tránh fetch treo khi server không phản hồi (RN không có default timeout)
  const _ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  if (_ctrl) reqOpts.signal = _ctrl.signal;
  const _to = setTimeout(() => { try { _ctrl && _ctrl.abort(); } catch (_) {} }, opts.timeoutMs || 8000);
  let res, text, json;
  try {
    res  = await fetch(url, reqOpts);
    text = await res.text();
  } catch (netErr) {
    const e = new Error(
      (netErr && netErr.name === 'AbortError')
        ? 'Server không phản hồi (quá ' + ((opts.timeoutMs || 8000) / 1000) + 's). Kiểm tra URL & mạng.'
        : 'Không kết nối được server. Kiểm tra URL & cùng mạng Wi-Fi.'
    );
    e.code = (netErr && netErr.name === 'AbortError') ? 'TIMEOUT' : 'NETWORK_ERROR';
    clearTimeout(_to);
    throw e;
  } finally {
    clearTimeout(_to);
  }
  try { json = text ? JSON.parse(text) : {}; }
  catch { json = { success:false, message: text || `HTTP ${res.status}` }; }

  if (!res.ok || json.success === false) {
    const err = new Error((json && json.message) || `HTTP ${res.status}`);
    err.status  = res.status;
    err.code    = (json && json.error && json.error.code) || 'HTTP_' + res.status;
    err.details = json && json.error && json.error.details;

    // Auto-refresh access token rồi retry 1 lần
    const isAuthErr = err.status === 401 &&
      (err.code === 'TOKEN_EXPIRED' || err.code === 'INVALID_TOKEN' || err.code === 'jwt expired');
    if (isAuthErr && !_retry && !skipAuthRefresh && _cache.refresh && path !== '/auth/refresh') {
      const ok = await _doRefresh();
      if (ok) return request(path, { ...opts, _retry: true });
    }
    if (err.status === 401 && (err.code === 'INVALID_TOKEN' || err.code === 'TOKEN_EXPIRED')) {
      await clearAuth();
    }
    throw err;
  }
  return json.data;
}

export const Api = {
  request,
  AuthEvents,
  // Auth
  login: async (username, password) => {
    const data = await request('/auth/login', { method:'POST', body:{username, password} });
    if (data && data.token)         await setToken(data.token);
    if (data && data.refresh_token) await setRefreshToken(data.refresh_token);
    if (data && data.user)          await setUser(data.user);
    return data;
  },
  refresh: () => _doRefresh(),
  me:      () => request('/auth/me'),
  logout:  () => request('/auth/logout', { method:'POST' }).catch(()=>{}),
  // Users
  listUsers: () => request('/users'),
  // Menu
  listCategories: () => request('/menu/categories'),
  listMenu: (q) => request('/menu', { query: q }),
  // Tables
  listTables: (q) => request('/tables', { query: q }),
  // Orders
  listOrders: (q) => request('/orders', { query: q }),
  getOrder: (id) => request('/orders/' + id),
  getOpenOrderForTable: (tableId) => request('/orders/by-table/' + tableId),
  createOrder: (data) => request('/orders', { method:'POST', body: data }),
  addOrderItems: (id, items) => request('/orders/' + id + '/items', { method:'POST', body:{ items } }),
  updateOrderItem: (orderId, itemId, payload) =>
    request('/orders/' + orderId + '/items/' + itemId, { method:'PUT', body: payload }),
  removeOrderItem: (orderId, itemId) =>
    request('/orders/' + orderId + '/items/' + itemId, { method:'DELETE' }),
  cancelOrder: (id) => request('/orders/' + id, { method:'DELETE' }),
  checkout: (id, payload) => request('/orders/' + id + '/checkout', { method:'POST', body: payload }),
  // Invoices
  listInvoices: (q) => request('/invoices', { query: q }),
  getInvoice: (id) => request('/invoices/' + id),
  // Stats
  statsOverview: (q) => request('/stats/overview', { query: q }),
  // Health
  health: () => request('/health'),
};
