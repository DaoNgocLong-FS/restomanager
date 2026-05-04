// =============================================================================
//  Table context menu (web POS)
//  - Right-click trên thẻ bàn → menu nổi với các action: chuyển bàn, dọn bàn,
//    bật/tắt bàn (tuỳ trạng thái và quyền user)
//  - Click ngoài / phím Esc → đóng menu
//  - Long-press 600ms trên cảm ứng cũng kích hoạt menu
//
//  Tích hợp:
//    1) Nạp file này SAU js/api.js
//    2) Trên mỗi grid bàn, gọi RmTableMenu.attach(gridEl, getCtx)
//       với getCtx(tableId) → { table, role } để menu biết quyền & trạng thái
// =============================================================================
(function () {
  const ROLES_ALLOWED = new Set(['admin', 'cashier']);

  // ── Element của menu (singleton) ────────────────────────────────────────
  let _menuEl = null;
  let _backdropEl = null;
  let _onDocClick = null;
  let _onKey = null;

  function ensureMenu() {
    if (_menuEl) return;
    _backdropEl = document.createElement('div');
    _backdropEl.className = 'rm-tm-backdrop';
    _backdropEl.style.cssText =
      'position:fixed;inset:0;z-index:9998;background:transparent;display:none';
    document.body.appendChild(_backdropEl);

    _menuEl = document.createElement('div');
    _menuEl.className = 'rm-tm-menu';
    _menuEl.setAttribute('role', 'menu');
    _menuEl.style.cssText = [
      'position:fixed', 'z-index:9999', 'min-width:220px',
      'background:#fff', 'border:1px solid rgba(0,0,0,0.08)',
      'border-radius:12px', 'box-shadow:0 10px 24px rgba(0,0,0,0.12)',
      'padding:6px', 'display:none', 'font-size:14px',
      'user-select:none', 'animation:rm-tm-pop .12s ease-out',
    ].join(';');
    document.body.appendChild(_menuEl);

    // Style cho item + animation (tự inject 1 lần)
    if (!document.getElementById('rm-tm-style')) {
      const st = document.createElement('style');
      st.id = 'rm-tm-style';
      st.textContent = `
        @keyframes rm-tm-pop { from { opacity:0; transform:scale(.98) translateY(-2px) } to { opacity:1; transform:none } }
        .rm-tm-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;color:#1f2937}
        .rm-tm-item:hover{background:#f3f4f6}
        .rm-tm-item.danger{color:#b91c1c}
        .rm-tm-item.danger:hover{background:#fee2e2}
        .rm-tm-item .ico{width:20px;text-align:center;font-size:18px;color:#6b7280}
        .rm-tm-item.danger .ico{color:#b91c1c}
        .rm-tm-item.disabled{opacity:.45;pointer-events:none}
        .rm-tm-sep{height:1px;background:#e5e7eb;margin:4px 6px}
        .rm-tm-header{padding:8px 12px 4px;font-size:11px;letter-spacing:.04em;color:#6b7280;text-transform:uppercase;font-weight:600}
      `;
      document.head.appendChild(st);
    }
  }

  function close() {
    if (!_menuEl) return;
    _menuEl.style.display = 'none';
    _backdropEl.style.display = 'none';
    if (_onDocClick) { document.removeEventListener('mousedown', _onDocClick, true); _onDocClick = null; }
    if (_onKey) { document.removeEventListener('keydown', _onKey, true); _onKey = null; }
  }

  function clamp(x, max) { return Math.max(8, Math.min(x, max - 8)); }

  function open(x, y, items, headerText) {
    ensureMenu();
    _menuEl.innerHTML = '';

    if (headerText) {
      const h = document.createElement('div');
      h.className = 'rm-tm-header';
      h.textContent = headerText;
      _menuEl.appendChild(h);
    }

    items.forEach((it) => {
      if (it.sep) {
        const s = document.createElement('div');
        s.className = 'rm-tm-sep';
        _menuEl.appendChild(s);
        return;
      }
      const el = document.createElement('div');
      el.className = 'rm-tm-item' + (it.danger ? ' danger' : '') + (it.disabled ? ' disabled' : '');
      el.setAttribute('role', 'menuitem');
      el.innerHTML =
        `<span class="ico material-symbols-outlined">${it.icon || 'circle'}</span>` +
        `<span class="lbl">${it.label}</span>`;
      el.addEventListener('click', () => {
        close();
        try { it.onClick && it.onClick(); } catch (e) { console.error(e); }
      });
      _menuEl.appendChild(el);
    });

    // Đặt vị trí trước khi show để đo được chiều rộng/cao
    _menuEl.style.display = 'block';
    _backdropEl.style.display = 'block';
    const rect = _menuEl.getBoundingClientRect();
    const left = clamp(x, window.innerWidth - rect.width);
    const top = clamp(y, window.innerHeight - rect.height);
    _menuEl.style.left = left + 'px';
    _menuEl.style.top = top + 'px';

    _onDocClick = (e) => {
      if (!_menuEl.contains(e.target)) close();
    };
    _onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', _onDocClick, true);
    document.addEventListener('keydown', _onKey, true);
  }

  // ── Helpers gọi API ─────────────────────────────────────────────────────
  async function _confirm(msg) {
    return Promise.resolve(window.confirm(msg));
  }
  function _toast(msg, icon) {
    if (typeof window.toast === 'function') return window.toast(msg, icon);
    console.log('[toast]', msg);
  }

  // ── Action: chuyển bàn ─────────────────────────────────────────────────
  async function _moveOrder(table) {
    if (!table.open_order_id) return _toast('Bàn chưa có order để chuyển', 'info');

    // Lấy danh sách bàn đích hợp lệ
    let allTables;
    try { allTables = await window.Api.listTables({ with_status: 'true' }); }
    catch (e) { return _toast('Không tải được danh sách bàn: ' + e.message, 'error'); }

    const candidates = allTables.filter(t =>
      t.id !== (table.dbId || table.id) && t.is_active !== false &&
      (t.status === 'empty' || !t.status)
    );
    if (candidates.length === 0) {
      return _toast('Không có bàn trống nào để chuyển sang', 'info');
    }

    _openMoveDialog(table, candidates);
  }

  function _openMoveDialog(fromTable, candidates) {
    // Modal đơn giản, không phụ thuộc framework
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';

    const box = document.createElement('div');
    box.style.cssText =
      'background:#fff;border-radius:16px;max-width:420px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.25)';
    box.innerHTML = `
      <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb">
        <div style="font-weight:700;font-size:16px;color:#111827">Chuyển order — Bàn ${fromTable.code || fromTable.id}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px">Chọn bàn đích (chỉ liệt kê bàn đang trống)</div>
      </div>
      <div id="rm-mv-list" style="overflow:auto;padding:8px;flex:1"></div>
      <div style="padding:12px 16px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:8px">
        <button id="rm-mv-cancel" style="padding:8px 14px;border-radius:8px;background:#f3f4f6;color:#111827;border:none;cursor:pointer;font-weight:600">Huỷ</button>
      </div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const list = box.querySelector('#rm-mv-list');
    candidates.forEach(t => {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:10px;cursor:pointer;border:1px solid #f3f4f6;margin-bottom:6px';
      row.innerHTML =
        `<div><div style="font-weight:700;color:#111827">${t.code}</div>` +
        `<div style="font-size:11px;color:#6b7280">${t.zone || ''} · ${t.capacity || '?'} chỗ</div></div>` +
        `<span style="font-size:11px;color:#15803d;background:#dcfce7;padding:3px 8px;border-radius:99px;font-weight:600">Trống</span>`;
      row.addEventListener('mouseenter', () => row.style.background = '#f9fafb');
      row.addEventListener('mouseleave', () => row.style.background = '');
      row.addEventListener('click', async () => {
        row.style.pointerEvents = 'none';
        row.style.opacity = '0.5';
        try {
          await window.Api.moveOrder(fromTable.open_order_id, t.id);
          _toast(`Đã chuyển sang bàn ${t.code}`, 'check_circle');
          document.body.removeChild(overlay);
          // Realtime sẽ tự reload, nhưng vẫn gọi để cảm giác mượt
          if (typeof window.loadTablesFromApi === 'function') {
            window.loadTablesFromApi().then(() => {
              if (typeof window.refreshCashierTables === 'function') window.refreshCashierTables();
              if (typeof window.renderWaiterTables === 'function') window.renderWaiterTables();
            });
          }
        } catch (e) {
          row.style.pointerEvents = '';
          row.style.opacity = '';
          _toast(e.message || 'Lỗi chuyển bàn', 'error');
        }
      });
      list.appendChild(row);
    });

    box.querySelector('#rm-mv-cancel').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
  }

  // ── Action: dọn bàn ────────────────────────────────────────────────────
  async function _clearTable(table) {
    const code = table.code || table.id;
    const ok = await _confirm(
      `DỌN BÀN ${code}?\n\n` +
      `Order đang mở sẽ bị HUỶ (không tạo hoá đơn).\n` +
      `Dùng khi khách bỏ về hoặc cần reset bàn về trống.\n\n` +
      `Tiếp tục?`
    );
    if (!ok) return;

    const reason = window.prompt('Lý do dọn bàn (tuỳ chọn):', 'Khách bỏ về') || null;

    try {
      await window.Api.clearTable(table.dbId || table.id, reason);
      _toast(`Đã dọn bàn ${code}`, 'cleaning_services');
      if (typeof window.loadTablesFromApi === 'function') {
        await window.loadTablesFromApi();
        if (typeof window.refreshCashierTables === 'function') window.refreshCashierTables();
        if (typeof window.renderWaiterTables === 'function') window.renderWaiterTables();
      }
    } catch (e) {
      _toast(e.message || 'Lỗi dọn bàn', 'error');
    }
  }

  // ── Action: bật/tắt bàn ────────────────────────────────────────────────
  async function _toggleActive(table, makeActive) {
    const code = table.code || table.id;
    const ok = await _confirm(
      makeActive
        ? `Kích hoạt lại bàn ${code}?`
        : `Tạm khoá bàn ${code}?\n\nKhi tắt, không thể tạo order mới trên bàn này.\nDùng khi bàn hỏng hoặc đang sửa.`
    );
    if (!ok) return;

    try {
      await window.Api.setTableActive(table.dbId || table.id, makeActive);
      _toast(makeActive ? `Đã kích hoạt bàn ${code}` : `Đã tắt bàn ${code}`, 'power_settings_new');
      if (typeof window.loadTablesFromApi === 'function') {
        await window.loadTablesFromApi();
        if (typeof window.refreshCashierTables === 'function') window.refreshCashierTables();
        if (typeof window.renderWaiterTables === 'function') window.renderWaiterTables();
      }
    } catch (e) {
      _toast(e.message || 'Lỗi cập nhật bàn', 'error');
    }
  }

  // ── Build menu items theo trạng thái ───────────────────────────────────
  function buildItems(ctx) {
    const t = ctx.table;
    if (!t) return [];
    const role = ctx.role || (window.currentUser && window.currentUser.role) || 'guest';
    if (!ROLES_ALLOWED.has(role)) {
      return [{ label: 'Không có quyền thao tác', disabled: true, icon: 'lock' }];
    }

    const isActive = t.is_active !== false; // default treat as active
    const hasOpenOrder = !!t.open_order_id || t.status === 'busy' || t.status === 'pay';

    const items = [];

    // Chuyển bàn — chỉ khi bàn có order mở
    items.push({
      label: 'Chuyển bàn…',
      icon: 'swap_horiz',
      disabled: !hasOpenOrder,
      onClick: () => _moveOrder(t),
    });

    // Dọn bàn — chỉ khi bàn có order mở
    items.push({
      label: 'Dọn bàn (huỷ order)',
      icon: 'cleaning_services',
      danger: true,
      disabled: !hasOpenOrder,
      onClick: () => _clearTable(t),
    });

    items.push({ sep: true });

    // Bật/tắt
    if (isActive) {
      items.push({
        label: 'Tạm khoá bàn',
        icon: 'block',
        disabled: hasOpenOrder, // không cho tắt khi đang có order
        onClick: () => _toggleActive(t, false),
      });
    } else {
      items.push({
        label: 'Kích hoạt lại bàn',
        icon: 'check_circle',
        onClick: () => _toggleActive(t, true),
      });
    }

    return items;
  }

  // ── Public API: gắn handler cho 1 grid bàn ─────────────────────────────
  // gridEl: container chứa các thẻ bàn
  // getCtx(targetEl, ev) → { table, role } | null
  function attach(gridEl, getCtx) {
    if (!gridEl || gridEl._rmTmAttached) return;
    gridEl._rmTmAttached = true;

    // Right-click (desktop)
    gridEl.addEventListener('contextmenu', (ev) => {
      const ctx = getCtx(ev.target, ev);
      if (!ctx) return;
      ev.preventDefault();
      const items = buildItems(ctx);
      if (!items.length) return;
      const headerText = ctx.table ? ('Bàn ' + (ctx.table.code || ctx.table.id)) : '';
      open(ev.clientX, ev.clientY, items, headerText);
    });

    // Long-press (mobile/tablet web): 600ms
    let pressTimer = null;
    let pressX = 0, pressY = 0, pressTarget = null;

    const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };

    gridEl.addEventListener('touchstart', (ev) => {
      const t0 = ev.touches[0];
      if (!t0) return;
      pressX = t0.clientX; pressY = t0.clientY; pressTarget = ev.target;
      pressTimer = setTimeout(() => {
        const ctx = getCtx(pressTarget, ev);
        if (!ctx) return;
        // Ngăn click sau long-press
        try { ev.preventDefault(); } catch (_) {}
        const items = buildItems(ctx);
        if (!items.length) return;
        const headerText = ctx.table ? ('Bàn ' + (ctx.table.code || ctx.table.id)) : '';
        open(pressX, pressY, items, headerText);
      }, 600);
    }, { passive: true });
    gridEl.addEventListener('touchend', cancelPress);
    gridEl.addEventListener('touchmove', cancelPress);
    gridEl.addEventListener('touchcancel', cancelPress);
  }

  window.RmTableMenu = { attach, open, close, buildItems };
})();
