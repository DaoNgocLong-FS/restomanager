const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const ctrl    = require('../controllers/menuController');
const { requireAuth, requireRole } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// PUBLIC reads — anyone (incl. waiter, cashier) can list menu
router.get('/categories', ctrl.listCategories);
router.get('/',           ctrl.listItems);
router.get('/:id',        ctrl.getItem);

// ADMIN writes
router.post('/',          requireAuth, requireRole('admin'), upload.single('image'), ctrl.createItem);
router.put('/:id',        requireAuth, requireRole('admin'), upload.single('image'), ctrl.updateItem);
router.delete('/:id',     requireAuth, requireRole('admin'), ctrl.deleteItem);

module.exports = router;
