const TableModel = require('../models/Table');
const LogModel = require('../models/Log');
const realtime = require('../realtime/io');
const { ok, created, paged, paginateArray, asyncHandler, ApiError } = require('../utils/response');

const ZONES = ['indoor', 'outdoor', 'vip'];

exports.list = asyncHandler(async (req, res) => {
  const { zone, with_status, page, limit } = req.query;
  let tables;
  if (with_status === 'true') {
    tables = await TableModel.findAllWithStatus(zone);
    tables = tables.map(t => {
      let status = 'empty';
      if (t.order_status === 'pending') status = 'busy';
      if (t.order_status === 'serving') status = 'pay';
      if (t.order_status === 'completed' || t.order_status === 'cancelled') status = 'empty';
      const mins = t.check_in_time
        ? Math.max(0, Math.round((Date.now() - new Date(t.check_in_time).getTime()) / 60000))
        : 0;
      return Object.assign({}, t, { status, mins });
    });
  } else {
    tables = await TableModel.findAll();
  }
  const r = paginateArray(tables, { page, limit });
  return paged(res, r);
});

exports.create = asyncHandler(async (req, res) => {
  const { code, zone, capacity } = req.body || {};
  const errs = [];
  if (!code) errs.push('code: bắt buộc');
  if (!zone || !ZONES.includes(zone)) errs.push('zone: phải thuộc {' + ZONES.join('|') + '}');
  if (!capacity || isNaN(Number(capacity)) || Number(capacity) < 1)
    errs.push('capacity: phải là số nguyên dương');
  if (errs.length) throw ApiError.validation('Dữ liệu không hợp lệ', errs);

  const t = await TableModel.create({
    code: String(code).trim().toUpperCase(),
    zone, capacity: parseInt(capacity),
  });
  LogModel.write({
    user_id: req.user && req.user.id, user_name: req.user && req.user.full_name,
    action: 'CREATE_TABLE', entity: 'TABLE', entity_id: t.id, details: { code, zone },
  }).catch(() => {});
  realtime.emit('table:created', { table: t });
  realtime.broadcastTablesChanged({ reason: 'created', table_code: t.code });
  return created(res, t, 'Tạo bàn thành công');
});

exports.update = asyncHandler(async (req, res) => {
  if (req.body && req.body.zone && !ZONES.includes(req.body.zone))
    throw ApiError.validation('Dữ liệu không hợp lệ', ['zone: phải thuộc {' + ZONES.join('|') + '}']);
  const t = await TableModel.update(req.params.id, req.body || {});
  if (!t) throw ApiError.notFound('Bàn không tồn tại');
  LogModel.write({
    user_id: req.user && req.user.id, user_name: req.user && req.user.full_name,
    action: 'UPDATE_TABLE', entity: 'TABLE', entity_id: t.id, details: req.body,
  }).catch(() => {});
  realtime.emit('table:updated', { table: t });
  realtime.broadcastTablesChanged({ reason: 'updated', table_code: t.code });
  return ok(res, t, { message: 'Cập nhật bàn thành công' });
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await TableModel.remove(req.params.id);
  if (!r) throw ApiError.notFound('Bàn không tồn tại');
  LogModel.write({
    user_id: req.user && req.user.id, user_name: req.user && req.user.full_name,
    action: 'DELETE_TABLE', entity: 'TABLE', entity_id: req.params.id,
  }).catch(() => {});
  realtime.emit('table:deleted', { id: req.params.id });
  realtime.broadcastTablesChanged({ reason: 'deleted', id: req.params.id });
  return ok(res, r, { message: 'Đã xoá bàn' });
});
