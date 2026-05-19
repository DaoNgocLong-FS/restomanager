// =============================================================================
//  WaiterMenu — chọn món, gửi đơn (tạo mới hoặc thêm vào order đang mở)
// =============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Minus, Send, ShoppingCart } from 'lucide-react';
import { Api, fmt } from '../api/client';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

export default function WaiterMenu() {
  const { code } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [table, setTable] = useState(null);
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({}); // { id: qty }
  const [openOrder, setOpenOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [tables, m, c] = await Promise.all([
          Api.listTables({ with_status: 'true' }),
          Api.listMenu({ active: 'true' }),
          Api.listCategories(),
        ]);
        const t = tables.find(x => x.code === code);
        if (!t) { toast.err('Không tìm thấy bàn'); navigate(-1); return; }
        setTable(t); setItems(m); setCats(c);
        try { setOpenOrder(await Api.getOpenOrderForTable(t.id)); } catch {}
      } catch (e) {
        toast.err('Lỗi tải dữ liệu', e.message);
      } finally { setLoading(false); }
    })();
  }, [code]); // eslint-disable-line

  const filtered = useMemo(() => {
    let arr = items;
    if (cat !== 'all') arr = arr.filter(x => x.category_code === cat || x.category_id === cat);
    if (search) arr = arr.filter(x => x.name.toLowerCase().includes(search.toLowerCase()));
    return arr;
  }, [items, cat, search]);

  const total = useMemo(
    () => Object.entries(cart).reduce((s, [id, q]) => {
      const it = items.find(x => x.id === id);
      return s + (it ? Number(it.price) * q : 0);
    }, 0),
    [cart, items]
  );
  const count = Object.values(cart).reduce((s, q) => s + q, 0);

  const inc = (id) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const dec = (id) => setCart(c => {
    const n = { ...c };
    if ((n[id] || 0) > 1) n[id]--; else delete n[id];
    return n;
  });

  const send = async () => {
    if (count === 0) { toast.info('Chưa có món', 'Thêm món trước khi gửi.'); return; }
    setSending(true);
    try {
      const apiItems = Object.entries(cart).map(([id, q]) => {
        const it = items.find(x => x.id === id);
        return { menu_item_id: it.id, item_name: it.name, quantity: q, price: Number(it.price) };
      });
      if (openOrder?.id) {
        await Api.addOrderItems(openOrder.id, apiItems);
      } else {
        await Api.createOrder({
          table_id: table.id,
          table_code: table.code,
          waiter_name: user?.full_name || user?.username || 'Waiter',
          items: apiItems,
        });
      }
      toast.ok(`Đã gửi ${count} món`, `Bàn ${table.code}`);
      navigate(-1);
    } catch (e) {
      toast.err('Gửi thất bại', e.message);
    } finally { setSending(false); }
  };

  if (loading) return <div className="p-8 text-center text-muted">Đang tải…</div>;
  if (!table) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 pb-32">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted hover:text-on-surface mb-3">
        <ArrowLeft className="w-4 h-4" /> Quay lại
      </button>

      <div className="card p-4 mb-3">
        <div className="font-bold text-lg">Bàn {table.code}</div>
        <div className="text-xs text-muted">
          {openOrder ? `Đang có đơn ${openOrder.code} – sẽ thêm món vào đơn này` : 'Tạo đơn mới'}
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="field pl-10" placeholder="Tìm món…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <ChipBtn on={cat === 'all'} onClick={() => setCat('all')}>Tất cả</ChipBtn>
        {cats.map(cc => (
          <ChipBtn key={cc.id} on={cat === cc.code || cat === cc.id}
            onClick={() => setCat(cc.code || cc.id)}>{cc.name}</ChipBtn>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(it => {
          const qty = cart[it.id] || 0;
          return (
            <div key={it.id} className={
              'card p-3 flex items-center gap-3 transition ' +
              (qty > 0 ? 'ring-2 ring-primary' : '')
            }>
              <div className="w-14 h-14 rounded-xl bg-surface-container flex items-center justify-center text-2xl shrink-0">
                {it.emoji || '🍽'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-on-surface text-sm truncate">{it.name}</div>
                {it.description && (
                  <div className="text-xs text-muted truncate">{it.description}</div>
                )}
                <div className="text-primary font-bold mt-0.5">{fmt(it.price)}</div>
              </div>
              {qty === 0 ? (
                <button onClick={() => inc(it.id)}
                  className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary-dark">
                  <Plus className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button onClick={() => dec(it.id)}
                    className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-7 text-center font-bold">{qty}</span>
                  <button onClick={() => inc(it.id)}
                    className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-muted py-12">Không tìm thấy món.</div>
        )}
      </div>

      {count > 0 && (
        <button onClick={send} disabled={sending}
          className="fixed left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md bottom-20 h-14 rounded-2xl bg-primary text-white shadow-card flex items-center justify-between px-4 hover:bg-primary-dark transition disabled:opacity-60 z-30">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            <span className="font-bold">{count} món</span>
          </div>
          <span className="font-bold text-lg">{fmt(total)}</span>
          <span className="flex items-center gap-1 bg-primary-dark px-3 py-1.5 rounded-lg">
            <span className="font-bold text-sm">{openOrder ? 'Thêm' : 'Gửi'}</span>
            <Send className="w-4 h-4" />
          </span>
        </button>
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
