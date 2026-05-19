# =============================================================================
#  Dockerfile cho front-end (React + Vite, phục vụ qua Nginx)
#   - Stage 1: build SPA bằng Vite
#   - Stage 2: nginx serve /usr/share/nginx/html (proxy /api và /socket.io)
#
#  Build context = ./front-end (xem docker-compose.yml)
# =============================================================================

# ─── Stage 1: build React ──────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Cache layer cho deps
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy source & build
COPY . .
RUN npm run build
# → /app/dist/

# ─── Stage 2: nginx phục vụ ────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
