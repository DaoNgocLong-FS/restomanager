// =============================================================================
//  Confirm — modal hỏi Yes/No, Promise-based
//  Cách dùng:
//    const confirm = useConfirm();
//    if (!(await confirm({ title:'Xoá?', message:'...', danger:true }))) return;
// =============================================================================
import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, HelpCircle } from 'lucide-react';

const ConfirmCtx = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    open: false, title: '', message: '',
    okText: 'Đồng ý', cancelText: 'Huỷ',
    danger: false, _resolve: null,
  });

  const ask = useCallback((opts) => new Promise((resolve) => {
    setState({
      open: true,
      title:   opts.title   || 'Xác nhận',
      message: opts.message || '',
      okText:  opts.okText  || 'Đồng ý',
      cancelText: opts.cancelText || 'Huỷ',
      danger: !!opts.danger,
      _resolve: resolve,
    });
  }), []);

  const close = useCallback((result) => {
    setState((s) => {
      if (s._resolve) s._resolve(result);
      return { ...s, open: false, _resolve: null };
    });
  }, []);

  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {state.open && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-900/50"
          onClick={() => close(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-3">
              <div className={
                'w-14 h-14 rounded-full flex items-center justify-center ' +
                (state.danger ? 'bg-red-50 text-red-600' : 'bg-primary-container text-primary')
              }>
                {state.danger
                  ? <AlertCircle className="w-7 h-7" />
                  : <HelpCircle  className="w-7 h-7" />}
              </div>
            </div>
            <h3 className="text-center text-lg font-bold text-on-surface">{state.title}</h3>
            {state.message && (
              <p className="text-center text-sm text-muted mt-2 leading-relaxed whitespace-pre-line">
                {state.message}
              </p>
            )}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => close(false)}
                className="btn-ghost flex-1"
                autoFocus
              >
                {state.cancelText}
              </button>
              <button
                onClick={() => close(true)}
                className={state.danger ? 'btn-danger flex-1' : 'btn-primary flex-1'}
              >
                {state.okText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const fn = useContext(ConfirmCtx);
  if (!fn) throw new Error('useConfirm must be inside <ConfirmProvider>');
  return fn;
}
