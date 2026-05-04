-- =============================================================================
-- 004_refresh_tokens.sql
-- Bảng lưu refresh tokens đã phát hành để hỗ trợ logout / revoke.
-- Lưu hash (SHA-256) chứ không lưu token plain-text.
-- Idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,
    user_agent   TEXT,
    ip           TEXT,
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx     ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx  ON refresh_tokens(expires_at);
