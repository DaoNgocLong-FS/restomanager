# RestoManager – API Specification (v2.0)

Toàn bộ endpoint dùng prefix `/api`.

## 1. Quy ước chung

### 1.1 Envelope phản hồi

Mọi phản hồi đều dùng JSON với 2 dạng:

**Thành công**

```json
{
  "success": true,
  "data": <object | array | null>,
  "message": "Mô tả ngắn (tuỳ chọn)",
  "meta":  { "total": 123, "page": 1, "limit": 50, "pages": 3 }
}
```

`meta` chỉ xuất hiện ở các endpoint trả về danh sách phân trang.

**Lỗi**

```json
{
  "success": false,
  "message": "Mô tả ngắn cho người dùng",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": ["price: phải là số", "name: bắt buộc"]
  }
}
```

### 1.2 HTTP status code

| Mã  | Khi nào                                          |
| --- | ------------------------------------------------ |
| 200 | Thành công (GET / PUT / DELETE)                  |
| 201 | Tạo mới thành công                               |
| 204 | Thành công, không có body                        |
| 400 | Tham số / payload sai cú pháp                    |
| 401 | Thiếu / sai / hết hạn token                      |
| 403 | Vai trò không đủ quyền                           |
| 404 | Không tìm thấy tài nguyên                        |
| 409 | Xung đột (trùng username, vi phạm khoá ngoại)   |
| 413 | File upload quá lớn                              |
| 422 | Validation thất bại (dữ liệu hợp cú pháp nhưng sai logic) |
| 500 | Lỗi server                                       |

### 1.3 `error.code` chuẩn

```
BAD_REQUEST           – HTTP 400 chung
BAD_JSON              – body không phải JSON hợp lệ
BAD_PARAM             – tham số kiểu dữ liệu sai (PG 22P02)
UNAUTHORIZED          – chưa login / sai mật khẩu
INVALID_TOKEN         – JWT không hợp lệ
TOKEN_EXPIRED         – JWT hết hạn
FORBIDDEN             – không đủ vai trò
NOT_FOUND             – không tìm thấy
ROUTE_NOT_FOUND       – endpoint không tồn tại
CONFLICT              – xung đột chung (vd. username trùng)
DUPLICATE             – PG unique_violation 23505
FK_VIOLATION          – PG foreign_key_violation 23503
NOT_NULL_VIOLATION    – PG 23502
VALIDATION_ERROR      – dữ liệu sai logic
FILE_TOO_LARGE        – upload vượt giới hạn
UPLOAD_ERROR          – lỗi multer khác
INTERNAL_ERROR        – lỗi server không phân loại
NETWORK_ERROR         – (FE) không kết nối được server
```

### 1.4 Authentication

Tất cả endpoint (trừ `POST /auth/login`, `GET /api/health`) đều yêu cầu header:

```
Authorization: Bearer <jwt>
```

Token nhận sau khi login, hết hạn sau 12h (cấu hình `JWT_EXPIRES`).

### 1.5 Phân trang

Mọi endpoint trả danh sách hỗ trợ:

```
?page=1&limit=50
```

Mặc định: `page=1`, `limit=50`. Giới hạn tối đa: `200` (logs: `500`).

### 1.6 Filtering

Các tham số filter dùng query string, ví dụ: `?status=open&table_code=T1-01`.

### 1.7 Naming

* Trường JSON dùng `snake_case`: `full_name`, `payment_method`, `created_at`.
* Tiền: `numeric`, đơn vị VND, không có separator.
* Thời gian: ISO-8601 UTC: `2026-04-26T08:30:00.000Z`.

---

## 2. Endpoints

### 2.1 System

| Method + Path        | Auth | Mô tả                           |
| -------------------- | ---- | ------------------------------- |
| `GET /api/health`    | –    | Trả `{status:"ok", version, timestamp}` |

### 2.2 Auth (`/api/auth`)

| Method + Path            | Auth      | Body                                | Trả `data`                    |
| ------------------------ | --------- | ----------------------------------- | ----------------------------- |
| `POST /auth/login`       | –         | `{ username, password }`            | `{ token, user }`             |
| `GET  /auth/me`          | bất kỳ    | –                                   | `User`                        |
| `POST /auth/logout`      | bất kỳ    | –                                   | `null`                        |

