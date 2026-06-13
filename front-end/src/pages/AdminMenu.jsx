// =============================================================================
//  AdminMenu — CRUD món ăn, upload ảnh lên MinIO (multipart)
// =============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, ImageOff, Edit2, Trash2 } from 'lucide-react';
import { Api, fmt } from '../api/client';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import Modal from '../components/Modal';

const EMPTY = {
  id: null, name: '', category_id: '', price: '',
  description: '', is_active: true,
  imageFile: null, imagePreview: null, currentImageUrl: null,
};

export default function AdminMenu() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      const [cats, list] = await Promise.all([Api.listCategories(), Api.listMenu()]);
      setCategories(cats || []);
      setItems(list || []);
    } catch (e) {
      toast.err('Không tải được thực đơn', e.message);
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => setEditing({
    ...EMPTY,
    category_id: categories[0]?.id || '',
  });
  const openEdit = (m) => setEditing({
    id: m.id, name: m.name, category_id: m.category_id || categories[0]?.id || '',
    price: m.price, description: m.description || '',
    is_active: !!m.is_active,
    imageFile: null, imagePreview: m.image_url || null,
    currentImageUrl: m.image_url || null,
  });

  const onPickImage = (file) => {
    if (!file) return;
    // Chỉ cho phép ảnh JPG / PNG
    const ALLOWED = ['image/jpeg', 'image/png'];
    if (!ALLOWED.includes(file.type)) {
      toast.err('Sai định dạng', 'Chỉ chấp nhận ảnh JPG hoặc PNG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.err('Ảnh quá lớn', 'Kích thước tối đa 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) =>
      setEditing(s => ({ ...s, imageFile: file, imagePreview: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const onSave = async () => {
    const f = editing;
    if (!f.name?.trim() || !f.price) {
      toast.err('Thiếu thông tin', 'Tên và giá là bắt buộc.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', f.name.trim());
      fd.append('category_id', f.category_id);
      fd.append('price', String(f.price));
      fd.append('description', f.description || '');
      fd.append('is_active', f.is_active ? 'true' : 'false');
      if (f.imageFile) fd.append('image', f.imageFile);

      if (f.id) await Api.updateMenuItem(f.id, fd);
      else      await Api.createMenuItem(fd);
      setEditing(null);
      toast.ok('Đã lưu');
      load();
    } catch (e) {
      toast.err('Lưu thất bại', e.message);
    } finally { setSaving(false); }
  };

  const onDelete = async (m) => {
    const ok = await confirm({
      title: 'Xoá món?',
      message: `Sẽ xoá "${m.name}" khỏi thực đơn.`,
      okText: 'Xoá', danger: true,
    });
    if (!ok) return;
    try {
      await Api.deleteMenuItem(m.id);
      toast.ok('Đã xoá');
      load();
    } catch (e) { toast.err('Xoá thất bại', e.message); }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Thực đơn</h1>
          <p className="text-sm text-muted">Quản lý món, hình ảnh và giá bán.</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm py-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Thêm món</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center text-muted py-12">Đang tải…</div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted py-12">Chưa có món nào.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map(m => (
            <div key={m.id} className="card overflow-hidden flex flex-col">
              <div className="aspect-video bg-surface-low flex items-center justify-center">
                {m.image_url ? (
                  <img
                    src={m.image_url} alt={m.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <ImageOff className="w-12 h-12 text-muted opacity-50" />
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-on-surface line-clamp-1">{m.name}</h4>
                  <span className={
                    'text-xs shrink-0 ' +
                    (m.is_active ? 'text-success' : 'text-danger')
                  }>{m.is_active ? 'Đang bán' : 'Tạm ngừng'}</span>
                </div>
                <div className="text-xs text-muted mt-1 line-clamp-2 min-h-[2.5em]">
                  {m.description || '—'}
                </div>
                <div className="text-xs text-muted mt-2">{m.category_name || ''}</div>
                <div className="font-bold text-primary mt-1">{fmt(m.price)}</div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-border-soft">
                  <button
                    onClick={() => openEdit(m)}
                    className="btn-ghost text-xs py-1.5 flex-1"
                  ><Edit2 className="w-3.5 h-3.5" /> Sửa</button>
                  <button
                    onClick={() => onDelete(m)}
                    className="btn-ghost text-xs py-1.5 text-danger"
                  ><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        title={editing?.id ? 'Sửa món' : 'Thêm món'}
        onClose={() => setEditing(null)}
        size="lg"
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
              <span className="text-xs text-muted">Tên món</span>
              <input
                value={editing.name}
                onChange={(e) => setEditing(s => ({ ...s, name: e.target.value }))}
                className="field mt-1 py-2"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-muted">Danh mục</span>
                <select
                  value={editing.category_id}
                  onChange={(e) => setEditing(s => ({ ...s, category_id: e.target.value }))}
                  className="field mt-1 py-2"
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-muted">Giá (VND)</span>
                <input
                  type="number" min="0"
                  value={editing.price}
                  onChange={(e) => setEditing(s => ({ ...s, price: e.target.value }))}
                  className="field mt-1 py-2"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-muted">Mô tả</span>
              <textarea
                rows={2}
                value={editing.description}
                onChange={(e) => setEditing(s => ({ ...s, description: e.target.value }))}
                className="field mt-1 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Hình ảnh</span>
              <input
                type="file" accept="image/png, image/jpeg"
                onChange={(e) => { onPickImage(e.target.files?.[0]); e.target.value = ''; }}
                className="mt-1 w-full text-sm"
              />
            </label>
            {editing.imagePreview && (
              <img
                src={editing.imagePreview}
                className="rounded-lg border border-border-soft max-h-32"
                alt="preview"
              />
            )}
            <div>
              <span className="text-xs text-muted">Trạng thái</span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setEditing(s => ({ ...s, is_active: true }))}
                  className={
                    'py-2 rounded-xl border-2 text-sm font-semibold transition ' +
                    (editing.is_active
                      ? 'border-success bg-emerald-50 text-success'
                      : 'border-border bg-white text-muted')
                  }
                >
                  ✓ Có bán
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(s => ({ ...s, is_active: false }))}
                  className={
                    'py-2 rounded-xl border-2 text-sm font-semibold transition ' +
                    (!editing.is_active
                      ? 'border-danger bg-red-50 text-danger'
                      : 'border-border bg-white text-muted')
                  }
                >
                  ⏸ Tạm ngừng
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
