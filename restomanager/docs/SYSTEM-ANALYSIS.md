# RestoManager – Phân tích hệ thống chi tiết

> Tài liệu này mô tả **kiến trúc, công nghệ, lý do lựa chọn** và **các tối ưu** của
> hệ thống F&B đặt món + quản lý nhà hàng RestoManager (web POS + Admin + Mobile).
> Mục đích: giúp người mới đọc code hiểu nhanh "tại sao lại làm thế" và biết chỗ
> nào còn có thể cải thiện thêm khi triển khai thực tế.

---

## 1. Tổng quan kiến trúc

```
                    ┌────────────────────────────────────────────────────────────┐
                    │                     CLIENTS                                │
                    │                                                            │
   POS waiter (web) │  POS cashier (web) │  Admin (web) │   Mobile (Expo / RN)   │
   pos.html         │  pos.html          │  admin.html  │   App.js + screens/    │
                    └─────────────┬──────────────┬────────────────┬──────────────┘
                                  │ HTTPS/REST   │ WebSocket      │
                                  │ + JWT Bearer │ + JWT handshake│
                                  ▼              ▼                ▼
                          ┌──────────────────────────────────────────┐
                          │              Nginx (cổng 80)             │
                          │  / → static html/js                      │
                          │  /api/  → backend:3000                   │
                          │  /socket.io/ → backend:3000 (Upgrade WS) │
                          └────────────────────┬─────────────────────┘
                                               │
                                               ▼
                       ┌──────────────────────────────────────────────┐
                       │   Backend Node.js 20 (Express 4 + Socket.IO) │
                       │   server.js (httpServer dùng chung port)     │
                       │   ├── REST routes:  /api/auth, /menu, /tables│
                       │   │                  /orders, /invoices, ... │
                       │   ├── Realtime:    server-→client events     │
                       │   ├── Auth (JWT access + JWT refresh)        │
                       │   └── pg + minio client                      │
                       └─────────┬──────────────────────┬─────────────┘
                                 │                      │
                                 ▼                      ▼
                          ┌─────────────┐        ┌────────────────┐
                          │ PostgreSQL  │        │ MinIO (S3)     │
                          │ - users     │        │ Bucket:        │
                          │ - menu_*    │        │  restaurant/   │
                          │ - tables    │        │  (public-read) │
                          │ - orders    │        │  ảnh menu      │
                          │ - invoices  │        └────────────────┘
                          │ - logs      │
                          └─────────────┘
```

5 service trong `docker-compose.yml`: `postgres`, `minio`, `minio-init`, `backend`, `frontend`. Backend và frontend đều có healthcheck phụ thuộc nhau, MinIO có job `minio-init` chạy 1 lần để tạo bucket public.

---

## 2. Stack & lý do chọn

| Lớp           | Công nghệ                                           | Vì sao                                                                                  |
| ------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Runtime       | **Node.js 20 LTS**                                  | Hỗ trợ `--watch`, native fetch, nhanh, ecosystem khổng lồ; phù hợp app I/O-bound như F&B|
| HTTP API      | **Express 4**                                       | Tối giản, dễ maintain, không bị "magic" như Nest/Koa; routing minh bạch                 |
| Realtime      | **Socket.IO 4**                                     | Auto fallback websocket↔polling, room/namespace, ack, reconnect — không phải tự code   |
| DB            | **PostgreSQL 16**                                   | Ổn định, có UUID, JSONB, transaction; F&B cần ACID khi checkout                         |
| ORM/SQL       | Driver `pg` thuần + helper trong `database/db.js`   | Đơn giản, kiểm soát query rõ ràng, không học thêm DSL; transaction tường minh           |
| Object store  | **MinIO** (S3-compatible)                           | Self-hosted, drop-in S3; có thể đổi sang AWS S3 thật chỉ bằng đổi env                   |
| Auth          | **JWT** (access + refresh token, refresh rotation)  | Stateless, dễ verify trên cả REST lẫn Socket.IO; phù hợp đa-thiết-bị                    |
| Frontend web  | HTML + **Tailwind CDN** + Vanilla JS                | Triển khai zero-build, sửa nhanh; dùng Nginx phục vụ tĩnh                               |
| Mobile        | **Expo / React Native** (SDK 54)                    | Cùng ngôn ngữ JS, share API client với web; build một lần ra Android & iOS              |
| DevOps        | **Docker Compose**                                  | Setup nội bộ 1 lệnh; healthcheck/depends_on rõ ràng                                     |

