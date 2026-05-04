// =============================================================================
//  Global error handler – format chuẩn { success:false, message, error:{code,details} }
// =============================================================================
const { ApiError } = require('../utils/response');

function fail(res, status, message, code, details) {
  const body = { success: false, message: message || 'Lỗi không xác định', error: { code } };
  if (details !== undefined) body.error.details = details;
  return res.status(status).json(body);
}

exports.notFoundHandler = (req, res) =>
  fail(res, 404, `Route không tồn tại: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND');

exports.globalErrorHandler = (err, req, res, _next) => {
  // 1) ApiError tự bọc
  if (err instanceof ApiError) {
    return fail(res, err.status, err.message, err.code, err.details);
  }

  // 2) JWT errors
  if (err && err.name === 'JsonWebTokenError')   return fail(res, 401, 'Token không hợp lệ', 'INVALID_TOKEN');
  if (err && err.name === 'TokenExpiredError')   return fail(res, 401, 'Token đã hết hạn', 'TOKEN_EXPIRED');

  // 3) Multer (upload) errors
  if (err && err.name === 'MulterError') {
    const map = {
      LIMIT_FILE_SIZE:        ['File quá lớn',                'FILE_TOO_LARGE',     413],
      LIMIT_UNEXPECTED_FILE:  ['Field upload không hợp lệ',   'UNEXPECTED_FIELD',   400],
    };
    const [msg, code, status] = map[err.code] || ['Lỗi upload', 'UPLOAD_ERROR', 400];
    return fail(res, status, msg, code, err.field);
  }

  // 4) JSON body parse error
  if (err && err.type === 'entity.parse.failed') {
    return fail(res, 400, 'JSON body không hợp lệ', 'BAD_JSON');
  }

  // 5) PostgreSQL errors (mã SQLSTATE)
  if (err && err.code && /^[0-9A-Z]{5}$/.test(err.code)) {
    const pg = {
      '23505': [409, 'Bản ghi đã tồn tại',    'DUPLICATE'],
      '23503': [409, 'Vi phạm khoá ngoại',    'FK_VIOLATION'],
      '23502': [400, 'Thiếu trường bắt buộc', 'NOT_NULL_VIOLATION'],
      '22P02': [400, 'Tham số không hợp lệ',  'BAD_PARAM'],
      '42P01': [500, 'Bảng không tồn tại',    'UNDEFINED_TABLE'],
    };
    const m = pg[err.code];
    if (m) return fail(res, m[0], m[1], m[2], err.detail);
  }

  // 6) Default → 500
  console.error('[UNHANDLED]', err);
  return fail(
    res,
    500,
    process.env.NODE_ENV === 'production' ? 'Lỗi server nội bộ' : (err && err.message) || 'Lỗi server',
    'INTERNAL_ERROR'
  );
};
