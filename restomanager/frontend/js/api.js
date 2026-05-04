// =============================================================================
//  RestoManager – Shared API client
//  Envelope server:
//     thành công: { success:true,  data, message?, meta? }
//     thất bại:   { success:false, message, error:{ code, details? } }
//
//  V2: hỗ trợ refresh token. Khi access token (JWT_EXPIRES, vd 15m) hết hạn:
//   - Server trả 401 + code TOKEN_EXPIRED.
//   - Client tự gọi POST /auth/refresh với refresh_token đã lưu.
//   - Nếu thành công → cập nhật token mới + retry request gốc 1 lần.
//   - Nếu refresh cũng hỏng (code REFRESH_INVALID) → clear auth & dispatch
//     event 'rm:session-expired' để app điều hướng về Login.
// =============================================================================
(function () {
  const ORIGIN_API   = '/api';
  const FALLBACK_API = 'http://localhost:3000/api';
  const API_BASE = (location.protocol === 'http:' || location.protocol === 'https:')
    ? ORIGIN_API : FALLBACK_API;

  const TOKEN_KEY    = 'rm_token';
  const REFRESH_KEY  = 'rm_refresh';
  const USER_KEY     = 'rm_user';

  function getToken()   { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t)  { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
  function getRefresh() { return localStorage.getItem(REFRESH_KEY); }
  function setRefresh(t){ if (t) localStorage.setItem(REFRESH_KEY, t); else localStorage.removeItem(REFRESH_KEY); }
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }
  function getUser()    { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (_) { return null; } }
  function setUser(u)   { localStorage.setItem(USER_KEY, JSON.stringify(u)); }

  // Cập nhật cả socket auth khi token đổi (nếu socket đang mở)
  function _refreshSocketAuth() {
    const sock = window._rmSocket;
    if (!sock) return;
    try {
      sock.auth = { token: getToken() || '' };
      // Buộc reconnect với token mới
      if (sock.disconnect && sock.connect) { sock.disconnect(); sock.connect(); }
    } catch (_) {}
  }

  // ─── Refresh state machine ──────────────────────────────────────────────
  // Đảm bảo nhiều request đồng thời chỉ gọi /auth/refresh một lần.
  let _refreshing = null;
  async function _doRefresh() {
    if (_refreshing) return _refreshing;
    const rt = getRefresh();
    if (!rt) return Promise.resolve(false);
    _refreshing = (async () => {
      try {
        const res = await fetch(API_BASE + '/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
        });
        const text = await res.text();
        let json; try { json = text ? JSON.parse(text) : {}; } catch (_) { json = {}; }
        if (!res.ok || json.success === false) {
          // Refresh hỏng → buộc đăng xuất phía client
          clearToken();
          window.dispatchEvent(new CustomEvent('rm:session-expired',
            { detail: { reason: (json.error && json.error.code) || 'REFRESH_FAILED' } }));
          return false;
        }
        const d = json.data || {};
        if (d.token)         setToken(d.token);
        if (d.refresh_token) setRefresh(d.refresh_token);
        if (d.user)          setUser(d.user);
        _refreshSocketAuth();
        return true;
      } catch (_) {
        clearToken();
        window.dispatchEvent(new CustomEvent('rm:session-expired',
          { detail: { reason: 'NETWORK_ERROR' } }));
        return false;
      } finally {
        _refreshing = null;
      }
    })();
    return _refreshing;
  }

  /**
   * request(path, opts)
   *  - opts.method, body, query, headers, isForm
   *  - opts.full = true → trả nguyên envelope { data, meta, message }
   *  - opts._retry (internal): tránh refresh-retry vô hạn
   */
  async function request(path, opts = {}) {
    const {
      method = 'GET', body, query, headers, isForm,
      full = false, _retry = false, skipAuthRefresh = false,
    } = opts;

    let url = API_BASE + path;
    if (query) {
      const qs = new URLSearchParams(
        Object.entries(query).filter(([_, v]) => v !== undefined && v !== null && v !== '')
      ).toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    const reqOpts = { method, headers: Object.assign({}, headers || {}) };
    const tok = getToken();
    if (tok) reqOpts.headers['Authorization'] = 'Bearer ' + tok;

    if (body !== undefined) {
      if (isForm) {
        reqOpts.body = body; // FormData – không set Content-Type
      } else {
        reqOpts.headers['Content-Type'] = 'application/json';
        reqOpts.body = JSON.stringify(body);
      }
    }

    let res, text, json;
    try {
      res  = await fetch(url, reqOpts);
      text = await res.text();
    } catch (netErr) {
      const e = new Error('Không thể kết nối tới server');
      e.code = 'NETWORK_ERROR';
      throw e;
    }
    try { json = text ? JSON.parse(text) : {}; }
    catch (_) { json = { success: false, message: text || 'HTTP ' + res.status }; }

    if (!res.ok || json.success === false) {
      const msg = (json && json.message) || ('HTTP ' + res.status);
      const err = new Error(msg);
      err.status  = res.status;
      err.code    = (json && json.error && json.error.code) || ('HTTP_' + res.status);
      err.details = json && json.error && json.error.details;

      // Auto-refresh khi token hết hạn / không hợp lệ
      const isAuthErr = err.status === 401
        && (err.code === 'TOKEN_EXPIRED' || err.code === 'INVALID_TOKEN' || err.code === 'jwt expired');
      if (isAuthErr && !_retry && !skipAuthRefresh && getRefresh() && path !== '/auth/refresh') {
        const refreshed = await _doRefresh();
        if (refreshed) {
          // Retry lần duy nhất với token mới
          return request(path, Object.assign({}, opts, { _retry: true }));
        }
      }
      // Nếu refresh thất bại hoặc không có refresh token → logout client side
      if (err.status === 401 && (err.code === 'INVALID_TOKEN' || err.code === 'TOKEN_EXPIRED')) {
        clearToken();
      }
      throw err;
    }
    return full ? { data: json.data, meta: json.meta || null, message: json.message || '' }
                : json.data;
  }

  const Api = {
    base: API_BASE,
    request,
    getToken, setToken, clearToken, getUser, setUser,
    getRefresh, setRefresh,

    // ─── Auth ───
    login: async (username, password) => {
      const data = await request('/auth/login', { method: 'POST', body: { username, password } });
      // Lưu cả refresh token nếu server trả
      if (data && data.refresh_token) setRefresh(data.refresh_token);
      return data;
    },
    refresh: () => _doRefresh(),
    me:      () => request('/auth/me'),
    logout:  () => request('/auth/logout', { method: 'POST' }).catch(() => {}),

    // ─── Users ───
    listUsers:    (q)        => request('/users', { query: q }),
    listUsersFull:(q)        => request('/users', { query: q, full: true }),
    createUser:   (data)     => request('/users', { method: 'POST', body: data }),
    updateUser:   (id, data) => request('/users/' + id, { method: 'PUT', body: data }),
    resetPwd:     (id, password) => request('/users/' + id + '/password', { method: 'PUT', body: { password } }),
    deleteUser:   (id)       => request('/users/' + id, { method: 'DELETE' }),

    // ─── Menu ───
    listCategories:  ()      => request('/menu/categories'),
    listMenu:        (q)     => request('/menu', { query: q }),
    listMenuFull:    (q)     => request('/menu', { query: q, full: true }),
    getMenuItem:     (id)    => request('/menu/' + id),
    createMenuItem:  (formData) => request('/menu', { method: 'POST', body: formData, isForm: true }),
    updateMenuItem:  (id, formData) => request('/menu/' + id, { method: 'PUT', body: formData, isForm: true }),
    deleteMenuItem:  (id)    => request('/menu/' + id, { method: 'DELETE' }),

    // ─── Tables ───
    listTables:    (q)       => request('/tables', { query: q }),
    listTablesFull:(q)       => request('/tables', { query: q, full: true }),
    createTable:   (data)    => request('/tables', { method: 'POST', body: data }),
    updateTable:   (id, data)=> request('/tables/' + id, { method: 'PUT', body: data }),
    deleteTable:   (id)      => request('/tables/' + id, { method: 'DELETE' }),
    setTableActive:(id, isActive) => request('/tables/' + id + '/active',
      { method: 'PATCH', body: { is_active: !!isActive } }),
    clearTable:    (id, reason) => request('/tables/' + id + '/clear',
      { method: 'POST', body: reason ? { reason } : {} }),

    // ─── Orders ───
    listOrders:    (q)       => request('/orders', { query: q }),
    listOrdersFull:(q)       => request('/orders', { query: q, full: true }),
    createOrder:   (data)    => request('/orders', { method: 'POST', body: data }),
    getOrder:      (id)      => request('/orders/' + id),
    getOpenOrderForTable: (tableId) => request('/orders/by-table/' + tableId),
    addOrderItems: (id, items) => request('/orders/' + id + '/items', { method: 'POST', body: { items } }),
    updateOrderItem: (orderId, itemId, payload) =>
      request('/orders/' + orderId + '/items/' + itemId, { method: 'PUT', body: payload }),
    removeOrderItem: (orderId, itemId) =>
      request('/orders/' + orderId + '/items/' + itemId, { method: 'DELETE' }),
    updateOrderStatus: (id, status) => request('/orders/' + id + '/status', { method: 'PUT', body: { status } }),
    cancelOrder:   (id)      => request('/orders/' + id, { method: 'DELETE' }),
    moveOrder:     (id, toTableId) => request('/orders/' + id + '/move',
      { method: 'POST', body: { to_table_id: toTableId } }),
    checkout:      (id, payload) => request('/orders/' + id + '/checkout', { method: 'POST', body: payload }),

    // ─── Invoices ───
    listInvoices:    (q)     => request('/invoices', { query: q }),
    listInvoicesFull:(q)     => request('/invoices', { query: q, full: true }),
    getInvoice:      (id)    => request('/invoices/' + id),

    // ─── Files ───
    uploadFile: (file, prefix) => {
      const fd = new FormData();
      fd.append('file', file);
      if (prefix) fd.append('prefix', prefix);
      return request('/files/upload', { method: 'POST', body: fd, isForm: true });
    },

    // ─── Stats ───
    statsOverview: (q) => request('/stats/overview', { query: q }),
    statsDaily:    (q) => request('/stats/daily', { query: q }),

    // ─── Logs ───
    listLogs:     (q) => request('/logs', { query: q }),
    listLogsFull: (q) => request('/logs', { query: q, full: true }),

    // ─── Realtime (Socket.IO) ─────────────────────────────────────────────
    connectSocket() {
      if (typeof io === 'undefined') {
        console.warn('[Api] socket.io client chưa được nạp.');
        return null;
      }
      if (window._rmSocket && window._rmSocket.connected) return window._rmSocket;
      const url = (location.protocol === 'http:' || location.protocol === 'https:')
        ? undefined : 'http://localhost:3000';
      const opts = {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        auth: { token: getToken() || '' },
      };
      const sock = url ? io(url, opts) : io(opts);
      sock.on('connect',    () => console.log('[socket] connected', sock.id));
      sock.on('disconnect', (r) => console.log('[socket] disconnect', r));
      sock.on('connect_error', async (err) => {
        console.warn('[socket] error:', err.message);
        // Token có thể vừa hết hạn → thử refresh rồi reconnect
        if (String(err.message || '').toUpperCase().includes('UNAUTHORIZED') && getRefresh()) {
          const ok = await _doRefresh();
          if (ok) { sock.auth = { token: getToken() || '' }; sock.connect(); }
        }
      });
      window._rmSocket = sock;
      return sock;
    },
    getSocket()        { return window._rmSocket || null; },
    disconnectSocket() {
      if (window._rmSocket) {
        try { window._rmSocket.disconnect(); } catch (_) {}
        window._rmSocket = null;
      }
    },
  };

  window.Api = Api;
})();
