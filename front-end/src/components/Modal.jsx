// =============================================================================
//  Modal — overlay dùng chung cho mọi dialog có form (Users / Menu / Tables…)
//  - Đóng khi click backdrop hoặc nhấn Escape
//  - Khoá scroll body khi mở
// =============================================================================
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, title, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeCls = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    '2xl': 'max-w-3xl',
  }[size] || 'max-w-md';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-pop-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog" aria-modal="true"
    >
      <div className={`bg-white rounded-2xl w-full ${sizeCls} max-h-[90vh] flex flex-col overflow-hidden shadow-card`}>
        <div className="px-6 py-4 border-b border-border-soft flex items-center justify-between">
          <h3 className="font-bold text-lg text-on-surface">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-on-surface transition"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="px-6 py-3 border-t border-border-soft flex justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
}
