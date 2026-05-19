// =============================================================================
//  AdminDashboard — KPI tổng quan + chart doanh thu theo giờ + top món + PT TT
//  Realtime: tự reload khi có invoice mới hoặc đơn thay đổi.
// =============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw, DollarSign, Receipt, TrendingUp, Users as UsersIcon,
  Banknote, QrCode, CreditCard,
} from 'lucide-react';
import { Api, fmt } from '../api/client';
import { useToast } from '../components/Toast';
import { useSocket } from '../hooks/useSocket';

const PAY_METHODS = [
  { key: 'cash',     label: 'Tiền mặt',     icon: Banknote },
  { key: 'transfer', label: 'Chuyển khoản', icon: QrCode },
  { key: 'card',     label: 'Thẻ',          icon: CreditCard },
];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const d = await Api.statsOverview();
      setData(d);
    } catch (e) {
      toast.err('Không tải được dashboard', e.message);
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useSocket({
    'invoice:created':  load,
    'orders:changed':   load,
    'tables:changed':   load,
  });

  const s = data?.summary || {};
  const byHour = data?.byHour || [];
  const maxRev = Math.max(1, ...byHour.map(x => Number(x.revenue) || 0));
  const hours = Array.from({ length: 24 }, (_, h) => {
    const m = byHour.find(x => x.hour === h);
    return { h, v: m ? Number(m.revenue) : 0 };
  });
  const topItems = data?.topItems || [];
  const byPM = data?.byPaymentMethod || [];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Tổng quan</h1>
          <p className="text-sm text-muted">Số liệu kinh doanh thời gian thực.</p>
        </div>
        <button
          onClick={load}
          className="btn-ghost text-sm py-2"
          disabled={loading}
        >
          <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
          Làm mới
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Kpi icon={DollarSign} label="Doanh thu hôm nay" value={fmt(s.total_revenue)} hint="Tổng đã thu" />
        <Kpi icon={Receipt}    label="Hoá đơn"           value={s.invoice_count || 0} hint="Trong ngày" />
        <Kpi icon={TrendingUp} label="TB / Hoá đơn"      value={fmt(s.average)} hint="Giá trị bình quân" />
        <Kpi icon={UsersIcon}  label="Bàn đang phục vụ"  value={s.busy_tables || 0} hint="Đơn mở" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold text-on-surface mb-4">Doanh thu theo giờ (hôm nay)</h3>
          <div className="flex items-end justify-between gap-1 h-48">
            {hours.map(x => {
              const pct = Math.round((x.v / maxRev) * 100);
              return (
                <div key={x.h} className="flex flex-col items-center flex-1 min-w-0">
                  <div className="w-full flex items-end h-40">
                    <div
                      className="w-full bg-primary rounded-t transition-all duration-500"
                      style={{ height: pct + '%' }}
                      title={`${x.h}h: ${fmt(x.v)}`}
                    />
                  </div>
                  <div className="text-[10px] text-muted mt-1">{x.h}h</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-on-surface mb-4">Món bán chạy</h3>
          {topItems.length === 0 ? (
            <div className="text-sm text-muted">Chưa có dữ liệu.</div>
          ) : (
            <ul className="space-y-2">
              {topItems.map((it, i) => (
                <li key={i} className="flex items-center justify-between py-2 border-b border-border-soft last:border-b-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted font-mono text-sm shrink-0">{i + 1}.</span>
                    <span className="truncate">{it.name}</span>
                  </div>
                  <div className="text-sm font-semibold text-on-surface shrink-0">{it.qty}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Payment methods */}
      <div className="card p-5">
        <h3 className="font-semibold text-on-surface mb-4">Phương thức thanh toán</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PAY_METHODS.map(pm => {
            const found = byPM.find(x => x.payment_method === pm.key);
            const Icon = pm.icon;
            return (
              <div key={pm.key} className="border border-border-soft rounded-xl p-4 flex items-center gap-3">
                <Icon className="w-6 h-6 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-muted">{pm.label}</div>
                  <div className="font-semibold text-on-surface truncate">{fmt(found ? found.revenue : 0)}</div>
                  <div className="text-xs text-muted">{found ? found.count : 0} hoá đơn</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }) {
  return (
    <div className="card p-4 md:p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
          <div className="text-xl md:text-2xl font-bold text-on-surface mt-1 truncate">{value}</div>
          <div className="text-xs text-muted mt-1">{hint}</div>
        </div>
        <Icon className="w-5 h-5 text-primary shrink-0" />
      </div>
    </div>
  );
}