### 2.3 Users (`/api/users`) – yêu cầu vai trò `admin`

| Method + Path                        | Body                                                                 | Trả                |
| ------------------------------------ | -------------------------------------------------------------------- | ------------------ |
| `GET  /users?page=&limit=`           | –                                                                    | `User[]` + `meta`  |
| `POST /users`                        | `{ username*, password*, full_name*, role*, email?, phone?, is_active? }` | `User`         |
| `PUT  /users/:id`                    | partial `User`                                                       | `User`             |
| `PUT  /users/:id/password`           | `{ password* }`                                                      | `User`             |
| `DELETE /users/:id`                  | –                                                                    | `User` đã xoá      |

`role` ∈ `{admin, cashier, waiter}`. Tự xoá chính mình → `409 CONFLICT`.

### 2.4 Menu (`/api/menu`)

| Method + Path                  | Auth   | Body / Query                                      | Trả                       |
| ------------------------------ | ------ | ------------------------------------------------- | ------------------------- |
| `GET  /menu/categories`        | bất kỳ | –                                                 | `Category[]`              |
| `GET  /menu`                   | bất kỳ | `?active=true|false&category=<code>&page=&limit=` | `MenuItem[]` + `meta`     |
| `GET  /menu/:id`               | bất kỳ | –                                                 | `MenuItem`                |
| `POST /menu`                   | admin  | multipart: `name*, price*, description?, category_id?, emoji?, image?` | `MenuItem` |
| `PUT  /menu/:id`               | admin  | multipart partial                                 | `MenuItem`                |
| `DELETE /menu/:id`             | admin  | –                                                 | `MenuItem` đã xoá         |

Image gửi qua field `image` (multipart). Giới hạn 5 MB.

### 2.5 Tables (`/api/tables`) – yêu cầu auth

| Method + Path             | Auth   | Body / Query                          | Trả                |
| ------------------------- | ------ | ------------------------------------- | ------------------ |
| `GET  /tables`            | bất kỳ | `?zone=&with_status=true&page=&limit=`| `Table[]` + `meta` |
| `POST /tables`            | admin  | `{ code*, zone*, capacity* }`         | `Table`            |
| `PUT  /tables/:id`        | admin  | partial                               | `Table`            |
| `DELETE /tables/:id`      | admin  | –                                     | `Table` đã xoá     |

`zone` ∈ `{indoor, outdoor, vip}`. Khi `with_status=true` mỗi bàn có thêm `{status:'empty'|'busy'|'pay', mins, order_status, check_in_time}`.

### 2.6 Orders (`/api/orders`) – yêu cầu auth

| Method + Path                       | Vai trò                | Body / Query                                                      | Trả          |
| ----------------------------------- | ---------------------- | ----------------------------------------------------------------- | ------------ |
| `GET    /orders`                    | bất kỳ                 | `?status=&table_code=&waiter_id=&page=&limit=`                    | `Order[]`+meta|
| `GET    /orders/by-table/:tableId`  | bất kỳ                 | –                                                                 | `Order|null` |
| `GET    /orders/:id`                | bất kỳ                 | –                                                                 | `Order`      |
| `POST   /orders`                    | waiter, admin          | xem **OrderCreate** ↓                                             | `Order`      |
| `POST   /orders/:id/items`          | waiter, cashier, admin | `{ items: OrderItem[] }` — thêm món vào đơn                      | `Order`      |
| `PUT    /orders/:id/items/:itemId`  | waiter, cashier, admin | `{ quantity?, notes? }` — sửa món                                 | `Order`      |
| `DELETE /orders/:id/items/:itemId`  | waiter, cashier, admin | – — xoá món                                                       | `Order`      |
| `PUT    /orders/:id/status`         | waiter, cashier, admin | `{ status: 'pending'|'serving'|'completed'|'cancelled' }`         | `Order`      |
| `DELETE /orders/:id`                | waiter, cashier, admin | –                                                                 | `Order`      |
| `POST   /orders/:id/checkout`       | cashier, admin         | xem **Checkout** ↓                                                | `Invoice`    |

**OrderCreate**

