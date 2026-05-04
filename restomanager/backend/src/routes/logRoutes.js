const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/logController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('admin'));
router.get('/', ctrl.list);

module.exports = router;