Triết lý chung: **đơn giản, ít magic, dễ giải thích cho dev mới** — phù hợp F&B nội bộ. Mọi tầng đều có thể swap khi quy mô tăng (Postgres → managed RDS, MinIO → AWS S3, Express → Fastify, v.v.) mà không phá hỏng cấu trúc.

---

## 3. Backend

### 3.1. Cấu trúc thư mục

```
backend/
├── server.js          # bootstrap: init DB → init MinIO → seed → http.createServer + Socket.IO
├── app.js             # Express app: middleware + routes + error handler
├── package.json       # dependencies + scripts
├── Dockerfile         # node:20-alpine + tini
├── migrations/
│   ├── 001_init.sql
│   ├── 002_dedupe_menu.sql
│   └── 003_invoice_payment_fields.sql
└── src/
    ├── database/   db.js, seed.js
    ├── storage/    minio.js
    ├── middleware/ auth.js, errorHandler.js, validate.js
    ├── models/     User, MenuItem, Table, Order, Invoice, Log
    ├── controllers/{auth,user,menu,table,order,invoice,file,stat,log}Controller.js
    ├── routes/     *Routes.js
    ├── realtime/   io.js
    └── utils/      response.js (envelope ok/created/paged + ApiError + asyncHandler)
```

Phân tách routes ↔ controllers ↔ models là **MVC nhẹ**. Các util chung (envelope JSON, lỗi chuẩn, paging) tập trung trong `utils/response.js` để controller chỉ tập trung logic nghiệp vụ.

### 3.2. PostgreSQL & migrations

`database/db.js` đảm nhận:
- Tạo `pg.Pool` từ env (`DB_HOST/PORT/...` hoặc `DATABASE_URL`).
- `waitForDb()` retry tối đa 30 × 2 s — chấp nhận trường hợp Postgres chưa kịp lên khi backend bật.
- `initDatabase()` đọc tất cả file `.sql` trong `migrations/` rồi `client.query(content)` theo thứ tự tên file. Vì các statement đều dùng `IF NOT EXISTS`, an toàn khi chạy lại nhiều lần.
- `transaction(fn)` cấp client riêng, tự `BEGIN/COMMIT/ROLLBACK`. Mọi thao tác đa bước (tạo order + items, addItems, removeItem, checkout) đều bọc trong helper này → **không bao giờ nửa-tạo nửa-fail**.

Schema chính (file `001_init.sql`):

| Bảng              | Trường nổi bật                                                            | Index/Constraint                          |
| ----------------- | ------------------------------------------------------------------------- | ----------------------------------------- |
| `users`           | id (UUID), username UNIQUE, role, is_active                               | password_hash bcrypt                      |
| `menu_categories` | code UNIQUE, name UNIQUE, sort_order                                      |                                           |
| `menu_items`      | category_id FK ON DELETE SET NULL, price NUMERIC, image_url               |                                           |
| `tables`          | code UNIQUE, zone TEXT, capacity, is_active                               |                                           |
| `orders`          | code DEFAULT generated, status, table_id FK, waiter_id FK, total_amount   | `idx orders_status`, `idx orders_table`   |
| `order_items`     | order_id FK ON DELETE CASCADE, menu_item_id FK, quantity, price           |                                           |
| `invoices`        | code DEFAULT, **order_id UNIQUE**, vat_rate, paid_amount, payment_method  | `idx invoices_created`, `idx cashier`     |
| `invoice_items`   | snapshot món lúc thanh toán (giá đã lock)                                 |                                           |
| `activity_logs`   | user_id, action, entity, entity_id, details JSONB, ip                     | `idx logs_created`                        |

