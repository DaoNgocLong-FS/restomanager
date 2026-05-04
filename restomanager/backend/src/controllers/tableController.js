const TableModel    = require('../models/Table');
const OrderModel    = require('../models/Order');
const LogModel      = require('../models/Log');
const realtime      = require('../realtime/io');
const { ok, created, paged, paginateArray, asyncHandler, ApiError } = require('../utils/response');

const ZONES = ['indoor', 'outdoor', 'vip'];

exports.list = asyncHandler(async (req, res) => {
  const { zone, with_status, page, limit } = req.query;
  let tables;
  if (with_status === 'true') {
    tables = await TableModel.findAllWithStatus(zone);
    tables = tables.map(t => {
      let status = 'empty';
      if (t.is_active === false) status = 'inactive';
      else if (t.order_status === 'pending') status = 'busy';
      else if (t.order_status === 'serving') status = 'pay';
      else if (t.order_status === 'completed' || t.order_status === 'cancelled') status = 'empty';
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

/**
 * PATCH /api/tables/:id/active
 * Body: { is_active: boolean }
 * Bật/tắt bàn. Khi tắt, bàn không được có order đang mở.
 */
exports.setActive = asyncHandler(async (req, res) => {
  const { is_active } = req.body || {};
  if (typeof is_active !== 'boolean')
    throw ApiError.validation('Dữ liệu không hợp lệ', ['is_active: phải là true hoặc false']);

  const { table, openOrder } = await TableModel.setActive(req.params.id, is_active);
  if (!table) throw ApiError.notFound('Bàn không tồn tại');
  if (openOrder) {
    throw ApiError.conflict(
      `Bàn ${table.code} đang có order mở (${openOrder.code}), không thể tắt. ` +
      `Vui lòng thanh toán hoặc dọn bàn trước.`
    );
  }

  LogModel.write({
    user_id: req.user && req.user.id, user_name: req.user && req.user.full_name,
    action: is_active ? 'ENABLE_TABLE' : 'DISABLE_TABLE',
    entity: 'TABLE', entity_id: table.id,
    details: { code: table.code },
  }).catch(() => {});

  realtime.emit('table:updated', { table });
  realtime.broadcastTablesChanged({
    reason: is_active ? 'enabled' : 'disabled',
    table_code: table.code,
  });

  return ok(res, table, {
    message: is_active ? `Đã kích hoạt bàn ${table.code}` : `Đã tắt bàn ${table.code}`,
  });
});

/**
 * POST /api/tables/:id/clear
 * Body: { reason?: string }
 * "Dọn bàn": huỷ order đang mở trên bàn (KHÔNG tạo invoice).
 * Dùng khi khách bỏ về, hoặc cần reset trạng thái bàn nhanh.
 * Nếu bàn không có order mở → no-op, trả về trạng thái hiện tại.
 */
exports.clearTable = asyncHandler(async (req, res) => {
  const table = await TableModel.findById(req.params.id);
  if (!table) throw ApiError.notFound('Bàn không tồn tại');

  const openOrder = await TableModel.findOpenOrder(table.id);
  if (!openOrder) {
    return ok(res, { table, cancelled_order: null }, {
      message: `Bàn ${table.code} đã trống, không có gì để dọn`,
    });
  }

  const reason = (req.body && req.body.reason)
    ? String(req.body.reason).trim()
    : 'CLEAR_TABLE';

  const cancelled = await OrderModel.cancel(openOrder.id, reason);

  LogModel.write({
    user_id: req.user && req.user.id, user_name: req.user && req.user.full_name,
    action: 'CLEAR_TABLE', entity: 'TABLE', entity_id: table.id,
    details: {
      table_code: table.code,
      cancelled_order_id: cancelled.id,
      cancelled_order_code: cancelled.code,
      reason,
    },
  }).catch(() => {});

  realtime.emit('order:cancelled', {
    order: {
      id: cancelled.id, code: cancelled.code,
      table_code: cancelled.table_code, status: cancelled.status,
    },
    reason: 'CLEAR_TABLE',
  });
  realtime.broadcastOrdersChanged({ reason: 'clear_table', order_id: cancelled.id });
  realtime.broadcastTablesChanged({ reason: 'cleared', table_code: table.code });

  return ok(res, { table, cancelled_order: cancelled }, {
    message: `Đã dọn bàn ${table.code} (huỷ order ${cancelled.code})`,
  });
});
