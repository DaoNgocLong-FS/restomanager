// =============================================================================
//  AdminUsers — CRUD nhân viên (admin / cashier / waiter), khoá/mở tài khoản
// =============================================================================
import React, { useCallback, useEffect, useState } from 'react';
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
  id: null, full_name: '', username: '', password: '',
  role: 'waiter', email: '', phone: '', is_active: true,
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // null = closed, {} = form state
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try { setUsers(await Api.listUsers() || []); }
    catch (e) { toast.err('Không tải được danh sách', e.message); }
    finally   { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => setEditing({ ...EMPTY });
  const openEdit   = (u) => setEditing({
    id: u.id, full_name: u.full_name || '', username: u.username,
    password: '', role: u.role,
    email: u.email || '', phone: u.phone || '', is_active: !!u.is_active,
  });

  const onSave = async () => {
    const f = editing;
    if (!f.full_name?.trim() || !f.username?.trim()) {
      toast.err('Thiếu thông tin', 'Họ tên và tên đăng nhập là bắt buộc.');
      return;
    }
    if (!f.id && !f.password?.trim()) {
      toast.err('Thiếu mật khẩu', 'Khi tạo mới cần đặt mật khẩu.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        full_name: f.full_name.trim(),
        username:  f.username.trim(),
        role:      f.role,
        email:     f.email?.trim() || null,
        phone:     f.phone?.trim() || null,
        is_active: !!f.is_active,
      };
      if (f.id) await Api.updateUser(f.id, payload);
      else      await Api.createUser({ ...payload, password: f.password });
      setEditing(null);
      toast.ok('Đã lưu');
      load();
    } catch (e) {
      toast.err('Lưu thất bại', e.message);
    } finally { setSaving(false); }
  };

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
                      <button
                        onClick={() => openEdit(u)}
                        className="text-muted hover:text-primary transition p-1"
                        title="Sửa"
                      ><Edit2 className="w-4 h-4" /></button>
                      <button
                        onClick={() => onDelete(u)}
                        className="text-muted hover:text-danger transition p-1 ml-1"
                        title="Xoá"
                      ><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!editing}
        title={editing?.id ? 'Sửa nhân viên' : 'Thêm nhân viên'}
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
            <Field label="Họ và tên" value={editing.full_name}
              onChange={(v) => setEditing(s => ({ ...s, full_name: v }))} />
            <Field label="Tên đăng nhập" value={editing.username}
              onChange={(v) => setEditing(s => ({ ...s, username: v }))} />
            {!editing.id && (
              <Field label="Mật khẩu" type="password" value={editing.password}
                onChange={(v) => setEditing(s => ({ ...s, password: v }))} />
            )}
            <label className="block">
              <span className="text-xs text-muted">Vai trò</span>
              <select
                value={editing.role}
                onChange={(e) => setEditing(s => ({ ...s, role: e.target.value }))}
                className="field mt-1 py-2"
              >
                <option value="admin">Quản trị viên</option>
                <option value="cashier">Thu ngân</option>
                <option value="waiter">Nhân viên phục vụ</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" value={editing.email}
                onChange={(v) => setEditing(s => ({ ...s, email: v }))} />
              <Field label="SĐT" value={editing.phone}
                onChange={(v) => setEditing(s => ({ ...s, phone: v }))} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(e) => setEditing(s => ({ ...s, is_active: e.target.checked }))}
              />
              <span className="text-sm">Đang hoạt động</span>
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="field mt-1 py-2"
      />
    </label>
  );
}
