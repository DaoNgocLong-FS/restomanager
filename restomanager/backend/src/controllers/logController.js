const LogModel = require('../models/Log');
const { paged, paginateArray, asyncHandler } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { from, to, action, user_name, page, limit } = req.query;
  const max = Math.min(parseInt(limit) || 50, 500);
  // Lấy tối đa 1000 dòng từ DB rồi paginate trong app (đơn giản, đủ dùng).
  const rows = await LogModel.list({ from, to, action, user_name, limit: 1000 });
  const r = paginateArray(rows, { page, limit: max });
  return paged(res, r);
});
