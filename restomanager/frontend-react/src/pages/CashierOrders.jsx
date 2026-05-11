// =============================================================================
//  CashierOrders — danh sách đơn hôm nay
//  Tab Đang mở | Đã thanh toán
// =============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Receipt, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Api, fmt } from '../api/client';
import { useToast } from '../components/Toast';
import { useSocket } from '../hooks/useSocket';

export default function CashierOrders() {
  const [tab, setTab] = useState('open');
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, i] = await Promise.all([
        Api.listOrders({ status: 'pending,serving' }),
        Api.listInvoices({ today: 'true' }),
      ]);
      setOrders(o || []);
      setInvoices(i || []);
    } catch (e) {
      toast.err('Lỗi tải đơn', e.message);
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useSocket({
    'orders:changed': load, 'order:created': load, 'order:updated': load,
    'order:cancelled': load, 'invoice:created': load,
  });

  const data = tab === 'open' ? orders : invoices;

  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      <h1 className="text-xl font-bold mb-3">Đơn hàng</h1>

      <div className="flex gap-1 bg-surface-low p-1 rounded-xl mb-4">
        <TabBtn on={tab === 'open'} onClick={() => setTab('open')}>
          Đang mở ({orders.length})
        </TabBtn>
        <TabBtn on={tab === 'paid'} onClick={() => setTab('paid')}>
          Đã TT hôm nay ({invoices.length})
        </TabBtn>
      </div>

      {loading ? (
        <div className="text-center text-muted py-12">Đang tải…</div>
      ) : data.length === 0 ? (
        <div className="text-center text-muted py-12">
          <Receipt className="w-12 h-12 mx-auto mb-2 opacity-40" />
          <div>Chưa có đơn nào.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map(o => tab === 'open'
            ? <OrderCard key={o.id} o={o} onClick={() => navigate('/cashier/detail/' + encodeURIComponent(o.table_code))} />
            : <InvoiceCard key={o.id} inv={o} />
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ on, onClick, children }) {
  return (
    <button onClick={onClick} className={
      'flex-1 py-2 rounded-lg text-sm font-semibold transition ' +
      (on ? 'bg-white text-on-surface shadow-soft' : 'text-muted hover:text-on-surface')
    }>{children}</button>
  );
}

function OrderCard({ o, onClick }) {
  return (
    <button onClick={onClick} className="card p-3 w-full text-left hover:shadow-card transition flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-on-surface">Bàn {o.table_code}</span>
          <span className="text-[10px] font-mono text-muted">{o.code}</span>
        </div>
        <div className="text-xs text-muted mt-0.5">
          {o.waiter_name || '–'} · {o.items_count || 0} món · {fmt(o.total_amount)}
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-muted" />
    </button>
  );
}

function InvoiceCard({ inv }) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">Bàn {inv.table_code}</div>
          <div className="text-[10px] font-mono text-muted">{inv.code}</div>
        </div>
        <div className="text-right">
          <div className="font-bold text-primary">{fmt(inv.final_amount)}</div>
          <div className="text-xs text-muted capitalize">{inv.payment_method}</div>
        </div>
      </div>
    </div>
  );
}
