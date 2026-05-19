const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./src/openapi.json');
const { ok } = require('./src/utils/response');
const { notFoundHandler, globalErrorHandler } = require('./src/middleware/errorHandler');
const { authLimiter, apiLimiter } = require('./src/middleware/rateLimiter');

const authRoutes      = require('./src/routes/authRoutes');
const userRoutes      = require('./src/routes/userRoutes');
const menuRoutes      = require('./src/routes/menuRoutes');
const tableRoutes     = require('./src/routes/tableRoutes');
const orderRoutes     = require('./src/routes/orderRoutes');
const invoiceRoutes   = require('./src/routes/invoiceRoutes');
const fileRoutes      = require('./src/routes/fileRoutes');
const statRoutes      = require('./src/routes/statRoutes');
const logRoutes       = require('./src/routes/logRoutes');

const app = express();

// ─── CORS allowlist (đọc từ ENV) ─────────────────────────────────────────────
// ALLOWED_ORIGINS="https://pos.example.com,https://admin.example.com"
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

if (ALLOWED_ORIGINS.length === 0 && process.env.NODE_ENV === 'production') {
  throw new Error('[FATAL] ALLOWED_ORIGINS must be set in production. Example: ALLOWED_ORIGINS=https://app.example.com');
}
if (ALLOWED_ORIGINS.length === 0) {
  console.warn('[WARN] ALLOWED_ORIGINS not set — CORS is open. Dev only!');
}

const corsOptions = {
  origin(origin, cb) {
    // Cho phép request không có origin (server-to-server, curl, mobile native)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.length === 0) return cb(null, true); // dev fallback
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('CORS: origin not allowed: ' + origin));
  },
  credentials: true,
};

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Request log đơn giản (không log body để tránh lộ password)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ─── HEALTH ──────────────────────────────────────────────────────────────────
app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));
app.use('/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'RestoManager API',
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
  })
);

app.get('/api/health', (_req, res) =>
  ok(res, {
    status:    'ok',
    service:   'RestoManager API',
    version:   '2.0.1',
    timestamp: new Date().toISOString(),
  })
);

// ─── ROUTES ──────────────────────────────────────────────────────────────────
// Rate limit chặt cho auth (login / refresh) — apply TRƯỚC route handler
app.use('/api/auth/login',   authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth',         authRoutes);

// Rate limit lỏng cho phần còn lại của API
app.use('/api', apiLimiter);
app.use('/api/users',    userRoutes);
app.use('/api/menu',     menuRoutes);
app.use('/api/tables',   tableRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/files',    fileRoutes);
app.use('/api/stats',    statRoutes);
app.use('/api/logs',     logRoutes);

// ─── ERROR ───────────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