Snapshot `invoice_items` là chủ đích: sau này admin sửa giá món gốc cũng không làm thay đổi hoá đơn cũ. Đây là pattern chuẩn cho mọi POS.

### 3.3. Models & transaction

Mỗi model là class với static methods, ví dụ `OrderModel.create({...items})`:

```js
return db.transaction(async (client) => {
  // 1) lookup table_code → table_id
  // 2) INSERT INTO orders (...)   RETURNING *
  // 3) INSERT INTO order_items (...) cho từng món
  // 4) UPDATE orders.total_amount = SUM(...)
  // 5) trả lại order kèm items
});
```

`InvoiceModel.checkout` thì:
1. SELECT order còn `pending/serving` mới được thanh toán; ngược lại throw `ApiError`.
2. Tính `final_amount = total + vat - discount`.
3. INSERT invoice + invoice_items snapshot.
4. UPDATE order.status = 'completed'.

Toàn bộ trong 1 transaction → checkout không bao giờ tạo invoice mà order vẫn là `pending`, hay ngược lại.

### 3.4. Authentication: JWT access + refresh

Lưu ở `middleware/auth.js`:

- **Access token** ký bằng `JWT_SECRET`, mặc định **15 phút**. Đính `Authorization: Bearer ...` cho mọi request.
- **Refresh token** ký bằng `REFRESH_SECRET` (khác hoàn toàn), mặc định **30 ngày**, có claim `typ: 'refresh'` để chặn dùng nhầm thay cho access.
- Helper `tokenExpiresIn() / refreshExpiresIn()` parse chuỗi `15m/12h/30d` ra giây cho client biết.

Endpoint:
- `POST /auth/login` → `{ token, refresh_token, expires_in, refresh_expires_in, user }`
- `POST /auth/refresh` → kiểm tra refresh, kiểm `is_active`, **rotate** cấp cặp token mới.
- `POST /auth/logout` (cần auth) → ghi log; không invalidate token vì JWT stateless.
- `GET /auth/me`.

Lý do tách 2 secret: nếu access bị lộ (vì XSS chẳng hạn), kẻ xấu chỉ có 15 p khai thác và **không** thể tự tạo refresh để kéo dài phiên.

### 3.5. Realtime layer (Socket.IO)

`src/realtime/io.js` cung cấp `init / emit / emitToRole / broadcastTablesChanged / broadcastOrdersChanged` để controller phát event sau mỗi mutation.

Quy ước event:

| Lớp           | Event                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| Cụ thể        | `order:created`, `order:updated`, `order:cancelled`, `invoice:created`, `table:created/updated/deleted`, `menu:changed` |
| Tổng quát     | `tables:changed`, `orders:changed`                                        |

Thiết kế **2 lớp**: client đơn giản chỉ cần lắng nghe `tables:changed` để reload bàn. Client thông minh hơn lắng nghe event chi tiết để patch state local.

Auth Socket.IO dùng cùng `JWT_SECRET` qua `handshake.auth.token`. Không có token vẫn vào được nhưng `role: 'guest'` (chỉ nhận broadcast). Socket.IO 4 hỗ trợ websocket + polling fallback, đã cấu hình `path: /socket.io` để Nginx proxy.

### 3.6. Lưu trữ ảnh – MinIO/S3

`storage/minio.js`:
- `initStorage()` tạo bucket nếu chưa có và set policy `public-read` (cho ảnh menu hiển thị trực tiếp).
- `uploadBuffer(buffer, originalname, mimetype, prefix)` sinh key kiểu `prefix/<uuid>.<ext>` rồi `putObject`. Trả về `{ key, url }` (URL = `MINIO_PUBLIC_URL + /bucket/key`).
- `deleteObject(key)` dùng khi update menu (xoá ảnh cũ).

Lý do chọn MinIO: bản dev chạy local không cần AWS; production chỉ đổi `MINIO_ENDPOINT` sang S3 thật là xong. Pattern signed URL có thể bổ sung sau cho file riêng tư.

### 3.7. Validate, error, logging

