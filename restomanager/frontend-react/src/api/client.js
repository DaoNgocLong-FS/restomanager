// =============================================================================
//  API client — port từ frontend/js/api.js (vanilla → ES module)
//  Giữ nguyên logic envelope { success, data, message, error } và
//  refresh-token state machine: 401 + TOKEN_EXPIRED → /auth/refresh → retry.
// =============================================================================
const ORIGIN_API = '/api';
const FALLBACK_API = 'http://localhost:3000/api';
const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    ? ORIGIN_API
    : FALLBACK_API;

const TOKEN_KEY = 'rm_token';
const REFRESH_KEY = 'rm_refresh';
const USER_KEY = 'rm_user';

export const tokenStore = {
  get token()    { return localStorage.getItem(TOKEN_KEY); },
  set token(t)   { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); },
  get refresh()  { return localStorage.getItem(REFRESH_KEY); },
  set refresh(t) { t ? localStorage.setItem(REFRESH_KEY, t) : localStorage.removeItem(REFRESH_KEY); },
  get user()     { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } },
  set user(u)    { u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY); },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

// Pub/sub đơn giản — AuthContext lắng nghe để force-logout khi refresh hỏng.
const _listeners = { 'session-expired': [] };
export const AuthEvents = {
  on(ev, fn) { (_listeners[ev] = _listeners[ev] || []).push(fn); return () => AuthEvents.off(ev, fn); },
  off(ev, fn) { if (_listeners[ev]) _listeners[ev] = _listeners[ev].filter(f => f !== fn); },
  emit(ev, payload) { (_listeners[ev] || []).forEach(fn => { try { fn(payload); } catch (_) {} }); },
};

let _refreshing = null;
async function _doRefresh() {
  if (_refreshing) return _refreshing;
  const rt = tokenStore.refresh;
  if (!rt) return false;
  _refreshing = (async () => {
    try {
      const res = await fetch(API_BASE + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });
      const text = await res.text();
      let json; try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
      if (!res.ok || json.success === false) {
        tokenStore.clear();
        AuthEvents.emit('session-expired', { reason: (json.error && json.error.code) || 'REFRESH_FAILED' });
        return false;
      }
      const d = json.data || {};
      if (d.token)         tokenStore.token   = d.token;
      if (d.refresh_token) tokenStore.refresh = d.refresh_token;
      if (d.user)          tokenStore.user    = d.user;
      return true;
    } catch {
      tokenStore.clear();
      AuthEvents.emit('session-expired', { reason: 'NETWORK_ERROR' });
      return false;
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

async function request(path, opts = {}) {
  const { method = 'GET', body, query, headers, isForm, _retry = false } = opts;

  let url = API_BASE + path;
  if (query) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  const reqOpts = { method, headers: { ...(headers || {}) } };
  if (tokenStore.token) reqOpts.headers['Authorization'] = 'Bearer ' + tokenStore.token;
  if (body !== undefined) {
    if (isForm) reqOpts.body = body;
    else { reqOpts.headers['Content-Type'] = 'application/json'; reqOpts.body = JSON.stringify(body); }
  }

  let res, text, json;
  try {
    res = await fetch(url, reqOpts);
    text = await res.text();
  } catch (e) {
    const err = new Error('Không thể kết nối tới server');
    err.code = 'NETWORK_ERROR';
    throw err;
  }
  try { json = text ? JSON.parse(text) : {}; }
  catch { json = { success: false, message: text || `HTTP ${res.status}` }; }

  if (!res.ok || json.success === false) {
    const err = new Error((json && json.message) || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = (json && json.error && json.error.code) || `HTTP_${res.status}`;
    err.details = json && json.error && json.error.details;

    const isAuthErr = err.status === 401 &&
      (err.code === 'TOKEN_EXPIRED' || err.code === 'INVALID_TOKEN' || err.code === 'jwt expired');
    if (isAuthErr && !_retry && tokenStore.refresh && path !== '/auth/refresh') {
      const ok = await _doRefresh();
      if (ok) return request(path, { ...opts, _retry: true });
    }
    if (err.status === 401) tokenStore.clear();
    throw err;
  }
  return json.data;
}

export const Api = {
  base: API_BASE,
  request,

  // Auth
  login: async (username, password) => {
    const data = await request('/auth/login', { method: 'POST', body: { username, password } });
    if (data?.token)         tokenStore.token   = data.token;
    if (data?.refresh_token) tokenStore.refresh = data.refresh_token;
    if (data?.user)          tokenStore.user    = data.user;
    return data;
  },
  refresh: () => _doRefresh(),
  me:      () => request('/auth/me'),
  logout:  () => request('/auth/logout', { method: 'POST' }).catch(() => {}),

  // Menu
  listCategories: () => request('/menu/categories'),
  listMenu:       (q) => request('/menu', { query: q }),

  // Tables
  listTables:    (q) => request('/tables', { query: q }),
  setTableActive:(id, isActive) =>
    request('/tables/' + id + '/active', { method: 'PATCH', body: { is_active: !!isActive } }),
  clearTable:    (id, reason) =>
    request('/tables/' + id + '/clear', { method: 'POST', body: reason ? { reason } : {} }),

  // Orders
  listOrders:    (q) => request('/orders', { query: q }),
  createOrder:   (data) => request('/orders', { method: 'POST', body: data }),
  getOrder:      (id) => request('/orders/' + id),
  getOpenOrderForTable: (tableId) => request('/orders/by-table/' + tableId),
  addOrderItems: (id, items) => request('/orders/' + id + '/items', { method: 'POST', body: { items } }),
  updateOrderItem: (orderId, itemId, payload) =>
    request('/orders/' + orderId + '/items/' + itemId, { method: 'PUT', body: payload }),
  removeOrderItem: (orderId, itemId) =>
    request('/orders/' + orderId + '/items/' + itemId, { method: 'DELETE' }),
  cancelOrder:   (id) => request('/orders/' + id, { method: 'DELETE' }),
  moveOrder:     (id, toTableId) =>
    request('/orders/' + id + '/move', { method: 'POST', body: { to_table_id: toTableId } }),
  checkout:      (id, payload) =>
    request('/orders/' + id + '/checkout', { method: 'POST', body: payload }),

  // Invoices
  listInvoices:  (q) => request('/invoices', { query: q }),
  getInvoice:    (id) => request('/invoices/' + id),

  // Stats
  statsOverview: (q) => request('/stats/overview', { query: q }),

  // Health
  health:        () => request('/health'),
};

// ─── Số tiền (đ), giống cũ ─────────────────────────────────────────────────
export const fmt = (n) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + 'đ';
