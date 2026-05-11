# RestoManager – Hệ thống Đặt món & Quản lý Nhà hàng

Một ứng dụng web hoàn chỉnh gồm hai vai trò chính:

* **POS** (React app, `frontend-react/`) – dành cho **nhân viên phục vụ** (gọi món, thêm món vào bàn) và **thu ngân** (xem đơn, lập hoá đơn, thanh toán). Đã migrate từ vanilla sang React 18 (xem `frontend-react/README.md`).
* **Admin** (`admin.html`) – dành cho **quản trị viên**: dashboard, nhân viên, thực đơn, bàn, hoá đơn, nhật ký hệ thống. *Vẫn đang là vanilla, sẽ migrate ở sprint tiếp.*

Stack:

* **Backend**: Node.js 20 + Express 4 + **Socket.IO 4** + PostgreSQL 16 + MinIO (S3-compatible) + JWT
* **Frontend (POS)**: **React 18 + Vite 5 + Tailwind 3 + react-router-dom 6 + lucide-react** — phục vụ static (đã build) qua Nginx
* **Frontend (Admin)**: HTML + Tailwind (CDN) + Vanilla JS — phục vụ qua cùng Nginx tại `/admin.html`
* **Mobile**: Expo / React Native + **react-native-safe-area-context** + custom Toast/ConfirmDialog (không dùng `Alert.alert`)
* **Triển khai**: Docker Compose (5 services: `postgres`, `minio`, `minio-init`, `backend`, `frontend`)
  Service `frontend` dùng **multi-stage build**: stage 1 chạy `npm build` cho React, stage 2 nginx phục vụ.

> 📋 Đã hoàn thành **3 yêu cầu của giảng viên** (sprint T2/2026):
> 1. ✅ Web migrate sang React.js — xem `frontend-react/`
> 2. ✅ Mobile dùng SafeAreaView của Expo (8/8 screens)
> 3. ✅ Mobile bỏ Alert, dùng Toast + ConfirmDialog tự xây
>
> Chi tiết: xem `CHANGELOG_FEEDBACK.md`

---

## 🚀 Chạy nhanh

Yêu cầu: Docker Desktop (hoặc Docker Engine + Compose v2).

```bash
# 1) Vào thư mục dự án
cd restomanager

# 2) (tuỳ chọn) chỉnh sửa cấu hình
cp .env.example .env

# 3) Build & chạy toàn bộ stack
docker compose up -d --build

# 4) Theo dõi log
docker compose logs -f backend
```

Sau khi tất cả service đã sẵn sàng, mở trình duyệt:

| Dịch vụ                  | URL                              |
| ------------------------ | -------------------------------- |
| Trang POS (React)        | http://localhost:8080/           |
| Trang Admin (vanilla)    | http://localhost:8080/admin.html |
| API REST                 | http://localhost:3000/api        |
| MinIO Console (S3 UI)    | http://localhost:9001            |
| MinIO API (object store) | http://localhost:9000            |
| Socket.IO (WebSocket)    | ws://localhost:3000/socket.io    |
| Swagger UI               | http://localhost:8080/api/docs   |

### Tài khoản mặc định (mật khẩu: `123`)

| Tên đăng nhập | Vai trò                |
| ------------- | ---------------------- |
| `admin`       | Quản trị viên          |
| `cashier`     | Thu ngân               |
| `waiter`      | Nhân viên phục vụ      |

> ⚠️ Hãy đổi mật khẩu các tài khoản trên ngay khi triển khai thật, và đặt `JWT_SECRET` mới trong `.env`.

---

## 📁 Cấu trúc thư mục

