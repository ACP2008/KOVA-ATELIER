import React, { useMemo, useState } from 'react';
import { Edit3, Image as ImageIcon, Plus, Trash2, Upload, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  deleteProductFromFirestore,
  sanitizeId,
  sanitizeSku,
  sanitizeSlug,
  saveProductToFirestore,
  updateProductBadgeInFirestore,
} from '../../lib/firestoreService';
import { uploadImageToStorage } from '../../lib/firebase';
import {
  ADMIN_BADGE_OPTIONS,
  DEFAULT_LOW_STOCK_THRESHOLD,
  getBadgeStyleClasses,
  resolveProductBadges,
} from '../../lib/productBadges';
import { MENS_CATEGORIES, MENS_SIZES, STUDIO_MEDIA_LIBRARY } from '../../data/seedCatalog';
import { Product, ProductBadge, ProductCategory, ProductColor, ProductStatus } from '../../types';
import { ResilientImage } from '../ui/ResilientImage';

const CATEGORIES: ProductCategory[] = MENS_CATEGORIES;
const ALL_SIZES = MENS_SIZES;

interface AdminProductsProps {
  globalSearch: string;
}

const EMPTY_FORM: Omit<Product, 'createdAt' | 'updatedAt'> = {
  id: '',
  name: '',
  slug: '',
  category: 'Oversized T-Shirts',
  description: '',
  fabricInfo: '100% Organic Combed Cotton (280 GSM). Machine wash cold.',
  price: 78,
  discountPrice: 0,
  sku: '',
  sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  colors: [{ name: 'Obsidian', hex: '#141416' }],
  images: [STUDIO_MEDIA_LIBRARY[2].url],
  stockQuantity: 20,
  variantStock: {
    S_Obsidian: 4,
    M_Obsidian: 4,
    L_Obsidian: 4,
    XL_Obsidian: 4,
    XXL_Obsidian: 4,
  },
  featured: false,
  newArrival: true,
  bestSeller: false,
  badge: '',
  status: 'active',
};

