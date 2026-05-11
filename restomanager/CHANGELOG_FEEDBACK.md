# CHANGELOG — Phản hồi giảng viên (sprint T2/2026)

## Yêu cầu giảng viên

> 1. Web phải migrate sang React.js
> 2. App phải dùng SafeAreaView của Expo
> 3. Không nên dùng Alert (UI/UX kém)

## Đã thực hiện

### 1. Web migrate sang React.js → `frontend-react/`

Folder mới `frontend-react/` chứa app React 18 + Vite + Tailwind đầy đủ:

- **Setup**: Vite + React 18 + Tailwind 3 + react-router-dom 6 + socket.io-client 4 + lucide-react
- **17 file module** (so với 1 file `pos.html` 1650 dòng cũ)
- **Đã migrate**:
  - Đăng nhập (`/login`)
  - POS thu ngân: sơ đồ bàn + chi tiết bàn + thanh toán (`/cashier/...`)
  - POS waiter: sơ đồ bàn + gọi món (`/waiter/...`)
  - Đơn hôm nay, thống kê, profile
  - **Menu chuyển/dọn/tắt bàn** (right-click trên desktop, long-press trên mobile) — phần giảng viên đã review
- **Chưa migrate**: `admin.html` (quản lý menu/users) — sprint sau, hiện vẫn chạy bản vanilla
- **Cách chạy**:
  ```bash
  cd frontend-react
  npm install
  npm run dev   # http://localhost:5173
  ```
  Vite proxy tự forward `/api` và `/socket.io` sang backend `:3000`.
- Tham khảo `frontend-react/README.md` để biết chi tiết cấu trúc, routes, component.

### 2. App dùng SafeAreaView của Expo

Đã wrap **8/8 screens** với `SafeAreaView` từ `react-native-safe-area-context` (đây là phiên bản chính thức được Expo khuyến nghị, tốt hơn `SafeAreaView` của `react-native` core):

| Screen | edges | Lý do |
|---|---|---|
| `LoginScreen` | `['top','bottom']` | Không có header, full-screen brand layout |
| `TablesScreen` | `['top']` | Tab screen, bottom tab-bar tự xử lý |
| `OrdersScreen` | `['top']` | Tab screen |
| `ProfileScreen` | `['top']` | Tab screen |
| `MenuScreen` | `['bottom']` | Stack screen có header, cần safe area cho FAB cart |
| `DetailScreen` | `['bottom']` | Stack screen có header, cần safe area cho footer thanh toán |
| `PaymentScreen` | `['bottom']` | Stack screen có sticky bottom |
| `SettingsScreen` | `['bottom']` | Stack screen với form |

Cấu trúc đã có sẵn `SafeAreaProvider` ở `App.js` (root), nay từng screen dùng `SafeAreaView` đúng vị trí và đúng `edges` phù hợp với navigation context.

### 3. Không dùng Alert nữa → Toast + ConfirmDialog tự xây

Đã thay **toàn bộ** `Alert.alert(...)` bằng 2 component custom:

#### `mobile/src/components/Notify.js`
- `toast.ok(title, message?)` / `toast.info(...)` / `toast.err(...)` — dùng `react-native-toast-message`, có icon + màu phân loại, animation, tự ẩn 2.4s, không chặn UI
- `useConfirm()` hook trả về function Promise-based:
  ```js
  const confirm = useConfirm();
  const ok = await confirm({
    title: 'Dọn bàn?',
    message: '...',
    okText: 'Dọn bàn',
    danger: true,    // → button đỏ
  });
  if (!ok) return;
  ```
  Modal có animation slide + fade, button danger màu đỏ riêng, dùng được bất cứ đâu trong cây component.
- Wire vào `App.js`: bọc trong `<ConfirmProvider>`, render `<ConfirmBridge />` + `<ToastHost />` ở root.

#### Số lượng `Alert.alert` còn lại trong `mobile/src/`:
```
$ grep -rn "Alert\.alert" mobile/src/ | grep -v "//"
(không có dòng nào — chỉ còn trong comment giải thích)
```

#### Bên web React (`frontend-react/src/components/`)
- `Toast.jsx` — `useToast()` hook, render top-right
- `Confirm.jsx` — `useConfirm()` hook, modal Promise-based với button danger
- Không dùng `window.alert` / `window.confirm` ở bất cứ đâu trong web React

## Kiểm tra nhanh

```bash
# Mobile
cd mobile
grep -rn "Alert.alert" src/                # 0 dòng (ngoài comment)
grep -l "SafeAreaView" src/screens/        # 8/8 screen có SafeAreaView

# Web React
cd ../frontend-react
ls src/                                    # api, auth, components, hooks, pages
npm install && npm run dev                  # http://localhost:5173
```

---
**Tác giả**: nhóm RestoManager
**Ngày**: T2/2026
