// =============================================================================
//  Response helpers + ApiError + asyncHandler
//  Envelope chuẩn:
//    { success: true,  data, message?, meta? }
//    { success: false, message, error: { code, details? } }
// =============================================================================

class ApiError extends Error {
  constructor(message, { status = 400, code = 'BAD_REQUEST', details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
  static badRequest(msg = 'Yêu cầu không hợp lệ', details)   { return new ApiError(msg, { status: 400, code: 'BAD_REQUEST', details }); }
  static unauthorized(msg = 'Chưa xác thực')                 { return new ApiError(msg, { status: 401, code: 'UNAUTHORIZED' }); }
  static forbidden(msg = 'Không có quyền truy cập')          { return new ApiError(msg, { status: 403, code: 'FORBIDDEN' }); }
  static notFound(msg = 'Không tìm thấy tài nguyên')         { return new ApiError(msg, { status: 404, code: 'NOT_FOUND' }); }
  static conflict(msg = 'Xung đột dữ liệu', details)         { return new ApiError(msg, { status: 409, code: 'CONFLICT', details }); }
  static validation(msg = 'Dữ liệu không hợp lệ', details)   { return new ApiError(msg, { status: 422, code: 'VALIDATION_ERROR', details }); }
  static internal(msg = 'Lỗi server nội bộ')                 { return new ApiError(msg, { status: 500, code: 'INTERNAL_ERROR' }); }
}

/** Trả phản hồi thành công (data có thể là null/array/object). */
function ok(res, data = null, { status = 200, message = '', meta } = {}) {
  const body = { success: true, data: data === undefined ? null : data, message: message || '' };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

/** 201 Created */
const created = (res, data, message = 'Tạo thành công') =>
  ok(res, data, { status: 201, message });

/** 204 No Content */
const noContent = (res) => res.status(204).end();

/** Trả về list có phân trang chuẩn. */
function paged(res, { items, total, page, limit, message = '' }) {
  const t  = Number(total) || 0;
  const p  = Math.max(1, parseInt(page) || 1);
  const l  = Math.max(1, parseInt(limit) || 50);
  return ok(res, items, {
    message,
    meta: { total: t, page: p, limit: l, pages: Math.max(1, Math.ceil(t / l)) },
  });
}

/** Wrap async handler → forward lỗi tới global error handler. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Phân trang trên 1 mảng đã có sẵn (cho dataset nhỏ). */
function paginateArray(arr, { page = 1, limit = 50, max = 200 } = {}) {
  const all = Array.isArray(arr) ? arr : [];
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.max(1, Math.min(max, parseInt(limit) || 50));
  const start = (p - 1) * l;
  return { items: all.slice(start, start + l), total: all.length, page: p, limit: l };
}

// ─── Backward-compat shims (giữ cho mã cũ vẫn chạy) ──────────────────────────
function successResponse(res, data, message = '', statusCode = 200) {
  return ok(res, data === undefined ? null : data, { status: statusCode, message });
}
function errorResponse(res, message, statusCode = 400, errors) {
  const codeMap = { 400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN',
                    404: 'NOT_FOUND',   409: 'CONFLICT',     422: 'VALIDATION_ERROR',
                    500: 'INTERNAL_ERROR' };
  return res.status(statusCode).json({
    success: false,
    message: message || 'Lỗi không xác định',
    error: { code: codeMap[statusCode] || 'BAD_REQUEST', details: errors && errors.length ? errors : undefined },
  });
}

module.exports = {
  ApiError,
  ok, created, noContent, paged,
  asyncHandler, paginateArray,
  successResponse, errorResponse,
};