export function AdminProducts({ globalSearch }: AdminProductsProps) {
  const { products, siteSettings, addToast, requestConfirm } = useStore();
  const lowStockThreshold = siteSettings.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Omit<Product, 'createdAt' | 'updatedAt'>>(EMPTY_FORM);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#27272A');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingBadgeId, setUpdatingBadgeId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.sku.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [products, categoryFilter, statusFilter, globalSearch]);

  const openCreateModal = () => {
    setIsEditing(false);
    setForm({
      ...EMPTY_FORM,
      id: `prod-${Date.now()}`,
      sku: `KOVA-NEW-${Math.floor(100 + Math.random() * 900)}`,
    });
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setIsEditing(true);
    setForm({
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.category,
      description: product.description,
      fabricInfo: product.fabricInfo,
      price: product.price,
      discountPrice: product.discountPrice,
      sku: product.sku,
      sizes: [...product.sizes],
      colors: product.colors.map((c) => ({ ...c })),
      images: [...product.images],
      stockQuantity: product.stockQuantity,
      variantStock: { ...product.variantStock },
      featured: product.featured,
      newArrival: product.newArrival,
      bestSeller: product.bestSeller,
      badge: product.badge ?? '',
      status: product.status,
    });
    setModalOpen(true);
  };

  const handleQuickBadgeChange = async (product: Product, nextBadge: ProductBadge) => {
    setUpdatingBadgeId(product.id);
    try {
      await updateProductBadgeInFirestore(product.id, nextBadge);
      addToast(
        'success',
        'Badge Updated',
        nextBadge
          ? `Assigned "${nextBadge}" badge to ${product.name}.`
          : `Cleared manual badge on ${product.name}.`
      );
    } catch (err) {
      console.error(err);
      addToast('error', 'Badge Update Failed', 'Could not update product badge in Firestore.');
    } finally {
      setUpdatingBadgeId(null);
    }
  };

  const syncVariants = (sizes: string[], colors: ProductColor[], currentMap: Record<string, number>) => {
    const next: Record<string, number> = {};
    let total = 0;
    for (const s of sizes) {
      for (const c of colors) {
        const key = `${s}_${c.name}`;
        const qty = key in currentMap ? currentMap[key] : 3;
        next[key] = qty;
        total += qty;
      }
    }
    return { variantStock: next, stockQuantity: total };
  };

  const toggleSize = (sz: string) => {
    const nextSizes = form.sizes.includes(sz)
      ? form.sizes.filter((s) => s !== sz)
      : [...form.sizes, sz];
    if (nextSizes.length === 0) return;
    const synced = syncVariants(nextSizes, form.colors, form.variantStock);
    setForm({ ...form, sizes: nextSizes, ...synced });
  };

  const addColor = () => {
    const name = newColorName.trim();
    if (!name || form.colors.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    const nextColors = [...form.colors, { name, hex: newColorHex }];
    const synced = syncVariants(form.sizes, nextColors, form.variantStock);
    setForm({ ...form, colors: nextColors, ...synced });
    setNewColorName('');
  };

  const removeColor = (name: string) => {
    if (form.colors.length <= 1) return;
    const nextColors = form.colors.filter((c) => c.name !== name);
    const synced = syncVariants(form.sizes, nextColors, form.variantStock);
    setForm({ ...form, colors: nextColors, ...synced });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadImageToStorage(file, 'products');
      setForm((prev) => ({ ...prev, images: [...prev.images, url].slice(0, 8) }));
      addToast('success', 'Image Uploaded', 'Uploaded to Firebase Storage.');
    } catch {
      addToast(
        'error',
        'Storage Upload Unavailable',
        'Select from the Studio Media Library or paste a direct image URL.'
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      addToast('error', 'Validation Error', 'Product name must be at least 2 characters.');
      return;
    }
    if (form.description.trim().length < 10) {
      addToast('error', 'Validation Error', 'Description must be at least 10 characters.');
      return;
    }
    if (form.images.length === 0) {
      addToast('error', 'Validation Error', 'Please add at least one product image.');
      return;
    }

    setSaving(true);
    try {
      const id = isEditing ? form.id : sanitizeId(`prod-${sanitizeSlug(form.name)}-${Date.now().toString().slice(-4)}`);
      await saveProductToFirestore(
        {
          ...form,
          id,
          slug: sanitizeSlug(form.slug || form.name),
          sku: sanitizeSku(form.sku),
        },
        isEditing
      );
      addToast('success', isEditing ? 'Product Updated' : 'Product Created', `${form.name} saved to Firestore.`);
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      addToast('error', 'Save Failed', 'Ensure all required fields meet schema validation rules.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (product: Product) => {
    requestConfirm({
      title: `Delete "${product.name}"?`,
      message: 'This will permanently remove the garment from Firestore and the customer storefront.',
      confirmLabel: 'Delete Product',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteProductFromFirestore(product.id);
          addToast('info', 'Product Deleted', `${product.name} removed from catalog.`);
        } catch {
          addToast('error', 'Delete Failed', 'Could not delete this product.');
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white tracking-tight">
            Product Catalog
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Add, edit, price, and curate pieces across the storefront.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-medium rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {['All', ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="self-start sm:self-auto px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 cursor-pointer"
        >
          <option value="All">All Statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Products Data Table */}
      <div className="glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden min-w-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-500">
                <th className="py-3.5 px-5 font-medium">Product</th>
                <th className="py-3.5 px-3 font-medium">SKU</th>
                <th className="py-3.5 px-3 font-medium">Category</th>
                <th className="py-3.5 px-3 font-medium">Badge</th>
                <th className="py-3.5 px-3 font-medium text-right">Price</th>
                <th className="py-3.5 px-3 font-medium text-right">Stock</th>
                <th className="py-3.5 px-3 font-medium">Status</th>
                <th className="py-3.5 px-5 text-right font-medium min-w-[132px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {filtered.map((p) => {
                const resolvedBadges = resolveProductBadges(p, lowStockThreshold);
                return (
                <tr key={p.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <ResilientImage
                        src={p.images[0]}
                        alt={p.name}
                        className="w-10 h-12 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-950 dark:text-white truncate max-w-[220px]">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {[p.featured && 'Featured', p.newArrival && 'New Arrival', p.bestSeller && 'Best Seller']
                            .filter(Boolean)
                            .join(' · ') || 'Standard'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 font-mono text-zinc-600 dark:text-zinc-400">{p.sku}</td>
                  <td className="py-3.5 px-3 text-zinc-700 dark:text-zinc-300">{p.category}</td>
                  <td className="py-3.5 px-3">
                    <div className="space-y-1.5 min-w-[140px]">
                      <select
                        aria-label={`Badge for ${p.name}`}
                        disabled={updatingBadgeId === p.id}
                        value={p.badge ?? ''}
                        onChange={(e) => handleQuickBadgeChange(p, e.target.value as ProductBadge)}
                        className="w-full px-2.5 py-1 text-[11px] font-medium rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 cursor-pointer disabled:opacity-50"
                      >
                        {ADMIN_BADGE_OPTIONS.map((opt) => (
                          <option key={opt.label} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {resolvedBadges.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {resolvedBadges.map((b) => (
                            <span
                              key={b}
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] border ${getBadgeStyleClasses(
                                b
                              )}`}
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                    <span className="font-semibold text-zinc-950 dark:text-white">
                      ${p.discountPrice > 0 ? p.discountPrice : p.price}
                    </span>
                    {p.discountPrice > 0 && (
                      <span className="block text-[10px] text-zinc-400 line-through">${p.price}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                    <span
                      className={
                        p.stockQuantity <= lowStockThreshold
                          ? 'text-red-600 dark:text-red-400 font-semibold'
                          : 'text-zinc-900 dark:text-zinc-100'
                      }
                    >
                      {p.stockQuantity}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 capitalize font-medium">
                    <span
                      className={
                        p.status === 'active'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : p.status === 'draft'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-zinc-400'
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right align-middle whitespace-nowrap min-w-[132px]">
                    <div className="inline-flex items-center justify-end gap-2.5 sm:gap-3 flex-nowrap">
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        title="Edit Product"
                        aria-label={`Edit Product: ${p.name}`}
                        className="inline-flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] shrink-0 rounded-[10px] bg-zinc-100/90 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80 hover:bg-sky-50 hover:text-slate-900 hover:border-sky-200 dark:hover:bg-sky-500/15 dark:hover:text-sky-200 dark:hover:border-sky-400/40 hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 active:scale-95 transition-all duration-200 ease-out cursor-pointer"
                      >
                        <Edit3 className="w-[19px] h-[19px] shrink-0" strokeWidth={1.85} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        title="Delete Product"
                        aria-label={`Delete Product: ${p.name}`}
                        className="inline-flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] shrink-0 rounded-[10px] bg-red-50/90 dark:bg-red-500/12 text-red-600 dark:text-red-400 border border-red-200/75 dark:border-red-500/25 hover:bg-red-100 hover:text-red-700 hover:border-red-300 dark:hover:bg-red-500/25 dark:hover:text-red-300 dark:hover:border-red-400/50 hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 active:scale-95 transition-all duration-200 ease-out cursor-pointer"
                      >
                        <Trash2 className="w-[19px] h-[19px] shrink-0" strokeWidth={1.85} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Slide-Over Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setModalOpen(false)}
          />
          <form
            onSubmit={handleSave}
            className="relative w-full max-w-[100vw] sm:max-w-2xl bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 h-[100dvh] flex flex-col shadow-2xl"
          >
            <div className="px-4 sm:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
              <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
                {isEditing ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Price (USD, whole integer) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100000}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Math.max(1, Number(e.target.value)) })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Discount Price (0 = no sale)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, form.price - 1)}
                    value={form.discountPrice}
                    onChange={(e) =>
                      setForm({ ...form, discountPrice: Math.max(0, Number(e.target.value)) })
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Product Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                  >
                    <option value="active">Active (Visible in Store)</option>
                    <option value="draft">Draft (Hidden)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Product Badge
                  </label>
                  <select
                    value={form.badge ?? ''}
                    onChange={(e) => setForm({ ...form, badge: e.target.value as ProductBadge })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                  >
                    {ADMIN_BADGE_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      Storefront Card Badge Preview (Max 2 Visible)
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Auto-adds SALE on discount &amp; LOW STOCK at &le; {lowStockThreshold} units
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 min-h-[26px]">
                    {(() => {
                      const preview = resolveProductBadges(
                        {
                          badge: form.badge ?? '',
                          price: form.price,
                          discountPrice: form.discountPrice,
                          stockQuantity: form.stockQuantity,
                          newArrival: form.newArrival,
                          bestSeller: form.bestSeller,
                        },
                        lowStockThreshold
                      );
                      if (preview.length === 0) {
                        return (
                          <span className="text-[11px] text-zinc-400">
                            No badges displayed on card
                          </span>
                        );
                      }
                      return preview.map((b) => (
                        <span
                          key={b}
                          className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none backdrop-blur-md border shadow-xs ${getBadgeStyleClasses(
                            b
                          )}`}
                        >
                          {b}
                        </span>
                      ));
                    })()}
                  </div>
                </div>

                <div className="sm:col-span-2 flex flex-wrap items-center gap-5 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                    />
                    <span>Featured</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.newArrival}
                      onChange={(e) => setForm({ ...form, newArrival: e.target.checked })}
                    />
                    <span>New Arrival (Auto / Override)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.bestSeller}
                      onChange={(e) => setForm({ ...form, bestSeller: e.target.checked })}
                    />
                    <span>Best Seller</span>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Description *
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={10}
                    maxLength={2000}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Fabric & Care Information
                  </label>
                  <input
                    type="text"
                    maxLength={500}
                    value={form.fabricInfo}
                    onChange={(e) => setForm({ ...form, fabricInfo: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
                  />
                </div>
              </div>

              {/* Sizes */}
              <div className="space-y-2">
                <label className="block font-medium text-zinc-700 dark:text-zinc-300">
                  Available Sizes
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SIZES.map((sz) => (
                    <button
                      type="button"
                      key={sz}
                      onClick={() => toggleSize(sz)}
                      className={`px-3.5 py-1.5 rounded-lg border font-medium cursor-pointer ${
                        form.sizes.includes(sz)
                          ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950'
                          : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="space-y-2.5">
                <label className="block font-medium text-zinc-700 dark:text-zinc-300">Colors</label>
                <div className="flex flex-wrap gap-2">
                  {form.colors.map((c) => (
                    <div
                      key={c.name}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700"
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-zinc-300"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span>{c.name}</span>
                      {form.colors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeColor(c.name)}
                          className="text-zinc-400 hover:text-red-500 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  <input
                    type="text"
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    placeholder="Add color name (e.g. Graphite)"
                    className="flex-1 min-w-[140px] px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                  />
                  <input
                    type="color"
                    value={newColorHex}
                    onChange={(e) => setNewColorHex(e.target.value)}
                    className="w-10 h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 p-0.5 cursor-pointer shrink-0"
                  />
                  <button
                    type="button"
                    onClick={addColor}
                    className="px-3.5 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 font-medium cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Variant Stock Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-medium text-zinc-700 dark:text-zinc-300">
                    Stock by Size & Color
                  </label>
                  <span className="font-mono text-zinc-500">
                    Total: {Object.values(form.variantStock).reduce((s, v) => s + v, 0)} units
                  </span>
                </div>
                <div className="grid grid-cols-1 min-[376px]:grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(form.variantStock).map(([key, qty]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800"
                    >
                      <span className="truncate text-[11px]">{key.replace('_', ' / ')}</span>
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        value={qty}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value));
                          const nextMap = { ...form.variantStock, [key]: v };
                          const total = Object.values(nextMap).reduce((s, n) => s + n, 0);
                          setForm({ ...form, variantStock: nextMap, stockQuantity: total });
                        }}
                        className="w-14 px-2 py-1 text-right font-mono rounded border border-zinc-300 dark:border-zinc-700 bg-transparent"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Images Manager */}
              <div className="space-y-3">
                <label className="block font-medium text-zinc-700 dark:text-zinc-300">
                  Product Images (max 8)
                </label>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {form.images.map((img, idx) => (
                    <div key={`${img}-${idx}`} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                      <ResilientImage src={img} alt="Product preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, images: form.images.filter((_, i) => i !== idx) })
                        }
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-400 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'Uploading...' : 'Upload to Firebase Storage'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingImage}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="Or paste image URL..."
                    className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newImageUrl.trim()) return;
                      setForm({ ...form, images: [...form.images, newImageUrl.trim()].slice(0, 8) });
                      setNewImageUrl('');
                    }}
                    className="px-3.5 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 font-medium cursor-pointer shrink-0"
                  >
                    Add URL
                  </button>
                </div>

                {/* Quick Studio Media Library Picker */}
                <div className="space-y-1.5">
                  <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" />
                    <span>Atelier Studio Media Library</span>
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {STUDIO_MEDIA_LIBRARY.slice(2).map((m) => (
                      <button
                        type="button"
                        key={m.url}
                        onClick={() => {
                          if (!form.images.includes(m.url)) {
                            setForm({ ...form, images: [...form.images, m.url].slice(0, 8) });
                          }
                        }}
                        title={m.label}
                        className="w-12 h-16 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0 hover:ring-2 hover:ring-zinc-900 dark:hover:ring-white cursor-pointer"
                      >
                        <img src={m.url} alt={m.label} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-medium rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : isEditing ? 'Save Product' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
