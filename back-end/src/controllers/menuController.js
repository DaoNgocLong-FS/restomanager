const MenuItemModel = require('../models/MenuItem');
const LogModel = require('../models/Log');
const { uploadBuffer, deleteObject } = require('../storage/minio');
const realtime = require('../realtime/io');
const { ok, created, paged, paginateArray, asyncHandler, ApiError } = require('../utils/response');

exports.listCategories = asyncHandler(async (_req, res) => {
  const cats = await MenuItemModel.listCategories();
  return ok(res, cats);
});

exports.listItems = asyncHandler(async (req, res) => {
  const { active, category, page, limit } = req.query;
  const filters = {};
  if (active === 'true')  filters.is_active = true;
  if (active === 'false') filters.is_active = false;
  if (category && category !== 'all') filters.category_code = category;
  const all = await MenuItemModel.findAll(filters);
  const r = paginateArray(all, { page, limit });
  return paged(res, { ...r, message: `Lấy thực đơn thành công (${r.total} món)` });
});

exports.getItem = asyncHandler(async (req, res) => {
  const item = await MenuItemModel.findById(req.params.id);
  if (!item) throw ApiError.notFound('Món ăn không tồn tại');
  return ok(res, item);
});

exports.createItem = asyncHandler(async (req, res) => {
  const { name, description, price, category_id, emoji } = req.body || {};
  const errs = [];
  if (!name)            errs.push('name: bắt buộc');
  if (price === undefined || price === '' || isNaN(Number(price)))
                        errs.push('price: phải là số');
  if (errs.length) throw ApiError.validation('Dữ liệu không hợp lệ', errs);

  let image_url = null, image_key = null;
  if (req.file) {
    const up = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype, 'menu');
    image_url = up.url; image_key = up.key;
  }
  const item = await MenuItemModel.create({
    name, description, price: Number(price),
    category_id: category_id || null, emoji, image_url, image_key,
  });
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'CREATE_MENU', entity: 'MENU_ITEM', entity_id: item.id, details: { name },
  }).catch(() => {});
  realtime.emit('menu:changed', { action: 'create', id: item.id });
  return created(res, item, 'Thêm món thành công');
});

exports.updateItem = asyncHandler(async (req, res) => {
  const old = await MenuItemModel.findById(req.params.id);
  if (!old) throw ApiError.notFound('Món ăn không tồn tại');

  const body = { ...req.body };
  if (body.price !== undefined)     body.price = Number(body.price);
  if (body.is_active !== undefined) body.is_active = body.is_active === 'true' || body.is_active === true;

  let image_url = body.image_url ?? null, image_key = body.image_key ?? null;
  if (req.file) {
    const up = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype, 'menu');
    image_url = up.url; image_key = up.key;
    if (old.image_key) deleteObject(old.image_key).catch(() => {});
  }
  const updated = await MenuItemModel.update(req.params.id, {
    ...body,
    image_url: image_url ?? null,
    image_key: image_key ?? null,
  });
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'UPDATE_MENU', entity: 'MENU_ITEM', entity_id: updated.id, details: body,
  }).catch(() => {});
  realtime.emit('menu:changed', { action: 'update', id: updated.id });
  return ok(res, updated, { message: 'Cập nhật thành công' });
});

exports.deleteItem = asyncHandler(async (req, res) => {
  const r = await MenuItemModel.remove(req.params.id);
  if (!r) throw ApiError.notFound('Món ăn không tồn tại');
  if (r.image_key) deleteObject(r.image_key).catch(() => {});
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'DELETE_MENU', entity: 'MENU_ITEM', entity_id: req.params.id,
  }).catch(() => {});
  realtime.emit('menu:changed', { action: 'delete', id: req.params.id });
  return ok(res, r, { message: 'Đã xoá món' });
});
