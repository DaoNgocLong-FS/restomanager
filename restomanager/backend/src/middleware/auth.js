const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils/response');

// ─────────────────────────────────────────────────────────────────────────────
//  SECURITY: Strict secret validation at boot.
//  In production, refuse to start with weak/default/missing secrets.
// ─────────────────────────────────────────────────────────────────────────────
const WEAK_SECRETS = new Set([
  'restomanager-dev-secret-change-me',
  'please-change-me-in-prod',
  'please-change-me-too-in-prod',
  'change-me-too-32+chars-please',
  'secret', 'changeme', 'jwt-secret', 'dev-secret',
]);

function _validateSecret(name, value) {
  const isProd = process.env.NODE_ENV === 'production';
  if (!value) {
    if (isProd) throw new Error(`[FATAL] ${name} is not set. Refusing to start in production.`);
    console.warn(`[WARN] ${name} not set - using insecure default (dev only)`);
    return false;
  }
  if (value.length < 32) {
    if (isProd) throw new Error(`[FATAL] ${name} must be at least 32 chars in production. Got ${value.length}.`);
    console.warn(`[WARN] ${name} is only ${value.length} chars - use 32+ in production`);
  }
  if (WEAK_SECRETS.has(value)) {
    if (isProd) throw new Error(`[FATAL] ${name} is a known weak/default value. Refusing to start in production.`);
    console.warn(`[WARN] ${name} is a known weak value - change before deploying!`);
  }
  return true;
}

const JWT_SECRET      = process.env.JWT_SECRET      || 'restomanager-dev-secret-change-me';
const JWT_EXPIRES     = process.env.JWT_EXPIRES     || '15m';
const REFRESH_SECRET  = process.env.REFRESH_SECRET  || (JWT_SECRET + '-refresh-do-not-use-in-prod');
const REFRESH_EXPIRES = process.env.REFRESH_EXPIRES || '30d';

_validateSecret('JWT_SECRET', process.env.JWT_SECRET);
_validateSecret('REFRESH_SECRET', process.env.REFRESH_SECRET);
if (process.env.JWT_SECRET && process.env.REFRESH_SECRET &&
    process.env.JWT_SECRET === process.env.REFRESH_SECRET) {
  const msg = '[FATAL] JWT_SECRET and REFRESH_SECRET must differ.';
  if (process.env.NODE_ENV === 'production') throw new Error(msg);
  console.warn(msg.replace('[FATAL]', '[WARN]'));
}

function _expSeconds(ttl) {
  if (typeof ttl === 'number') return ttl;
  const m = String(ttl).match(/^(\d+)\s*([smhd])?$/i);
  if (!m) return 900;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || 's').toLowerCase();
  return unit === 's' ? n
       : unit === 'm' ? n * 60
       : unit === 'h' ? n * 3600
       : unit === 'd' ? n * 86400 : n;
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
function signRefreshToken(payload) {
  return jwt.sign(Object.assign({}, payload, { typ: 'refresh' }), REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}
function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, REFRESH_SECRET);
  if (decoded.typ !== 'refresh') {
    const err = new Error('NOT_A_REFRESH_TOKEN');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return decoded;
}
function tokenExpiresIn() { return _expSeconds(JWT_EXPIRES); }
function refreshExpiresIn() { return _expSeconds(REFRESH_EXPIRES); }

function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized('Thiếu token xác thực'));
  try {
    req.user = verifyToken(token);
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized('Chưa xác thực'));
    if (!roles.includes(req.user.role))
      return next(ApiError.forbidden('Yêu cầu vai trò: ' + roles.join(', ')));
    next();
  };
}

module.exports = {
  signToken, verifyToken,
  signRefreshToken, verifyRefreshToken,
  tokenExpiresIn, refreshExpiresIn,
  requireAuth, requireRole,
  JWT_SECRET, REFRESH_SECRET,
};
