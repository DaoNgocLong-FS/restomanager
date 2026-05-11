# RestoManager Web — React.js (v2)

Phiên bản web mới của RestoManager, viết lại bằng **React 18 + Vite + Tailwind CSS**, thay thế phần POS (vanilla JS) trước đây.

> Đây là kết quả của **đợt feedback từ giảng viên**: chuyển web từ vanilla JS sang React.js.

## 1. Mục đích & phạm vi

### Đã migrate sang React (folder này)

| Module | Trạng thái | Trang React |
|---|---|---|
| Đăng nhập | ✅ | `/login` |
| Sơ đồ bàn (cashier) + **menu chuyển/dọn/tắt bàn** | ✅ | `/cashier/tables` |
| Chi tiết bàn + sửa đơn + thanh toán | ✅ | `/cashier/detail/:code` |
| Danh sách đơn hôm nay | ✅ | `/cashier/orders` |
| Thống kê hôm nay | ✅ | `/cashier/stats` |
| Sơ đồ bàn (waiter) | ✅ | `/waiter/tables` |
| Gọi món (waiter) | ✅ | `/waiter/menu/:code` |
| Profile + Logout | ✅ | `/profile` |
| Realtime Socket.IO | ✅ | (hook `useSocket`) |
| Refresh-token tự động | ✅ | (`api/client.js`) |
| Toast + Confirm dialog (thay alert/confirm trình duyệt) | ✅ | `components/Toast`, `components/Confirm` |

### Chưa migrate (giữ nguyên vanilla)

- **Trang quản trị `admin.html`** — quản lý menu/bàn/users/giảm giá. Sẽ migrate ở sprint tiếp theo. Hiện tại admin vẫn truy cập trực tiếp `admin.html` từ backend.

## 2. Cấu trúc project

```
frontend-react/
├── package.json           # Vite + React 18 + Tailwind 3 + react-router-dom 6
├── vite.config.js         # proxy /api và /socket.io → backend :3000
├── tailwind.config.js     # palette giống bản cũ (primary #0d5c63, …)
├── postcss.config.js
├── index.html
└── src/
    ├── main.jsx           # entry — bọc <ToastProvider>, <ConfirmProvider>, <AuthProvider>
    ├── App.jsx            # router + protected routes theo role
    ├── index.css          # Tailwind + utility class .card .btn-primary .pill-busy …
    ├── api/
    │   └── client.js      # fetch + auth state machine (port từ js/api.js)
    ├── auth/
    │   ├── AuthContext.jsx
    │   └── LoginPage.jsx
    ├── components/
    │   ├── AppShell.jsx          # khung chung: topbar + bottom-nav theo role
    │   ├── Toast.jsx             # toast top-right, useToast()
    │   ├── Confirm.jsx           # modal Promise-based, useConfirm()
    │   └── TableContextMenu.jsx  # ⭐ menu nổi cho thao tác quản lý bàn
    ├── hooks/
    │   └── useSocket.js
    └── pages/
        ├── CashierTables.jsx     # ⭐ sơ đồ bàn + tích hợp TableContextMenu
        ├── CashierDetail.jsx     # chi tiết + thanh toán
        ├── CashierOrders.jsx
        ├── CashierStats.jsx
        ├── WaiterTables.jsx
        ├── WaiterMenu.jsx
        └── Profile.jsx
```

## 3. Cách chạy

### Yêu cầu
- Node.js ≥ 18
- Backend RestoManager đang chạy ở `http://localhost:3000`

### Dev mode (hot reload)
```bash
cd frontend-react
npm install
npm run dev
```
Mở http://localhost:5173 — Vite sẽ proxy `/api` và `/socket.io` sang backend.

### Build production
```bash
npm run build
```
Output ở `frontend-react/dist/`. Có thể serve bằng nginx hoặc bất cứ static server nào, đặt cùng host với backend để route `/api` trỏ đúng.

