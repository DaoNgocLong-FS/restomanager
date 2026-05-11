# =============================================================================
#  Multi-stage build cho web RestoManager
#   - Stage 1 (build-react): npm build app React (Vite) ở /frontend-react
#   - Stage 2 (nginx): nginx phục vụ
#       - React SPA tại /            (default)
#       - Admin (vanilla) tại /admin.html  (chưa migrate, dùng tạm)
#  Build context phải là root project (xem docker-compose.yml: context: .)
# =============================================================================

# ─── Stage 1: build React ─────────────────────────────────────────────────
FROM node:20-alpine AS build-react
WORKDIR /app

# Cache layer cho deps (chỉ rebuild khi package.json đổi)
COPY frontend-react/package.json frontend-react/package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy source code và build
COPY frontend-react/ ./
RUN npm run build
# → /app/dist/

# ─── Stage 2: nginx phục vụ ──────────────────────────────────────────────
FROM nginx:1.27-alpine

# Cấu hình nginx (proxy /api + /socket.io, SPA fallback)
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# Copy React build vào webroot
COPY --from=build-react /app/dist/ /usr/share/nginx/html/

# Copy admin (legacy vanilla) — chưa migrate nên giữ tạm
COPY frontend/admin.html /usr/share/nginx/html/admin.html
COPY frontend/js         /usr/share/nginx/html/js

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
