// =============================================================================
//  AdminUsers — CRUD nhân viên (validate form bằng react-hook-form)
// =============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { UserPlus, Edit2, Trash2 } from 'lucide-react';
import { Api } from '../api/client';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import Modal from '../components/Modal';

const ROLE_META = {
  admin:   { label: 'Quản trị viên',     cls: 'bg-red-100 text-red-700' },
  cashier: { label: 'Thu ngân',          cls: 'bg-blue-100 text-blue-700' },
  waiter:  { label: 'Nhân viên phục vụ', cls: 'bg-emerald-100 text-emerald-700' },
};

const EMPTY = {
  full_name: '', username: '', password: '',
  role: 'waiter', email: '', phone: '', is_active: true,
};

export default function AdminUsers() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);  // null | { id?:number }  (id có khi là edit)
  const toast   = useToast();
  const confirm = useConfirm();

  // ── danh sách
  const load = useCallback(async () => {
    try { setUsers(await Api.listUsers() || []); }
    catch (e) { toast.err('Không tải được danh sách', e.message); }
    finally   { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => setEditing({});           // không có id → tạo mới
  const openEdit   = (u) => setEditing({ id: u.id, ...u, password: '' });

  const onDelete = async (u) => {
    const ok = await confirm({
      title: 'Xoá nhân viên?',
      message: `Sẽ xoá tài khoản "${u.username}". Không thể hoàn tác.`,
      okText: 'Xoá', danger: true,
    });
    if (!ok) return;
    try {
      await Api.deleteUser(u.id);
      toast.ok('Đã xoá');
      load();
    } catch (e) { toast.err('Xoá thất bại', e.message); }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Nhân viên</h1>
          <p className="text-sm text-muted">Quản lý tài khoản và phân quyền.</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm py-2">
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Thêm nhân viên</span>
        </button>
      </div>

      {/* Bảng */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-low text-muted">
              <tr>
                <th className="px-4 py-3 text-left">Họ tên</th>
                <th className="px-4 py-3 text-left">Tài khoản</th>
                <th className="px-4 py-3 text-left">Vai trò</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">SĐT</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {loading ? (
                <tr><td colSpan={7} className="text-center text-muted py-8">Đang tải…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted py-8">Chưa có nhân viên.</td></tr>
              ) : users.map(u => {
                const rm = ROLE_META[u.role] || { label: u.role, cls: 'bg-slate-100 text-slate-700' };
                return (
                  <tr key={u.id} className="hover:bg-surface-low transition">
                    <td className="px-4 py-3 font-medium text-on-surface">{u.full_name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={'px-2 py-0.5 rounded-full text-xs font-semibold ' + rm.cls}>
                        {rm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{u.email || '—'}</td>
                    <td className="px-4 py-3 text-muted">{u.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={
                        'px-2 py-0.5 rounded-full text-xs font-semibold ' +
                        (u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')
                      }>
                        {u.is_active ? 'Hoạt động' : 'Tạm khoá'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(u)}
                        className="text-muted hover:text-primary transition p-1" title="Sửa">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDelete(u)}
                        className="text-muted hover:text-danger transition p-1 ml-1" title="Xoá">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal form, mount/unmount theo `editing` để useForm reset đúng */}
      {editing && (
        <UserForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// =============================================================================
//  Form CRUD (component riêng để useForm tự reset mỗi lần mở)
// =============================================================================
function UserForm({ initial, onClose, onSaved }) {
  const isEdit = !!initial.id;
  const toast  = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    defaultValues: { ...EMPTY, ...initial },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const onSubmit = async (form) => {
    const payload = {
      full_name: form.full_name.trim(),
      username:  form.username.trim(),
      role:      form.role,
      email:     form.email?.trim() || null,
      phone:     form.phone?.trim() || null,
      is_active: !!form.is_active,
    };
    try {
      if (isEdit) {
        await Api.updateUser(initial.id, payload);
      } else {
        await Api.createUser({ ...payload, password: form.password });
      }
      toast.ok('Đã lưu');
      onSaved();
    } catch (e) {
      // Đẩy lỗi từ server lên field nếu có thể (vd username trùng)
      const msg = e.message || '';
      if (/đã tồn tại/i.test(msg) || /tồn tại/i.test(msg)) {
        setError('username', { type: 'server', message: msg });
      } else {
        toast.err('Lưu thất bại', msg);
      }
    }
  };

  return (
    <Modal
      open
      title={isEdit ? 'Sửa nhân viên' : 'Thêm nhân viên'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost text-sm py-2" onClick={onClose}>
            Huỷ
          </button>
          <button
            type="submit" form="user-form"
            className="btn-primary text-sm py-2" disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang lưu…' : 'Lưu'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        <Field label="Họ và tên" error={errors.full_name?.message}>
          <input
            className={'field py-2 ' + (errors.full_name ? 'border-danger' : '')}
            {...register('full_name', {
              required: 'Họ tên là bắt buộc',
              minLength: { value: 2, message: 'Họ tên tối thiểu 2 ký tự' },
              maxLength: { value: 100, message: 'Họ tên tối đa 100 ký tự' },
              setValueAs: (v) => (v ?? '').trim(),
            })}
          />
        </Field>

        <Field label="Tên đăng nhập" error={errors.username?.message}>
          <input
            className={'field py-2 ' + (errors.username ? 'border-danger' : '')}
            disabled={isEdit}
            {...register('username', {
              required: 'Tên đăng nhập là bắt buộc',
              pattern: {
                value: /^[a-zA-Z0-9_.-]{3,30}$/,
                message: 'Chỉ chữ/số/. _ - và dài 3–30 ký tự',
              },
              setValueAs: (v) => (v ?? '').trim().toLowerCase(),
            })}
          />
        </Field>

        {!isEdit && (
          <Field label="Mật khẩu" error={errors.password?.message}>
            <input
              type="password"
              className={'field py-2 ' + (errors.password ? 'border-danger' : '')}
              {...register('password', {
                required: 'Mật khẩu là bắt buộc khi tạo mới',
                minLength: { value: 6, message: 'Mật khẩu tối thiểu 6 ký tự' },
                maxLength: { value: 72, message: 'Mật khẩu tối đa 72 ký tự (giới hạn bcrypt)' },
              })}
            />
          </Field>
        )}

        <Field label="Vai trò" error={errors.role?.message}>
          <select
            className={'field py-2 ' + (errors.role ? 'border-danger' : '')}
            {...register('role', {
              required: 'Chọn vai trò',
              validate: (v) => ['admin', 'cashier', 'waiter'].includes(v) || 'Vai trò không hợp lệ',
            })}
          >
            <option value="admin">Quản trị viên</option>
            <option value="cashier">Thu ngân</option>
            <option value="waiter">Nhân viên phục vụ</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" error={errors.email?.message}>
            <input
              type="email"
              className={'field py-2 ' + (errors.email ? 'border-danger' : '')}
              {...register('email', {
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Email không hợp lệ',
                },
                setValueAs: (v) => (v ?? '').trim() || null,
              })}
            />
          </Field>

          <Field label="SĐT" error={errors.phone?.message}>
            <input
              className={'field py-2 ' + (errors.phone ? 'border-danger' : '')}
              {...register('phone', {
                pattern: {
                  value: /^[0-9+()\s-]{8,15}$/,
                  message: 'SĐT 8–15 số',
                },
                setValueAs: (v) => (v ?? '').trim() || null,
              })}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('is_active')} />
          <span className="text-sm">Đang hoạt động</span>
        </label>
      </form>
    </Modal>
  );
}

// ── Field wrapper hiển thị label + error message ──────────────────────────
function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </label>
  );
}
