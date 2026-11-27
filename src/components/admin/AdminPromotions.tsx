import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { deletePromotionFromFirestore, savePromotionToFirestore } from '../../lib/firestoreService';
import { Promotion, PromotionType } from '../../types';

export function AdminPromotions() {
  const { adminPromotions, addToast, requestConfirm } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Promotion>({
    code: '',
    type: 'percentage',
    value: 15,
    minOrderAmount: 200,
    expiresAt: '2027-06-30',
    active: true,
    usageCount: 0,
  });

  const openCreate = () => {
    setIsEditing(false);
    setForm({
      code: '',
      type: 'percentage',
      value: 15,
      minOrderAmount: 200,
      expiresAt: '2027-06-30',
      active: true,
      usageCount: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (promo: Promotion) => {
    setIsEditing(true);
    setForm({ ...promo });
    setModalOpen(true);
  };

  const handleToggleActive = async (promo: Promotion) => {
    try {
      await savePromotionToFirestore({ ...promo, active: !promo.active }, true);
      addToast(
        'info',
        promo.active ? 'Promotion Disabled' : 'Promotion Enabled',
        `${promo.code} is now ${!promo.active ? 'active' : 'disabled'}.`
      );
    } catch {
      addToast('error', 'Update Failed', 'Unable to toggle promotion.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = form.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanCode.length < 3) {
      addToast('error', 'Invalid Code', 'Code must be at least 3 alphanumeric characters.');
      return;
    }
    setSaving(true);
    try {
      await savePromotionToFirestore({ ...form, code: cleanCode }, isEditing);
      addToast('success', isEditing ? 'Promotion Updated' : 'Promotion Created', `Code ${cleanCode} saved.`);
      setModalOpen(false);
    } catch {
      addToast('error', 'Save Failed', 'Verify discount values (percentage 1–90%, fixed $1–$10,000).');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (promo: Promotion) => {
    requestConfirm({
      title: `Delete promotion "${promo.code}"?`,
      message: 'Customers will no longer be able to redeem this discount code at checkout.',
      confirmLabel: 'Delete Code',
      destructive: true,
      onConfirm: async () => {
        try {
          await deletePromotionFromFirestore(promo.code);
          addToast('info', 'Promotion Deleted', `${promo.code} removed.`);
        } catch {
          addToast('error', 'Delete Failed', 'Could not delete promotion.');
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white tracking-tight">
            Promotion Management
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Create percentage or fixed discount codes verified server-side at checkout.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-medium rounded-lg hover:opacity-90 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Create Discount Code</span>
        </button>
      </div>

      <div className="glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden min-w-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-500">
                <th className="py-3.5 px-5 font-medium">Code</th>
                <th className="py-3.5 px-3 font-medium">Discount</th>
                <th className="py-3.5 px-3 text-right font-medium">Min. Order</th>
                <th className="py-3.5 px-3 font-medium">Expires</th>
                <th className="py-3.5 px-3 font-medium">Status</th>
                <th className="py-3.5 px-5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {adminPromotions.map((promo) => (
                <tr key={promo.code} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                  <td className="py-3.5 px-5 font-mono font-semibold text-zinc-950 dark:text-white">
                    {promo.code}
                  </td>
                  <td className="py-3.5 px-3 font-mono tabular-nums">
                    {promo.type === 'percentage' ? `${promo.value}% off` : `$${promo.value} off`}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                    ${promo.minOrderAmount}
                  </td>
                  <td className="py-3.5 px-3 font-mono text-zinc-500">{promo.expiresAt}</td>
                  <td className="py-3.5 px-3">
                    <button
                      onClick={() => handleToggleActive(promo)}
                      className={`text-xs font-medium underline underline-offset-4 cursor-pointer ${
                        promo.active
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {promo.active ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="inline-flex items-center gap-3">
                      <button
                        onClick={() => openEdit(promo)}
                        className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white font-medium cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(promo)}
                        aria-label={`Delete ${promo.code}`}
                        className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setModalOpen(false)}
        >
          <form
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
                {isEditing ? `Edit ${form.code}` : 'New Promotion Code'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Promo Code *
              </label>
              <input
                type="text"
                required
                disabled={isEditing}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="WINTER20"
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono uppercase text-sm disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-1 min-[376px]:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Discount Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as PromotionType })}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount ($)</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Value ({form.type === 'percentage' ? '1–90%' : 'USD'})
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={form.type === 'percentage' ? 90 : 10000}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 min-[376px]:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Min Order Amount ($)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50000}
                  value={form.minOrderAmount}
                  onChange={(e) => setForm({ ...form, minOrderAmount: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Expiration Date
                </label>
                <input
                  type="date"
                  required
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono text-sm"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <span>Promotion Active</span>
            </label>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-medium cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Promotion'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
