// =============================================================================
//  AdminInvoices — danh sách hoá đơn + modal chi tiết + in hoá đơn
//  Realtime: tự refresh khi có hoá đơn mới (invoice:created).
// =============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Printer } from 'lucide-react';
import { Api, fmt } from '../api/client';
import { useToast } from '../components/Toast';
import { useSocket } from '../hooks/useSocket';
import Modal from '../components/Modal';

const PAY_LABEL = {
  cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản',
  online: 'Bán online', grab: 'Grab', vnpay: 'VietQR', banking: 'Banking',
  momo: 'MoMo', zalopay: 'ZaloPay',
};
const dt = (s) => s ? new Date(s).toLocaleString('vi-VN') : '—';

export default function AdminInvoices() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);   // invoice object
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await Api.listInvoices() || []); }
    catch (e) { toast.err('Không tải được hoá đơn', e.message); }
    finally   { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useSocket({ 'invoice:created': load });

  const openDetail = async (id) => {
    try { setDetail(await Api.getInvoice(id)); }
    catch (e) { toast.err('Không lấy được chi tiết', e.message); }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Hoá đơn</h1>
          <p className="text-sm text-muted">Tra cứu và xem chi tiết hoá đơn đã thanh toán.</p>
        </div>
        <button onClick={load} className="btn-ghost text-sm py-2" disabled={loading}>
          <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
          Làm mới
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-low text-muted">
              <tr>
                <th className="px-4 py-3 text-left">Mã HĐ</th>
                <th className="px-4 py-3 text-left">Bàn</th>
                <th className="px-4 py-3 text-left">Thu ngân</th>
                <th className="px-4 py-3 text-right">Tạm tính</th>
                <th className="px-4 py-3 text-right">VAT</th>
                <th className="px-4 py-3 text-right">Tổng</th>
                <th className="px-4 py-3 text-left">PT TT</th>
                <th className="px-4 py-3 text-left">Lúc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {loading ? (
                <tr><td colSpan={8} className="text-center text-muted py-8">Đang tải…</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-muted py-8">Chưa có hoá đơn nào.</td></tr>
              ) : list.map(v => (
                <tr
                  key={v.id}
                  onClick={() => openDetail(v.id)}
                  className="cursor-pointer hover:bg-surface-low transition"
                >
                  <td className="px-4 py-3 font-mono text-xs text-primary">{v.code}</td>
                  <td className="px-4 py-3 text-on-surface">{v.table_code || '—'}</td>
                  <td className="px-4 py-3 text-on-surface">{v.cashier_name || '—'}</td>
                  <td className="px-4 py-3 text-right text-on-surface">{fmt(v.total_amount)}</td>
                  <td className="px-4 py-3 text-right text-muted">{fmt(v.vat_amount)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">{fmt(v.final_amount)}</td>
                  <td className="px-4 py-3 text-on-surface">{PAY_LABEL[v.payment_method] || v.payment_method || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted">{dt(v.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!detail}
        title="Chi tiết hoá đơn"
        onClose={() => setDetail(null)}
        size="xl"
        footer={
          <>
            <button className="btn-ghost text-sm py-2" onClick={() => setDetail(null)}>Đóng</button>
            <button className="btn-primary text-sm py-2" onClick={() => printInvoice(detail)}>
              <Printer className="w-4 h-4" /> In hoá đơn
            </button>
          </>
        }
      >
        {detail && <InvoiceDetail inv={detail} />}
      </Modal>
    </div>
  );
}

function InvoiceDetail({ inv }) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-mono text-muted">{inv.code}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <Cell label="Bàn"          value={inv.table_code || '—'} bold />
        <Cell label="Thu ngân"     value={inv.cashier_name || '—'} />
        <Cell label="Phục vụ"      value={inv.waiter_name || '—'} />
        <Cell label="PT thanh toán" value={PAY_LABEL[inv.payment_method] || inv.payment_method || '—'} primary />
        <Cell label="Giờ vào"      value={dt(inv.check_in_time)}  small />
        <Cell label="Giờ ra"       value={dt(inv.check_out_time)} small />
      </div>

      <div>
        <h4 className="font-semibold text-on-surface mb-2">Danh sách món</h4>
        <table className="w-full text-sm border border-border-soft rounded-lg overflow-hidden">
          <thead className="bg-surface-low text-muted text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Món</th>
              <th className="px-3 py-2 text-right">SL</th>
              <th className="px-3 py-2 text-right">Đơn giá</th>
              <th className="px-3 py-2 text-right">Thành tiền</th>
              <th className="px-3 py-2 text-left">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {(inv.items || []).length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-muted">Không có món.</td></tr>
            ) : inv.items.map((it, i) => (
              <tr key={i}>
                <td className="px-3 py-2">{it.item_name}</td>
                <td className="px-3 py-2 text-right">{it.quantity}</td>
                <td className="px-3 py-2 text-right">{fmt(it.price)}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmt(it.total_price)}</td>
                <td className="px-3 py-2 text-xs text-muted">{it.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm bg-surface-low rounded-lg p-4">
        <Row label="Tạm tính"  value={fmt(inv.total_amount)} />
        <Row label="Giảm giá"  value={fmt(inv.discount)} />
        <Row label={`VAT (${Number(inv.vat_rate ?? 8)}%)`} value={fmt(inv.vat_amount)} />
        <div className="col-span-2 flex justify-between border-t border-border pt-1 mt-1 font-bold text-base">
          <span>Tổng cộng</span>
          <span className="text-primary">{fmt(inv.final_amount)}</span>
        </div>
        <Row label="Khách trả"  value={fmt(inv.paid_amount ?? inv.final_amount)} small />
        <Row label="Tiền thừa"  value={fmt(inv.change_amount ?? 0)} small emerald />
      </div>
    </div>
  );
}

function Cell({ label, value, bold, primary, small }) {
  return (
    <div className="bg-surface-low p-3 rounded-lg">
      <div className="text-xs text-muted uppercase">{label}</div>
      <div className={
        'mt-0.5 ' +
        (small ? 'text-xs ' : '') +
        (bold ? 'font-bold ' : 'font-semibold ') +
        (primary ? 'text-primary' : 'text-on-surface')
      }>{value}</div>
    </div>
  );
}
function Row({ label, value, small, emerald }) {
  return (
    <div className="flex justify-between">
      <span className={'text-muted ' + (small ? 'text-xs' : '')}>{label}</span>
      <span className={
        'font-semibold ' + (small ? 'text-xs ' : '') +
        (emerald ? 'text-success' : '')
      }>{value}</span>
    </div>
  );
}

// In hoá đơn: mở cửa sổ mới, tự gọi window.print
function printInvoice(inv) {
  if (!inv) return;
  const rows = (inv.items || []).map(i =>
    `<tr><td>${escapeHtml(i.item_name)}</td><td class="r">${i.quantity}</td>` +
    `<td class="r">${fmt(i.price)}</td><td class="r">${fmt(i.total_price)}</td></tr>`
  ).join('');
  const w = window.open('', '_blank', 'width=420,height=720');
  if (!w) { alert('Trình duyệt chặn cửa sổ in'); return; }
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Hoá đơn ${escapeHtml(inv.code || '')}</title>
<style>
body{font-family:Arial,sans-serif;padding:20px;color:#111;font-size:13px}
h1{font-size:18px;margin:0 0 8px;text-align:center}
.meta p{margin:2px 0;font-size:12px}
table{width:100%;border-collapse:collapse;margin-top:10px}
th,td{border-bottom:1px dashed #ccc;padding:5px 4px;font-size:12px}
th{background:#f5f5f5;text-align:left}
.r{text-align:right}.summary{margin-top:10px;font-size:13px}
.summary div{display:flex;justify-content:space-between;margin:3px 0}
.summary .total{font-weight:bold;font-size:15px;border-top:1px solid #000;padding-top:6px;margin-top:6px}
.footer{margin-top:18px;text-align:center;font-size:11px;color:#666}
</style></head><body>
<h1>HOÁ ĐƠN THANH TOÁN</h1>
<div class="meta">
<p><b>Mã HĐ:</b> ${escapeHtml(inv.code || '')}</p>
<p><b>Bàn:</b> ${escapeHtml(inv.table_code || '')}</p>
<p><b>Thu ngân:</b> ${escapeHtml(inv.cashier_name || '')}</p>
<p><b>Giờ vào:</b> ${inv.check_in_time ? new Date(inv.check_in_time).toLocaleString('vi-VN') : '–'}</p>
<p><b>Giờ ra:</b> ${inv.check_out_time ? new Date(inv.check_out_time).toLocaleString('vi-VN') : '–'}</p>
<p><b>PT thanh toán:</b> ${escapeHtml(PAY_LABEL[inv.payment_method] || inv.payment_method || '')}</p>
</div>
<table><thead><tr><th>Món</th><th class="r">SL</th><th class="r">Đơn giá</th><th class="r">TT</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="summary">
<div><span>Tạm tính</span><span>${fmt(inv.total_amount)}</span></div>
<div><span>VAT (${Number(inv.vat_rate ?? 8)}%)</span><span>${fmt(inv.vat_amount)}</span></div>
<div class="total"><span>Tổng cộng</span><span>${fmt(inv.final_amount)}</span></div>
<div><span>Khách trả</span><span>${fmt(inv.paid_amount ?? inv.final_amount)}</span></div>
<div><span>Tiền thừa</span><span>${fmt(inv.change_amount ?? 0)}</span></div>
</div>
<div class="footer">Cảm ơn quý khách!</div>
<scr` + `ipt>window.onload=()=>setTimeout(()=>window.print(),250);</scr` + `ipt>
</body></html>`;
  w.document.open(); w.document.write(html); w.document.close(); w.focus();
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