- `middleware/validate.js`: schema-like nhỏ gọn — `validateBody({ field: { required, type, enum, min, max, minLength, maxLength } })`. Dùng cho login, refresh, các route có body đơn giản. Controller validate sâu thêm khi cần.
- `middleware/errorHandler.js`: bắt mọi lỗi → trả envelope `{ success:false, message, error:{ code, details } }`.
  - `ApiError` (validate, notFound, unauthorized, forbidden, badRequest)
  - `JsonWebTokenError` → `INVALID_TOKEN`, `TokenExpiredError` → `TOKEN_EXPIRED` (đây là tín hiệu cho client interceptor refresh).
  - `MulterError` → mapping mã lỗi upload.
  - PostgreSQL SQLSTATE: `23505` DUPLICATE, `23503` FK_VIOLATION, `23502` NOT_NULL, `22P02` BAD_PARAM, ...
  - Mặc định 500. Trong production che message gốc để không lộ stack.
- `LogModel.write({...})` ghi vào bảng `activity_logs`. Mọi mutation quan trọng (login, logout, CRUD nhân viên, menu, bàn, order, checkout) đều ghi log. `Logs` được phân trang ở admin.

### 3.8. Endpoint REST tóm tắt

```
POST   /api/auth/login       (public)
POST   /api/auth/refresh     (public, body: refresh_token)
POST   /api/auth/logout      (auth)
GET    /api/auth/me          (auth)

GET    /api/users            (admin)
POST   /api/users            (admin)  …

GET    /api/menu/categories  (public reads)
GET    /api/menu             (public reads)
POST   /api/menu             (admin, multipart)   ← upload ảnh
PUT    /api/menu/:id         (admin, multipart)
DELETE /api/menu/:id         (admin)

CRUD   /api/tables           (admin để write)

GET    /api/orders, /api/orders/by-table/:tableId, /api/orders/:id
POST   /api/orders                                (waiter, admin)
POST   /api/orders/:id/items                      (waiter/cashier/admin)
PUT    /api/orders/:id/items/:itemId              (waiter/cashier/admin)
DELETE /api/orders/:id/items/:itemId              (waiter/cashier/admin)
PUT    /api/orders/:id/status                     (waiter/cashier/admin)
DELETE /api/orders/:id                            (waiter/cashier/admin) — cancel
POST   /api/orders/:id/checkout                   (cashier, admin)

GET    /api/invoices, /api/invoices/:id

POST   /api/files/upload                          (auth) — upload chung
GET    /api/stats/overview, /api/stats/daily
GET    /api/logs
```

Tất cả response theo envelope chuẩn; phân trang qua `?page=&limit=`.

---

## 4. Frontend Web (POS + Admin)

### 4.1. Triết lý "no build"

Chỉ có 3 file HTML (`index.html`, `pos.html`, `admin.html`) + 1 file `js/api.js`. Tailwind nhúng qua CDN. Lợi: deploy chỉ cần copy file vào Nginx, không cần Webpack/Vite. Hợp với scope demo nội bộ.

`api.js` được nạp đầu tiên trong cả 2 trang, expose `window.Api` với toàn bộ method REST + helper realtime + token storage.

### 4.2. API client + interceptor (refresh token)

`request(path, opts)`:
1. Build URL + query string an toàn.
2. Đính `Authorization: Bearer <access>` nếu có token.
3. `fetch` → đọc text → parse JSON → kiểm `success`.
4. Nếu `401 TOKEN_EXPIRED|INVALID_TOKEN` và còn refresh token → gọi `_doRefresh()` (in-flight promise duy nhất, các request đồng thời share kết quả) → set token mới → retry **đúng 1 lần**.
5. Nếu refresh trả 401 (`REFRESH_INVALID`) → `clearToken()` + `dispatchEvent('rm:session-expired')`. Trang lắng nghe event này để hiển thị toast và quay về login.

Socket cũng được cập nhật `auth.token` rồi reconnect khi access đổi (giúp realtime không đứt khi user dùng app cả ngày).

### 4.3. POS UI flow

