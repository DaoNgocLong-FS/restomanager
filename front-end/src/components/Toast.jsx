// =============================================================================
//  Toast — thông báo nhanh, không chặn UI
//  - useToast() trả về { ok, info, err } để gọi từ component
//  - Ở root app render <ToastProvider> bao quanh, <ToastViewport> sẽ tự render
// =============================================================================
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, Info, XCircle, X } from 'lucide-react';

const ToastCtx = createContext(null);

const ICONS = {
  success: CheckCircle2,
  info:    Info,
  error:   XCircle,
};
const COLORS = {
  success: 'border-emerald-500 text-emerald-700',
  info:    'border-sky-500 text-sky-700',
  error:   'border-red-500 text-red-700',
};

let _id = 0;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const remove = useCallback((id) => {
    setItems(arr => arr.filter(x => x.id !== id));
  }, []);

  const push = useCallback((type, title, message, durationMs = 2800) => {
    const id = ++_id;
    setItems(arr => [...arr, { id, type, title, message }]);
    setTimeout(() => remove(id), durationMs);
  }, [remove]);

  const api = {
    ok:   (title, message) => push('success', title, message),
    info: (title, message) => push('info',    title, message),
    err:  (title, message) => push('error',   title, message),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastViewport items={items} onClose={remove} />
    </ToastCtx.Provider>
  );
}

function ToastViewport({ items, onClose }) {
  return (
    <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
      {items.map(t => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div
            key={t.id}
            role="status"
            className={
              'pointer-events-auto flex items-start gap-3 px-4 py-3 bg-white rounded-xl shadow-card ' +
              'border-l-4 ' + (COLORS[t.type] || COLORS.info) +
              ' min-w-[280px] max-w-sm animate-pop-in'
            }
          >
            <Icon className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-on-surface truncate">{t.title}</div>
              {t.message && (
                <div className="text-xs text-muted mt-0.5 break-words">{t.message}</div>
              )}
            </div>
            <button
              onClick={() => onClose(t.id)}
              className="text-muted hover:text-on-surface transition"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}
