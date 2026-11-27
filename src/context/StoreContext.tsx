import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, signInWithGoogle, signOutUser } from '../lib/firebase';
import {
  ensureUserProfileInFirestore,
  mapInventoryLogDoc,
  mapNotificationDoc,
  mapOrderDoc,
  seedInitialCatalogIfEmpty,
  timestampToIso,
  updateUserProfileFields,
  verifyAdminBackendAccess,
} from '../lib/firestoreService';
import {
  DEFAULT_SITE_SETTINGS,
  LEGACY_DELETED_IMAGE_FRAGMENTS,
  LEGACY_FEMALE_PRODUCT_IDS,
  MENS_CATEGORIES,
  SEED_PRODUCTS,
  SEED_PROMOTIONS,
} from '../data/seedCatalog';
import {
  AdminNotification,
  AdminSection,
  AppRoute,
  CartItem,
  InventoryLog,
  Order,
  Product,
  ProductBadge,
  Promotion,
  ShopCollectionFilter,
  SiteSettings,
  ToastMessage,
  UserProfile,
} from '../types';

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

interface StoreContextValue {
  route: AppRoute;
  navigate: (next: AppRoute) => void;
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  adminCheckLoading: boolean;
  userProfile: UserProfile | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  logoutAdmin: () => Promise<void>;

  products: Product[];
  activeProducts: Product[];
  productsLoading: boolean;
  isCatalogSeeded: boolean;
  seedCatalogNow: () => Promise<void>;

  siteSettings: SiteSettings;
  customerOrders: Order[];

  // Admin real-time streams (only populated when isAdmin === true)
  adminOrders: Order[];
  adminCustomers: UserProfile[];
  adminPromotions: Promotion[];
  adminInventoryLogs: InventoryLog[];
  adminNotifications: AdminNotification[];

  // Cart
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (item: CartItem) => void;
  updateCartQty: (productId: string, size: string, color: string, qty: number) => void;
  removeFromCart: (productId: string, size: string, color: string) => void;
  clearCart: () => void;

  // Wishlist & Recently Viewed
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  recentlyViewed: string[];
  recordProductView: (productId: string) => void;

  // Search Overlay
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // Theme (Admin dark mode)
  adminDarkMode: boolean;
  toggleAdminDarkMode: () => void;

