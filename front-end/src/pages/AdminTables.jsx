// =============================================================================
//  AdminTables — CRUD bàn theo khu vực (indoor / outdoor / vip)
// =============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Api } from '../api/client';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { useSocket } from '../hooks/useSocket';
import Modal from '../components/Modal';

const ZONE_LABEL = { indoor: 'Trong nhà', outdoor: 'Sân vườn', vip: 'VIP' };

const EMPTY = { id: null, code: '', zone: 'indoor', capacity: 4, is_active: true };

export default function AdminTables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try { setTables(await Api.listTables() || []); }
    catch (e) { toast.err('Không tải được danh sách bàn', e.message); }
    finally   { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useSocket({ 'tables:changed': load });

  const openCreate = () => setEditing({ ...EMPTY });
  const openEdit   = (t) => setEditing({
    id: t.id, code: t.code, zone: t.zone, capacity: t.capacity, is_active: !!t.is_active,
  });

  const onSave = async () => {
    const f = editing;
    if (!f.code?.trim()) {
      toast.err('Thiếu mã bàn', 'Cần đặt mã (vd: T1-07).');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: f.code.trim().toUpperCase(),
        zone: f.zone,
        capacity: parseInt(f.capacity, 10) || 4,
        is_active: !!f.is_active,
      };
      if (f.id) await Api.updateTable(f.id, payload);
      else      await Api.createTable(payload);
      setEditing(null);
      toast.ok('Đã lưu');
      load();
    } catch (e) {
      toast.err('Lưu thất bại', e.message);
    } finally { setSaving(false); }
  };

  const onDelete = async (t) => {
    const ok = await confirm({
      title: 'Xoá bàn?',
      message: `Sẽ xoá bàn "${t.code}".`,
      okText: 'Xoá', danger: true,
    });
    if (!ok) return;
    try {
      await Api.deleteTable(t.id);
      toast.ok('Đã xoá');
      load();
    } catch (e) { toast.err('Xoá thất bại', e.message); }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Bàn</h1>
          <p className="text-sm text-muted">Cấu hình bàn theo khu vực.</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm py-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Thêm bàn</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center text-muted py-12">Đang tải…</div>
      ) : tables.length === 0 ? (
        <div className="text-center text-muted py-12">Chưa có bàn nào.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tables.map(t => (
            <div key={t.id} className="card p-4 text-center">
              <div className="text-xs text-muted uppercase">{ZONE_LABEL[t.zone] || t.zone}</div>
              <div className="text-2xl font-bold text-on-surface mt-1">{t.code}</div>
              <div className="text-xs text-muted mt-1">Sức chứa: {t.capacity}</div>
              <div className={
                'mt-2 text-xs ' + (t.is_active ? 'text-success' : 'text-danger')
              }>{t.is_active ? 'Đang dùng' : 'Tạm ngừng'}</div>
              <div className="flex gap-1 mt-3 pt-3 border-t border-border-soft">
                <button
                  onClick={() => openEdit(t)}
                  className="btn-ghost text-xs py-1.5 flex-1"
                ><Edit2 className="w-3.5 h-3.5" /></button>
                <button
                  onClick={() => onDelete(t)}
                  className="btn-ghost text-xs py-1.5 text-danger"
                ><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        title={editing?.id ? 'Sửa bàn' : 'Thêm bàn'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn-ghost text-sm py-2" onClick={() => setEditing(null)}>Huỷ</button>
            <button className="btn-primary text-sm py-2" onClick={onSave} disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-muted">Mã bàn</span>
              <input
                value={editing.code}
                onChange={(e) => setEditing(s => ({ ...s, code: e.target.value }))}
                placeholder="VD: T1-07"
                className="field mt-1 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Khu vực</span>
              <select
                value={editing.zone}
                onChange={(e) => setEditing(s => ({ ...s, zone: e.target.value }))}
                className="field mt-1 py-2"
              >
                <option value="indoor">Trong nhà</option>
                <option value="outdoor">Sân vườn</option>
                <option value="vip">VIP</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted">Sức chứa</span>
              <input
                type="number" min="1"
                value={editing.capacity}
                onChange={(e) => setEditing(s => ({ ...s, capacity: e.target.value }))}
                className="field mt-1 py-2"
              />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(e) => setEditing(s => ({ ...s, is_active: e.target.checked }))}
              />
              <span className="text-sm">Đang sử dụng</span>
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
