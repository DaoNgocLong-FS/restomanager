// =============================================================================
//  TableContextMenu — menu nổi khi right-click hoặc long-press 1 thẻ bàn
//  Action: chuyển bàn / dọn bàn / tạm khoá / kích hoạt lại
//
//  Cách dùng:
//    const menu = useTableMenu({ onChanged: () => reload() });
//    return (
//      <>
//        <div onContextMenu={menu.onContextMenu} onTouchStart={menu.onTouchStart} onTouchEnd={menu.onTouchEnd}
//             data-table-id={t.code}>...</div>
//        <menu.Element />
//      </>
//    );
//  trong đó onContextMenu yêu cầu element có data-table-id và thuộc vào tablesById map
// =============================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Trash2, Pause, Play, Lock, X } from 'lucide-react';
import { Api, fmt } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toast';
import { useConfirm } from './Confirm';

const ROLES_ALLOWED = new Set(['admin', 'cashier']);

/**
 * @param {{ tablesById: Record<string, any>, onChanged: () => void }} cfg
 *   tablesById: map từ table.code → { id, code, status, is_active, open_order_id, ... }
 */
export function useTableMenu({ tablesById, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  // Vị trí và bàn được chọn
  const [menu, setMenu] = useState(null); // { x, y, table } | null

  // ─── Move dialog state ─────────────────────────────────────────────────
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveFrom, setMoveFrom] = useState(null);
  const [moveCandidates, setMoveCandidates] = useState([]);

  // ─── Mở menu từ DOM event ──────────────────────────────────────────────
  const _openFromTarget = useCallback((target, x, y) => {
    if (!target) return;
    const card = target.closest && target.closest('[data-table-id]');
    if (!card) return;
    const code = card.getAttribute('data-table-id');
    const t = tablesById[code];
    if (!t) return;
    setMenu({ x, y, table: t });
  }, [tablesById]);

  const onContextMenu = useCallback((ev) => {
    if (!ROLES_ALLOWED.has(user?.role)) return;
    ev.preventDefault();
    _openFromTarget(ev.target, ev.clientX, ev.clientY);
  }, [_openFromTarget, user?.role]);

  // Long-press support cho touch device
  const pressTimer = useRef(null);
  const pressXY = useRef({ x: 0, y: 0, target: null });
  const onTouchStart = useCallback((ev) => {
    if (!ROLES_ALLOWED.has(user?.role)) return;
    const t0 = ev.touches[0]; if (!t0) return;
    pressXY.current = { x: t0.clientX, y: t0.clientY, target: ev.target };
    pressTimer.current = setTimeout(() => {
      const { x, y, target } = pressXY.current;
      _openFromTarget(target, x, y);
    }, 600);
  }, [_openFromTarget, user?.role]);
  const cancelPress = useCallback(() => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  }, []);

  const close = useCallback(() => setMenu(null), []);

  // Đóng khi Escape hoặc click ngoài
  useEffect(() => {
    if (!menu) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onClick = (e) => {
      if (!e.target.closest('[data-rm-tm]')) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick, true);
    };
  }, [menu, close]);

  // ─── Action handlers ───────────────────────────────────────────────────
  const startMove = async (t) => {
    close();
    if (!t.open_order_id) {
      toast.info('Không có order', 'Bàn này chưa có order để chuyển.');
      return;
    }
    try {
      const list = await Api.listTables({ with_status: 'true' });
      const candidates = list.filter(x =>
        x.id !== t.id && x.is_active !== false && (x.status === 'empty' || !x.status)
      );
      if (candidates.length === 0) {
        toast.info('Hết bàn trống', 'Không có bàn nào để chuyển sang.');
        return;
      }
      setMoveFrom(t);
      setMoveCandidates(candidates);
      setMoveOpen(true);
    } catch (e) {
      toast.err('Không tải được danh sách bàn', e.message);
    }
  };

  const doMove = async (toTable) => {
    if (!moveFrom?.open_order_id) return;
    try {
      await Api.moveOrder(moveFrom.open_order_id, toTable.id);
      setMoveOpen(false);
      onChanged && onChanged();
      toast.ok('Đã chuyển bàn', `Order chuyển sang ${toTable.code}`);
    } catch (e) {
      toast.err('Lỗi chuyển bàn', e.message);
    }
  };

  const askClear = async (t) => {
    close();
    if (!t.open_order_id) return toast.info('Bàn đã trống', 'Không có gì để dọn.');
    const ok = await confirm({
      title: `Dọn bàn ${t.code}?`,
      message: 'Order đang mở sẽ bị HUỶ và không tạo hoá đơn.\nDùng khi khách bỏ về hoặc cần reset bàn.',
      okText: 'Dọn bàn',
      danger: true,
    });
    if (!ok) return;
    try {
      await Api.clearTable(t.id, 'Khách bỏ về');
      onChanged && onChanged();
      toast.ok(`Đã dọn bàn ${t.code}`);
    } catch (e) {
      toast.err('Lỗi dọn bàn', e.message);
    }
  };

  const askToggle = async (t) => {
    close();
    const isActive = t.is_active !== false;
    const hasOpenOrder = !!t.open_order_id;
    if (isActive && hasOpenOrder) {
      return toast.info('Không thể tắt', 'Bàn đang có order. Vui lòng thanh toán hoặc dọn bàn trước.');
    }
    const ok = await confirm({
      title: isActive ? `Tạm khoá bàn ${t.code}?` : `Kích hoạt lại bàn ${t.code}?`,
      message: isActive
        ? 'Khi tắt, không thể tạo order mới trên bàn này.\nDùng khi bàn hỏng hoặc đang sửa.'
        : 'Bàn sẽ sẵn sàng nhận order mới.',
      okText: isActive ? 'Tắt bàn' : 'Bật bàn',
      danger: isActive,
    });
    if (!ok) return;
    try {
      await Api.setTableActive(t.id, !isActive);
      onChanged && onChanged();
      toast.ok(isActive ? `Đã tắt bàn ${t.code}` : `Đã bật bàn ${t.code}`);
    } catch (e) {
      toast.err('Lỗi cập nhật', e.message);
    }
  };

  // ─── Render Element ────────────────────────────────────────────────────
  const Element = useCallback(() => {
    if (!ROLES_ALLOWED.has(user?.role)) return null;
    return (
      <>
        {menu && <MenuPopup menu={menu} onClose={close}
          onMove={() => startMove(menu.table)}
          onClear={() => askClear(menu.table)}
          onToggle={() => askToggle(menu.table)} />}

        {moveOpen && (
          <MoveDialog
            from={moveFrom}
            candidates={moveCandidates}
            onClose={() => setMoveOpen(false)}
            onPick={doMove}
          />
        )}
      </>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, moveOpen, moveFrom, moveCandidates, user?.role]);

  return {
    onContextMenu,
    onTouchStart,
    onTouchEnd: cancelPress,
    onTouchMove: cancelPress,
    onTouchCancel: cancelPress,
    Element,
  };
}

