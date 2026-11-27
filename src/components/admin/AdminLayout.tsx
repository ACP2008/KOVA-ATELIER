import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  Boxes,
  CheckCheck,
  ChevronDown,
  Globe,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Moon,
  Package,
  Search,
  ShieldAlert,
  ShoppingBag,
  Sun,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  markAllNotificationsReadInFirestore,
  markNotificationReadInFirestore,
} from '../../lib/firestoreService';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../../lib/productBadges';
import { AdminSection } from '../../types';
import { AdminOverview } from './AdminOverview';
import { AdminProducts } from './AdminProducts';
import { AdminInventory } from './AdminInventory';
import { AdminOrders } from './AdminOrders';
import { AdminCustomers } from './AdminCustomers';
import { AdminPromotions } from './AdminPromotions';
import { AdminWebsite } from './AdminWebsite';

interface AdminLayoutProps {
  section: AdminSection;
}

const NAV_ITEMS: { id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: ShoppingBag },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'promotions', label: 'Promotions', icon: Tag },
  { id: 'website', label: 'Website', icon: Globe },
];

export function AdminLayout({ section }: AdminLayoutProps) {
  const {
    user,
    authReady,
    isAdmin,
    adminCheckLoading,
    logoutAdmin,
    navigate,
    adminDarkMode,
    toggleAdminDarkMode,
    adminNotifications,
    products,
    adminOrders,
    siteSettings,
  } = useStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Automatically redirect unauthenticated visitors to /admin/login
  useEffect(() => {
    if (authReady && !adminCheckLoading && !user) {
      navigate({ name: 'admin-login' });
    }
  }, [authReady, adminCheckLoading, user, navigate]);

  // Close profile menu on outside click
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [profileMenuOpen]);

  const unreadCount = useMemo(
    () => adminNotifications.filter((n) => !n.read).length,
    [adminNotifications]
  );

  const lowStockThreshold = siteSettings.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

  const lowStockCount = useMemo(
    () => products.filter((p) => p.stockQuantity <= lowStockThreshold).length,
    [products, lowStockThreshold]
  );

  const pendingOrdersCount = useMemo(
    () => adminOrders.filter((o) => o.status === 'Pending').length,
    [adminOrders]
  );

  // Loading state while verifying backend admin claims or redirecting to /admin/login
  if (!authReady || adminCheckLoading || !user) {
    return (
      <div className="min-h-screen bg-[#070709] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-zinc-400">
            Verifying administrator session...
          </p>
        </div>
      </div>
    );
  }

  // Gate: Signed in as a customer (non-admin) -> Unauthorized Access screen
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#070709] text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-zinc-900/70 backdrop-blur-2xl border border-white/12 p-8 text-center space-y-6 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-red-400">
              403 · Unauthorized Access
            </p>
            <h1 className="font-display text-3xl font-semibold text-white">
              Admin Access Denied
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              The signed-in account{' '}
              <span className="font-mono text-xs text-zinc-200">{user.email}</span> is a customer
              account and does not have administrator privileges. All admin routes and Firestore
              collections are strictly restricted.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              onClick={() => navigate({ name: 'home' })}
              className="w-full py-3 px-6 bg-white text-zinc-950 text-sm font-semibold rounded-xl hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              Return to Storefront
            </button>
            <button
              onClick={logoutAdmin}
              className="w-full py-2.5 px-4 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sign Out &amp; Go to Admin Login</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentNav = NAV_ITEMS.find((n) => n.id === section) || NAV_ITEMS[0];

  const renderSection = () => {
    switch (section) {
      case 'overview':
        return <AdminOverview />;
      case 'products':
        return <AdminProducts globalSearch={globalSearch} />;
      case 'inventory':
        return <AdminInventory globalSearch={globalSearch} />;
      case 'orders':
        return <AdminOrders globalSearch={globalSearch} />;
      case 'customers':
        return <AdminCustomers globalSearch={globalSearch} />;
      case 'promotions':
        return <AdminPromotions />;
      case 'website':
        return <AdminWebsite />;
    }
  };

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="h-16 px-6 flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/80">
        <button
          onClick={() => navigate({ name: 'admin', section: 'overview' })}
          className="font-display text-xl font-semibold tracking-[0.14em] text-zinc-950 dark:text-white whitespace-nowrap cursor-pointer"
        >
          {siteSettings.logoText}
        </button>
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          const count =
            item.id === 'orders' && pendingOrdersCount > 0
              ? pendingOrdersCount
              : item.id === 'inventory' && lowStockCount > 0
                ? lowStockCount
                : null;

          return (
            <button
              key={item.id}
              onClick={() => {
                navigate({ name: 'admin', section: item.id });
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/70 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </span>
              {count !== null && (
                <span
                  className={`font-mono text-xs tabular-nums ${
                    active
                      ? 'text-zinc-300 dark:text-zinc-600'
                      : item.id === 'inventory'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
        <button
          onClick={() => navigate({ name: 'home' })}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer"
        >
          <span>View Storefront</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={logoutAdmin}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/70 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F4F4F6] via-[#FAFAFB] to-[#ECEEF2] dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 text-zinc-950 dark:text-zinc-100 flex">
      {/* Desktop Glass Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 glass-panel border-r border-zinc-200/80 dark:border-zinc-800/80 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 max-w-[82vw] bg-white dark:bg-zinc-900 h-full shadow-2xl">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Canvas */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 glass-nav border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              className="lg:hidden p-2 -ml-2 text-zinc-600 dark:text-zinc-300"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-zinc-400 dark:text-zinc-500 hidden sm:inline">Admin</span>
              <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">/</span>
              <span className="font-semibold text-zinc-950 dark:text-white truncate">
                {currentNav.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Global Search */}
            <div className="relative hidden md:block w-60">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search products, orders..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/90 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
              />
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleAdminDarkMode}
              aria-label={adminDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
            >
              {adminDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Bell */}
            <button
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Admin notifications"
              className="relative p-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-mono text-[10px] font-semibold flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Admin Identity & Profile Menu */}
            <div ref={profileMenuRef} className="relative pl-2 border-l border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                aria-expanded={profileMenuOpen}
                aria-label="Admin profile menu"
                className="flex items-center gap-2.5 py-1 px-1.5 rounded-lg hover:bg-zinc-100/80 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold flex items-center justify-center shrink-0">
                  {(user.displayName || user.email || 'A').slice(0, 1).toUpperCase()}
                </div>
                <div className="text-left leading-tight hidden xl:block">
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 max-w-[130px] truncate">
                    {user.displayName || 'Administrator'}
                  </p>
                  <p className="text-[11px] text-zinc-500 max-w-[130px] truncate">{user.email}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 hidden sm:block" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl p-2 z-50">
                  <div className="px-3 py-2.5 border-b border-zinc-200/70 dark:border-zinc-800">
                    <p className="text-xs font-semibold text-zinc-950 dark:text-white truncate">
                      {user.displayName || 'Store Administrator'}
                    </p>
                    <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>
                  <div className="pt-1.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate({ name: 'home' });
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <span>View Storefront</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logoutAdmin();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Active Section Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto">
          {renderSection()}
        </main>
      </div>

      {/* Admin Notifications Slide-over Panel */}
      {notifOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setNotifOpen(false)}
          />
          <aside className="relative w-full max-w-md bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border-l border-zinc-200 dark:border-zinc-800 h-full flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
                  Notifications
                </h2>
                <p className="text-xs text-zinc-500">
                  {unreadCount} unread alerts
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllNotificationsReadInFirestore(adminNotifications)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={() => setNotifOpen(false)}
                  aria-label="Close notifications"
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {adminNotifications.length === 0 ? (
                <div className="py-20 text-center px-6">
                  <Bell className="w-7 h-7 text-zinc-400 mx-auto mb-3 stroke-[1.4]" />
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    All caught up
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    New orders, low-stock alerts, and order status updates will appear here in real time.
                  </p>
                </div>
              ) : (
                adminNotifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markNotificationReadInFirestore(n.id);
                      if (n.type === 'low_stock') navigate({ name: 'admin', section: 'inventory' });
                      else navigate({ name: 'admin', section: 'orders' });
                      setNotifOpen(false);
                    }}
                    className={`px-6 py-4 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                      !n.read ? 'bg-zinc-50/90 dark:bg-zinc-800/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                      <span className="uppercase tracking-wider font-medium">
                        {n.type === 'new_order'
                          ? 'New Order'
                          : n.type === 'low_stock'
                            ? 'Low Stock'
                            : 'Order Update'}
                      </span>
                      <span className="font-mono">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p
                      className={`text-sm mt-1 ${
                        !n.read
                          ? 'font-semibold text-zinc-950 dark:text-white'
                          : 'font-medium text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
