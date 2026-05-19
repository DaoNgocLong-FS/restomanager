const { uploadBuffer } = require('../storage/minio');
const { created, asyncHandler, ApiError } = require('../utils/response');

/**
 * POST /api/files/upload  (multipart/form-data, field: "file")
 * Upload tệp bất kỳ lên MinIO. Body có thể kèm "prefix".
 * Trả: { key, url }
 */
exports.upload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.validation('Dữ liệu không hợp lệ', ['file: bắt buộc (multipart field "file")']);
  const prefix = (req.body && req.body.prefix) || 'misc';
  const result = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype, prefix);
  return created(res, result, 'Upload thành công');
});
