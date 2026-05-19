const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/tableController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

// Đọc: yêu cầu auth (đảm bảo không lộ trạng thái bàn cho người ngoài)
router.get('/', requireAuth, ctrl.list);

// Quản trị: chỉ admin
router.post  ('/',
  requireAuth, requireRole('admin'),
  validateBody({
    code:     { required: true, type: 'string', minLength: 1 },
    zone:     { required: true, enum: ['indoor', 'outdoor', 'vip'] },
    capacity: { required: true, type: 'integer', min: 1 },
  }),
  ctrl.create
);
router.put   ('/:id', requireAuth, requireRole('admin'), ctrl.update);
router.delete('/:id', requireAuth, requireRole('admin'), ctrl.remove);

// Bật/tắt bàn + dọn bàn: admin + cashier
router.patch ('/:id/active', requireAuth, requireRole('admin', 'cashier'), ctrl.setActive);
router.post  ('/:id/clear',  requireAuth, requireRole('admin', 'cashier'), ctrl.clearTable);

module.exports = router;
