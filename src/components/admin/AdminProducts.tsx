import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Edit3,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  cleanupUnusedStorageImages,
  collectProductStoragePaths,
  deleteProductFromFirestore,
  sanitizeId,
  sanitizeSku,
  sanitizeSlug,
  saveProductToFirestore,
  updateProductBadgeInFirestore,
} from '../../lib/firestoreService';
import {
  deleteStorageFileIfExists,
  extractStoragePathFromUrl,
  MAX_PRODUCT_IMAGES,
  UploadedStorageImage,
  uploadProductImageToStorage,
  validateProductImageFile,
} from '../../lib/firebase';
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

interface StagedImageUpload {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'uploading' | 'error';
  progress: number;
  error?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
  images: [],
  imagePaths: [],
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
  const [stagedUploads, setStagedUploads] = useState<StagedImageUpload[]>([]);
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [replaceProgress, setReplaceProgress] = useState<number>(0);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingBadgeId, setUpdatingBadgeId] = useState<string | null>(null);

  // Track Cloud Storage files created/removed during the modal session for safe cleanup
  const sessionUploadedPathsRef = useRef<string[]>([]);
  const removedPathsOnSaveRef = useRef<string[]>([]);
  const stagedUploadsRef = useRef<StagedImageUpload[]>([]);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetIndexRef = useRef<number | null>(null);

  useEffect(() => {
    stagedUploadsRef.current = stagedUploads;
  }, [stagedUploads]);

  // Revoke any object URLs on component unmount
  useEffect(() => {
    return () => {
      for (const item of stagedUploadsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

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

  const clearStagedPreviews = () => {
    for (const item of stagedUploadsRef.current) {
      URL.revokeObjectURL(item.previewUrl);
    }
    setStagedUploads([]);
  };

  const resetImageSession = () => {
    clearStagedPreviews();
    sessionUploadedPathsRef.current = [];
    removedPathsOnSaveRef.current = [];
    setUploadFeedback(null);
    setReplacingIndex(null);
    setReplaceProgress(0);
    setNewImageUrl('');
  };

  const closeModal = () => {
    if (saving || isUploadingBatch || replacingIndex !== null) return;
    const orphaned = [...sessionUploadedPathsRef.current];
    if (orphaned.length > 0) {
      cleanupUnusedStorageImages(orphaned, products).catch((err) =>
        console.warn('Orphan upload cleanup warning:', err)
      );
    }
    resetImageSession();
    setModalOpen(false);
  };

  const openCreateModal = () => {
    resetImageSession();
    setIsEditing(false);
    const stableProductId = sanitizeId(`prod-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`);
    setForm({
      ...EMPTY_FORM,
      id: stableProductId,
      sku: `KOVA-NEW-${Math.floor(100 + Math.random() * 900)}`,
      images: [],
      imagePaths: [],
    });
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    resetImageSession();
    setIsEditing(true);
    const alignedImagePaths = product.images.map(
      (url, idx) => product.imagePaths?.[idx] || extractStoragePathFromUrl(url) || ''
    );
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
      imagePaths: alignedImagePaths,
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

  const stageFilesForUpload = (fileList: FileList | File[]) => {
    const incomingFiles = Array.from(fileList);
    if (incomingFiles.length === 0) return;

    const remainingSlots = MAX_PRODUCT_IMAGES - (form.images.length + stagedUploads.length);
    if (remainingSlots <= 0) {
      const msg = `Maximum ${MAX_PRODUCT_IMAGES} images allowed per product. Remove an image to add more.`;
      setUploadFeedback({ type: 'error', message: msg });
      addToast('error', 'Image Limit Reached', msg);
      return;
    }

    const errors: string[] = [];
    const nextStaged: StagedImageUpload[] = [];

    for (const file of incomingFiles) {
      if (nextStaged.length >= remainingSlots) {
        errors.push(`Only ${remainingSlots} more image slot(s) available (max ${MAX_PRODUCT_IMAGES}).`);
        break;
      }
      const check = validateProductImageFile(file);
      if (!check.valid) {
        errors.push(check.error || `"${file.name}" is invalid.`);
        continue;
      }
      nextStaged.push({
        id: `stage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'pending',
        progress: 0,
      });
    }

    if (nextStaged.length > 0) {
      setStagedUploads((prev) => [...prev, ...nextStaged]);
      setUploadFeedback(
        errors.length > 0
          ? { type: 'error', message: errors.join(' ') }
          : {
              type: 'success',
              message: `${nextStaged.length} image${nextStaged.length > 1 ? 's' : ''} ready for preview. Click "Upload to Cloud Storage" or save the product to upload permanently.`,
            }
      );
    } else if (errors.length > 0) {
      setUploadFeedback({ type: 'error', message: errors.join(' ') });
      addToast('error', 'Invalid Image Selection', errors[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      stageFilesForUpload(e.target.files);
    }
    e.target.value = '';
  };

  const handleRemoveStaged = (stagedId: string) => {
    setStagedUploads((prev) => {
      const target = prev.find((item) => item.id === stagedId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== stagedId);
    });
  };

  const uploadStagedItems = async (
    targetIds?: string[]
  ): Promise<{ uploaded: UploadedStorageImage[]; failedCount: number }> => {
    const itemsToUpload = stagedUploadsRef.current.filter((item) =>
      targetIds ? targetIds.includes(item.id) : item.status !== 'uploading'
    );
    if (itemsToUpload.length === 0) {
      return { uploaded: [], failedCount: 0 };
    }

    const productIdForPath = sanitizeId(form.id || `prod-${Date.now()}`);
    setIsUploadingBatch(true);
    setUploadFeedback(null);

    const orderedResults: Array<UploadedStorageImage | null> = new Array(itemsToUpload.length).fill(null);
    const succeededIds: string[] = [];
    let failedCount = 0;
    let firstError = '';

    await Promise.all(
      itemsToUpload.map(async (item, idx) => {
        setStagedUploads((prev) =>
          prev.map((s) =>
            s.id === item.id ? { ...s, status: 'uploading', progress: 5, error: undefined } : s
          )
        );
        try {
          const res = await uploadProductImageToStorage({
            file: item.file,
            productId: productIdForPath,
            onProgress: (pct) => {
              setStagedUploads((prev) =>
                prev.map((s) => (s.id === item.id ? { ...s, progress: pct } : s))
              );
            },
          });

          orderedResults[idx] = res;
          succeededIds.push(item.id);
          sessionUploadedPathsRef.current.push(res.path);
          URL.revokeObjectURL(item.previewUrl);
        } catch (err) {
          failedCount += 1;
          const message = err instanceof Error ? err.message : 'Failed to upload image.';
          if (!firstError) firstError = message;
          setStagedUploads((prev) =>
            prev.map((s) =>
              s.id === item.id ? { ...s, status: 'error', progress: 0, error: message } : s
            )
          );
        }
      })
    );

    const uploadedResults = orderedResults.filter(
      (res): res is UploadedStorageImage => res !== null
    );

    if (uploadedResults.length > 0) {
      setForm((prev) => {
        const nextImages = [...prev.images];
        const nextPaths = prev.images.map(
          (url, i) => prev.imagePaths?.[i] || extractStoragePathFromUrl(url) || ''
        );
        for (const res of uploadedResults) {
          if (nextImages.length < MAX_PRODUCT_IMAGES && !nextImages.includes(res.url)) {
            nextImages.push(res.url);
            nextPaths.push(res.path);
          }
        }
        return {
          ...prev,
          images: nextImages,
          imagePaths: nextPaths,
        };
      });
      setStagedUploads((prev) => prev.filter((s) => !succeededIds.includes(s.id)));
    }

    setIsUploadingBatch(false);

    if (uploadedResults.length > 0 && failedCount === 0) {
      const msg = `${uploadedResults.length} image${uploadedResults.length > 1 ? 's' : ''} permanently uploaded to Firebase Cloud Storage.`;
      setUploadFeedback({ type: 'success', message: msg });
      addToast('success', 'Cloud Storage Upload Complete', msg);
    } else if (uploadedResults.length > 0 && failedCount > 0) {
      const msg = `Uploaded ${uploadedResults.length} image(s), but ${failedCount} failed: ${firstError}`;
      setUploadFeedback({ type: 'error', message: msg });
      addToast('error', 'Partial Upload Failure', firstError);
    } else if (failedCount > 0) {
      setUploadFeedback({ type: 'error', message: firstError });
      addToast('error', 'Cloud Storage Upload Failed', firstError);
    }

    return { uploaded: uploadedResults, failedCount };
  };

  const handleSetPrimaryImage = (idx: number) => {
    if (idx <= 0 || idx >= form.images.length) return;
    const nextImages = [...form.images];
    const nextPaths = form.images.map(
      (url, i) => form.imagePaths?.[i] || extractStoragePathFromUrl(url) || ''
    );
    const [pickedUrl] = nextImages.splice(idx, 1);
    const [pickedPath] = nextPaths.splice(idx, 1);
    nextImages.unshift(pickedUrl);
    nextPaths.unshift(pickedPath);
    setForm((prev) => ({ ...prev, images: nextImages, imagePaths: nextPaths }));
    setUploadFeedback({
      type: 'success',
      message: 'Primary product image updated. Save the product to publish the new order.',
    });
  };

  const handleRemoveImage = (idx: number) => {
    const removedUrl = form.images[idx];
    const removedPath = form.imagePaths?.[idx] || extractStoragePathFromUrl(removedUrl) || '';

    const nextImages = form.images.filter((_, i) => i !== idx);
    const nextPaths = form.images
      .map((url, i) => form.imagePaths?.[i] || extractStoragePathFromUrl(url) || '')
      .filter((_, i) => i !== idx);

    setForm((prev) => ({ ...prev, images: nextImages, imagePaths: nextPaths }));

    if (removedPath && removedPath.startsWith('products/')) {
      const sessionIdx = sessionUploadedPathsRef.current.indexOf(removedPath);
      if (sessionIdx >= 0) {
        sessionUploadedPathsRef.current.splice(sessionIdx, 1);
        deleteStorageFileIfExists(removedPath).catch(() => undefined);
      } else {
        removedPathsOnSaveRef.current.push(removedPath);
      }
    }
  };

  const handleTriggerReplaceImage = (idx: number) => {
    if (replacingIndex !== null || isUploadingBatch) return;
    replaceTargetIndexRef.current = idx;
    replaceInputRef.current?.click();
  };

  const handleReplaceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const targetIdx = replaceTargetIndexRef.current;
    replaceTargetIndexRef.current = null;
    if (!file || targetIdx === null || targetIdx < 0 || targetIdx >= form.images.length) return;

    const validation = validateProductImageFile(file);
    if (!validation.valid) {
      const errMsg = validation.error || 'Invalid replacement image.';
      setUploadFeedback({ type: 'error', message: errMsg });
      addToast('error', 'Invalid Image', errMsg);
      return;
    }

    const productIdForPath = sanitizeId(form.id || `prod-${Date.now()}`);
    setReplacingIndex(targetIdx);
    setReplaceProgress(5);
    setUploadFeedback(null);

    try {
      const uploaded = await uploadProductImageToStorage({
        file,
        productId: productIdForPath,
        onProgress: (pct) => setReplaceProgress(pct),
      });

      const oldUrl = form.images[targetIdx];
      const oldPath = form.imagePaths?.[targetIdx] || extractStoragePathFromUrl(oldUrl) || '';

      if (oldPath && oldPath.startsWith('products/')) {
        const sessionIdx = sessionUploadedPathsRef.current.indexOf(oldPath);
        if (sessionIdx >= 0) {
          sessionUploadedPathsRef.current.splice(sessionIdx, 1);
          deleteStorageFileIfExists(oldPath).catch(() => undefined);
        } else {
          removedPathsOnSaveRef.current.push(oldPath);
        }
      }

      sessionUploadedPathsRef.current.push(uploaded.path);

      setForm((prev) => {
        const nextImages = [...prev.images];
        const nextPaths = prev.images.map(
          (url, i) => prev.imagePaths?.[i] || extractStoragePathFromUrl(url) || ''
        );
        nextImages[targetIdx] = uploaded.url;
        nextPaths[targetIdx] = uploaded.path;
        return { ...prev, images: nextImages, imagePaths: nextPaths };
      });

      const msg = 'Image replaced in Firebase Cloud Storage. Save the product to confirm.';
      setUploadFeedback({ type: 'success', message: msg });
      addToast('success', 'Image Replaced', msg);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to replace product image.';
      setUploadFeedback({ type: 'error', message: errMsg });
      addToast('error', 'Replace Failed', errMsg);
    } finally {
      setReplacingIndex(null);
      setReplaceProgress(0);
    }
  };

  const handleAddExternalUrl = () => {
    const trimmed = newImageUrl.trim();
    if (!trimmed) return;
    const isAllowedUrl =
      trimmed.startsWith('https://') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('/assets/') ||
      trimmed.startsWith('/src/assets/');
    if (!isAllowedUrl || trimmed.startsWith('blob:') || trimmed.startsWith('data:') || trimmed.startsWith('file:')) {
      const msg = 'Only permanent HTTPS URLs or uploaded Firebase Cloud Storage images are allowed (no local paths, blob, or Base64 URLs).';
      setUploadFeedback({ type: 'error', message: msg });
      addToast('error', 'Unsupported Image URL', msg);
      return;
    }
    if (form.images.length >= MAX_PRODUCT_IMAGES) {
      addToast('error', 'Image Limit Reached', `Maximum ${MAX_PRODUCT_IMAGES} images per product.`);
      return;
    }
    const existingPaths = form.images.map(
      (url, i) => form.imagePaths?.[i] || extractStoragePathFromUrl(url) || ''
    );
    const extractedPath = extractStoragePathFromUrl(trimmed) || '';
    setForm((prev) => ({
      ...prev,
      images: [...prev.images, trimmed].slice(0, MAX_PRODUCT_IMAGES),
      imagePaths: [...existingPaths, extractedPath].slice(0, MAX_PRODUCT_IMAGES),
    }));
    setNewImageUrl('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploadingBatch || replacingIndex !== null) {
      addToast('info', 'Upload In Progress', 'Please wait for the current image upload to finish.');
      return;
    }
    if (form.name.trim().length < 2) {
      addToast('error', 'Validation Error', 'Product name must be at least 2 characters.');
      return;
    }
    if (form.description.trim().length < 10) {
      addToast('error', 'Validation Error', 'Description must be at least 10 characters.');
      return;
    }

    setSaving(true);
    try {
      let finalImages = [...form.images];
      let finalImagePaths = form.images.map(
        (url, i) => form.imagePaths?.[i] || extractStoragePathFromUrl(url) || ''
      );

      // Automatically upload any staged preview images to Firebase Cloud Storage before saving
      if (stagedUploadsRef.current.length > 0) {
        const { uploaded, failedCount } = await uploadStagedItems();
        if (failedCount > 0) {
          addToast(
            'error',
            'Upload Required Before Saving',
            'Resolve or remove failed image uploads before saving the product.'
          );
          setSaving(false);
          return;
        }
        for (const item of uploaded) {
          if (finalImages.length < MAX_PRODUCT_IMAGES && !finalImages.includes(item.url)) {
            finalImages.push(item.url);
            finalImagePaths.push(item.path);
          }
        }
      }

      if (finalImages.length === 0) {
        addToast('error', 'Validation Error', 'Please upload at least one product image.');
        setSaving(false);
        return;
      }

      const stableId = sanitizeId(form.id || `prod-${sanitizeSlug(form.name)}-${Date.now().toString().slice(-4)}`);
      await saveProductToFirestore(
        {
          ...form,
          id: stableId,
          images: finalImages,
          imagePaths: finalImagePaths,
          slug: sanitizeSlug(form.slug || form.name),
          sku: sanitizeSku(form.sku),
        },
        isEditing
      );

      // Safely delete removed/replaced Cloud Storage images not used by any other product or this product
      const pathsToClean = removedPathsOnSaveRef.current.filter(
        (p) => p && !finalImagePaths.includes(p)
      );
      if (pathsToClean.length > 0) {
        const otherProducts = products.filter((p) => p.id !== stableId);
        cleanupUnusedStorageImages(pathsToClean, otherProducts).catch((err) =>
          console.warn('Removed image cleanup warning:', err)
        );
      }

      sessionUploadedPathsRef.current = [];
      removedPathsOnSaveRef.current = [];
      clearStagedPreviews();
      setUploadFeedback(null);
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
      message: 'This will permanently remove the garment from Firestore, the storefront, and clean up its unused Cloud Storage images.',
      confirmLabel: 'Delete Product',
      destructive: true,
      onConfirm: async () => {
        try {
          const storagePathsToClean = collectProductStoragePaths(product);
          await deleteProductFromFirestore(product.id);
          if (storagePathsToClean.length > 0) {
            const remainingProducts = products.filter((p) => p.id !== product.id);
            cleanupUnusedStorageImages(storagePathsToClean, remainingProducts).catch((err) =>
              console.warn('Deleted product storage cleanup warning:', err)
            );
          }
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
            onClick={closeModal}
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
                onClick={closeModal}
                disabled={saving || isUploadingBatch || replacingIndex !== null}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-40 cursor-pointer"
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

              {/* Permanent Firebase Cloud Storage Image Manager */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="block font-semibold text-zinc-800 dark:text-zinc-200">
                      Product Images — Firebase Cloud Storage ({form.images.length}/{MAX_PRODUCT_IMAGES})
                    </label>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      JPG, JPEG, PNG, or WEBP up to 5 MB each · Stored permanently at{' '}
                      <span className="font-mono text-[10px]">products/{form.id || '{productId}'}/</span>
                    </p>
                  </div>
                </div>

                {/* Hidden single-file input for in-place image replacement */}
                <input
                  ref={replaceInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={handleReplaceFileChange}
                  className="hidden"
                />

                {/* Inline Upload Status / Error Feedback */}
                {uploadFeedback && (
                  <div
                    className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border text-[11px] leading-relaxed ${
                      uploadFeedback.type === 'success'
                        ? 'bg-emerald-50/90 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                        : 'bg-red-50/90 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {uploadFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span className="flex-1">{uploadFeedback.message}</span>
                    <button
                      type="button"
                      onClick={() => setUploadFeedback(null)}
                      className="opacity-70 hover:opacity-100 cursor-pointer"
                      aria-label="Dismiss message"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Drag & Drop / Multi-File Picker */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFiles(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingFiles(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingFiles(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      stageFilesForUpload(e.dataTransfer.files);
                    }
                  }}
                  className={`rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
                    isDraggingFiles
                      ? 'border-zinc-900 dark:border-white bg-zinc-100/80 dark:bg-zinc-800/70'
                      : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-950/40'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-zinc-200/80 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">
                        Select or drag &amp; drop product images
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Supports multiple JPG, JPEG, PNG, WEBP images (max 5 MB each)
                      </p>
                    </div>
                    <label
                      className={`mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-medium text-xs transition-opacity ${
                        form.images.length + stagedUploads.length >= MAX_PRODUCT_IMAGES || isUploadingBatch
                          ? 'opacity-50 pointer-events-none'
                          : 'hover:opacity-90 cursor-pointer'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choose Images</span>
                      <input
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                        disabled={
                          form.images.length + stagedUploads.length >= MAX_PRODUCT_IMAGES ||
                          isUploadingBatch
                        }
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Pre-Upload Staged Previews & Progress Queue */}
                {stagedUploads.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          Ready to Upload ({stagedUploads.length})
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          Preview before permanent Cloud Storage upload
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={isUploadingBatch}
                        onClick={() => uploadStagedItems()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-medium text-[11px] hover:opacity-90 disabled:opacity-50 cursor-pointer"
                      >
                        {isUploadingBatch ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Uploading to Cloud...</span>
                          </>
                        ) : (
                          <>
                            <Cloud className="w-3.5 h-3.5" />
                            <span>
                              Upload {stagedUploads.length} Image{stagedUploads.length > 1 ? 's' : ''} to Cloud Storage
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {stagedUploads.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden flex flex-col"
                        >
                          <div className="relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-800">
                            <img
                              src={item.previewUrl}
                              alt={item.file.name}
                              className="w-full h-full object-cover"
                            />
                            {item.status !== 'uploading' && (
                              <button
                                type="button"
                                onClick={() => handleRemoveStaged(item.id)}
                                title="Remove preview"
                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/75 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {item.status === 'uploading' && (
                              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center px-3 text-white gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-[11px] font-mono font-semibold">
                                  {item.progress}%
                                </span>
                                <div className="w-full h-1.5 rounded-full bg-white/25 overflow-hidden">
                                  <div
                                    className="h-full bg-white transition-all duration-150"
                                    style={{ width: `${item.progress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="p-2 space-y-1">
                            <p className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 truncate">
                              {item.file.name}
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-zinc-500">
                              <span>{formatFileSize(item.file.size)}</span>
                              <span
                                className={
                                  item.status === 'error'
                                    ? 'text-red-600 dark:text-red-400 font-medium'
                                    : item.status === 'uploading'
                                      ? 'text-sky-600 dark:text-sky-400 font-medium'
                                      : 'text-amber-600 dark:text-amber-400 font-medium'
                                }
                              >
                                {item.status === 'uploading'
                                  ? `Uploading ${item.progress}%`
                                  : item.status === 'error'
                                    ? 'Failed'
                                    : 'Pending upload'}
                              </span>
                            </div>
                            {item.error && (
                              <div className="pt-1 space-y-1">
                                <p className="text-[10px] text-red-600 dark:text-red-400 leading-snug line-clamp-2">
                                  {item.error}
                                </p>
                                <button
                                  type="button"
                                  disabled={isUploadingBatch}
                                  onClick={() => uploadStagedItems([item.id])}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-900 dark:text-white hover:underline cursor-pointer"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Retry Upload</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Saved / Uploaded Product Image Gallery */}
                {form.images.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Product Gallery (First image is shown as Primary on Storefront)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {form.images.map((img, idx) => {
                        const isPrimary = idx === 0;
                        const storagePath = form.imagePaths?.[idx] || extractStoragePathFromUrl(img) || '';
                        const isCloudStored = Boolean(storagePath);
                        const isReplacingThis = replacingIndex === idx;

                        return (
                          <div
                            key={`${img}-${idx}`}
                            className={`rounded-xl overflow-hidden border transition-all bg-white dark:bg-zinc-900 flex flex-col ${
                              isPrimary
                                ? 'border-zinc-950 dark:border-white ring-1 ring-zinc-950/20 dark:ring-white/25'
                                : 'border-zinc-200 dark:border-zinc-700'
                            }`}
                          >
                            <div className="relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-800">
                              <ResilientImage
                                src={img}
                                alt={`Product image ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />

                              {/* Primary / Cloud badges */}
                              <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                                {isPrimary && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950/90 text-white text-[9px] font-semibold uppercase tracking-wider shadow-xs">
                                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                    Primary
                                  </span>
                                )}
                                {isCloudStored && (
                                  <span
                                    title={storagePath}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-200 text-[9px] font-medium backdrop-blur-xs"
                                  >
                                    <Cloud className="w-2.5 h-2.5" />
                                    Cloud
                                  </span>
                                )}
                              </div>

                              {/* Replacing upload progress overlay */}
                              {isReplacingThis && (
                                <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center px-3 text-white gap-2">
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                  <span className="text-[11px] font-mono font-semibold">
                                    Replacing {replaceProgress}%
                                  </span>
                                  <div className="w-full h-1.5 rounded-full bg-white/25 overflow-hidden">
                                    <div
                                      className="h-full bg-white transition-all duration-150"
                                      style={{ width: `${replaceProgress}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Action Controls: Set Primary, Replace, Remove */}
                            <div className="p-2 flex flex-wrap items-center gap-1.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50">
                              {!isPrimary && (
                                <button
                                  type="button"
                                  disabled={isReplacingThis || isUploadingBatch}
                                  onClick={() => handleSetPrimaryImage(idx)}
                                  title="Set as Primary Image"
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 cursor-pointer"
                                >
                                  <Star className="w-3 h-3" />
                                  <span>Primary</span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={replacingIndex !== null || isUploadingBatch}
                                onClick={() => handleTriggerReplaceImage(idx)}
                                title="Replace image in Firebase Cloud Storage"
                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Replace</span>
                              </button>
                              <button
                                type="button"
                                disabled={isReplacingThis || isUploadingBatch}
                                onClick={() => handleRemoveImage(idx)}
                                title="Remove image"
                                aria-label={`Remove product image ${idx + 1}`}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200/70 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/25 disabled:opacity-40 cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500 italic">
                    No permanent product images added yet. Upload images above to store them in Firebase Cloud Storage.
                  </p>
                )}

                {/* Optional Direct HTTPS URL & Studio Media Library */}
                <div className="pt-2 border-t border-zinc-200/70 dark:border-zinc-800/80 space-y-3">
                  <div className="flex flex-wrap sm:flex-nowrap gap-2">
                    <input
                      type="url"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Or paste an existing HTTPS image URL..."
                      className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddExternalUrl}
                      className="px-3.5 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 font-medium cursor-pointer shrink-0"
                    >
                      Add URL
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                      <ImageIcon className="w-3 h-3" />
                      <span>Atelier Studio Media Library (Optional Presets)</span>
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {STUDIO_MEDIA_LIBRARY.slice(2).map((m) => (
                        <button
                          type="button"
                          key={m.url}
                          onClick={() => {
                            if (
                              !form.images.includes(m.url) &&
                              form.images.length < MAX_PRODUCT_IMAGES
                            ) {
                              const prevPaths = form.images.map(
                                (url, i) => form.imagePaths?.[i] || extractStoragePathFromUrl(url) || ''
                              );
                              setForm({
                                ...form,
                                images: [...form.images, m.url].slice(0, MAX_PRODUCT_IMAGES),
                                imagePaths: [...prevPaths, ''].slice(0, MAX_PRODUCT_IMAGES),
                              });
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
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving || isUploadingBatch || replacingIndex !== null}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || isUploadingBatch || replacingIndex !== null}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 disabled:opacity-50 cursor-pointer"
              >
                {(saving || isUploadingBatch) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isUploadingBatch
                    ? 'Uploading Images...'
                    : saving
                      ? 'Saving...'
                      : isEditing
                        ? 'Save Product'
                        : 'Create Product'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
