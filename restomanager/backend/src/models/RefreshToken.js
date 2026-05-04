// =============================================================================
//  RefreshToken model
//  - Lưu hash (SHA-256) của refresh token, không lưu plain-text
//  - Hỗ trợ: lưu, kiểm tra hợp lệ, revoke (logout), revoke-all (đổi mật khẩu)
//  - Cleanup các token đã hết hạn
// =============================================================================
const crypto = require('crypto');
const db = require('../database/db');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class RefreshTokenModel {
  /** Lưu refresh token mới (lưu hash). Trả về row đã tạo. */
  static async store({ user_id, token, expires_at, user_agent, ip }) {
    const token_hash = hashToken(token);
    return db.queryOne(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, expires_at, created_at`,
      [user_id, token_hash, expires_at, user_agent || null, ip || null]
    );
  }

  /**
   * Tìm token nếu còn hiệu lực (chưa revoke, chưa hết hạn).
   * Trả về null nếu không hợp lệ → caller báo REFRESH_INVALID.
   */
  static async findActive(token) {
    const token_hash = hashToken(token);
    return db.queryOne(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [token_hash]
    );
  }

  /** Đánh dấu 1 token đã revoke (logout / rotate). */
  static async revoke(token) {
    const token_hash = hashToken(token);
    return db.queryOne(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL
       RETURNING id`,
      [token_hash]
    );
  }

  /** Revoke tất cả token của 1 user (đổi mật khẩu, khóa tài khoản). */
  static async revokeAllForUser(user_id) {
    return db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [user_id]
    );
  }

  /** Dọn các token đã hết hạn (chạy định kỳ). */
  static async cleanupExpired() {
    return db.query(`DELETE FROM refresh_tokens WHERE expires_at < NOW()`);
  }
}

module.exports = RefreshTokenModel;
