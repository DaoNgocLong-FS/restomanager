const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/invoiceController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Hoá đơn: chỉ thu ngân + admin xem được
router.use(requireAuth, requireRole('cashier', 'admin'));

router.get('/',    ctrl.list);
router.get('/:id', ctrl.getById);

module.exports = router;