`pos.html` chứa cả vai trò **waiter** lẫn **cashier**, dùng "page router" siêu đơn giản: các `<div class="page">` với id `pg-...`, chỉ page đang `.active` mới `display:flex`. `goPage(id)` chuyển trạng thái + nạp dữ liệu cần thiết.

Flow waiter:
1. Đăng nhập → `initWaiter()` → load menu + tables + orders.
2. Tap bàn → `openWaiterMenu(tableId)` → fetch open order của bàn (nếu có), set `currentOpenOrder` để **append vào đơn cũ thay vì tạo đơn mới**.
3. Chọn món → cart local; gửi → `Api.addOrderItems(...)` hoặc `Api.createOrder(...)`.

Flow cashier:
1. `initCashier()` → load tables + orders đang `pending/serving` + invoices hôm nay.
2. Tap bàn `pay` → mở chi tiết → có thể sửa/xoá món → tính VAT → chọn phương thức → `Api.checkout(...)`.

### 4.4. Dynamic chips (categories & zones)

Trước đây 3 cụm chip "Khai vị / Món chính / Đồ uống" và "Tầng 1 / Sân vườn" hardcode trong HTML — admin thêm category/zone mới sẽ không xuất hiện. Đã refactor:
- HTML chỉ còn container rỗng có id (`#w-zone-chips`, `#c-zone-chips`, `#w-menu-cats`).
- `loadCategoriesFromApi()` gọi `Api.listCategories()` lấy `MENU_CATS` rồi `renderWaiterMenuCats()` sinh chip.
- Zone sinh từ `TABLES` đã load: `Set(t.zone)` → render chip. Có map nhãn (`t1 → Tầng 1`, `garden → Sân vườn`, `indoor/outdoor/vip → ...`), fallback cap-case zone code.

### 4.5. Realtime client + debounce

`setupRealtime()` gắn handler cho `tables:changed`, `orders:changed`, `order:*`, `invoice:created`, `menu:changed`. Mọi event đẩy vào hàng đợi `_rtPendingTables / _rtPendingOrders` rồi `setTimeout(_rtSyncNow, 80)` — **debounce 80 ms** tránh re-render khi server đẩy nhiều event liên tục (vd waiter thêm 3 món thì chỉ render 1 lần).

`admin.html` tương tự nhưng đơn giản hơn: chỉ refresh đúng tab đang xem (`dashboard / tables / invoices / logs`).

---

## 5. Mobile (Expo / React Native)

### 5.1. Cấu trúc

```
mobile/
├── App.js                         # NavigationContainer + AuthProvider
└── src/
    ├── api.js                     # API client + refresh + AuthEvents pub/sub
    ├── socket.js                  # singleton io + useRealtime hook
    ├── AuthContext.js             # boot + login/logout, BOOT_FAILSAFE
    ├── theme.js
    └── screens/
        ├── LoginScreen.js
        ├── SettingsScreen.js      # cấu hình API base URL
        ├── TablesScreen.js
        ├── MenuScreen.js
        ├── DetailScreen.js
        ├── PaymentScreen.js
        ├── OrdersScreen.js
        └── ProfileScreen.js
```

`App.js` chia logic:
- Nếu chưa cấu hình `apiBase` → render `SettingsScreen`.
- Có `apiBase` mà chưa login → `LoginScreen`.
- Đã login → bottom tab navigator (Tables / Orders / Profile).

### 5.2. AuthContext + AsyncStorage

`AuthContext` lưu `booting / user / apiBase` qua React state. Khi mount:
1. `loadConfig()` đọc base + token + refresh + user từ AsyncStorage.
2. Nếu có cả base + token → `Api.me()` xác minh; thành công thì kết nối socket.
3. **BOOT_FAILSAFE 8.5 s**: `setTimeout` bắt buộc `setBooting(false)` để spinner không kẹt vô hạn (xảy ra khi network/server treo).

`Api.login` lưu cả 3 thứ vào AsyncStorage, sau đó `connectSocket()`. `Api.AuthEvents.on('session-expired', …)` để khi refresh hỏng toàn cục thì AuthContext xoá auth + ngắt socket → app tự về Login.