```json
{
  "table_id": 3,                    // ho¶c table_code
  "table_code": "T1-01",
  "waiter_name": "Nguyễn Văn A",
  "items": [
    { "menu_item_id": 12, "item_name": "Cà phê đen", "quantity": 2, "price": 25000, "notes": "ít đá" }
  ],
  "notes": "khách quen"
}
```

**Checkout**

```json
{
  "cashier_name": "Trần Thu Ngân",
  "discount": 0,
  "discount_note": null,
  "vat_rate": 8,
  "payment_method": "cash",
  "paid_amount": 500000
}
```

`payment_method` ∈ `{cash, card, transfer, online, grab, vnpay, banking, momo, zalopay}`.
`paid_amount` (tuỳ chọn) – số tiền khách trả; mặc định = `final_amount`. Trả thiếu → 400; thừa thì backend tự tính `change_amount`.

Response trả về `Invoice` chứa thêm:
- `paid_amount`   – số tiền khách trả
- `change_amount` – tiền thừa
- `check_in_time` / `check_out_time` – giờ vào / giờ ra

### 2.7 Invoices (`/api/invoices`) – yêu cầu vai trò `cashier` hoặc `admin`

| Method + Path                | Body / Query                                              | Trả                  |
| ---------------------------- | --------------------------------------------------------- | -------------------- |
| `GET  /invoices`             | `?table_code=&cashier_name=&from=&to=&page=&limit=`       | `Invoice[]` + `meta` |
| `GET  /invoices/:id`         | –                                                         | `Invoice`            |

### 2.8 Files (`/api/files`)

| Method + Path           | Auth   | Body                              | Trả          |
| ----------------------- | ------ | --------------------------------- | ------------ |
| `POST /files/upload`    | bất kỳ | multipart: `file*`, `prefix?`     | `{ key, url }` |

Tối đa 10 MB.

### 2.9 Stats (`/api/stats`) – yêu cầu vai trò `cashier` hoặc `admin`

| Method + Path                   | Query                              | Trả                                                                |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `GET  /stats/overview`          | `?from=&to=&cashier_id=`           | `{ summary, byHour, byPaymentMethod, topItems }` (kèm `meta` filter) |
| `GET  /stats/daily?days=14`     | `days` ∈ 1..90                     | `[{day, invoice_count, revenue}]`                                  |

### 2.10 Logs (`/api/logs`) – yêu cầu vai trò `admin`

| Method + Path                | Query                                                          | Trả               |
| ---------------------------- | -------------------------------------------------------------- | ----------------- |
| `GET  /logs`                 | `?from=&to=&action=&user_name=&page=&limit=` (limit ≤ 500)     | `Log[]` + `meta`  |

---

## 3. Mô hình dữ liệu (rút gọn)

```ts
User      = { id, username, full_name, role, email?, phone?, is_active, created_at }
Category  = { id, code, name, sort_order }
MenuItem  = { id, name, description, price, category_id, category_name?, emoji?, image_url?, image_key?, is_active, created_at }
Table     = { id, code, zone, capacity, is_active, created_at }
OrderItem = { id?, menu_item_id?, item_name, quantity, price, total_price, notes? }
Order     = { id, code, table_id, table_code, waiter_id?, waiter_name, status, total_amount, items: OrderItem[], notes?, created_at }
Invoice   = { id, code, order_id, table_code, cashier_id?, cashier_name, subtotal, discount, discount_note?, vat_rate, vat_amount, final_amount, payment_method, items: InvoiceItem[], created_at }
Log       = { id, user_id?, user_name?, action, entity, entity_id?, details?, ip?, created_at }
```

---

## 4. Ví dụ cURL

```bash
# 1) Login
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123"}' | jq

# 2) Danh sách menu (admin) — phân trang
curl -s "http://localhost:3000/api/menu?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq

# 3) Tạo bàn — sai dữ liệu để xem 422
curl -s -X POST http://localhost:3000/api/tables \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"code":"","zone":"foo","capacity":0}' | jq
# → 422  { error:{code:"VALIDATION_ERROR", details:[...]} }
```

---

## 5. Phiên bản

* **2.0** (2026-04-26) – chuẩn hoá envelope, error code, status code, phân trang, validation tập trung.
* **1.0** – phiên bản đầu (response không có `error.code`, một số endpoint trả `{}` thay vì `null`).
