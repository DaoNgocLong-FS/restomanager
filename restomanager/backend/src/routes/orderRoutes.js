const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/orderController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

// ─── Read ───
router.get('/',                     ctrl.getOrders);
router.get('/by-table/:tableId',    ctrl.getOpenOrderForTable);
router.get('/:id',                  ctrl.getOrderById);

// ─── Write order ───
router.post  ('/',                requireRole('waiter', 'admin'),            ctrl.createOrder);
router.put   ('/:id/status',      requireRole('waiter', 'cashier', 'admin'), ctrl.updateOrderStatus);
router.delete('/:id',             requireRole('waiter', 'cashier', 'admin'), ctrl.cancelOrder);
router.post  ('/:id/checkout',    requireRole('cashier', 'admin'),           ctrl.checkout);

// ─── Write order items (cashier cũng được sửa) ───
router.post  ('/:id/items',                requireRole('waiter', 'cashier', 'admin'), ctrl.addItems);
router.put   ('/:id/items/:itemId',        requireRole('waiter', 'cashier', 'admin'), ctrl.updateItem);
router.delete('/:id/items/:itemId',        requireRole('waiter', 'cashier', 'admin'), ctrl.removeItem);

module.exports = router;