### 5.3. Socket layer + timeout

`socket.js`:
- Singleton `_socket`, dùng `transports: ['websocket']` (RN ổn nhất với WS thuần). Reconnection vô hạn, delay 1.5 s.
- `useRealtime(handlers)` hook cho mỗi screen — register listener khi mount, unregister khi unmount. **Không** disconnect socket lúc unmount vì các screen khác vẫn dùng.

`api.js` mobile có **timeout 8 s mặc định** qua `AbortController` — RN không có timeout default nên thiếu cái này là spinner kẹt mãi như trước.

### 5.4. Screens nổi bật

- `TablesScreen`: `useFocusEffect` + `useRealtime` để cả 2 cách refresh đều hoạt động (focus tab hoặc server đẩy event). FlatList 2 cột.
- `DetailScreen` (cashier): debounce reload, **chỉ phản ứng với event đúng `table.code`** để tránh load liên tục khi nhân viên khác thao tác bàn khác.
- `MenuScreen` (waiter): cart `useState`, gửi đơn qua `Api.createOrder` hoặc `Api.addOrderItems` tùy bàn đã có open order.
- `PaymentScreen` (cashier): tính VAT 8%, chọn payment method, gọi checkout.

---

## 6. DevOps

### 6.1. Docker Compose

5 service:
- `postgres` (postgres:16-alpine) — volume `postgres_data`, healthcheck `pg_isready`.
- `minio` (minio/minio:latest) — volume `minio_data`, healthcheck `minio/health/live`.
- `minio-init` (minio/mc) — chạy 1 lần, tạo bucket + set anonymous public.
- `backend` (build từ `backend/Dockerfile`) — depends_on `postgres healthy` + `minio healthy`. Truyền 14 env: DB, JWT, REFRESH, MINIO, PORT.
- `frontend` (build từ `frontend/Dockerfile` = nginx + html) — depends_on `backend`.

Toàn bộ cổng đều cấu hình được qua `.env` (`DB_PORT_HOST`, `BACKEND_PORT_HOST`, `FRONTEND_PORT_HOST`, ...).

### 6.2. Nginx proxy WebSocket

`frontend/nginx.conf` có 2 location block quan trọng:

```nginx
location /api/ {
  proxy_pass http://restomanager_backend/api/;
  ...
}

map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}

location /socket.io/ {
  proxy_pass http://restomanager_backend/socket.io/;
  proxy_http_version 1.1;
  proxy_set_header   Upgrade           $http_upgrade;
  proxy_set_header   Connection        $connection_upgrade;
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;
  proxy_buffering    off;
}
```

Cấu hình `Upgrade/Connection` là bắt buộc cho WebSocket. Timeout 3600 s đủ cho session realtime dài.

### 6.3. Env & secrets

- `.env.example` đầy đủ. Khi prod: đổi `JWT_SECRET / REFRESH_SECRET` thành 32+ ký tự ngẫu nhiên, đổi mật khẩu account demo, chỉnh `MINIO_PUBLIC_URL` thành domain thật.
- Refresh token rotate: mỗi `/auth/refresh` cấp cả refresh mới — client lưu lại để dùng lần kế tiếp.

---

## 7. Flow đầu cuối

### 7.1. Login + auto-refresh

```
Browser → POST /api/auth/login {username,password}
       ← { token, refresh_token, expires_in, user }

Browser lưu rm_token, rm_refresh, rm_user ở localStorage.
SocketIO connect với auth.token = rm_token.

(15 phút sau)
Browser → GET /api/orders   ←  401 TOKEN_EXPIRED
api.js intercept → POST /api/auth/refresh {refresh_token}
                ← { token: <new>, refresh_token: <new> }
api.js retry  → GET /api/orders  → 200 OK

User không thấy bất kỳ lỗi nào.
```

### 7.2. Đặt món real-time

