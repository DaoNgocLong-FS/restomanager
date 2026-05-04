# Test RestoManager API

Có 4 cách phổ biến, chọn cái hợp với bạn.

## 1. VSCode REST Client (đơn giản nhất, không cài thêm app)

1. Cài extension **REST Client** (humao.rest-client) trong VSCode.
2. Mở file `tests/requests.http`.
3. Bấm **Send Request** trên dòng `### Login admin` → response sẽ hiện ở panel bên cạnh.
4. Copy giá trị `token` từ response, dán vào dòng `@token = ...` ở đầu file (hoặc dùng `{{login.response.body.data.token}}` nếu IDE hỗ trợ named request).
5. Tiếp tục Send các request khác.

## 2. Bash + cURL (terminal)

```bash
cd tests
# Sửa biến API nếu backend không chạy ở localhost:3000
API=http://localhost:3000/api ./curl-examples.sh
```

Script tự động: login admin → /auth/me → list tables → list menu → refresh token → login waiter → tạo đơn → login cashier → checkout → stats.

Yêu cầu `jq` để format JSON. Cài: `sudo apt install jq` (Linux) hoặc `brew install jq` (Mac).

## 3. Postman / Bruno / Insomnia

- Postman: import file `tests/RestoManager.postman_collection.json`.
  - Chạy "Login admin" trước → script test sẽ tự lưu `{{token}}` và `{{refresh}}` vào collection variables.
  - Các request sau dùng `Bearer {{token}}` luôn.
- Bruno: tương tự, import collection JSON.

## 4. Trình duyệt / DevTools (cho GET nhanh)

- GET `/api/health` mở thẳng trên trình duyệt: <http://localhost:3000/api/health>.
- Các endpoint cần auth: dùng DevTools → tab Network → Copy as fetch sau khi đăng nhập POS.

## Test realtime (Socket.IO)

Mở 2 tab `http://localhost:8080/pos.html` → đăng nhập 2 role khác nhau (waiter/cashier). Khi waiter tạo đơn, tab cashier sẽ tự cập nhật < 1 s. Có thể quan sát event qua DevTools → Network → tab WS → click vào `/socket.io/?...` → tab Messages.

Hoặc test bằng `wscat`:

```bash
npm i -g wscat
TOKEN=...   # access token từ login
wscat -c "ws://localhost:3000/socket.io/?EIO=4&transport=websocket" \
      -H "Authorization: Bearer $TOKEN"
```

## Test refresh-token flow

Cách nhanh nhất: đặt access token TTL ngắn rồi xem API client tự refresh.

```bash
# Trong .env của backend
JWT_EXPIRES=30s
docker compose restart backend
```

- Đăng nhập web POS → để yên 1 phút → reload trang Bàn → vẫn chạy bình thường (interceptor đã refresh).
- DevTools → Network sẽ thấy 1 request 401 TOKEN_EXPIRED → 1 POST /auth/refresh → request gốc retry 200.

## Smoke test 1 dòng

```bash
curl -fsS http://localhost:3000/api/health && echo "OK"
```

Nếu in `OK` là backend còn sống.

## 5. Swagger UI (đã tích hợp sẵn — khuyên dùng cho test thủ công)

Backend đã mount `swagger-ui-express` tại **`/api/docs`**. Mở trực tiếp trong trình duyệt:

- Khi chạy qua Docker Compose: <http://localhost:8080/api/docs> (Nginx proxy)
- Khi chạy backend trần: <http://localhost:3000/api/docs>

Cách test:

1. Bấm **Authorize** (góc trên-phải) → nhập `Bearer <access_token>` (lấy từ POST /auth/login).
2. Bấm vào endpoint cần thử → **Try it out** → điền body → **Execute**.
3. Swagger sẽ hiển thị curl tương đương, request URL, response, headers, code.

Spec gốc cũng được expose tại **`/api/openapi.json`** — có thể nhập vào Postman/Bruno để generate collection tự động.

> Mẹo: bật `persistAuthorization` đã được set sẵn — token vẫn còn sau khi reload trang.
