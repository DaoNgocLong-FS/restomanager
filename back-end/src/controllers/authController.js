const UserModel         = require('../models/User');
const LogModel          = require('../models/Log');
const RefreshTokenModel = require('../models/RefreshToken');
const {
  signToken, signRefreshToken, verifyRefreshToken,
  tokenExpiresIn, refreshExpiresIn,
} = require('../middleware/auth');
const { ok, asyncHandler, ApiError } = require('../utils/response');

/**
 * Phát hành cặp access + refresh token, đồng thời lưu hash refresh token vào DB.
 * Trả về object đã sẵn sàng gửi cho client.
 */
async function _issueTokens(user, req) {
  const payload = {
    id: user.id, username: user.username, role: user.role, full_name: user.full_name,
  };
  const accessToken  = signToken(payload);
  const refreshToken = signRefreshToken({ id: user.id, role: user.role, username: user.username });

  // Persist refresh token (hashed) để có thể revoke khi logout / đổi mật khẩu
  const expires_at = new Date(Date.now() + refreshExpiresIn() * 1000);
  try {
    await RefreshTokenModel.store({
      user_id:    user.id,
      token:      refreshToken,
      expires_at,
      user_agent: req && req.headers ? req.headers['user-agent'] : null,
      ip:         req && req.ip,
    });
  } catch (e) {
    // Nếu DB lỗi, KHÔNG phát hành token (fail closed)
    console.error('[auth] failed to persist refresh token:', e.message);
    throw ApiError.internal('Không thể tạo phiên đăng nhập, vui lòng thử lại');
  }

  return {
    token:                accessToken,
    refresh_token:        refreshToken,
    expires_in:           tokenExpiresIn(),
    refresh_expires_in:   refreshExpiresIn(),
    token_type:           'Bearer',
  };
}

exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    throw ApiError.validation('Vui lòng nhập tên đăng nhập và mật khẩu');

  const user = await UserModel.findByUsername(String(username).trim());
  if (!user || !user.is_active)
    throw ApiError.unauthorized('Tên đăng nhập hoặc mật khẩu không đúng');

  const verified = await UserModel.verifyPassword(user, password);
  if (!verified)
    throw ApiError.unauthorized('Tên đăng nhập hoặc mật khẩu không đúng');

  const tokens = await _issueTokens(user, req);

  LogModel.write({
    user_id: user.id, user_name: user.full_name, action: 'LOGIN',
    entity: 'USER', entity_id: user.id, ip: req.ip,
  }).catch(() => {});

  return ok(res,
    Object.assign({}, tokens, { user: UserModel.publicView(user) }),
    { message: 'Đăng nhập thành công' }
  );
});

/**
 * POST /auth/refresh
 * Body: { refresh_token }
 *   - Verify chữ ký + hạn của refresh token
 *   - Verify token còn hiệu lực trong DB (chưa bị revoke)
 *   - Rotate: revoke token cũ, phát hành token mới
 */
exports.refresh = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token)
    throw ApiError.validation('refresh_token: bắt buộc');

  // 1) Verify JWT (signature + exp)
  let decoded;
  try {
    decoded = verifyRefreshToken(refresh_token);
  } catch (e) {
    const err = ApiError.unauthorized('Refresh token không hợp lệ hoặc đã hết hạn');
    err.code = 'REFRESH_INVALID';
    throw err;
  }

  // 2) Verify token tồn tại & chưa revoke trong DB
  const stored = await RefreshTokenModel.findActive(refresh_token);
  if (!stored) {
    const err = ApiError.unauthorized('Phiên đăng nhập đã bị thu hồi, vui lòng đăng nhập lại');
    err.code = 'REFRESH_INVALID';
    throw err;
  }

  // 3) Verify user còn hoạt động
  const user = await UserModel.findById(decoded.id);
  if (!user || !user.is_active) {
    // Nếu user bị disable, revoke luôn tất cả token còn lại
    await RefreshTokenModel.revokeAllForUser(decoded.id).catch(() => {});
    const err = ApiError.unauthorized('Tài khoản không còn hoạt động');
    err.code = 'REFRESH_INVALID';
    throw err;
  }

  // 4) Rotate: revoke token cũ rồi phát hành cặp mới
  await RefreshTokenModel.revoke(refresh_token);
  const tokens = await _issueTokens(user, req);

  return ok(res,
    Object.assign({}, tokens, { user: UserModel.publicView(user) }),
    { message: 'Đã làm mới phiên đăng nhập' }
  );
});

exports.me = asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user.id);
  if (!user) throw ApiError.notFound('User không tồn tại');
  return ok(res, UserModel.publicView(user));
});

/**
 * POST /auth/logout
 * Body: { refresh_token? }
 *   - Nếu có refresh_token → revoke token đó (đăng xuất 1 thiết bị)
 *   - Nếu body có { all: true } → revoke tất cả thiết bị của user
 */
exports.logout = asyncHandler(async (req, res) => {
  const { refresh_token, all } = req.body || {};

  if (all && req.user) {
    await RefreshTokenModel.revokeAllForUser(req.user.id).catch(() => {});
  } else if (refresh_token) {
    await RefreshTokenModel.revoke(refresh_token).catch(() => {});
  }

  if (req.user) {
    LogModel.write({
      user_id: req.user.id, user_name: req.user.full_name,
      action: all ? 'LOGOUT_ALL' : 'LOGOUT',
      entity: 'USER', entity_id: req.user.id, ip: req.ip,
    }).catch(() => {});
  }

  return ok(res, null, { message: all ? 'Đã đăng xuất tất cả thiết bị' : 'Đã đăng xuất' });
});
