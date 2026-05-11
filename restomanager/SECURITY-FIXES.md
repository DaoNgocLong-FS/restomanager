# Critical security fixes — RestoManager

This bundle fixes the 4 critical issues from the code review. All files are drop-in replacements (or new files) that match the existing code style and folder structure.

## Files

```
backend/
├── package.json                          (updated: + express-rate-limit)
├── app.js                                (updated: CORS allowlist + rate limiters)
├── .env.example                          (updated: secrets + ALLOWED_ORIGINS)
├── migrations/
│   └── 004_refresh_tokens.sql            (new)
└── src/
    ├── controllers/
    │   └── authController.js             (updated: persistent refresh tokens)
    ├── middleware/
    │   ├── auth.js                       (updated: rejects weak secrets)
    │   └── rateLimiter.js                (new)
    ├── models/
    │   └── RefreshToken.js               (new)
    └── realtime/
        └── io.js                         (updated: rejects unauth sockets)

root/
├── .env.example                          (updated)
└── .gitignore                            (new — keeps .env out of git)
```

## What's fixed

### 1. Weak JWT secret + open CORS

**Before:** committed `.env` had `JWT_SECRET=please-change-me-in-prod`, CORS used `origin: true` (any origin allowed).

**After:**
- `auth.js` validates secrets at boot — production refuses to start with weak/default/missing values, dev shows a warning.
- `app.js` reads `ALLOWED_ORIGINS` from env and uses an allowlist function. Production refuses to start without it.
- New root `.gitignore` keeps `.env` files out of git.
- Updated `.env.example` files explain how to generate strong secrets (`openssl rand -base64 48`).

### 2. Refresh tokens couldn't be revoked (logout was cosmetic)

**Before:** `/auth/logout` only wrote a log entry. A leaked refresh token stayed valid for 30 days.

**After:**
- New `refresh_tokens` table stores SHA-256 hashes (never plain tokens) of every issued refresh token.
- New `RefreshToken` model handles store / findActive / revoke / revokeAllForUser.
- `authController.js` now:
  - Stores the hashed refresh token on login.
  - Verifies refresh tokens against the DB on `/auth/refresh` (rejects revoked ones).
  - **Rotates** refresh tokens on every refresh (revokes old, issues new).
  - Revokes the token on `/auth/logout`. Supports `{ all: true }` to log out all devices.

### 3. No rate limiting on auth endpoints

**Before:** unlimited login attempts.

**After:**
- New `rateLimiter.js` middleware using `express-rate-limit`.
- `authLimiter`: 10 failed attempts / 15 min, keyed by `IP + username` (so one attacker can't lock out other users).
- `apiLimiter`: 200 req/min for the rest of the API.
- Wired into `app.js` before the auth routes and as global API protection.

### 4. Guest WebSocket connections received all events

**Before:** `socket.io` allowed unauthenticated connections (`role: 'guest'`) and `_io.emit()` broadcast everything to every socket.

**After:**
- `realtime/io.js` rejects sockets with no token / invalid role.
- All authenticated sockets join an `authenticated` room.
- The internal `emit()` helper now sends only to that room — guests would never receive these events even if they slipped past auth.
- Socket.IO CORS now uses the same allowlist as Express.

## How to apply

1. Copy the files into your project, preserving the paths above.
2. Install the new dependency:
   ```
   cd backend && npm install
   ```
3. Generate strong secrets:
   ```
   openssl rand -base64 48   # use this for JWT_SECRET
   openssl rand -base64 48   # use a DIFFERENT one for REFRESH_SECRET
   ```
4. Update your `.env` (and the `JWT_SECRET` / `REFRESH_SECRET` used by docker-compose). Add `ALLOWED_ORIGINS` listing the real domains your frontend and mobile clients use.
5. Remove the old committed `.env` from git history (it leaked the dev secret):
   ```
   git rm --cached .env backend/.env
   git commit -m "Remove committed .env files"
   ```
   Then rotate any production secrets that may have been derived from the old values.
6. Restart the backend. The new migration `004_refresh_tokens.sql` runs automatically (existing migration loop in `db.js` picks it up).
7. After deploy: existing refresh tokens from before the fix will fail the new DB check → users will be forced to log in again once. This is intentional.

## Notes / things you may want next

- **Rate limiter is in-memory.** Fine for a single Node process. If you scale to multiple instances (PM2 cluster, Kubernetes), swap in `rate-limit-redis`.
- **Periodic cleanup:** add a cron / scheduled job to call `RefreshTokenModel.cleanupExpired()` once a day so the table doesn't grow forever.
- **`docker-compose.yml`** still has placeholder secrets in its environment defaults (`please-change-me-in-prod`). When using compose in production, set the real values via host env or a `.env` file (which compose reads automatically) and never rely on the inline defaults.
- **Mobile app:** the mobile client should send the refresh token in the logout request body so the server can revoke it. Update `Api.logout()` in `mobile/src/api.js` accordingly.