// ─── Sub: popup menu ──────────────────────────────────────────────────────
function MenuPopup({ menu, onClose, onMove, onClear, onToggle }) {
  const t = menu.table;
  const isActive = t.is_active !== false;
  const hasOpen = !!t.open_order_id;

  // Clamp vị trí
  const left  = Math.min(Math.max(8, menu.x), window.innerWidth  - 240);
  const top   = Math.min(Math.max(8, menu.y), window.innerHeight - 220);

  const items = [
    { icon: ArrowLeftRight, label: 'Chuyển bàn…',          onClick: onMove,   disabled: !hasOpen },
    { icon: Trash2,         label: 'Dọn bàn (huỷ order)', onClick: onClear,  disabled: !hasOpen, danger: true },
    { sep: true },
    isActive
      ? { icon: Pause, label: 'Tạm khoá bàn',     onClick: onToggle, disabled: hasOpen }
      : { icon: Play,  label: 'Kích hoạt lại bàn', onClick: onToggle },
  ];

  return (
    <div
      data-rm-tm
      role="menu"
      style={{ position: 'fixed', left, top, zIndex: 9999 }}
      className="min-w-[230px] bg-white rounded-xl shadow-card border border-border-soft py-2 animate-pop-in"
    >
      <div className="px-3 pt-1 pb-2 text-[10px] uppercase tracking-wider text-muted font-semibold">
        Bàn {t.code}
      </div>
      {items.map((it, i) =>
        it.sep
          ? <div key={'sep' + i} className="h-px bg-border-soft my-1 mx-2" />
          : (
            <button
              key={i}
              onClick={it.disabled ? undefined : it.onClick}
              disabled={it.disabled}
              className={
                'w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-lg mx-1 ' +
                (it.danger ? 'text-red-700 hover:bg-red-50 ' : 'text-on-surface hover:bg-surface-low ') +
                (it.disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : '')
              }
              style={{ width: 'calc(100% - 8px)' }}
            >
              <it.icon className="w-4 h-4 shrink-0" />
              <span>{it.label}</span>
            </button>
          )
      )}
    </div>
  );
}

// ─── Sub: move-target dialog ──────────────────────────────────────────────
function MoveDialog({ from, candidates, onClose, onPick }) {
  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-900/50"
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border-soft flex items-start justify-between">
          <div>
            <div className="font-bold text-on-surface">Chuyển order — Bàn {from?.code}</div>
            <div className="text-xs text-muted mt-0.5">Chọn bàn đích (chỉ liệt kê bàn trống)</div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-on-surface" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {candidates.map(t => (
            <button key={t.id}
              onClick={() => onPick(t)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-surface-low border border-transparent hover:border-border-soft transition mb-1 text-left"
            >
              <div>
                <div className="font-bold text-on-surface">{t.code}</div>
                <div className="text-xs text-muted">{t.zone} · {t.capacity || '?'} chỗ</div>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                Trống
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
