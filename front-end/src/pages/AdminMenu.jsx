// =============================================================================
//  AdminMenu — CRUD món + upload ảnh (validate bằng react-hook-form)
// =============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Plus, ImageOff, Edit2, Trash2 } from 'lucide-react';
import { Api, fmt } from '../api/client';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import Modal from '../components/Modal';

const MAX_IMG_BYTES = 5 * 1024 * 1024;            // 5 MB (khớp với multer ở backend)
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function AdminMenu() {
  const [categories, setCategories] = useState([]);
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(null);
  const toast   = useToast();
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
    name: '', category_id: categories[0]?.id || '', price: '',
    description: '', is_available: true,
    imageFile: null, currentImageUrl: null,
  });
  const openEdit = (m) => setEditing({
    id: m.id,
    name: m.name,
    category_id: m.category_id || categories[0]?.id || '',
    price: String(m.price ?? ''),
    description: m.description || '',
    is_available: !!m.is_available,
    imageFile: null,
    currentImageUrl: m.image_url || null,
  });

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
                  <img src={m.image_url} alt={m.name}
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
                    (m.is_available ? 'text-success' : 'text-danger')
                  }>{m.is_available ? 'Đang bán' : 'Tạm ngừng'}</span>
                </div>
                <div className="text-xs text-muted mt-1 line-clamp-2 min-h-[2.5em]">
                  {m.description || '—'}
                </div>
                <div className="text-xs text-muted mt-2">{m.category_name || ''}</div>
                <div className="font-bold text-primary mt-1">{fmt(m.price)}</div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-border-soft">
                  <button onClick={() => openEdit(m)} className="btn-ghost text-xs py-1.5 flex-1">
                    <Edit2 className="w-3.5 h-3.5" /> Sửa
                  </button>
                  <button onClick={() => onDelete(m)} className="btn-ghost text-xs py-1.5 text-danger">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <MenuItemForm
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// =============================================================================
//  Form CRUD món
// =============================================================================
function MenuItemForm({ initial, categories, onClose, onSaved }) {
  const isEdit = !!initial.id;
  const toast  = useToast();
  const [preview, setPreview] = useState(initial.currentImageUrl || null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: initial,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  // Khi user chọn file mới → cập nhật preview (data URL)
  const onPickImage = (file) => {
    setValue('imageFile', file, { shouldValidate: true });
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(initial.currentImageUrl || null);
    }
  };

  const onSubmit = async (form) => {
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('category_id', form.category_id);
      fd.append('price', String(form.price));
      fd.append('description', form.description || '');
      fd.append('is_available', form.is_available ? 'true' : 'false');
      if (form.imageFile instanceof File) fd.append('image', form.imageFile);

      if (isEdit) await Api.updateMenuItem(initial.id, fd);
      else        await Api.createMenuItem(fd);
      toast.ok('Đã lưu');
      onSaved();
    } catch (e) {
      toast.err('Lưu thất bại', e.message);
    }
  };

  return (
    <Modal
      open
      title={isEdit ? 'Sửa món' : 'Thêm món'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-ghost text-sm py-2" onClick={onClose}>Huỷ</button>
          <button
            type="submit" form="menu-form"
            className="btn-primary text-sm py-2" disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang lưu…' : 'Lưu'}
          </button>
        </>
      }
    >
      <form id="menu-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        <Field label="Tên món" error={errors.name?.message}>
          <input
            className={'field py-2 ' + (errors.name ? 'border-danger' : '')}
            {...register('name', {
              required: 'Tên món là bắt buộc',
              minLength: { value: 2, message: 'Tối thiểu 2 ký tự' },
              maxLength: { value: 150, message: 'Tối đa 150 ký tự' },
              setValueAs: (v) => (v ?? '').trim(),
            })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Danh mục" error={errors.category_id?.message}>
            <select
              className={'field py-2 ' + (errors.category_id ? 'border-danger' : '')}
              {...register('category_id', { required: 'Chọn danh mục' })}
            >
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <Field label="Giá (VND)" error={errors.price?.message}>
            <input
              type="number" min="0" step="1000"
              className={'field py-2 ' + (errors.price ? 'border-danger' : '')}
              {...register('price', {
                required: 'Giá là bắt buộc',
                valueAsNumber: true,
                min: { value: 0, message: 'Giá không được âm' },
                max: { value: 99999999, message: 'Giá quá lớn' },
                validate: (v) => (Number.isFinite(Number(v)) || 'Giá phải là số'),
              })}
            />
          </Field>
        </div>

        <Field label="Mô tả" error={errors.description?.message}>
          <textarea
            rows={2}
            className={'field py-2 ' + (errors.description ? 'border-danger' : '')}
            {...register('description', {
              maxLength: { value: 500, message: 'Tối đa 500 ký tự' },
            })}
          />
        </Field>

        {/* File input dùng Controller vì cần custom logic preview */}
        <Field label="Hình ảnh (JPG/PNG/WebP/GIF, tối đa 5 MB)" error={errors.imageFile?.message}>
          <Controller
            control={control}
            name="imageFile"
            rules={{
              validate: (file) => {
                if (!file) return true;             // optional
                if (!(file instanceof File)) return true;
                if (!ALLOWED_MIMES.includes(file.type))
                  return 'Định dạng không hỗ trợ (chỉ JPG/PNG/WebP/GIF)';
                if (file.size > MAX_IMG_BYTES)
                  return `File lớn hơn ${(MAX_IMG_BYTES / 1024 / 1024).toFixed(0)} MB`;
                return true;
              },
            }}
            render={() => (
              <input
                type="file" accept="image/*"
                onChange={(e) => onPickImage(e.target.files?.[0] || null)}
                className="mt-1 w-full text-sm"
              />
            )}
          />
        </Field>

        {preview && (
          <img src={preview}
            className="rounded-lg border border-border-soft max-h-32"
            alt="preview"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('is_available')} />
          <span className="text-sm">Đang bán</span>
        </label>
      </form>
    </Modal>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </label>
  );
}
