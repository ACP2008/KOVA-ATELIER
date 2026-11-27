import { Product, ProductBadge } from '../types';

export type ActiveProductBadge = Exclude<ProductBadge, ''>;

export const ADMIN_BADGE_OPTIONS: { value: ProductBadge; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'BESTSELLER', label: 'Bestseller' },
  { value: 'TRENDING', label: 'Trending' },
  { value: 'NEW ARRIVAL', label: 'New Arrival' },
  { value: 'LIMITED EDITION', label: 'Limited Edition' },
  { value: 'SALE', label: 'Sale' },
  { value: 'LOW STOCK', label: 'Low Stock' },
];

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const NEW_ARRIVAL_WINDOW_DAYS = 14;

/**
 * Checks whether a product was added recently (within 14 days).
 */
export function isRecentlyAddedProduct(product: Pick<Product, 'createdAt'>): boolean {
  if (!product.createdAt) return false;
  const ts =
    typeof product.createdAt === 'number'
      ? product.createdAt
      : Date.parse(String(product.createdAt));
  if (Number.isNaN(ts)) return false;
  const ageMs = Date.now() - ts;
  return ageMs >= 0 && ageMs <= NEW_ARRIVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Computes up to TWO clean, non-duplicated product badges for display on a product card.
 * Combines manual admin badges with automatic SALE, LOW STOCK, and NEW ARRIVAL rules.
 */
export function resolveProductBadges(
  product: Pick<
    Product,
    'badge' | 'price' | 'discountPrice' | 'stockQuantity' | 'newArrival' | 'bestSeller' | 'createdAt'
  >,
  lowStockThreshold: number = DEFAULT_LOW_STOCK_THRESHOLD
): ActiveProductBadge[] {
  const threshold = Math.max(1, Math.round(lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD));
  const badges: ActiveProductBadge[] = [];

  const pushUnique = (b: ActiveProductBadge) => {
    if (!badges.includes(b) && badges.length < 2) {
      badges.push(b);
    }
  };

  // 1. Admin manually assigned badge always gets top priority
  const manualBadge = product.badge;
  if (manualBadge && manualBadge.length > 0) {
    // Do not display LOW STOCK if item is completely sold out
    if (!(manualBadge === 'LOW STOCK' && product.stockQuantity <= 0)) {
      pushUnique(manualBadge);
    }
  } else if (manualBadge === undefined && product.bestSeller) {
    // Graceful fallback for older Firestore docs created before the badge field existed
    pushUnique('BESTSELLER');
  }

  // 2. Automatic LOW STOCK when stock is above 0 and at/below configurable threshold
  if (product.stockQuantity > 0 && product.stockQuantity <= threshold) {
    pushUnique('LOW STOCK');
  }

  // 3. Automatic SALE when product has a valid discount price below base price
  if (product.discountPrice > 0 && product.discountPrice < product.price) {
    pushUnique('SALE');
  }

  // 4. Automatic NEW ARRIVAL for newly added products, respecting admin newArrival toggle override
  if (product.newArrival) {
    pushUnique('NEW ARRIVAL');
  } else if (product.newArrival === undefined && isRecentlyAddedProduct(product)) {
    pushUnique('NEW ARRIVAL');
  }

  return badges.slice(0, 2);
}

/**
 * Premium minimal glassmorphism styling tokens for each badge type.
 */
export function getBadgeStyleClasses(badge: ActiveProductBadge): string {
  switch (badge) {
    case 'BESTSELLER':
      return 'bg-zinc-950/78 text-white border-white/15';
    case 'TRENDING':
      return 'bg-zinc-900/78 text-zinc-100 border-white/20';
    case 'NEW ARRIVAL':
      return 'bg-white/84 text-zinc-950 border-zinc-900/12';
    case 'LIMITED EDITION':
      return 'bg-black/84 text-amber-200 border-amber-200/25';
    case 'SALE':
      return 'bg-white/88 text-zinc-950 border-zinc-950/15';
    case 'LOW STOCK':
      return 'bg-zinc-950/82 text-amber-300 border-amber-300/25';
  }
}
