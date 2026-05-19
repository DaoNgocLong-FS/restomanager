const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/statController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Số liệu doanh thu — chỉ cashier + admin
router.use(requireAuth, requireRole('cashier', 'admin'));

router.get('/overview', ctrl.overview);
router.get('/daily',    ctrl.daily);

module.exports = router;