  // Toasts & Confirm Dialog
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], title: string, description?: string) => void;
  removeToast: (id: string) => void;
  confirmState: ConfirmState | null;
  requestConfirm: (config: Omit<ConfirmState, 'open'>) => void;
  closeConfirm: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function parseAppRoute(): AppRoute {
  const hashRaw = window.location.hash.replace(/^#/, '');
  const raw =
    hashRaw && hashRaw !== '/'
      ? hashRaw
      : window.location.pathname && window.location.pathname !== '/'
        ? `${window.location.pathname}${window.location.search}`
        : '/';

  const [pathPart, queryPart] = raw.split('?');
  const params = new URLSearchParams(queryPart || '');
  const segments = pathPart.split('/').filter(Boolean);

  if (segments[0] === 'admin') {
    if (segments[1] === 'login') {
      return { name: 'admin-login' };
    }
    if (!segments[1] || segments[1] === 'dashboard' || segments[1] === 'overview') {
      return { name: 'admin', section: 'overview' };
    }
    const validSections: AdminSection[] = [
      'overview',
      'products',
      'inventory',
      'orders',
      'customers',
      'promotions',
      'website',
    ];
    const sec = segments[1] as AdminSection | undefined;
    return { name: 'admin', section: sec && validSections.includes(sec) ? sec : 'overview' };
  }
  if (segments[0] === 'shop') {
    return {
      name: 'shop',
      category: params.get('category') || undefined,
      filter: (params.get('filter') as ShopCollectionFilter) || undefined,
    };
  }
  if (segments[0] === 'product' && segments[1]) {
    return { name: 'product', id: segments[1] };
  }
  if (segments[0] === 'checkout') return { name: 'checkout' };
  if (segments[0] === 'wishlist') return { name: 'wishlist' };
  if (segments[0] === 'account') {
    const tab = params.get('tab') as 'orders' | 'track' | 'profile' | null;
    return {
      name: 'account',
      tab: tab || 'orders',
      orderNumber: params.get('order') || undefined,
    };
  }
  return { name: 'home' };
}

function serializeRoute(r: AppRoute): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'shop': {
      const p = new URLSearchParams();
      if (r.category) p.set('category', r.category);
      if (r.filter) p.set('filter', r.filter);
      const qs = p.toString();
      return qs ? `#/shop?${qs}` : '#/shop';
    }
    case 'product':
      return `#/product/${r.id}`;
    case 'checkout':
      return '#/checkout';
    case 'wishlist':
      return '#/wishlist';
    case 'account': {
      const p = new URLSearchParams();
      if (r.tab) p.set('tab', r.tab);
      if (r.orderNumber) p.set('order', r.orderNumber);
      const qs = p.toString();
      return qs ? `#/account?${qs}` : '#/account';
    }
    case 'admin-login':
      return '#/admin/login';
    case 'admin': {
      const sec = r.section || 'overview';
      return sec === 'overview' ? '#/admin/dashboard' : `#/admin/${sec}`;
    }
  }
}

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<AppRoute>(() => parseAppRoute());
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);

  // Admin collections
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminCustomers, setAdminCustomers] = useState<UserProfile[]>([]);
  const [adminPromotions, setAdminPromotions] = useState<Promotion[]>(SEED_PROMOTIONS);
  const [adminInventoryLogs, setAdminInventoryLogs] = useState<InventoryLog[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);

  // Client interactive state
  const [cart, setCart] = useState<CartItem[]>(() => loadLocal<CartItem[]>('kova_cart', []));
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>(() => loadLocal<string[]>('kova_wishlist', []));
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() =>
    loadLocal<string[]>('kova_recent', [])
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [adminDarkMode, setAdminDarkMode] = useState<boolean>(() =>
    loadLocal<boolean>('kova_admin_dark', false)
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const addToast = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, title, description }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const requestConfirm = useCallback((config: Omit<ConfirmState, 'open'>) => {
    setConfirmState({ ...config, open: true });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState(null);
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    const hash = serializeRoute(next);
    if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', `/${hash}`);
    } else if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handleRouteChange = () => setRoute(parseAppRoute());
    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  // Apply dark mode class strictly when inside /admin and adminDarkMode is enabled
  useEffect(() => {
    const html = document.documentElement;
    if (route.name === 'admin' && adminDarkMode) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [route.name, adminDarkMode]);

  const toggleAdminDarkMode = useCallback(() => {
    setAdminDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('kova_admin_dark', JSON.stringify(next));
      return next;
    });
  }, []);

  // Persist local cart, wishlist, recentlyViewed
  useEffect(() => {
    localStorage.setItem('kova_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('kova_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('kova_recent', JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  // Firebase Auth listener + backend admin check + user profile bootstrap
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setIsAdmin(false);
        setUserProfile(null);
        setCustomerOrders([]);
        setAdminOrders([]);
        setAdminCustomers([]);
        setAdminInventoryLogs([]);
        setAdminNotifications([]);
        setAuthReady(true);
        return;
      }

      setAdminCheckLoading(true);
      try {
        const adminVerified = await verifyAdminBackendAccess(
          firebaseUser.uid,
          firebaseUser.email,
          firebaseUser.emailVerified
        );
        setIsAdmin(adminVerified);

        // Ensure user profile exists in Firestore
        if (firebaseUser.email && firebaseUser.emailVerified) {
          const localWishlist = loadLocal<string[]>('kova_wishlist', []);
          const profile = await ensureUserProfileInFirestore({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || '',
            email: firebaseUser.email,
            initialWishlist: localWishlist,
          });
          setUserProfile(profile);
          if (profile.wishlist.length > 0) {
            setWishlist((prev) => Array.from(new Set([...profile.wishlist, ...prev])).slice(0, 50));
          }
        }

        // Auto-seed or safely migrate T-shirt catalog on admin login
        if (adminVerified) {
          const seeded = await seedInitialCatalogIfEmpty();
          if (seeded) {
            addToast(
              'success',
              "T-Shirt Catalog Synced",
              'Active catalog updated to Men’s T-Shirts only; past orders remain preserved.'
            );
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setAdminCheckLoading(false);
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, [addToast]);

  // Real-time Products subscription (public active products, or all products when verified admin)
  useEffect(() => {
    if (!authReady) return;
    setProductsLoading(true);
    const q = isAdmin
      ? collection(db, 'products')
      : query(collection(db, 'products'), where('status', '==', 'active'));

    const mensCategorySet = new Set<string>(MENS_CATEGORIES);
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const loaded: Product[] = snapshot.docs
          .filter((d) => {
            const data = d.data();
            if (LEGACY_FEMALE_PRODUCT_IDS.includes(d.id)) return false;
            if (!mensCategorySet.has(String(data.category || ''))) return false;
            const rawImgs = Array.isArray(data.images) ? (data.images as string[]) : [];
            const allImgsLegacy =
              rawImgs.length > 0 &&
              rawImgs.every((img) =>
                LEGACY_DELETED_IMAGE_FRAGMENTS.some((frag) => String(img).includes(frag))
              );
            return !allImgsLegacy;
          })
          .map((d) => {
            const data = d.data();
            const cleanImages = Array.isArray(data.images)
              ? (data.images as string[]).filter(
                  (img) => !LEGACY_DELETED_IMAGE_FRAGMENTS.some((frag) => String(img).includes(frag))
                )
              : [];
            return {
              id: d.id,
              name: String(data.name || ''),
              slug: String(data.slug || d.id),
              category: data.category || 'Oversized T-Shirts',
              description: String(data.description || ''),
              fabricInfo: String(data.fabricInfo || ''),
              price: Number(data.price || 0),
              discountPrice: Number(data.discountPrice || 0),
              sku: String(data.sku || ''),
              sizes: Array.isArray(data.sizes) ? data.sizes : ['S', 'M', 'L', 'XL', 'XXL'],
              colors: Array.isArray(data.colors) ? data.colors : [],
              images:
                cleanImages.length > 0
                  ? cleanImages
                  : ['/src/assets/images/mens_oversized_black_tee_1795777633835.jpg'],
              stockQuantity: Number(data.stockQuantity || 0),
              variantStock: (data.variantStock as Record<string, number>) || {},
              featured: Boolean(data.featured),
              newArrival: Boolean(data.newArrival),
              bestSeller: Boolean(data.bestSeller),
              badge:
                typeof data.badge === 'string'
                  ? (data.badge as ProductBadge)
                  : undefined,
              status: data.status || 'active',
              createdAt: timestampToIso(data.createdAt),
              updatedAt: timestampToIso(data.updatedAt),
            };
          });
        setFirestoreProducts(loaded);
        setProductsLoading(false);
      },
      (error) => {
        setProductsLoading(false);
        console.error('Products listener error:', error);
      }
    );

    return () => unsub();
  }, [authReady, isAdmin]);

  // Real-time Site Settings listener
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'siteSettings', 'store'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const rawHero = typeof d.heroImage === 'string' ? d.heroImage : '';
          const rawEditorial = typeof d.editorialImage === 'string' ? d.editorialImage : '';
          const isLegacyCopy =
            String(d.heroTitle || '').includes('Pure Wool & Silk') ||
            String(d.editorialTitle || '').includes('Monochrome Knitwear') ||
            String(d.editorialTitle || '').toUpperCase().includes('FORMAL COLLECTION') ||
            String(d.tagline || '').toLowerCase().includes('selvedge denim');
          const heroBroken =
            !rawHero || LEGACY_DELETED_IMAGE_FRAGMENTS.some((frag) => rawHero.includes(frag));
          const editorialBroken =
            !rawEditorial ||
            LEGACY_DELETED_IMAGE_FRAGMENTS.some((frag) => rawEditorial.includes(frag));

          setSiteSettings({
            ...DEFAULT_SITE_SETTINGS,
            ...d,
            heroTitle: isLegacyCopy ? DEFAULT_SITE_SETTINGS.heroTitle : d.heroTitle || DEFAULT_SITE_SETTINGS.heroTitle,
            heroSubtitle: isLegacyCopy
              ? DEFAULT_SITE_SETTINGS.heroSubtitle
              : d.heroSubtitle || DEFAULT_SITE_SETTINGS.heroSubtitle,
            heroCtaText: isLegacyCopy
              ? DEFAULT_SITE_SETTINGS.heroCtaText
              : d.heroCtaText || DEFAULT_SITE_SETTINGS.heroCtaText,
            heroImage: heroBroken || isLegacyCopy ? DEFAULT_SITE_SETTINGS.heroImage : rawHero,
            editorialTitle: isLegacyCopy
              ? DEFAULT_SITE_SETTINGS.editorialTitle
              : d.editorialTitle || DEFAULT_SITE_SETTINGS.editorialTitle,
            editorialSubtitle: isLegacyCopy
              ? DEFAULT_SITE_SETTINGS.editorialSubtitle
              : d.editorialSubtitle || DEFAULT_SITE_SETTINGS.editorialSubtitle,
            editorialImage: editorialBroken || isLegacyCopy ? DEFAULT_SITE_SETTINGS.editorialImage : rawEditorial,
            tagline: isLegacyCopy ? DEFAULT_SITE_SETTINGS.tagline : d.tagline || DEFAULT_SITE_SETTINGS.tagline,
            updatedAt: timestampToIso(d.updatedAt),
          } as SiteSettings);
        }
      },
      (err) => {
        console.warn('SiteSettings listener fallback:', err.message);
      }
    );
    return () => unsub();
  }, []);

  // Real-time Customer Orders listener (only when signed in)
  useEffect(() => {
    if (!authReady || !user) return;
    const q = query(collection(db, 'orders'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => mapOrderDoc(d.id, d.data()))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCustomerOrders(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );
    return () => unsub();
  }, [authReady, user]);

  // Real-time User Profile listener
  useEffect(() => {
    if (!authReady || !user) return;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setUserProfile({
            uid: d.uid,
            displayName: d.displayName || '',
            email: d.email || user.email || '',
            phone: d.phone || '',
            address: d.address || '',
            city: d.city || '',
            state: d.state || '',
            postalCode: d.postalCode || '',
            wishlist: Array.isArray(d.wishlist) ? d.wishlist : [],
            createdAt: timestampToIso(d.createdAt),
            updatedAt: timestampToIso(d.updatedAt),
          });
        }
      },
      (err) => console.warn('User profile listener warning:', err.message)
    );
    return () => unsub();
  }, [authReady, user]);

  // Admin Real-time Listeners (ONLY attached after backend verifies isAdmin === true)
  useEffect(() => {
    if (!authReady || !user || !isAdmin) return;

    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const list = snap.docs
          .map((d) => mapOrderDoc(d.id, d.data()))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAdminOrders(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list: UserProfile[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            displayName: String(data.displayName || 'Guest Customer'),
            email: String(data.email || ''),
            phone: String(data.phone || ''),
            address: String(data.address || ''),
            city: String(data.city || ''),
            state: String(data.state || ''),
            postalCode: String(data.postalCode || ''),
            wishlist: Array.isArray(data.wishlist) ? data.wishlist : [],
            createdAt: timestampToIso(data.createdAt),
            updatedAt: timestampToIso(data.updatedAt),
          };
        });
        setAdminCustomers(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    const unsubPromos = onSnapshot(
      collection(db, 'promotions'),
      (snap) => {
        const list: Promotion[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            code: d.id,
            type: data.type || 'percentage',
            value: Number(data.value || 0),
            minOrderAmount: Number(data.minOrderAmount || 0),
            expiresAt: String(data.expiresAt || ''),
            active: Boolean(data.active),
            usageCount: Number(data.usageCount || 0),
            createdAt: timestampToIso(data.createdAt),
            updatedAt: timestampToIso(data.updatedAt),
          };
        });
        setAdminPromotions(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'promotions')
    );

    const unsubLogs = onSnapshot(
      collection(db, 'inventoryLogs'),
      (snap) => {
        const list = snap.docs
          .map((d) => mapInventoryLogDoc(d.id, d.data()))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAdminInventoryLogs(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'inventoryLogs')
    );

    const unsubNotifs = onSnapshot(
      collection(db, 'notifications'),
      (snap) => {
        const list = snap.docs
          .map((d) => mapNotificationDoc(d.id, d.data()))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAdminNotifications(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
    );

    return () => {
      unsubOrders();
      unsubUsers();
      unsubPromos();
      unsubLogs();
      unsubNotifs();
    };
  }, [authReady, user, isAdmin]);

  // Display seeded showcase products seamlessly on storefront if Firestore hasn't been seeded by admin yet
  const isCatalogSeeded = firestoreProducts.length > 0;
  const products = useMemo(
    () => (isCatalogSeeded ? firestoreProducts : SEED_PRODUCTS),
    [firestoreProducts, isCatalogSeeded]
  );
  const activeProducts = useMemo(
    () => products.filter((p) => p.status === 'active'),
    [products]
  );

  const seedCatalogNow = useCallback(async () => {
    if (!isAdmin) return;
    const seeded = await seedInitialCatalogIfEmpty();
    if (seeded) {
      addToast('success', 'Catalog Seeded', 'KOVA ATELIER catalog & promotions saved to Firestore.');
    } else {
      addToast('info', 'Already Initialized', 'Firestore already contains active products.');
    }
  }, [isAdmin, addToast]);

  const loginWithGoogle = useCallback(async () => {
    try {
      await signInWithGoogle();
      addToast('success', 'Signed In', 'Welcome to KOVA ATELIER.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to complete sign-in.';
      if (!message.includes('popup-closed-by-user')) {
        addToast('error', 'Sign-In Failed', message);
      }
    }
  }, [addToast]);

  const logout = useCallback(async () => {
    await signOutUser();
    setIsAdmin(false);
    setAdminOrders([]);
    setAdminCustomers([]);
    setAdminInventoryLogs([]);
    setAdminNotifications([]);
    addToast('info', 'Signed Out', 'You have been securely signed out.');
  }, [addToast]);

  const logoutAdmin = useCallback(async () => {
    await signOutUser();
    setIsAdmin(false);
    setUser(null);
    setUserProfile(null);
    setAdminOrders([]);
    setAdminCustomers([]);
    setAdminInventoryLogs([]);
    setAdminNotifications([]);
    navigate({ name: 'admin-login' });
    addToast('info', 'Admin Signed Out', 'Your admin session has been securely cleared.');
  }, [addToast, navigate]);

  // Cart Actions
  const addToCart = useCallback(
    (item: CartItem) => {
      setCart((prev) => {
        const idx = prev.findIndex(
          (c) => c.productId === item.productId && c.size === item.size && c.color === item.color
        );
        if (idx >= 0) {
          const updated = [...prev];
          const nextQty = Math.min(20, Math.min(item.maxStock || 20, updated[idx].quantity + item.quantity));
          updated[idx] = { ...updated[idx], quantity: nextQty };
          return updated;
        }
        if (prev.length >= 7) {
          addToast(
            'error',
            'Bag Item Limit',
            'You can place up to 7 distinct garments per order for server-side price verification.'
          );
          return prev;
        }
        return [...prev, item];
      });
      addToast('success', 'Added to Bag', `${item.name} (${item.size}, ${item.color})`);
      setCartOpen(true);
    },
    [addToast]
  );

  const updateCartQty = useCallback((productId: string, size: string, color: string, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) {
        return prev.filter((c) => !(c.productId === productId && c.size === size && c.color === color));
      }
      return prev.map((c) =>
        c.productId === productId && c.size === size && c.color === color
          ? { ...c, quantity: Math.min(20, Math.min(c.maxStock || 20, qty)) }
          : c
      );
    });
  }, []);

  const removeFromCart = useCallback((productId: string, size: string, color: string) => {
    setCart((prev) =>
      prev.filter((c) => !(c.productId === productId && c.size === size && c.color === color))
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const toggleWishlist = useCallback(
    (productId: string) => {
      setWishlist((prev) => {
        const exists = prev.includes(productId);
        const next = exists ? prev.filter((id) => id !== productId) : [productId, ...prev].slice(0, 50);
        if (user && user.emailVerified) {
          updateUserProfileFields(user.uid, { wishlist: next }).catch((e) =>
            console.warn('Wishlist sync warning:', e)
          );
        }
        addToast(
          'info',
          exists ? 'Removed from Wishlist' : 'Saved to Wishlist',
          exists ? 'Item removed from your saved pieces.' : 'Item saved to your personal edit.'
        );
        return next;
      });
    },
    [user, addToast]
  );

  const recordProductView = useCallback((productId: string) => {
    setRecentlyViewed((prev) => [productId, ...prev.filter((id) => id !== productId)].slice(0, 8));
  }, []);

  const value: StoreContextValue = {
    route,
    navigate,
    user,
    authReady,
    isAdmin,
    adminCheckLoading,
    userProfile,
    loginWithGoogle,
    logout,
    logoutAdmin,
    products,
    activeProducts,
    productsLoading,
    isCatalogSeeded,
    seedCatalogNow,
    siteSettings,
    customerOrders,
    adminOrders,
    adminCustomers,
    adminPromotions,
    adminInventoryLogs,
    adminNotifications,
    cart,
    cartCount,
    cartSubtotal,
    cartOpen,
    setCartOpen,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    wishlist,
    toggleWishlist,
    recentlyViewed,
    recordProductView,
    searchOpen,
    setSearchOpen,
    adminDarkMode,
    toggleAdminDarkMode,
    toasts,
    addToast,
    removeToast,
    confirmState,
    requestConfirm,
    closeConfirm,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
