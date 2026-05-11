// =============================================================================
//  CashierStats — KPI tổng quan hôm nay
// =============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { TrendingUp, Receipt, CreditCard, Utensils } from 'lucide-react';
import { Api, fmt } from '../api/client';
import { useToast } from '../components/Toast';

const PAY_LABELS = {
  cash: 'Tiền mặt', transfer: 'Chuyển khoản', card: 'Quẹt thẻ',
  vnpay: 'VietQR Pro', voucher: 'Voucher', combo: 'Combo',
};

export default function CashierStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setStats(await Api.statsOverview()); }
    catch (e) { toast.err('Không tải được thống kê', e.message); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (loading || !stats) {
    return <div className="p-8 text-center text-muted">Đang tải…</div>;
  }
  const sum = stats.summary || {};

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      <h1 className="text-xl font-bold">Thống kê hôm nay</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={TrendingUp} label="Doanh thu" value={fmt(sum.total_revenue)} color="text-primary" />
        <KPI icon={Receipt}    label="Hoá đơn"   value={String(sum.invoice_count || 0)} color="text-emerald-700" />
        <KPI icon={Utensils}   label="Món bán ra" value={String(sum.items_sold || 0)} color="text-amber-700" />
        <KPI icon={CreditCard} label="TB / HĐ"   value={fmt(sum.avg_invoice || 0)} color="text-blue-700" />
      </div>

      {stats.byPaymentMethod && stats.byPaymentMethod.length > 0 && (
        <div className="card p-4">
          <div className="font-bold mb-3">Theo phương thức thanh toán</div>
          <div className="space-y-2">
            {stats.byPaymentMethod.map(p => (
              <div key={p.payment_method} className="flex justify-between py-2 border-b border-border-soft last:border-0">
                <span className="text-on-surface-variant">{PAY_LABELS[p.payment_method] || p.payment_method}</span>
                <span className="font-bold">{p.count} HĐ · {fmt(p.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.topItems && stats.topItems.length > 0 && (
        <div className="card p-4">
          <div className="font-bold mb-3">Món bán chạy</div>
          <div className="space-y-2">
            {stats.topItems.slice(0, 10).map((it, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-border-soft last:border-0">
                <span className="text-on-surface-variant">{i + 1}. {it.item_name}</span>
                <span className="font-bold">×{it.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-4">
      <Icon className={'w-5 h-5 ' + color} />
      <div className="text-xs text-muted mt-2">{label}</div>
      <div className="text-lg font-bold text-on-surface mt-0.5">{value}</div>
    </div>
  );
}
