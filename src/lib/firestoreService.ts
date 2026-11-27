import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  db,
  deleteStorageFileIfExists,
  extractStoragePathFromUrl,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  AdminNotification,
  InventoryLog,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductBadge,
  Promotion,
  ShippingAddress,
  SiteSettings,
  UserProfile,
} from '../types';
import {
  DEFAULT_SITE_SETTINGS,
  LEGACY_DELETED_IMAGE_FRAGMENTS,
  LEGACY_FEMALE_PRODUCT_IDS,
  MENS_CATEGORIES,
  SEED_PRODUCTS,
  SEED_PROMOTIONS,
} from '../data/seedCatalog';

export const BOOTSTRAP_ADMIN_EMAILS = [
  'acp161008@gmail.com',
  'ayushprajapti1610@gmail.com',
];

export function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return new Date(val).toISOString();
  return new Date().toISOString();
}

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100);
  return cleaned || `id-${Date.now()}`;
}

export function sanitizeSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return cleaned || `item-${Date.now()}`;
}

export function sanitizeSku(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 36);
  return cleaned.length >= 3 ? cleaned : `KOVA-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function verifyAdminBackendAccess(
  uid: string,
  email: string | null,
  emailVerified: boolean
): Promise<boolean> {
  if (!uid) return false;

  // 1. Primary server-side check: Firestore /admins/{uid} role document
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    if (snap.exists()) {
      const data = snap.data();
      if (!('role' in data) || data.role === 'admin') {
        return true;
      }
      return false;
    }
  } catch {
    // Fall through to verified bootstrap email check if read denied
  }

  // 2. Verified authorized admin email check (mirrors Firestore security rules)
  if (
    emailVerified &&
    email &&
    BOOTSTRAP_ADMIN_EMAILS.some((allowed) => allowed.toLowerCase() === email.toLowerCase())
  ) {
    return true;
  }

  return false;
}

export async function seedInitialCatalogIfEmpty(): Promise<boolean> {
  const productsPath = 'products';
  try {
    const existingSnap = await getDocs(collection(db, productsPath));
    const tshirtCatSet = new Set<string>(MENS_CATEGORIES);
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));

    const batch = writeBatch(db);
    let hasWrites = false;

    // 1. Handle existing documents safely:
    // - Delete ancient legacy female placeholder products if any remain
    // - Safely ARCHIVE (never delete!) old non-T-shirt men's products so past order history stays intact
    // - Sanitize deleted non-T-shirt secondary images on surviving T-shirt docs
    for (const d of existingSnap.docs) {
      const data = d.data();
      const cat = String(data.category || '');
      const status = String(data.status || 'active');

      if (LEGACY_FEMALE_PRODUCT_IDS.includes(d.id)) {
        batch.delete(doc(db, 'products', d.id));
        hasWrites = true;
        continue;
      }

      if (!tshirtCatSet.has(cat)) {
        if (status !== 'archived') {
          batch.update(doc(db, 'products', d.id), {
            status: 'archived',
            updatedAt: serverTimestamp(),
          });
          hasWrites = true;
        }
        continue;
      }

      // Existing valid T-shirt product: strip any removed non-T-shirt image URLs if present
      const imgs = Array.isArray(data.images) ? (data.images as string[]) : [];
      const cleanedImgs = imgs.filter(
        (img) => !LEGACY_DELETED_IMAGE_FRAGMENTS.some((frag) => String(img).includes(frag))
      );
      if (cleanedImgs.length !== imgs.length) {
        batch.update(doc(db, 'products', d.id), {
          images:
            cleanedImgs.length > 0
              ? cleanedImgs
              : ['/src/assets/images/mens_oversized_black_tee_1795777633835.jpg'],
          updatedAt: serverTimestamp(),
        });
        hasWrites = true;
      }
    }

    // 2. Ensure all dedicated Men's T-Shirt flagship items exist (without overwriting customized existing T-shirts)
    const activeTShirtsCount = existingSnap.docs.filter((d) => {
      const data = d.data();
      return (
        !LEGACY_FEMALE_PRODUCT_IDS.includes(d.id) &&
        tshirtCatSet.has(String(data.category || '')) &&
        data.status !== 'archived'
      );
    }).length;

    if (activeTShirtsCount < 4) {
      for (const product of SEED_PRODUCTS) {
        if (!existingIds.has(product.id)) {
          const { id, ...rest } = product;
          batch.set(doc(db, 'products', id), {
            ...rest,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          hasWrites = true;
        }
      }
    }

    // 3. Ensure default promotions exist without overwriting existing ones
    const promoSnap = await getDocs(collection(db, 'promotions'));
    if (promoSnap.empty) {
      for (const promo of SEED_PROMOTIONS) {
        batch.set(doc(db, 'promotions', promo.code), {
          ...promo,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        hasWrites = true;
      }
    }

    // 4. Ensure siteSettings/store exists and replaces any removed non-T-shirt banners or non-T-shirt copy
    const settingsSnap = await getDoc(doc(db, 'siteSettings', 'store'));
    if (!settingsSnap.exists()) {
      batch.set(doc(db, 'siteSettings', 'store'), {
        ...DEFAULT_SITE_SETTINGS,
        updatedAt: serverTimestamp(),
      });
      hasWrites = true;
    } else {
      const sData = settingsSnap.data();
      const heroImg = String(sData.heroImage || '');
      const editImg = String(sData.editorialImage || '');
      const heroBroken =
        !heroImg || LEGACY_DELETED_IMAGE_FRAGMENTS.some((f) => heroImg.includes(f));
      const editBroken =
        !editImg || LEGACY_DELETED_IMAGE_FRAGMENTS.some((f) => editImg.includes(f));
      const hasLegacyCopy =
        String(sData.heroTitle || '').includes('Pure Wool & Silk') ||
        String(sData.editorialTitle || '').toUpperCase().includes('FORMAL COLLECTION') ||
        String(sData.tagline || '').toLowerCase().includes('selvedge denim');

      if (heroBroken || editBroken || hasLegacyCopy) {
        batch.set(doc(db, 'siteSettings', 'store'), {
          ...DEFAULT_SITE_SETTINGS,
          ...sData,
          tagline: hasLegacyCopy ? DEFAULT_SITE_SETTINGS.tagline : sData.tagline || DEFAULT_SITE_SETTINGS.tagline,
          heroSubtitle: hasLegacyCopy
            ? DEFAULT_SITE_SETTINGS.heroSubtitle
            : sData.heroSubtitle || DEFAULT_SITE_SETTINGS.heroSubtitle,
          heroCtaText: hasLegacyCopy
            ? DEFAULT_SITE_SETTINGS.heroCtaText
            : sData.heroCtaText || DEFAULT_SITE_SETTINGS.heroCtaText,
          heroImage: heroBroken ? DEFAULT_SITE_SETTINGS.heroImage : heroImg,
          editorialTitle: hasLegacyCopy
            ? DEFAULT_SITE_SETTINGS.editorialTitle
            : sData.editorialTitle || DEFAULT_SITE_SETTINGS.editorialTitle,
          editorialSubtitle: hasLegacyCopy
            ? DEFAULT_SITE_SETTINGS.editorialSubtitle
            : sData.editorialSubtitle || DEFAULT_SITE_SETTINGS.editorialSubtitle,
          editorialImage: editBroken ? DEFAULT_SITE_SETTINGS.editorialImage : editImg,
          updatedAt: serverTimestamp(),
        });
        hasWrites = true;
      }
    }

    if (hasWrites) {
      await batch.commit();
      return true;
    }
    return false;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, productsPath);
  }
}

export async function saveProductToFirestore(
  product: Omit<Product, 'createdAt' | 'updatedAt'>,
  isEdit: boolean,
  existingCreatedAt?: unknown
): Promise<void> {
  const id = sanitizeId(product.id);
  const path = `products/${id}`;
  const priceInt = Math.max(1, Math.round(Number(product.price) || 1));
  const discountInt =
    product.discountPrice && product.discountPrice > 0 && product.discountPrice < priceInt
      ? Math.round(Number(product.discountPrice))
      : 0;

  const variantEntries = Object.entries(product.variantStock || {}).slice(0, 60);
  const cleanVariantStock: Record<string, number> = {};
  let computedTotal = 0;
  for (const [k, v] of variantEntries) {
    const qty = Math.max(0, Math.round(Number(v) || 0));
    cleanVariantStock[k] = qty;
    computedTotal += qty;
  }

  const finalStock =
    variantEntries.length > 0
      ? computedTotal
      : Math.max(0, Math.round(Number(product.stockQuantity) || 0));

  const cleanImages: string[] = [];
  const cleanImagePaths: string[] = [];
  const rawPaths = Array.isArray(product.imagePaths) ? product.imagePaths : [];

  for (let i = 0; i < product.images.length && cleanImages.length < 8; i++) {
    const rawUrl = (product.images[i] || '').trim();
    if (
      !rawUrl ||
      rawUrl.startsWith('blob:') ||
      rawUrl.startsWith('data:') ||
      rawUrl.startsWith('file:')
    ) {
      continue;
    }
    cleanImages.push(rawUrl.slice(0, 1500));
    const explicitPath = typeof rawPaths[i] === 'string' ? rawPaths[i].trim() : '';
    const resolvedPath = explicitPath || extractStoragePathFromUrl(rawUrl) || '';
    cleanImagePaths.push(resolvedPath.slice(0, 500));
  }

  if (cleanImages.length === 0) {
    throw new Error('At least one permanent product image URL is required.');
  }

  const payload = {
    name: product.name.trim().slice(0, 120),
    slug: sanitizeSlug(product.slug || product.name),
    category: product.category,
    description: product.description.trim().slice(0, 2000),
    fabricInfo: (product.fabricInfo || '').trim().slice(0, 500),
    price: priceInt,
    discountPrice: discountInt,
    sku: sanitizeSku(product.sku),
    sizes: product.sizes.slice(0, 10),
    colors: product.colors.slice(0, 10),
    images: cleanImages,
    imagePaths: cleanImagePaths,
    stockQuantity: finalStock,
    variantStock: cleanVariantStock,
    featured: Boolean(product.featured),
    newArrival: Boolean(product.newArrival),
    bestSeller: Boolean(product.bestSeller),
    badge: (product.badge || '') as ProductBadge,
    status: product.status,
    createdAt: isEdit && existingCreatedAt ? existingCreatedAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isEdit) {
      // Preserve Firestore Timestamp for createdAt by reading existing doc if needed
      const snap = await getDoc(doc(db, 'products', id));
      if (snap.exists()) {
        await setDoc(doc(db, 'products', id), {
          ...payload,
          createdAt: snap.data().createdAt,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'products', id), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      await setDoc(doc(db, 'products', id), payload);
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function updateProductBadgeInFirestore(
  productId: string,
  badge: ProductBadge
): Promise<void> {
  const path = `products/${productId}`;
  try {
    const updatePayload: Record<string, unknown> = {
      badge,
      updatedAt: serverTimestamp(),
    };
    if (badge === 'BESTSELLER') {
      updatePayload.bestSeller = true;
    } else if (badge === 'NEW ARRIVAL') {
      updatePayload.newArrival = true;
    }
    await updateDoc(doc(db, 'products', productId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function collectProductStoragePaths(product: Pick<Product, 'images' | 'imagePaths'>): string[] {
  const paths = new Set<string>();
  if (Array.isArray(product.imagePaths)) {
    for (const p of product.imagePaths) {
      if (typeof p === 'string' && p.trim().startsWith('products/')) {
        paths.add(p.trim());
      }
    }
  }
  if (Array.isArray(product.images)) {
    for (const url of product.images) {
      const extracted = extractStoragePathFromUrl(url);
      if (extracted && extracted.startsWith('products/')) {
        paths.add(extracted);
      }
    }
  }
  return Array.from(paths);
}

export async function cleanupUnusedStorageImages(
  candidatePaths: string[],
  otherProducts: Product[]
): Promise<void> {
  const uniqueCandidates = Array.from(
    new Set(
      candidatePaths
        .map((p) => (p || '').trim())
        .filter((p) => p.startsWith('products/'))
    )
  );
  if (uniqueCandidates.length === 0) return;

  const referencedPaths = new Set<string>();
  for (const prod of otherProducts) {
    for (const refPath of collectProductStoragePaths(prod)) {
      referencedPaths.add(refPath);
    }
  }

  const safeToDelete = uniqueCandidates.filter((p) => !referencedPaths.has(p));
  if (safeToDelete.length === 0) return;

  await Promise.allSettled(safeToDelete.map((path) => deleteStorageFileIfExists(path)));
}

export async function adjustProductVariantStock(params: {
  product: Product;
  size: string;
  color: string;
  change: number;
  reason: string;
  performedBy: string;
}): Promise<void> {
  const { product, size, color, change, reason, performedBy } = params;
  const prodRef = doc(db, 'products', product.id);
  const key = `${size}_${color}`;
  const prevVariantQty = product.variantStock[key] ?? 0;
  const newVariantQty = Math.max(0, prevVariantQty + change);
  const actualChange = newVariantQty - prevVariantQty;

  const updatedVariantStock = {
    ...product.variantStock,
    [key]: newVariantQty,
  };
  const newTotalStock = Object.values(updatedVariantStock).reduce((sum, q) => sum + q, 0);

  const path = `products/${product.id}`;
  try {
    const prodSnap = await getDoc(prodRef);
    if (!prodSnap.exists()) {
      throw new Error('Product document does not exist in Firestore yet.');
    }

    const batch = writeBatch(db);
    batch.update(prodRef, {
      variantStock: updatedVariantStock,
      stockQuantity: newTotalStock,
      updatedAt: serverTimestamp(),
    });

    const logId = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    batch.set(doc(db, 'inventoryLogs', logId), {
      productId: product.id,
      productName: product.name.slice(0, 120),
      sku: product.sku.slice(0, 40),
      size: size.slice(0, 20),
      color: color.slice(0, 40),
      previousStock: prevVariantQty,
      change: actualChange,
      newStock: newVariantQty,
      reason: reason.trim().slice(0, 200) || 'Manual stock adjustment',
      performedBy: performedBy.slice(0, 120),
      createdAt: serverTimestamp(),
    });

    if (newTotalStock <= 5) {
      const notifId = `notif-stock-${Date.now()}`;
      batch.set(doc(db, 'notifications', notifId), {
        type: 'low_stock',
        title: `Low Stock Alert: ${product.name.slice(0, 80)}`,
        message: `${product.sku} (${size} / ${color}) now has ${newTotalStock} total units remaining.`,
        relatedId: product.id,
        read: false,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function validatePromoCode(
  rawCode: string,
  subtotal: number
): Promise<{ valid: boolean; promo?: Promotion; discountAmount: number; error?: string }> {
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!code || code.length < 3) {
    return { valid: false, discountAmount: 0, error: 'Please enter a valid promo code.' };
  }

  try {
    const snap = await getDoc(doc(db, 'promotions', code));
    if (!snap.exists()) {
      return { valid: false, discountAmount: 0, error: 'Promo code not found or inactive.' };
    }
    const data = snap.data() as Promotion;
    if (!data.active) {
      return { valid: false, discountAmount: 0, error: 'This promo code is currently disabled.' };
    }
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
      return { valid: false, discountAmount: 0, error: 'This promo code has expired.' };
    }
    if (subtotal < data.minOrderAmount) {
      return {
        valid: false,
        discountAmount: 0,
        error: `Minimum order of $${data.minOrderAmount} required for ${code}.`,
      };
    }

    const discountAmount =
      data.type === 'percentage'
        ? Math.round((subtotal * data.value) / 100)
        : Math.min(subtotal, data.value);

    return { valid: true, promo: data, discountAmount };
  } catch {
    return { valid: false, discountAmount: 0, error: 'Promo code not found or unavailable.' };
  }
}

export async function placeCustomerOrder(params: {
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  promoCode: string;
  discountAmount: number;
  shippingCost: number;
  paymentMethod: PaymentMethod;
  notes: string;
}): Promise<{ orderId: string; orderNumber: string }> {
  const orderId = `ord-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const orderNumber = `KV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const subtotal = params.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal - params.discountAmount + params.shippingCost;

  const orderPath = `orders/${orderId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'orders', orderId), {
      orderNumber,
      userId: params.userId,
      customerName: params.customerName.trim().slice(0, 100),
      customerEmail: params.customerEmail.trim().slice(0, 120),
      customerPhone: params.customerPhone.trim().slice(0, 30),
      shippingAddress: {
        address: params.shippingAddress.address.trim().slice(0, 200),
        city: params.shippingAddress.city.trim().slice(0, 80),
        state: params.shippingAddress.state.trim().slice(0, 80),
        postalCode: params.shippingAddress.postalCode.trim().slice(0, 20),
      },
      items: params.items.slice(0, 7).map((item) => ({
        productId: item.productId,
        name: item.name.slice(0, 120),
        sku: item.sku.slice(0, 40),
        price: Math.round(item.price),
        quantity: Math.max(1, Math.min(20, Math.round(item.quantity))),
        size: item.size.slice(0, 20),
        color: item.color.slice(0, 40),
        image: item.image.slice(0, 1500),
      })),
      subtotal: Math.round(subtotal),
      promoCode: params.promoCode.trim().toUpperCase().slice(0, 32),
      discountAmount: Math.round(params.discountAmount),
      shippingCost: Math.round(params.shippingCost),
      total: Math.round(total),
      paymentMethod: params.paymentMethod,
      paymentStatus: 'pending',
      status: 'Pending',
      notes: (params.notes || '').trim().slice(0, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Atomic notification matching Pillar 7 Atomicity Guarantee
    const notifId = `notif-ord-${Date.now()}`;
    batch.set(doc(db, 'notifications', notifId), {
      type: 'new_order',
      title: `New Order ${orderNumber}`,
      message: `${params.customerName.trim().slice(0, 60)} placed an order totaling $${Math.round(total)}.`,
      relatedId: orderId,
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return { orderId, orderNumber };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, orderPath);
  }
}

export async function updateOrderByAdmin(
  order: Order,
  updates: { status?: OrderStatus; paymentStatus?: PaymentStatus; notes?: string }
): Promise<void> {
  const path = `orders/${order.id}`;
  try {
    const batch = writeBatch(db);
    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.paymentStatus !== undefined) updatePayload.paymentStatus = updates.paymentStatus;
    if (updates.notes !== undefined) updatePayload.notes = updates.notes.slice(0, 500);

    batch.update(doc(db, 'orders', order.id), updatePayload);

    if (updates.status && updates.status !== order.status) {
      const notifId = `notif-status-${Date.now()}`;
      batch.set(doc(db, 'notifications', notifId), {
        type: 'order_status',
        title: `Order ${order.orderNumber} → ${updates.status}`,
        message: `Order status for ${order.customerName} updated from ${order.status} to ${updates.status}.`,
        relatedId: order.id,
        read: false,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cancelOrderByCustomer(orderId: string): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status: 'Cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function ensureUserProfileInFirestore(params: {
  uid: string;
  displayName: string;
  email: string;
  initialWishlist?: string[];
}): Promise<UserProfile> {
  const path = `users/${params.uid}`;
  try {
    const userRef = doc(db, 'users', params.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const d = snap.data();
      return {
        uid: d.uid,
        displayName: d.displayName || '',
        email: d.email || params.email,
        phone: d.phone || '',
        address: d.address || '',
        city: d.city || '',
        state: d.state || '',
        postalCode: d.postalCode || '',
        wishlist: Array.isArray(d.wishlist) ? d.wishlist : [],
        createdAt: timestampToIso(d.createdAt),
        updatedAt: timestampToIso(d.updatedAt),
      };
    }

    const freshProfile = {
      uid: params.uid,
      displayName: (params.displayName || '').slice(0, 100),
      email: params.email.slice(0, 120),
      phone: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      wishlist: (params.initialWishlist || []).slice(0, 50),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(userRef, freshProfile);
    return {
      ...freshProfile,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfileFields(
  uid: string,
  fields: Partial<Pick<UserProfile, 'displayName' | 'phone' | 'address' | 'city' | 'state' | 'postalCode' | 'wishlist'>>
): Promise<void> {
  const path = `users/${uid}`;
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (fields.displayName !== undefined) payload.displayName = fields.displayName.slice(0, 100);
  if (fields.phone !== undefined) payload.phone = fields.phone.slice(0, 30);
  if (fields.address !== undefined) payload.address = fields.address.slice(0, 200);
  if (fields.city !== undefined) payload.city = fields.city.slice(0, 80);
  if (fields.state !== undefined) payload.state = fields.state.slice(0, 80);
  if (fields.postalCode !== undefined) payload.postalCode = fields.postalCode.slice(0, 20);
  if (fields.wishlist !== undefined) payload.wishlist = fields.wishlist.slice(0, 50);

  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function savePromotionToFirestore(promo: Promotion, isEdit: boolean): Promise<void> {
  const code = promo.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
  const path = `promotions/${code}`;
  const valueInt =
    promo.type === 'percentage'
      ? Math.max(1, Math.min(90, Math.round(promo.value)))
      : Math.max(1, Math.min(10000, Math.round(promo.value)));

  try {
    const refDoc = doc(db, 'promotions', code);
    const snap = isEdit ? await getDoc(refDoc) : null;
    await setDoc(refDoc, {
      code,
      type: promo.type,
      value: valueInt,
      minOrderAmount: Math.max(0, Math.round(promo.minOrderAmount || 0)),
      expiresAt: promo.expiresAt.slice(0, 40),
      active: Boolean(promo.active),
      usageCount: Math.max(0, Math.round(promo.usageCount || 0)),
      createdAt: snap?.exists() ? snap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deletePromotionFromFirestore(code: string): Promise<void> {
  const path = `promotions/${code}`;
  try {
    await deleteDoc(doc(db, 'promotions', code));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSiteSettingsToFirestore(settings: SiteSettings): Promise<void> {
  const path = 'siteSettings/store';
  try {
    await setDoc(doc(db, 'siteSettings', 'store'), {
      storeName: settings.storeName.trim().slice(0, 80),
      tagline: settings.tagline.trim().slice(0, 160),
      logoText: settings.logoText.trim().slice(0, 40),
      heroTitle: settings.heroTitle.trim().slice(0, 120),
      heroSubtitle: settings.heroSubtitle.trim().slice(0, 300),
      heroCtaText: settings.heroCtaText.trim().slice(0, 40),
      heroImage: settings.heroImage.trim().slice(0, 1500),
      promoBannerText: settings.promoBannerText.trim().slice(0, 180),
      promoBannerActive: Boolean(settings.promoBannerActive),
      editorialTitle: settings.editorialTitle.trim().slice(0, 120),
      editorialSubtitle: settings.editorialSubtitle.trim().slice(0, 300),
      editorialImage: settings.editorialImage.trim().slice(0, 1500),
      contactEmail: settings.contactEmail.trim().slice(0, 120),
      contactPhone: settings.contactPhone.trim().slice(0, 30),
      whatsappNumber: settings.whatsappNumber.trim().slice(0, 30),
      instagramUrl: settings.instagramUrl.trim().slice(0, 200),
      pinterestUrl: settings.pinterestUrl.trim().slice(0, 200),
      twitterUrl: settings.twitterUrl.trim().slice(0, 200),
      freeShippingThreshold: Math.max(0, Math.round(Number(settings.freeShippingThreshold) || 0)),
      standardShippingCost: Math.max(0, Math.round(Number(settings.standardShippingCost) || 0)),
      lowStockThreshold: Math.max(
        1,
        Math.min(100, Math.round(Number(settings.lowStockThreshold ?? 5) || 5))
      ),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function markNotificationReadInFirestore(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsReadInFirestore(notifications: AdminNotification[]): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const n of unread) {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

export async function subscribeToNewsletter(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase().slice(0, 120);
  const subId = `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const path = `newsletter/${subId}`;
  try {
    await setDoc(doc(db, 'newsletter', subId), {
      email: cleanEmail,
      subscribedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function mapOrderDoc(id: string, data: Record<string, unknown>): Order {
  return {
    id,
    orderNumber: String(data.orderNumber || ''),
    userId: String(data.userId || ''),
    customerName: String(data.customerName || ''),
    customerEmail: String(data.customerEmail || ''),
    customerPhone: String(data.customerPhone || ''),
    shippingAddress: (data.shippingAddress as ShippingAddress) || {
      address: '',
      city: '',
      state: '',
      postalCode: '',
    },
    items: (data.items as OrderItem[]) || [],
    subtotal: Number(data.subtotal || 0),
    promoCode: String(data.promoCode || ''),
    discountAmount: Number(data.discountAmount || 0),
    shippingCost: Number(data.shippingCost || 0),
    total: Number(data.total || 0),
    paymentMethod: (data.paymentMethod as PaymentMethod) || 'cod',
    paymentStatus: (data.paymentStatus as PaymentStatus) || 'pending',
    status: (data.status as OrderStatus) || 'Pending',
    notes: String(data.notes || ''),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export function mapInventoryLogDoc(id: string, data: Record<string, unknown>): InventoryLog {
  return {
    id,
    productId: String(data.productId || ''),
    productName: String(data.productName || ''),
    sku: String(data.sku || ''),
    size: String(data.size || ''),
    color: String(data.color || ''),
    previousStock: Number(data.previousStock || 0),
    change: Number(data.change || 0),
    newStock: Number(data.newStock || 0),
    reason: String(data.reason || ''),
    performedBy: String(data.performedBy || ''),
    createdAt: timestampToIso(data.createdAt),
  };
}

export function mapNotificationDoc(id: string, data: Record<string, unknown>): AdminNotification {
  return {
    id,
    type: (data.type as AdminNotification['type']) || 'new_order',
    title: String(data.title || ''),
    message: String(data.message || ''),
    relatedId: String(data.relatedId || ''),
    read: Boolean(data.read),
    createdAt: timestampToIso(data.createdAt),
  };
}