```
restomanager/
├── docker-compose.yml
├── .env / .env.example
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js / app.js
│   ├── migrations/                  # SQL khởi tạo (chạy tự động)
│   │   └── 001_init.sql
│   └── src/
│       ├── database/   (db.js, seed.js)
│       ├── storage/    (minio.js)
│       ├── middleware/ (auth.js)
│       ├── models/     (User, MenuItem, Table, Order, Invoice, Log)
│       ├── controllers/
│       └── routes/
├── frontend/                       # Static legacy + nginx config
│   ├── Dockerfile                  # Multi-stage: build React + nginx
│   ├── nginx.conf
│   ├── admin.html                  # Vanilla admin (chưa migrate)
│   └── js/api.js                   # API client cho admin.html
├── frontend-react/                 # ⭐ POS app — React + Vite + Tailwind
│   ├── package.json
│   ├── vite.config.js              # proxy /api & /socket.io khi dev
│   ├── tailwind.config.js
│   ├── README.md                   # Chi tiết cấu trúc / cách chạy
│   └── src/
│       ├── App.jsx, main.jsx
│       ├── api/client.js           # Port từ frontend/js/api.js cũ
│       ├── auth/                   # AuthContext + LoginPage
│       ├── components/             # Toast, Confirm, AppShell, TableContextMenu
│       ├── hooks/useSocket.js
│       └── pages/                  # CashierTables, CashierDetail, WaiterMenu, …
└── mobile/                         (Expo / React Native — xem mobile/README.md)
    ├── App.js                      # Đã wire ConfirmProvider + ToastHost + SafeAreaProvider
    ├── package.json
    ├── app.json
    └── src/
        ├── api.js
        ├── AuthContext.js
        ├── theme.js
        └── screens/    (Login, Tables, Menu, Detail, Payment, Orders, Profile, Settings)
```

App mobile (`mobile/`) gọi cùng REST API → đồng bộ thời gian thực với web. Xem `mobile/README.md` để chạy.

---

## ⚡ Đồng bộ thời gian thực (Socket.IO)

Hệ thống đã tích hợp **Socket.IO** để đồng bộ trạng thái **bàn / đơn hàng / hoá đơn** giữa
toàn bộ màn hình (POS waiter, POS cashier, Admin, Mobile) **trong vòng < 1 giây** mà không
cần bấm Refresh hay polling.

### Cách thức

1. Backend mở namespace mặc định trên cùng cổng `3000` qua `/socket.io`.
2. Client kết nối kèm `auth: { token: <JWT> }` (cùng JWT dùng cho REST). Token được verify bằng `JWT_SECRET`.
   Không có token vẫn nhận được broadcast nhưng được đánh role `guest`.
3. Sau mỗi mutation (tạo / sửa / xoá / huỷ / thanh toán đơn, CRUD bàn), controller phát 2 lớp event:

   | Event chi tiết                  | Khi nào                              | Payload chính                                              |
   | ------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
   | `order:created`                 | Tạo đơn mới                          | `{ order: {id, code, table_code, total_amount, ...} }`     |
   | `order:updated`                 | Thêm / sửa / xoá món, đổi status     | `{ order, change, ... }`                                   |
   | `order:cancelled`               | Huỷ đơn                              | `{ order }`                                                |
   | `invoice:created`               | Thanh toán xong                      | `{ invoice: {id, code, table_code, final_amount, ...} }`   |
   | `table:created/updated/deleted` | Admin sửa bàn                        | `{ table }` hoặc `{ id }`                                  |

   | Event tổng quát   | Khi nào                              | Mục đích                                |
   | ----------------- | ------------------------------------ | --------------------------------------- |
   | `tables:changed`  | Bất cứ khi nào trạng thái bàn đổi    | Client tải lại danh sách bàn            |
   | `orders:changed`  | Bất cứ khi nào danh sách đơn đổi     | Client tải lại danh sách đơn            |

4. Client (web + mobile) debounce ~120 ms, gọi lại đúng API và re-render duy nhất view đang mở.
   Mất kết nối thì socket.io-client tự reconnect, payload tiếp theo kéo lại trạng thái mới nhất.

### Kiểm thử nhanh

* Mở 2 tab cùng lúc: http://localhost:8080/ (đăng nhập **waiter**) và http://localhost:8080/ (đăng nhập **cashier**).
* Waiter gọi món → tab cashier sẽ thấy bàn chuyển sang "Có khách / Đơn mới" ngay lập tức.
* Cashier thanh toán → bàn về "Trống" và dashboard admin (nếu mở) cũng cập nhật.

### Cấu hình proxy (Nginx)

`frontend/nginx.conf` đã có block:

```nginx
location /socket.io/ {
  proxy_pass         http://restomanager_backend/socket.io/;
  proxy_http_version 1.1;
  proxy_set_header   Upgrade           $http_upgrade;
  proxy_set_header   Connection        $connection_upgrade;
  ...
}
```

Khi deploy sau LB / CDN khác, đảm bảo cấu hình tương đương để cho phép `Upgrade: websocket`.


---

## 🔌 Tính năng chính

### Vai trò Nhân viên phục vụ (waiter)
* Sơ đồ bàn theo khu vực (`indoor`, `outdoor`, `vip`).
* Mở thực đơn, thêm món vào giỏ, ghi chú món.
* Tự nhận biết bàn đã có **đơn mở**: thêm món sẽ **append** vào đơn cũ thay vì tạo đơn mới.
* Gửi đơn xuống bếp (`status = sent`).

### Vai trò Thu ngân (cashier)
* Danh sách đơn đang chờ thanh toán theo bàn.
* Xem chi tiết đơn, áp dụng **VAT** (mặc định 8%, có thể đổi).
* Thanh toán bằng **Tiền mặt / Chuyển khoản (QR) / Thẻ**.
* Xem hoá đơn đã thanh toán trong ngày, bộ chỉ số nhanh.

### Vai trò Quản trị (admin)
* **Dashboard**: doanh thu hôm nay, số HĐ, TB/HĐ, bàn đang phục vụ; biểu đồ doanh thu theo giờ; món bán chạy; tỷ trọng phương thức thanh toán.
* **Nhân viên**: CRUD tài khoản (admin / cashier / waiter), kích hoạt / khoá.
* **Thực đơn**: CRUD món; **upload ảnh** lên MinIO (bucket `restaurant`, public-read).
* **Bàn**: CRUD bàn theo khu vực và sức chứa.
* **Hoá đơn**: tra cứu lịch sử.
* **Nhật ký hệ thống**: 200 hoạt động gần nhất.

---

## 🌐 REST API tóm tắt (prefix `/api`)

> 📘 Đặc tả đầy đủ (envelope, error code, phân trang, payload từng endpoint) ở **[docs/API.md](docs/API.md)**.

| Method + Path                               | Mô tả                                |
| ------------------------------------------- | ------------------------------------ |
| `POST /auth/login`                          | Đăng nhập, trả JWT                   |
| `GET  /auth/me`                             | Lấy thông tin user hiện tại          |
| `GET  /users` (admin)                       | Danh sách nhân viên                  |
| `POST/PUT/DELETE /users[...]` (admin)       | CRUD nhân viên                       |
| `GET  /menu/categories`                     | Danh mục                             |
| `GET  /menu`                                | Thực đơn                             |
| `POST/PUT /menu` (multipart, admin)         | Thêm/sửa món + upload ảnh            |
| `DELETE /menu/:id` (admin)                  | Xoá món                              |
| `GET/POST/PUT/DELETE /tables[...]`          | CRUD bàn                             |
| `GET  /orders?status=open`                  | Danh sách đơn                        |
| `GET  /orders/by-table/:tableId`            | Đơn đang mở của 1 bàn                |
| `POST /orders`                              | Tạo đơn mới                          |
| `POST /orders/:id/items`                    | Thêm món vào đơn                     |
| `POST /orders/:id/checkout`                 | Lập hoá đơn & thanh toán             |
| `GET  /invoices`                            | Lịch sử hoá đơn                      |
| `POST /files/upload` (multipart)            | Upload tệp lên MinIO                 |
| `GET  /stats/overview`                      | Tổng quan dashboard                  |
| `GET  /logs`                                | Nhật ký hoạt động                    |

Tất cả endpoint (trừ `/auth/login`) đều yêu cầu header:
```
Authorization: Bearer <token>
```

---

## 🛠️ Phát triển ngoài Docker (tuỳ chọn)

```bash
# Backend
cd backend
cp .env.example .env       # rồi chỉnh DB_HOST=localhost, MINIO_ENDPOINT=localhost ...
npm install
npm start                  # cổng 3000

# Frontend (React)
cd ../frontend-react
npm install
npm run dev                 # cổng 5173 — proxy /api và /socket.io đã bật sẵn
# Mở http://localhost:5173/  → React app (login → POS)
# Trang admin (vanilla) chỉ chạy được khi build bằng Docker (multi-stage)
# hoặc bạn copy frontend/admin.html + frontend/js/api.js vào nginx của bạn.
```

