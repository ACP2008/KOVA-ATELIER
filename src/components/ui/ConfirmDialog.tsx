import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';

export function ConfirmDialog() {
  const { confirmState, closeConfirm } = useStore();
  const [busy, setBusy] = useState(false);

  if (!confirmState?.open) return null;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await confirmState.onConfirm();
    } finally {
      setBusy(false);
      closeConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {confirmState.title}
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
          {confirmState.message}
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 mt-6">
          <button
            type="button"
            disabled={busy}
            onClick={closeConfirm}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleConfirm}
            className={`w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer ${
              confirmState.destructive
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90'
            }`}
          >
            {busy ? 'Processing...' : confirmState.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