```
Waiter (mobile) → POST /api/orders {table_code, items}
Backend → INSERT orders + items (transaction)
        → realtime.emit('order:created', {order})
        → realtime.broadcastOrdersChanged()
        → realtime.broadcastTablesChanged()
Cashier (web POS)   ── nhận 'orders:changed'/'tables:changed' ──
                    → debounce 80ms
                    → reload Api.listOrders + Api.listTables
                    → render lại chỉ những phần đang xem.
```

### 7.3. Thanh toán

```
Cashier → POST /api/orders/:id/checkout {cashier_name, payment_method, vat_rate, paid_amount}
Backend (transaction):
  1) Validate order status hợp lệ
  2) INSERT invoices + invoice_items (snapshot)
  3) UPDATE orders.status = 'completed'
  4) realtime.emit('invoice:created', {invoice})
     realtime.broadcastTablesChanged({table_code})
Tất cả màn hình:
  - bàn về 'empty'
  - dashboard admin cộng dồn doanh thu
  - cashier thấy invoice trong tab "Đã TT hôm nay"
```

---

## 8. Các tối ưu đã có

| Khu vực        | Tối ưu                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| DB             | Index `orders.status`, `orders.table_id`, `invoices.created_at`, `invoices.cashier_id`, `logs.created_at`|
| DB             | Tất cả mutation đa bước trong `db.transaction()` — atomicity cho checkout                                |
| DB             | `invoice_items` snapshot món để bảo vệ hoá đơn lịch sử khi giá menu đổi                                  |
| API            | Envelope chuẩn + error mapping (JWT/Multer/SQLSTATE)                                                    |
| API            | Pagination helper `paginateArray` cho tất cả endpoint list                                              |
| API            | `multer.memoryStorage` + giới hạn 5/10 MB, đẩy thẳng MinIO không ghi đĩa                                |
| Auth           | Access ngắn 15 m + Refresh 30 d, rotate mỗi lần refresh, 2 secret tách biệt                              |
| Realtime       | 2 lớp event (chi tiết + tổng quát) — client tự chọn                                                      |
| Realtime       | Debounce client 80–150 ms tránh render bão tố                                                            |
| Realtime       | Token đổi mới sẽ tự reconnect socket với auth mới (web + mobile)                                         |
| Web            | API client singleton, in-flight promise cho refresh — N request đồng thời chỉ refresh 1 lần              |
| Web            | UI render dynamic categories/zones — admin thêm là POS thấy ngay (qua `menu:changed`/`tables:changed`)   |
| Mobile         | `AbortController` timeout 8 s cho mọi fetch                                                              |
| Mobile         | BOOT_FAILSAFE 8.5 s — spinner không bao giờ kẹt mãi                                                       |
| DevOps         | `tini` làm PID 1 trong backend container; `restart: unless-stopped`                                       |
| DevOps         | Healthcheck Postgres + MinIO; backend đợi 2 service healthy mới khởi                                       |
| DevOps         | Nginx có cấu hình `Upgrade/Connection` chuẩn cho WebSocket                                                |

---

## 9. Đề xuất tối ưu thêm (chưa làm)

### 9.1. Bảo mật

- Thêm **`helmet`** vào `app.js` — set CSP, HSTS, X-Frame-Options, X-Content-Type-Options.
- Thêm **`express-rate-limit`** cho `/auth/login` (5/phút/IP) và `/auth/refresh` (30/phút/IP).
- Đổi `cors({ origin: true })` → allowlist domain cụ thể từ env.
- Xem xét **HttpOnly cookie** cho refresh token thay vì localStorage để chống XSS.
- Thêm bảng `refresh_tokens` (id, user_id, jti, expires_at, revoked_at) → có thể revoke từng phiên & biết bao nhiêu thiết bị đang đăng nhập.
- Backend Dockerfile thêm `USER node` — hiện tại chạy bằng root.
- Thêm `package-lock.json` để build deterministic.

### 9.2. Database

- CHECK constraint cho `orders.status`, `invoices.payment_method` (hoặc enum).
- Bảng `zones` riêng + FK `tables.zone_id` để admin không gõ chệch chính tả.
- Index thêm `orders.created_at`, `order_items.menu_item_id`.
- Migration tracking: bảng `_migrations(name, applied_at)` để chỉ chạy file mới.
- Schedule backup `pg_dump` định kỳ.

