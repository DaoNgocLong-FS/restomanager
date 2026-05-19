// =============================================================================
//  AdminLogs — bảng nhật ký 200 hoạt động gần nhất
// =============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Api } from '../api/client';
import { useToast } from '../components/Toast';

const dt = (s) => s ? new Date(s).toLocaleString('vi-VN') : '—';

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setLogs(await Api.listLogs({ limit: 200 }) || []); }
    catch (e) { toast.err('Không tải được nhật ký', e.message); }
    finally   { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Nhật ký hệ thống</h1>
          <p className="text-sm text-muted">200 hoạt động gần nhất.</p>
        </div>
        <button onClick={load} className="btn-ghost text-sm py-2" disabled={loading}>
          <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
          Làm mới
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-low text-muted">
              <tr>
                <th className="px-4 py-3 text-left">Thời điểm</th>
                <th className="px-4 py-3 text-left">Người dùng</th>
                <th className="px-4 py-3 text-left">Hành động</th>
                <th className="px-4 py-3 text-left">Đối tượng</th>
                <th className="px-4 py-3 text-left">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {loading ? (
                <tr><td colSpan={5} className="text-center text-muted py-8">Đang tải…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-muted py-8">Chưa có nhật ký nào.</td></tr>
              ) : logs.map((l, i) => (
                <tr key={l.id || i} className="hover:bg-surface-low transition">
                  <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{dt(l.created_at)}</td>
                  <td className="px-4 py-3 text-on-surface">{l.username || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">{l.action}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {l.entity_type || ''}{l.entity_id ? ' #' + l.entity_id : ''}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted max-w-md">
                    <pre className="whitespace-pre-wrap break-words font-sans">
                      {l.details ? JSON.stringify(l.details) : ''}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
