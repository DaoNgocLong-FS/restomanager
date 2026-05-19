// =============================================================================
//  Rate limiter middleware (in-memory, no Redis dependency)
//  - authLimiter:    bảo vệ /auth/login & /auth/refresh khỏi brute-force
//  - apiLimiter:     giới hạn chung cho toàn bộ API (chống abuse)
//
//  Lưu ý: in-memory chỉ hoạt động trong 1 process. Nếu chạy nhiều instance
//  (PM2 cluster, Kubernetes), thay bằng `rate-limit-redis` store.
// =============================================================================
const rateLimit = require('express-rate-limit');
const { ApiError } = require('../utils/response');

// Trả lỗi qua errorHandler để giữ format response chuẩn
function _handler(_req, _res, next) {
  next(new ApiError('Quá nhiều yêu cầu, vui lòng thử lại sau', {
    status: 429,
    code: 'RATE_LIMITED',
  }));
}

/** Rất chặt: dùng cho login / refresh (10 req / 15 phút / IP). */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 phút
  max: 10,                    // tối đa 10 lần đăng nhập sai
  standardHeaders: true,
  legacyHeaders: false,
  // Đếm theo IP + username để tránh 1 user bị khóa làm IP bị khóa hết.
  keyGenerator: (req) => {
    const u = (req.body && req.body.username) || '';
    return `${req.ip}|${u}`.toLowerCase();
  },
  // Chỉ đếm những request thất bại (tránh khóa user vì gõ đúng nhiều lần)
  skipSuccessfulRequests: true,
  handler: _handler,
});

/** Lỏng hơn: dùng cho phần còn lại của API (200 req/phút/IP). */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: _handler,
});

module.exports = { authLimiter, apiLimiter };