### Tài khoản test (giữ nguyên)
- `cashier` / `123` — thu ngân
- `waiter` / `123` — phục vụ
- `admin` / `123` — chuyển sang `admin.html`

## 4. Điểm nổi bật

### 4.1 TableContextMenu (giảng viên đã review phần này)

Component custom hook `useTableMenu()` cấp đầy đủ event handler:

```jsx
const menu = useTableMenu({ tablesById, onChanged: load });

return (
  <>
    <div onContextMenu={menu.onContextMenu}
         onTouchStart={menu.onTouchStart}
         onTouchEnd={menu.onTouchEnd}>
      {tables.map(t => (
        <TableCard key={t.id} t={t} data-table-id={t.code} />
      ))}
    </div>
    <menu.Element />
  </>
);
```

- **Right-click** trên desktop → mở menu tại con trỏ
- **Long-press 600ms** trên mobile → mở menu tại điểm chạm
- Tự đóng khi `Escape` hoặc click ngoài
- Action: chuyển bàn (chỉ liệt kê bàn trống), dọn bàn (xác nhận), bật/tắt bàn
- Role gating: chỉ admin + cashier mới mở được

### 4.2 UX không dùng `alert()` / `confirm()` trình duyệt

```jsx
const toast = useToast();
toast.ok('Đã chuyển bàn', 'Order chuyển sang T1-02');

const confirm = useConfirm();
const ok = await confirm({
  title: 'Dọn bàn T1-01?',
  message: '...',
  okText: 'Dọn bàn',
  danger: true,
});
if (!ok) return;
```

- Toast: stacking ở góc phải-trên, tự ẩn sau 2.8s, có icon + màu theo type.
- Confirm: modal căn giữa với animation pop-in, button danger riêng cho action phá huỷ.

### 4.3 Refresh-token tự động

`api/client.js` giữ nguyên cơ chế: gặp `401 + TOKEN_EXPIRED` → tự gọi `/auth/refresh` → retry request gốc. Không thấy interruption ở UI.

### 4.4 Realtime đa-event

Mỗi page đăng ký nhiều socket event qua `useSocket()` — auto cleanup khi unmount, dùng chung 1 socket singleton:

```jsx
useSocket({
  'tables:changed':  load,
  'orders:changed':  load,
  'order:created':   load,
  'order:updated':   load,
  'order:cancelled': load,
  'order:moved':     load,
  'invoice:created': load,
});
```

## 5. So sánh với bản vanilla

| Tiêu chí | `frontend/` (vanilla) | `frontend-react/` (React) |
|---|---|---|
| Dòng JS POS | ~1650 (pos.html) | ~2200 (chia 17 file module) |
| State management | Global biến + DOM update | React state + Context |
| Routing | Single-page-tabs đổi qua `data-page` | react-router-dom v6 |
| Component reuse | Copy-paste (chip, card, modal) | Component module hoá |
| Type checking | Không | Sẵn sàng cho TS (chỉ cần đổi đuôi + tsconfig) |
| Hot reload | Không | Có (Vite HMR) |
| Build size | 0KB (chạy thẳng) | ~150-200KB gzipped |

## 6. Triển khai song song

Trong giai đoạn chuyển tiếp, bạn có thể chạy **cả hai** bản:

- `frontend/` (vanilla) — vẫn được nginx serve ở `/`
- `frontend-react/dist/` — serve ở subpath khác, ví dụ `/v2/`

Thay vì cắt đột ngột, team có thể test React trong production trước khi retire bản cũ.

## 7. Roadmap

- [ ] Migrate `admin.html` (quản lý menu/users/giảm giá) sang React
- [ ] Thêm test (Vitest + React Testing Library)
- [ ] PWA: cache offline, install vào home screen
- [ ] i18n (vi-VN làm mặc định, có sẵn structure cho EN)
- [ ] Chuyển sang TypeScript

---

**Tác giả**: nhóm RestoManager — sprint feedback giảng viên (T2/2026)
