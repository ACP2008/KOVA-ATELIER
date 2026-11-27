export type ProductCategory =
  | 'Oversized T-Shirts'
  | 'Regular Fit T-Shirts'
  | 'Graphic T-Shirts'
  | 'Printed T-Shirts'
  | 'Plain T-Shirts'
  | 'Premium Cotton T-Shirts';

export type ShopCollectionFilter =
  | 'new'
  | 'sale'
  | 'featured';

export type ProductStatus = 'active' | 'draft' | 'archived';

export type ProductBadge =
  | ''
  | 'BESTSELLER'
  | 'TRENDING'
  | 'NEW ARRIVAL'
  | 'LIMITED EDITION'
  | 'SALE'
  | 'LOW STOCK';

export interface ProductColor {
  name: string;
  hex: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: ProductCategory;
  description: string;
  fabricInfo: string;
  price: number;
  discountPrice: number; // 0 means no discount
  sku: string;
  sizes: string[];
  colors: ProductColor[];
  images: string[];
  imagePaths?: string[];
  stockQuantity: number;
  variantStock: Record<string, number>; // key: `${size}_${colorName}`
  featured: boolean;
  newArrival: boolean;
  bestSeller: boolean;
  badge?: ProductBadge;
  status: ProductStatus;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export interface CartItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  originalPrice: number;
  quantity: number;
  size: string;
  color: string;
  image: string;
  maxStock: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  size: string;
  color: string;
  image: string;
}

export interface ShippingAddress {
  address: string;
  city: string;
  state: string;
  postalCode: string;
}

export type PaymentMethod = 'cod' | 'bank_transfer';
export type PaymentStatus = 'pending' | 'verified' | 'refunded';
export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  subtotal: number;
  promoCode: string;
  discountAmount: number;
  shippingCost: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  wishlist: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type PromotionType = 'percentage' | 'fixed';

export interface Promotion {
  code: string;
  type: PromotionType;
  value: number;
  minOrderAmount: number;
  expiresAt: string;
  active: boolean;
  usageCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryLog {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  previousStock: number;
  change: number;
  newStock: number;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface SiteSettings {
  storeName: string;
  tagline: string;
  logoText: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroImage: string;
  promoBannerText: string;
  promoBannerActive: boolean;
  editorialTitle: string;
  editorialSubtitle: string;
  editorialImage: string;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string;
  instagramUrl: string;
  pinterestUrl: string;
  twitterUrl: string;
  freeShippingThreshold: number;
  standardShippingCost: number;
  lowStockThreshold?: number;
  updatedAt?: string;
}

export type NotificationType = 'new_order' | 'low_stock' | 'order_status';

export interface AdminNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId: string;
  read: boolean;
  createdAt: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

export type AppRoute =
  | { name: 'home' }
  | { name: 'shop'; category?: string; filter?: ShopCollectionFilter }
  | { name: 'product'; id: string }
  | { name: 'checkout' }
  | { name: 'wishlist' }
  | { name: 'account'; tab?: 'orders' | 'track' | 'profile'; orderNumber?: string }
  | { name: 'admin-login' }
  | { name: 'admin'; section?: AdminSection };

export type AdminSection =
  | 'overview'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'promotions'
  | 'website';
