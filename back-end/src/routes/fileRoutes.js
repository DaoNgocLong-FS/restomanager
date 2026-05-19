const express = require('express');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/fileController');
const { requireAuth } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
});

router.post('/upload', requireAuth, upload.single('file'), ctrl.upload);

module.exports = router;
