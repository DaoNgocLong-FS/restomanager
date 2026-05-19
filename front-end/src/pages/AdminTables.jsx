// =============================================================================
//  AdminTables — CRUD bàn (validate bằng react-hook-form)
// =============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Api } from '../api/client';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { useSocket } from '../hooks/useSocket';
import Modal from '../components/Modal';

const ZONE_LABEL = { indoor: 'Trong nhà', outdoor: 'Sân vườn', vip: 'VIP' };
const ZONE_VALUES = ['indoor', 'outdoor', 'vip'];

export default function AdminTables() {
  const [tables, setTables]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const toast   = useToast();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try { setTables(await Api.listTables() || []); }
    catch (e) { toast.err('Không tải được danh sách bàn', e.message); }
    finally   { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useSocket({ 'tables:changed': load });

  const openCreate = () => setEditing({ code: '', zone: 'indoor', capacity: 4, is_active: true });
  const openEdit   = (t) => setEditing({ id: t.id, ...t });

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
                <button onClick={() => openEdit(t)} className="btn-ghost text-xs py-1.5 flex-1">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(t)} className="btn-ghost text-xs py-1.5 text-danger">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TableForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// =============================================================================
//  Form CRUD bàn
// =============================================================================
function TableForm({ initial, onClose, onSaved }) {
  const isEdit = !!initial.id;
  const toast  = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    defaultValues: initial,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const onSubmit = async (form) => {
    const payload = {
      code: form.code.trim().toUpperCase(),
      zone: form.zone,
      capacity: Number(form.capacity),
      is_active: !!form.is_active,
    };
    try {
      if (isEdit) await Api.updateTable(initial.id, payload);
      else        await Api.createTable(payload);
      toast.ok('Đã lưu');
      onSaved();
    } catch (e) {
      const msg = e.message || '';
      if (/tồn tại/i.test(msg) || /trùng/i.test(msg) || /duplicate/i.test(msg)) {
        setError('code', { type: 'server', message: 'Mã bàn đã tồn tại' });
      } else {
        toast.err('Lưu thất bại', msg);
      }
    }
  };

  return (
    <Modal
      open
      title={isEdit ? 'Sửa bàn' : 'Thêm bàn'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost text-sm py-2" onClick={onClose}>Huỷ</button>
          <button type="submit" form="table-form"
            className="btn-primary text-sm py-2" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu…' : 'Lưu'}
          </button>
        </>
      }
    >
      <form id="table-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        <Field label="Mã bàn (VD: T1-07)" error={errors.code?.message}>
          <input
            placeholder="VD: T1-07"
            className={'field py-2 uppercase ' + (errors.code ? 'border-danger' : '')}
            {...register('code', {
              required: 'Mã bàn là bắt buộc',
              pattern: {
                value: /^[A-Z0-9-]{2,10}$/i,
                message: 'Chỉ chữ/số/dấu - và dài 2–10 ký tự',
              },
              setValueAs: (v) => (v ?? '').trim().toUpperCase(),
            })}
          />
        </Field>

        <Field label="Khu vực" error={errors.zone?.message}>
          <select
            className={'field py-2 ' + (errors.zone ? 'border-danger' : '')}
            {...register('zone', {
              required: 'Chọn khu vực',
              validate: (v) => ZONE_VALUES.includes(v) || 'Khu vực không hợp lệ',
            })}
          >
            <option value="indoor">Trong nhà</option>
            <option value="outdoor">Sân vườn</option>
            <option value="vip">VIP</option>
          </select>
        </Field>

        <Field label="Sức chứa (số người)" error={errors.capacity?.message}>
          <input
            type="number" min="1" max="50"
            className={'field py-2 ' + (errors.capacity ? 'border-danger' : '')}
            {...register('capacity', {
              required: 'Sức chứa là bắt buộc',
              valueAsNumber: true,
              min: { value: 1, message: 'Tối thiểu 1 người' },
              max: { value: 50, message: 'Tối đa 50 người' },
              validate: (v) => Number.isInteger(Number(v)) || 'Phải là số nguyên',
            })}
          />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('is_active')} />
          <span className="text-sm">Đang sử dụng</span>
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
