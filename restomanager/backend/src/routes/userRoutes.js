const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

router.use(requireAuth, requireRole('admin'));

router.get   ('/',              ctrl.list);
router.post  ('/',
  validateBody({
    username:  { required: true, type: 'string', minLength: 1 },
    password:  { required: true, type: 'string', minLength: 1 },
    full_name: { required: true, type: 'string', minLength: 1 },
    role:      { required: true, enum: ['admin', 'cashier', 'waiter'] },
  }),
  ctrl.create
);
router.put   ('/:id',           ctrl.update);
router.put   ('/:id/password',
  validateBody({ password: { required: true, type: 'string', minLength: 1 } }),
  ctrl.resetPassword
);
router.delete('/:id',           ctrl.remove);

module.exports = router;