### 9.3. Realtime

- Emit theo room `tenant:<id>` hoặc `table:<code>` thay vì broadcast toàn server — cần khi multi-tenant.
- `socket.io-redis` adapter khi scale backend > 1 instance.
- Mobile thêm `transports: ['websocket','polling']` để fallback khi mạng chặn WS.

### 9.4. Frontend

- Tách `pos.html` 1 600 dòng thành module hoặc chuyển sang Alpine.js / Preact để dễ maintain.
- Build Tailwind cục bộ (purge unused) thay vì CDN — load nhanh hơn và không phụ thuộc internet.
- Thêm Service Worker để POS hoạt động offline tạm thời (ghi đơn local rồi đồng bộ khi mạng phục hồi).
- Optimistic update khi gửi đơn, hủy đơn — UX mượt hơn.

### 9.5. Mobile

- Expo Push Notification — báo cho waiter khi có đơn mới (kể cả khi app background).
- Lắng nghe `menu:changed` ở `MenuScreen` để cập nhật món khi admin sửa giá.
- Error boundary RN tránh crash trắng khi 1 screen lỗi.
- Detox / Maestro e2e test.

### 9.6. Quan sát & vận hành

- `/metrics` Prometheus (qua `prom-client`) — request rate, latency, DB pool, socket count.
- Healthcheck backend trong compose (curl `/api/health`).
- Log driver json-file rotation hoặc đẩy về Loki/ELK.
- Đặt sau **TLS reverse proxy** (Caddy / Traefik / Cloudflare Tunnel) khi public.
- CI/CD: lint + test + build image + push registry.

### 9.7. Test

- Jest unit test cho models (đặc biệt `OrderModel.create`, `InvoiceModel.checkout`).
- Supertest integration cho flow `login → createOrder → addItems → checkout`.
- Playwright e2e cho POS — happy path waiter + cashier 2 tab.

---

## 10. Roadmap nâng cấp gợi ý (theo độ ưu tiên)

| Sprint | Mục tiêu                                                                  |
| ------ | -------------------------------------------------------------------------- |
| 1 (hardening) | helmet, rate-limit, CORS allowlist, đổi secrets, healthcheck backend, USER non-root, package-lock |
| 2 (DB) | enum/CHECK constraint, bảng `zones`, migration tracking, backup script    |
| 3 (UX) | optimistic update, service worker offline, push notification mobile      |
| 4 (scale) | socket.io-redis, room theo tenant, metrics Prometheus + Grafana       |
| 5 (test/CI) | Jest + Supertest + Playwright; pipeline build image + deploy        |

Sau roadmap 5 sprint, hệ thống sẵn sàng phục vụ **chuỗi nhà hàng vài chục chi nhánh** với SLA chấp nhận được.

---

## 11. Tổng kết

- **Stack đơn giản nhưng đủ chuyên nghiệp**: Express + Socket.IO + Postgres + MinIO + JWT refresh — không bị vướng framework cồng kềnh, dev mới onboard < 1 ngày.
- **Realtime đã chạy mượt**: < 1 s đồng bộ giữa POS waiter / cashier / admin / mobile, có debounce và auto reconnect.
- **Auth flow chắc chắn**: access ngắn + refresh dài + rotation, interceptor tự retry, UI chuyển về Login khi refresh chết.
- **Transaction-safe**: checkout không bao giờ tạo invoice mà order vẫn pending.
- Còn nợ kỹ thuật ở mảng **bảo mật biên** (helmet, rate-limit, CORS), **scale-out** (socket.io-redis), **test** (chưa có) — nhưng cấu trúc hiện tại sẵn sàng tiếp nhận các bổ sung này mà không phải refactor lớn.

Hệ thống này phù hợp ngay để chạy nội bộ một nhà hàng/quán cafe; với roadmap tối ưu trên có thể mở rộng thành SaaS đa-chi-nhánh.
