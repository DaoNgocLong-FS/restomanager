// =============================================================================
//  CashierDetail — chi tiết bàn cho thu ngân
//  - Xem order đang mở, sửa số lượng, xoá món
//  - Thanh toán: chọn phương thức + nhập tiền + xác nhận
//  - Realtime: cập nhật khi waiter thêm món
// =============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Minus, Trash2, ArrowLeft, ChevronRight, X,
         CreditCard, Banknote, QrCode, ScanLine } from 'lucide-react';
import { Api, fmt } from '../api/client';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { useSocket } from '../hooks/useSocket';

const VAT_RATE = 0.08;
const PAY_METHODS = [
  { key: 'cash',     label: 'Tiền mặt',     icon: Banknote },
  { key: 'transfer', label: 'Chuyển khoản', icon: QrCode },
  { key: 'card',     label: 'Quẹt thẻ',     icon: CreditCard },
  { key: 'vnpay',    label: 'VietQR Pro',   icon: ScanLine },
];

export default function CashierDetail() {
  const { code } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [table, setTable] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tables = await Api.listTables({ with_status: 'true' });
      const t = tables.find(x => x.code === code);
      if (!t) {
        toast.err('Không tìm thấy bàn', `Bàn ${code} không tồn tại`);
        navigate('/cashier/tables');
        return;
      }
      setTable(t);
      try {
        const o = await Api.getOpenOrderForTable(t.id);
        setOrder(o);
      } catch { setOrder(null); }
    } catch (e) {
      toast.err('Lỗi tải dữ liệu', e.message);
    } finally { setLoading(false); }
  }, [code, navigate, toast]);

  useEffect(() => { load(); }, [load]);
  useSocket({
    'orders:changed':  load,
    'order:updated':   load,
    'order:created':   load,
    'order:cancelled': load,
    'invoice:created': () => navigate('/cashier/tables'),
    'tables:changed':  load,
  });

  const items = order?.items || [];
  const sub   = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const vat   = Math.round(sub * VAT_RATE);
  const total = sub + vat;

  const inc = async (it) => {
    try { await Api.updateOrderItem(order.id, it.id, { quantity: it.quantity + 1 }); load(); }
    catch (e) { toast.err('Không tăng được', e.message); }
  };
  const dec = async (it) => {
    try {
      if (it.quantity <= 1) await Api.removeOrderItem(order.id, it.id);
      else await Api.updateOrderItem(order.id, it.id, { quantity: it.quantity - 1 });
      load();
    } catch (e) { toast.err('Không giảm được', e.message); }
  };
  const del = async (it) => {
    const ok = await confirm({
      title: `Xoá "${it.item_name}"?`,
      message: 'Món sẽ bị gỡ khỏi đơn.',
      okText: 'Xoá', danger: true,
    });
    if (!ok) return;
    try { await Api.removeOrderItem(order.id, it.id); load(); toast.ok('Đã xoá món'); }
    catch (e) { toast.err('Lỗi xoá món', e.message); }
  };

  if (loading && !table) {
    return <div className="p-8 text-center text-muted">Đang tải…</div>;
  }
  if (!table) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      <button onClick={() => navigate('/cashier/tables')}
        className="flex items-center gap-1 text-sm text-muted hover:text-on-surface mb-3">
        <ArrowLeft className="w-4 h-4" /> Quay lại sơ đồ bàn
      </button>

      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Bàn {table.code}</h1>
            <p className="text-sm text-muted">{table.zone || '–'} · {table.capacity || '?'} chỗ</p>
          </div>
          <span className={
            'px-3 py-1 rounded-full text-xs font-bold uppercase ' +
            (table.status === 'busy' ? 'pill-busy' : table.status === 'pay' ? 'pill-pay' : 'pill-empty')
          }>{table.status || 'empty'}</span>
        </div>
      </div>

      {!order || items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-muted mb-4">Bàn chưa có món nào.</p>
          <button onClick={() => navigate('/waiter/menu/' + encodeURIComponent(table.code))}
            className="btn-primary">
            <Plus className="w-4 h-4" /> Thêm món
          </button>
        </div>
      ) : (
        <>
          <button onClick={() => navigate('/waiter/menu/' + encodeURIComponent(table.code))}
            className="btn-primary w-full mb-3">
            <Plus className="w-4 h-4" /> Thêm món vào đơn
          </button>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 bg-surface-low border-b border-border-soft flex justify-between items-center">
              <span className="text-xs font-mono font-bold text-on-surface-variant">{order.code}</span>
              <span className="text-xs text-muted">
                {new Date(order.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {items.map((it, idx) => (
              <div key={it.id}
                className={'px-4 py-3 flex items-center gap-3 ' + (idx > 0 ? 'border-t border-border-soft' : '')}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-on-surface truncate">{it.item_name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {fmt(it.price)} × {it.quantity} = <span className="text-primary font-bold">{fmt(Number(it.price) * it.quantity)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <IconBtn onClick={() => dec(it)} aria="Giảm"><Minus className="w-4 h-4" /></IconBtn>
                  <span className="w-7 text-center font-bold">{it.quantity}</span>
                  <IconBtn onClick={() => inc(it)} aria="Tăng" primary><Plus className="w-4 h-4" /></IconBtn>
                  <IconBtn onClick={() => del(it)} aria="Xoá" danger><Trash2 className="w-4 h-4" /></IconBtn>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="card p-4 mt-4">
            <Row label="Tạm tính" value={fmt(sub)} />
            <Row label="VAT (8%)" value={fmt(vat)} />
            <Row label="Tổng cộng" value={fmt(total)} bold big />
            <button onClick={() => setShowCheckout(true)}
              className="btn-primary w-full mt-3 h-12 text-base">
              Thanh toán <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {showCheckout && (
        <CheckoutModal
          table={table} order={order} sub={sub} vat={vat} total={total}
          onClose={() => setShowCheckout(false)}
          onDone={() => { setShowCheckout(false); navigate('/cashier/tables'); }}
        />
      )}
    </div>
  );
}

function IconBtn({ children, onClick, aria, primary, danger }) {
  return (
    <button onClick={onClick} aria-label={aria}
      className={
        'w-8 h-8 rounded-full flex items-center justify-center transition ' +
        (primary ? 'bg-primary text-white hover:bg-primary-dark'
         : danger ? 'bg-red-50 text-red-600 hover:bg-red-100'
         : 'bg-surface-container text-on-surface hover:bg-surface-high')
      }>{children}</button>
  );
}

function Row({ label, value, bold, big }) {
  return (
    <div className={'flex justify-between py-1 ' + (bold ? 'border-t border-border-soft pt-2 mt-1' : '')}>
      <span className={(bold ? 'font-bold' : 'text-muted text-sm')}>{label}</span>
      <span className={(bold ? 'font-bold ' : '') + (big ? 'text-lg text-primary' : '')}>{value}</span>
    </div>
  );
}

// ─── Checkout modal ───────────────────────────────────────────────────────
function CheckoutModal({ table, order, sub, vat, total, onClose, onDone }) {
  const [method, setMethod] = useState('cash');
  const [paid, setPaid] = useState(String(total));
  const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const toast = useToast();

  const paidNum = Number(paid) || 0;
  const change = Math.max(0, paidNum - total);
  const quickAmounts = useMemo(
    () => [total, total + 5000, total + 10000, total + 50000, total + 100000, total + 200000],
    [total]
  );

  const onConfirm = async () => {
    if (paidNum < total) {
      toast.info('Khách trả chưa đủ', `Còn thiếu ${fmt(total - paidNum)}`);
      return;
    }
    setBusy(true);
    try {
      const inv = await Api.checkout(order.id, {
        cashier_name: 'Thu ngân',
        payment_method: method,
        vat_rate: 8,
        discount: 0,
        paid_amount: paidNum,
      });
      setInvoice(inv);
      toast.ok('Thanh toán thành công', `Hoá đơn ${inv?.code || ''}`);
    } catch (e) {
      toast.err('Thanh toán thất bại', e.message);
    } finally { setBusy(false); }
  };

  if (invoice) {
    // Receipt view
    return (
      <Modal onClose={onDone} title="Hoá đơn đã lưu" subtitle={invoice.code}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <KV k="Bàn" v={invoice.table_code} />
            <KV k="Thu ngân" v={invoice.cashier_name} />
            <KV k="PT" v={invoice.payment_method} />
            <KV k="Lúc" v={invoice.check_out_time && new Date(invoice.check_out_time).toLocaleString('vi-VN')} />
          </div>
          <div className="border-t border-border-soft pt-2 space-y-1">
            {(invoice.items || []).map((i, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="flex-1 truncate">{i.item_name}</span>
                <span className="text-muted mx-2">×{i.quantity}</span>
                <span className="font-bold">{fmt(i.total_price)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border-soft pt-2">
            <Row label="Tạm tính" value={fmt(invoice.total_amount)} />
            <Row label="VAT" value={fmt(invoice.vat_amount)} />
            <Row label="Tổng" value={fmt(invoice.final_amount)} bold big />
            <Row label="Khách trả" value={fmt(invoice.paid_amount ?? invoice.final_amount)} />
            <div className="flex justify-between text-sm pt-1">
              <span className="text-muted">Tiền thừa</span>
              <span className="font-bold text-success">{fmt(invoice.change_amount ?? 0)}</span>
            </div>
          </div>
          <button onClick={onDone} className="btn-primary w-full mt-2">Hoàn tất</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title={`Thanh toán bàn ${table.code}`}>
      <div className="space-y-4">
        <div className="card p-3">
          <Row label="Tạm tính" value={fmt(sub)} />
          <Row label="VAT (8%)" value={fmt(vat)} />
          <Row label="Cần thanh toán" value={fmt(total)} bold big />
        </div>

        <div>
          <div className="text-xs font-semibold text-on-surface-variant mb-2">Phương thức</div>
          <div className="grid grid-cols-2 gap-2">
            {PAY_METHODS.map(m => (
              <button key={m.key} onClick={() => setMethod(m.key)}
                className={
                  'flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition ' +
                  (method === m.key
                    ? 'border-primary bg-primary-container text-primary'
                    : 'border-border bg-white text-on-surface-variant hover:border-primary/50')
                }>
                <m.icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-on-surface-variant mb-2">Khách trả</div>
          <input type="number" inputMode="numeric" className="field text-right text-2xl font-bold text-primary"
            value={paid} onChange={(e) => setPaid(e.target.value)} />
          <div className="grid grid-cols-3 gap-2 mt-2">
            {quickAmounts.map(v => (
              <button key={v} onClick={() => setPaid(String(v))}
                className="px-2 py-2 rounded-lg bg-surface-low border border-border text-xs font-semibold hover:bg-surface-container">
                {fmt(v)}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-3 px-3 py-2 bg-secondary-container rounded-xl">
            <span className="text-sm text-muted">Tiền thừa</span>
            <span className="font-bold text-secondary">{fmt(change)}</span>
          </div>
        </div>

        <button onClick={onConfirm} disabled={busy}
          className="btn-primary w-full h-12 text-base">
          {busy ? 'Đang xử lý…' : 'Xác nhận thanh toán'}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ onClose, title, subtitle, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-border-soft px-4 py-3 flex items-start justify-between">
          <div>
            <div className="font-bold text-on-surface">{title}</div>
            {subtitle && <div className="text-xs text-muted mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="text-muted hover:text-on-surface" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold text-muted">{k}</div>
      <div className="text-sm font-semibold text-on-surface mt-0.5">{v || '–'}</div>
    </div>
  );
}
