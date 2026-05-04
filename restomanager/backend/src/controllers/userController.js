const UserModel = require('../models/User');
const LogModel  = require('../models/Log');
const { ok, created, paged, paginateArray, asyncHandler, ApiError } = require('../utils/response');

const ROLES = ['admin', 'cashier', 'waiter'];

exports.list = asyncHandler(async (req, res) => {
  const all = await UserModel.findAll();
  const { items, total, page, limit } = paginateArray(all, req.query);
  return paged(res, { items, total, page, limit, message: `Danh sách nhân viên (${total})` });
});

exports.create = asyncHandler(async (req, res) => {
  const { username, password, full_name, role, email, phone } = req.body || {};
  const errs = [];
  if (!username)  errs.push('username: bắt buộc');
  if (!password)  errs.push('password: bắt buộc');
  if (!full_name) errs.push('full_name: bắt buộc');
  if (!role || !ROLES.includes(role)) errs.push(`role: phải thuộc {${ROLES.join('|')}}`);
  if (errs.length) throw ApiError.validation('Dữ liệu không hợp lệ', errs);

  const existing = await UserModel.findByUsername(String(username).trim());
  if (existing) throw ApiError.conflict('Tên đăng nhập đã tồn tại');

  const user = await UserModel.create({
    username: String(username).trim(), password, full_name, role, email, phone,
  });
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'CREATE_USER', entity: 'USER', entity_id: user.id,
    details: { username: user.username, role: user.role },
  }).catch(() => {});
  return created(res, user, 'Tạo nhân viên thành công');
});

exports.update = asyncHandler(async (req, res) => {
  if (req.body && req.body.role && !ROLES.includes(req.body.role))
    throw ApiError.validation('Dữ liệu không hợp lệ', [`role: phải thuộc {${ROLES.join('|')}}`]);
  const u = await UserModel.update(req.params.id, req.body || {});
  if (!u) throw ApiError.notFound('Nhân viên không tồn tại');
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'UPDATE_USER', entity: 'USER', entity_id: u.id, details: req.body,
  }).catch(() => {});
  return ok(res, u, { message: 'Cập nhật thành công' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body || {};
  if (!password || String(password).length < 1)
    throw ApiError.validation('Dữ liệu không hợp lệ', ['password: bắt buộc']);
  const u = await UserModel.resetPassword(req.params.id, password);
  if (!u) throw ApiError.notFound('Nhân viên không tồn tại');
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'RESET_PASSWORD', entity: 'USER', entity_id: u.id,
  }).catch(() => {});
  return ok(res, u, { message: 'Đã đặt lại mật khẩu' });
});

exports.remove = asyncHandler(async (req, res) => {
  if (req.user && String(req.user.id) === String(req.params.id))
    throw ApiError.conflict('Không thể tự xoá chính mình');
  const r = await UserModel.remove(req.params.id);
  if (!r) throw ApiError.notFound('Nhân viên không tồn tại');
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'DELETE_USER', entity: 'USER', entity_id: req.params.id,
  }).catch(() => {});
  return ok(res, r, { message: 'Đã xoá nhân viên' });
});
