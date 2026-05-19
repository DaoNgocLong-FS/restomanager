# RestoManager – Mobile (Expo / React Native)

Ứng dụng mobile cho hệ thống RestoManager. Gọi cùng REST API với phiên bản web → **mọi thay đổi đồng bộ thời gian thực** (refresh là thấy).

Ứng dụng tập trung cho **waiter** (nhân viên phục vụ) và **cashier** (thu ngân). Tài khoản **admin** nên dùng phiên bản web.

---

## 📦 Yêu cầu

* Node.js ≥ 18
* npm hoặc yarn
* App **Expo Go** trên điện thoại (Android: Google Play, iOS: App Store) – để chạy thử.
* Backend RestoManager đã chạy (qua `docker compose up -d`), nghe ở `http://<IP-LAN>:3000`.
* Điện thoại và máy chạy backend phải **cùng mạng Wi-Fi**.

---

## 🚀 Chạy thử nhanh (dev)

```bash
cd mobile
npm install
npx expo install --fix       # tự đồng bộ version các package với SDK 54 (an toàn, nên chạy)
npm start
```

> ⚙️ **SDK 54** — phiên bản Expo Go mới nhất. Nếu app Expo Go của bạn báo SDK khác, dùng `npx expo install expo@~<major>.0.0` rồi `--fix` lại. SDK càng mới thì các điện thoại càng có thể cần cập nhật Expo Go từ App Store / Play Store.

Sau khi `npm start`, terminal hiện một mã QR. Mở **Expo Go** trên điện thoại quét mã đó là app sẽ chạy.

Lần đầu mở app, màn hình **Cấu hình server** sẽ xuất hiện. Nhập:

```
http://<IP-LAN-CỦA-MÁY-CHỦ>:3000/api
```

Ví dụ: `http://192.168.1.10:3000/api`. Nhấn **Lưu & Kiểm tra** — nếu OK app sẽ chuyển sang đăng nhập.

> 💡 Tìm IP-LAN: `ipconfig` (Windows) / `ifconfig` (Mac/Linux) — lấy địa chỉ kiểu `192.168.x.x`.

### Tài khoản mẫu

| Username  | Mật khẩu | Vai trò                |
| --------- | -------- | ---------------------- |
| `waiter`  | `123`    | Nhân viên phục vụ      |
| `cashier` | `123`    | Thu ngân               |

(Tài khoản `admin / 123` đăng nhập được nhưng app sẽ nhắc nên dùng web.)

---

## 🧭 Cấu trúc

```
mobile/
├── App.js                   # Stack + Tab navigation
├── package.json
├── app.json                 # Expo config
├── babel.config.js
└── src/
    ├── api.js               # Client REST + AsyncStorage cho token / config
    ├── AuthContext.js       # Auth state toàn cục
    ├── theme.js             # Bảng màu + helpers
    └── screens/
        ├── SettingsScreen.js   # cấu hình URL server
        ├── LoginScreen.js
        ├── TablesScreen.js     # sơ đồ bàn (waiter & cashier)
        ├── MenuScreen.js       # gọi món / thêm món
        ├── DetailScreen.js     # cashier xem & sửa đơn
        ├── PaymentScreen.js    # thanh toán + receipt modal
        ├── OrdersScreen.js     # đơn của tôi / hôm nay
        └── ProfileScreen.js    # KPI + cài đặt + logout
```

---

## ✨ Tính năng

### Waiter
* Sơ đồ bàn với badge trạng thái (Trống / Có khách / Chờ TT).
* Tap bàn → mở menu → cộng/trừ số lượng → gửi đơn.
* Nếu bàn đã có đơn mở, app **tự động phát hiện** và **append** thay vì tạo đơn mới.
* Tab "Đơn hàng" xem các đơn của mình.

### Cashier
* Sơ đồ bàn (xem trạng thái cập nhật).
* Tap bàn → xem chi tiết đơn → **sửa từng món**: tăng/giảm/xoá, thêm món mới (mở lại MenuScreen với mode append).
* Thanh toán: chọn 1 trong **6 phương thức** (Tiền mặt / Chuyển khoản / Quẹt thẻ / VietQR Pro / Banking / MoMo), keypad số nhập "Khách trả", **tự tính tiền thừa**, quick amounts gợi ý.
* Receipt modal hiện hoá đơn vừa lập, có thể đọc lại trên tab "Đơn hàng".
* Tab "Đơn hàng" có 2 tab con: **Đang mở** + **Đã TT hôm nay**.
* Tab "Cá nhân" hiện KPI hôm nay (doanh thu, số HĐ, theo phương thức TT).

### Chung
* Token JWT lưu vào AsyncStorage — đăng nhập 1 lần dùng nhiều lần.
* Pull-to-refresh trên mọi danh sách.
* Tự động đăng xuất khi token hết hạn.
* Có thể đổi server URL bất cứ lúc nào (Tab Cá nhân → Server).

---

## 📱 Build APK / IPA

Để build app cài độc lập (không cần Expo Go):

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview      # APK
eas build -p ios     --profile preview      # IPA (cần Apple Developer)
```

(Sửa `app.json` đổi `bundleIdentifier` / `package` thành tên domain của bạn trước khi build production.)

---

## 🔌 Liên kết với web

App và web chia sẻ:

* Cùng REST API (`/api/*`) — token, dữ liệu, log đều chung.
* Cùng database PostgreSQL → bàn, menu, đơn, hoá đơn được đồng bộ.
* Cùng MinIO → ảnh món hiển thị giống nhau.

Mọi thao tác trên app đều xuất hiện ngay khi web `Refresh` (và ngược lại).

---

## ⚠️ Khắc phục sự cố

* **"Không kết nối được server"**: kiểm tra IP-LAN; chắc chắn 2 thiết bị cùng Wi-Fi; kiểm tra firewall không chặn cổng 3000.
* **"Token hết hạn"**: đăng nhập lại — token mặc định 12 giờ.
* **App không load được**: thử `npm start -- --clear` để xoá cache Metro.
* **Lỗi Expo SDK version mismatch**: chạy `npx expo install --fix` để đồng bộ version.
