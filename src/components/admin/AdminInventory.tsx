import React, { useMemo, useState } from 'react';
import { AlertTriangle, History, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { adjustProductVariantStock } from '../../lib/firestoreService';
import { Product } from '../../types';
import { ResilientImage } from '../ui/ResilientImage';

interface AdminInventoryProps {
  globalSearch: string;
}

export function AdminInventory({ globalSearch }: AdminInventoryProps) {
  const { products, adminInventoryLogs, user, addToast } = useStore();

  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [delta, setDelta] = useState<number>(5);
  const [reason, setReason] = useState('Supplier restock delivery');
  const [submitting, setSubmitting] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyLowStock && p.stockQuantity > 5) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.sku.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [products, onlyLowStock, globalSearch]);

  const lowStockCount = products.filter((p) => p.stockQuantity <= 5).length;

  const openAdjustModal = (p: Product) => {
    setSelectedProduct(p);
    setSelectedSize(p.sizes[0] || 'M');
    setSelectedColor(p.colors[0]?.name || 'Obsidian');
    setDelta(5);
    setReason('Supplier restock delivery');
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || delta === 0) return;
    setSubmitting(true);
    try {
      await adjustProductVariantStock({
        product: selectedProduct,
        size: selectedSize,
        color: selectedColor,
        change: Math.round(delta),
        reason,
        performedBy: user?.email || 'Admin',
      });
      addToast(
        'success',
        'Inventory Adjusted',
        `${selectedProduct.name} (${selectedSize} / ${selectedColor}) updated by ${delta > 0 ? `+${delta}` : delta}.`
      );
      setSelectedProduct(null);
    } catch {
      addToast('error', 'Adjustment Failed', 'Unable to update stock. Ensure catalog is initialized in Firestore.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white tracking-tight">
            Inventory Management
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Control stock by size and color with full adjustment audit trails.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-200/70 dark:bg-zinc-800/70 rounded-lg self-start">
          <button
            onClick={() => setOnlyLowStock(false)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              !onlyLowStock
                ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            All Inventory ({products.length})
          </button>
          <button
            onClick={() => setOnlyLowStock(true)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 cursor-pointer ${
              onlyLowStock
                ? 'bg-white dark:bg-zinc-950 text-red-600 dark:text-red-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Stock ({lowStockCount})</span>
          </button>
        </div>
      </div>

      {/* Inventory Matrix Table */}
      <div className="glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-500">
                <th className="py-3.5 px-5 font-medium">Product</th>
                <th className="py-3.5 px-3 font-medium">Variant Breakdown (Size / Color)</th>
                <th className="py-3.5 px-3 text-right font-medium">Total Units</th>
                <th className="py-3.5 px-5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 align-top">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <ResilientImage
                        src={p.images[0]}
                        alt={p.name}
                        className="w-10 h-12 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800 shrink-0"
                      />
                      <div>
                        <p className="font-medium text-zinc-950 dark:text-white">{p.name}</p>
                        <p className="font-mono text-[11px] text-zinc-500 mt-0.5">{p.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-mono tabular-nums text-zinc-600 dark:text-zinc-400 max-w-xl">
                      {Object.entries(p.variantStock).map(([key, qty]) => (
                        <span
                          key={key}
                          className={
                            qty <= 1 ? 'text-red-600 dark:text-red-400 font-semibold' : ''
                          }
                        >
                          {key.replace('_', '·')}: {qty}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-3 text-right font-mono tabular-nums">
                    <span
                      className={`text-sm font-semibold ${
                        p.stockQuantity <= 5
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-zinc-950 dark:text-white'
                      }`}
                    >
                      {p.stockQuantity}
                    </span>
                    {p.stockQuantity <= 5 && (
                      <span className="block text-[10px] font-sans text-red-600 dark:text-red-400">
                        Low Stock Alert
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <button
                      onClick={() => openAdjustModal(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-300 text-xs font-medium cursor-pointer whitespace-nowrap"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Adjust Stock</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment History Log */}
      <div className="glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
            Stock Adjustment History
          </h2>
        </div>

        {adminInventoryLogs.length === 0 ? (
          <p className="text-xs text-zinc-500 py-6 text-center">
            No stock adjustments logged yet. Use &ldquo;Adjust Stock&rdquo; above to record changes.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-500">
                  <th className="py-2.5 pr-4 font-medium">Timestamp</th>
                  <th className="py-2.5 px-3 font-medium">Product</th>
                  <th className="py-2.5 px-3 font-medium">Variant</th>
                  <th className="py-2.5 px-3 text-right font-medium">Change</th>
                  <th className="py-2.5 px-3 text-right font-medium">New Qty</th>
                  <th className="py-2.5 px-3 font-medium">Reason</th>
                  <th className="py-2.5 pl-3 font-medium">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {adminInventoryLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 pr-4 font-mono text-zinc-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-medium text-zinc-950 dark:text-white">
                      {log.productName}
                    </td>
                    <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                      {log.size} / {log.color}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono font-semibold tabular-nums ${
                        log.change >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {log.change >= 0 ? `+${log.change}` : log.change}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">{log.newStock}</td>
                    <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">{log.reason}</td>
                    <td className="py-3 pl-3 text-zinc-500">{log.performedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <form
            onSubmit={handleAdjustSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5 shadow-2xl text-xs"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
                  Adjust Variant Stock
                </h3>
                <p className="text-zinc-500 mt-0.5">{selectedProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Size
                </label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                  {selectedProduct.sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Color
                </label>
                <select
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                  {selectedProduct.colors.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 flex items-center justify-between">
              <span className="text-zinc-500">Current Variant Stock</span>
              <span className="font-mono font-semibold text-sm tabular-nums">
                {selectedProduct.variantStock[`${selectedSize}_${selectedColor}`] ?? 0} units
              </span>
            </div>

            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Quantity Change (use negative to deduct)
              </label>
              <input
                type="number"
                required
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Adjustment Reason *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Restock, manual cycle count, damaged unit..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || delta === 0}
                className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-medium disabled:opacity-40 cursor-pointer"
              >
                {submitting ? 'Updating...' : 'Apply Adjustment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
