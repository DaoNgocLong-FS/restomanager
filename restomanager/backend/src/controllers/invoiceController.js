const InvoiceModel = require('../models/Invoice');
const { ok, paged, paginateArray, asyncHandler, ApiError } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { table_code, cashier_name, from, to, page, limit } = req.query;
  const all = await InvoiceModel.findAll({ table_code, cashier_name, from, to });
  const r = paginateArray(all, { page, limit });
  return paged(res, { ...r, message: `Danh sách hoá đơn (${r.total})` });
});

exports.getById = asyncHandler(async (req, res) => {
  const inv = await InvoiceModel.findById(req.params.id);
  if (!inv) throw ApiError.notFound('Hoá đơn không tồn tại');
  return ok(res, inv);
});
