// =============================================================================
//  Realtime layer (Socket.IO) — hardened
//  - Bắt buộc xác thực JWT để kết nối (không cho phép guest)
//  - Chia rooms: 'authenticated', 'role:<role>'
//  - Mọi event nhạy cảm (orders/invoices) chỉ broadcast vào 'authenticated'
//  - CORS được cấu hình bởi biến môi trường ALLOWED_ORIGINS
//
//  Quy ước event (server → client):
//    'tables:changed'      → trạng thái bàn có thay đổi
//    'orders:changed'      → danh sách đơn cần được tải lại
//    'order:created'       → có đơn mới
//    'order:updated'       → đơn được sửa (thêm món / sửa món / đổi status)
//    'order:cancelled'     → đơn bị huỷ
//    'invoice:created'     → có hoá đơn mới (checkout xong)
// =============================================================================
const { Server } = require('socket.io');
const { verifyToken } = require('../middleware/auth');

// Reuse the same allowlist as Express CORS (xem app.js).
function _parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function _corsOrigin(origin, callback) {
  const list = _parseAllowedOrigins();
  // Dev: nếu chưa cấu hình → cho phép tất cả (kèm cảnh báo trong log)
  if (list.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      return callback(new Error('ALLOWED_ORIGINS not configured'));
    }
    return callback(null, true);
  }
  // Cho phép request không có origin (server-to-server, curl)
  if (!origin) return callback(null, true);
  if (list.includes(origin)) return callback(null, true);
  return callback(new Error('CORS: Origin not allowed: ' + origin));
}

let _io = null;

function init(httpServer) {
  if (_io) return _io;
  _io = new Server(httpServer, {
    cors: { origin: _corsOrigin, credentials: true },
    transports: ['websocket', 'polling'],
    path: '/socket.io',
  });

  // ── Middleware xác thực: BẮT BUỘC token hợp lệ ───────────────────────────
  _io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth && socket.handshake.auth.token) ||
        (socket.handshake.query && socket.handshake.query.token) ||
        null;
      if (!token) {
        // Trước đây cho phép guest → reject ngay để không leak realtime data
        return next(new Error('UNAUTHORIZED: token required'));
      }
      socket.user = verifyToken(token);
      if (!socket.user || !socket.user.role || socket.user.role === 'guest') {
        return next(new Error('UNAUTHORIZED: invalid role'));
      }
      return next();
    } catch (err) {
      return next(new Error('UNAUTHORIZED: ' + (err.message || 'invalid token')));
    }
  });

  _io.on('connection', (socket) => {
    const u = socket.user || {};
    socket.join('authenticated');
    if (u.role) socket.join('role:' + u.role);

    socket.emit('hello', {
      ok: true,
      user: { id: u.id, role: u.role },
      at: new Date().toISOString(),
    });

    socket.on('ping:rt', () => socket.emit('pong:rt', { at: Date.now() }));

    if (process.env.NODE_ENV !== 'production') {
      console.log('[socket] connected id=' + socket.id + ' role=' + (u.role || 'unknown'));
      socket.on('disconnect', (reason) => {
        console.log('[socket] disconnect id=' + socket.id + ' reason=' + reason);
      });
    }
  });

  return _io;
}

function getIO() { return _io; }

/**
 * Emit chỉ tới các client đã xác thực.
 * Đây là default để tránh việc 1 socket guest (do bug hoặc cấu hình sai)
 * có thể nhận event nhạy cảm.
 */
function emit(event, payload) {
  if (!_io) return;
  const body = Object.assign({}, payload || {}, { at: new Date().toISOString() });
  _io.to('authenticated').emit(event, body);
}

function emitToRole(role, event, payload) {
  if (!_io) return;
  const body = Object.assign({}, payload || {}, { at: new Date().toISOString() });
  _io.to('role:' + role).emit(event, body);
}

function broadcastTablesChanged(meta) { emit('tables:changed', meta || {}); }
function broadcastOrdersChanged(meta) { emit('orders:changed', meta || {}); }

module.exports = {
  init, getIO, emit, emitToRole,
  broadcastTablesChanged, broadcastOrdersChanged,
};