---

## 🧰 Lệnh hữu ích

```bash
docker compose up -d --build       # build + chạy
docker compose ps                  # trạng thái
docker compose logs -f backend     # log backend
docker compose down                # dừng (vẫn giữ dữ liệu)
docker compose down -v             # dừng + xoá volume (mất hết DB & ảnh)
docker compose restart backend     # khởi động lại 1 service
```

---

## ❓ Khắc phục sự cố

* **Backend không kết nối DB**: backend tự retry tối đa 30 × 2s; xem `docker compose logs backend`. Đảm bảo container `postgres` đã `healthy`.
* **Ảnh món không hiển thị**: kiểm tra `MINIO_PUBLIC_URL` trong `.env` (mặc định `http://localhost:9000`). Nếu deploy server khác, đặt URL công khai tới MinIO.
* **Đăng nhập admin thất bại**: chắc chắn user là `admin / 123`; có thể tạo lại bằng cách `docker compose down -v && docker compose up -d --build` (sẽ seed lại).
* **Port bị chiếm**: chỉnh các biến `*_PORT_HOST` trong `.env`.

---

## 📜 Giấy phép

Phát hành cho mục đích nội bộ / học tập. Chỉnh sửa và sử dụng tự do.

---

## 🔐 Access token & Refresh token

Backend dùng **2 cặp JWT**:

| Loại                  | Secret                       | Mặc định TTL | Mục đích                                  |
| --------------------- | ---------------------------- | ------------ | ----------------------------------------- |
| `token` (access)      | `JWT_SECRET`                 | `15m`        | Đính `Authorization: Bearer …` cho mọi API|
| `refresh_token`       | `REFRESH_SECRET`             | `30d`        | Đổi lấy access token mới khi hết hạn      |

### Endpoint mới

| Method + Path        | Body                       | Trả về                                                                 |
| -------------------- | -------------------------- | ---------------------------------------------------------------------- |
| `POST /auth/login`   | `{ username, password }`   | `{ token, refresh_token, expires_in, refresh_expires_in, user }`       |
| `POST /auth/refresh` | `{ refresh_token }`        | `{ token, refresh_token, expires_in, refresh_expires_in, user }` *(rotate)*|

Refresh token được **rotate**: mỗi lần `/auth/refresh` thành công, server cấp một refresh token mới — client phải lưu lại để dùng lần kế tiếp.

### Hành vi của client (web + mobile)

Cả `frontend/js/api.js` và `mobile/src/api.js` đều có **interceptor**:

1. Mỗi request đính `Authorization: Bearer <access>`.
2. Nếu server trả `401` với code `TOKEN_EXPIRED` (hoặc `INVALID_TOKEN`) →
3. Client gọi `POST /auth/refresh` với `refresh_token` đang giữ. Đảm bảo nhiều request đồng thời chỉ kích hoạt **1** lần refresh (in-flight promise).
4. Nếu refresh thành công → cập nhật cả 2 token (và socket auth) → **retry duy nhất 1 lần** request gốc.
5. Nếu refresh cũng `401` (`REFRESH_INVALID`) → client xoá token và bắn event `rm:session-expired` (web) / `AuthEvents.emit('session-expired', …)` (mobile). UI điều hướng về Login với toast "Phiên đăng nhập đã hết hạn".

Socket.IO cũng dùng cùng access token: khi access đổi mới, client tự cập nhật `socket.auth = { token: <newAccess> }` và reconnect.

### Cấu hình `.env`

```env
JWT_SECRET=please-change-me-in-prod
JWT_EXPIRES=15m         # access ngắn
REFRESH_SECRET=change-me-too-32+chars-please
REFRESH_EXPIRES=30d     # refresh dài
```

Đổi `JWT_EXPIRES` ngắn xuống `30s` rồi `docker compose restart backend` là cách dễ nhất để kiểm thử flow refresh — mọi tab/POS/mobile sẽ vẫn hoạt động liên tục mà không phải đăng nhập lại.
