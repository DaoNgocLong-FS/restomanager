// =============================================================================
//  WaiterTables — sơ đồ bàn cho waiter
//  KHÔNG có context menu (waiter không có quyền chuyển/dọn/tắt)
//  Click 1 bàn → /waiter/menu/:code để gọi món
// =============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Clock } from 'lucide-react';
import { Api, fmt } from '../api/client';
import { useToast } from '../components/Toast';
import { useSocket } from '../hooks/useSocket';

const STATUS_LABEL = {
  empty: 'Trống', busy: 'Có khách', pay: 'Chờ TT', inactive: 'Tắt',
};
const STATUS_PILL = {
  empty: 'pill-empty', busy: 'pill-busy', pay: 'pill-pay', inactive: 'pill-off',
};

export default function WaiterTables() {
  const [tables, setTables] = useState([]);
  const [zone, setZone] = useState('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await Api.listTables({ with_status: 'true' });
      setTables(list || []);
    } catch (e) {
      toast.err('Không tải được danh sách bàn', e.message);
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useSocket({
    'tables:changed':  load,
    'orders:changed':  load,
    'order:created':   load,
    'order:updated':   load,
    'order:cancelled': load,
    'order:moved':     load,
    'invoice:created': load,
  });

  const zones = useMemo(() => {
    const set = new Set(tables.map(t => t.zone).filter(Boolean));
    return Array.from(set).sort();
  }, [tables]);

  const filtered = zone === 'all' ? tables : tables.filter(t => t.zone === zone);

  const onClickTable = (t) => {
    if (t.is_active === false) {
      toast.info('Bàn tạm khoá', `Bàn ${t.code} đang không hoạt động.`);
      return;
    }
    navigate('/waiter/menu/' + encodeURIComponent(t.code));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-on-surface">Bàn của tôi</h1>
        <p className="text-sm text-muted">Chọn bàn để gọi món / thêm món vào đơn.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <span className="px-3 py-1 rounded-full text-xs font-semibold pill-empty">Trống</span>
        <span className="px-3 py-1 rounded-full text-xs font-semibold pill-busy">Có khách</span>
        <span className="px-3 py-1 rounded-full text-xs font-semibold pill-pay">Chờ TT</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <ChipBtn on={zone === 'all'} onClick={() => setZone('all')}>Tất cả</ChipBtn>
        {zones.map(z => (
          <ChipBtn key={z} on={zone === z} onClick={() => setZone(z)}>{z}</ChipBtn>
        ))}
      </div>

      {loading && tables.length === 0 ? (
        <div className="text-center text-muted py-12">Đang tải…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(t => {
            const status = t.is_active === false ? 'inactive' : (t.status || 'empty');
            const inactive = status === 'inactive';
            return (
              <button key={t.id} onClick={() => onClickTable(t)}
                className={
                  'card p-4 text-left transition ' +
                  (inactive
                    ? 'opacity-70 cursor-not-allowed'
                    : 'hover:shadow-card hover:-translate-y-0.5')
                }>
                <div className="flex items-start justify-between mb-3">
                  <div className="font-bold text-lg text-on-surface">{t.code}</div>
                  <span className={'px-2 py-1 rounded-full text-[10px] font-bold uppercase ' + STATUS_PILL[status]}>
                    {STATUS_LABEL[status] || status}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted">
                  <Users className="w-3.5 h-3.5" />
                  <span>{t.capacity || '?'} chỗ</span>
                  {t.zone && <span className="ml-1">· {t.zone}</span>}
                </div>
                {(status === 'busy' || status === 'pay') && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-soft">
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <Clock className="w-3.5 h-3.5" /><span>{t.mins || 0}ph</span>
                    </div>
                    <div className="font-bold text-primary">{fmt(t.spent || 0)}</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChipBtn({ on, onClick, children }) {
  return (
    <button onClick={onClick} className={
      'px-4 py-1.5 rounded-full text-sm font-semibold border transition ' +
      (on
        ? 'bg-primary text-white border-primary'
        : 'bg-white text-on-surface-variant border-border hover:bg-surface-low')
    }>{children}</button>
  );
}
