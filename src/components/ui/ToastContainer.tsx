import React from 'react';
import { Check, Info, X, AlertCircle } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export function ToastContainer() {
  const { toasts, removeToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-16 inset-x-3 sm:top-auto sm:inset-x-auto sm:bottom-5 sm:right-5 z-50 flex flex-col gap-2.5 sm:max-w-sm sm:w-full pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto glass-panel border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl p-4 shadow-lg flex items-start gap-3 transition-all duration-200"
        >
          <div className="mt-0.5 shrink-0">
            {t.type === 'success' && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
              {t.title}
            </p>
            {t.description && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                {t.description}
              </p>
            )}
          </div>
          <button
            onClick={() => removeToast(t.id)}
            aria-label="Dismiss notification"
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
