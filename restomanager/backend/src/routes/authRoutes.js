const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

router.post('/login',
  validateBody({
    username: { required: true, type: 'string', minLength: 1 },
    password: { required: true, type: 'string', minLength: 1 },
  }),
  ctrl.login
);
router.post('/refresh',
  validateBody({
    refresh_token: { required: true, type: 'string', minLength: 1 },
  }),
  ctrl.refresh
);
router.post('/logout', requireAuth, ctrl.logout);
router.get ('/me',     requireAuth, ctrl.me);

module.exports = router;
