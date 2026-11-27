import React, { useEffect, useState } from 'react';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { MENS_CATEGORIES } from '../../data/seedCatalog';
import { ResilientImage } from '../ui/ResilientImage';

export function Header() {
  const {
    route,
    navigate,
    siteSettings,
    cartCount,
    setCartOpen,
    wishlist,
    user,
    isAdmin,
    searchOpen,
    setSearchOpen,
    activeProducts,
  } = useStore();

  const [promoDismissed, setPromoDismissed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!mobileMenuOpen && !searchOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileMenuOpen, searchOpen]);

  const filteredSearch = searchQuery.trim()
    ? activeProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeProducts.slice(0, 4);

  const navItems: { label: string; active: boolean; action: () => void }[] = [
    {
      label: 'Home',
      active: route.name === 'home',
      action: () => navigate({ name: 'home' }),
    },
    {
      label: 'Shop',
      active: route.name === 'shop' && !route.filter,
      action: () => navigate({ name: 'shop' }),
    },
    {
      label: 'New Arrivals',
      active: route.name === 'shop' && route.filter === 'new',
      action: () => navigate({ name: 'shop', filter: 'new' }),
    },
    {
      label: 'Track Order',
      active: route.name === 'account' && route.tab === 'track',
      action: () => navigate({ name: 'account', tab: 'track' }),
    },
  ];

  if (isAdmin) {
    navItems.push({
      label: 'Admin',
      active: route.name === 'admin',
      action: () => navigate({ name: 'admin', section: 'overview' }),
    });
  }

  return (
    <>
      <div className="sticky top-0 z-40 w-full max-w-full">
        {siteSettings.promoBannerActive && !promoDismissed && siteSettings.promoBannerText && (
          <div className="bg-zinc-950 text-zinc-100 text-[11px] sm:text-xs py-1.5 sm:py-2 px-9 flex items-center justify-center relative w-full">
            <p className="truncate tracking-wide text-center max-w-full">
              {siteSettings.promoBannerText}
            </p>
            <button
              onClick={() => setPromoDismissed(true)}
              aria-label="Dismiss announcement"
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1.5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <header className="glass-nav border-b border-zinc-200/70 w-full">
          <div className="max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-8">
            {/* Zone 1: Hamburger (mobile) + Single text element wordmark */}
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="md:hidden inline-flex items-center justify-center w-9 h-9 -ml-1 rounded-lg text-zinc-800 hover:text-black hover:bg-zinc-100/80 transition-colors shrink-0 cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'home' })}
                className="font-display text-[15px] min-[376px]:text-[17px] sm:text-xl md:text-2xl font-semibold tracking-[0.09em] min-[376px]:tracking-[0.12em] md:tracking-[0.14em] text-zinc-950 whitespace-nowrap truncate cursor-pointer"
              >
                {siteSettings.logoText || 'KOVA ATELIER'}
              </button>
            </div>

            {/* Zone 2: 4-5 clean single-line text links (tablet/desktop) */}
            <nav className="hidden md:flex items-center gap-5 lg:gap-7" aria-label="Primary navigation">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 relative py-1 cursor-pointer ${
                    item.active
                      ? 'text-zinc-950 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1.5px] after:bg-zinc-950'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Zone 3: Compact utility icons + single primary Shopping Bag action */}
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search catalog"
                className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100/70 transition-colors cursor-pointer shrink-0"
              >
                <Search className="w-[18px] h-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'wishlist' })}
                aria-label="Saved wishlist"
                className="hidden min-[431px]:inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100/70 transition-colors relative cursor-pointer shrink-0"
              >
                <Heart className="w-[18px] h-[18px]" />
                {wishlist.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 text-[10px] font-mono font-semibold leading-none text-zinc-950">
                    {wishlist.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'account', tab: 'orders' })}
                aria-label={user ? 'My account' : 'Sign in'}
                className="hidden sm:inline-flex items-center justify-center w-10 h-10 rounded-lg text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100/70 transition-colors cursor-pointer shrink-0"
              >
                <User className="w-[18px] h-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                aria-label={`Open shopping bag, ${cartCount} items`}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 min-[376px]:px-3 sm:px-4 py-2 bg-zinc-950 text-white text-[11px] sm:text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                <span>Bag</span>
                <span className="font-mono tabular-nums">({cartCount})</span>
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true" aria-label="Mobile navigation">
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-80 max-w-[86vw] bg-white/95 backdrop-blur-2xl h-[100dvh] flex flex-col shadow-2xl border-r border-zinc-200/80">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200/80 shrink-0">
              <span className="font-display text-lg font-semibold tracking-[0.14em] text-zinc-950">
                {siteSettings.logoText || 'KOVA ATELIER'}
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
              <div className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.action();
                      setMobileMenuOpen(false);
                    }}
                    className={`text-left py-3 px-3.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                      item.active ? 'bg-zinc-950 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-zinc-200/80 space-y-1">
                <p className="px-3.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  T-Shirt Categories
                </p>
                {MENS_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      navigate({ name: 'shop', category });
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left py-2.5 px-3.5 rounded-xl text-sm text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 transition-colors cursor-pointer"
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-zinc-200/80 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    navigate({ name: 'wishlist' });
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-between py-3 px-3.5 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <span>Saved Wishlist</span>
                  <span className="font-mono text-xs tabular-nums text-zinc-500">({wishlist.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate({ name: 'account', tab: 'orders' });
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-3 px-3.5 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Account &amp; Orders
                </button>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-zinc-200/80 flex items-center justify-between shrink-0 bg-zinc-50/70">
              <button
                type="button"
                onClick={() => {
                  navigate({ name: 'admin', section: 'overview' });
                  setMobileMenuOpen(false);
                }}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-950 transition-colors cursor-pointer"
              >
                Admin Portal
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setCartOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 text-white text-xs font-medium cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Bag ({cartCount})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-start justify-center pt-10 sm:pt-24 px-3 sm:px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white/95 backdrop-blur-xl border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-5 py-3 sm:py-4 border-b border-zinc-200">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search oversized, regular fit, graphic, plain T-shirts..."
                className="w-full min-w-0 bg-transparent text-base sm:text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="p-2 text-zinc-400 hover:text-zinc-900 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 max-h-[68dvh] overflow-y-auto">
              <p className="text-xs font-medium text-zinc-500 mb-4">
                {searchQuery.trim()
                  ? `${filteredSearch.length} matching pieces`
                  : 'Curated Recommendations'}
              </p>
              {filteredSearch.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-zinc-600">
                    No garments matched "{searchQuery}".
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchOpen(false);
                      navigate({ name: 'shop' });
                    }}
                    className="mt-3 text-xs font-medium text-zinc-950 underline underline-offset-4"
                  >
                    Browse Full Collection
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredSearch.slice(0, 6).map((p) => {
                    const effectivePrice = p.discountPrice > 0 ? p.discountPrice : p.price;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery('');
                          navigate({ name: 'product', id: p.id });
                        }}
                        className="flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-zinc-50 transition-colors text-left cursor-pointer"
                      >
                        <ResilientImage
                          src={p.images[0]}
                          alt={p.name}
                          className="w-14 h-18 object-cover rounded-lg bg-zinc-100 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs text-zinc-500">{p.category}</p>
                          <p className="text-sm font-medium text-zinc-950 truncate">{p.name}</p>
                          <p className="text-xs font-mono tabular-nums text-zinc-700 mt-0.5">
                            ${effectivePrice}
                            {p.discountPrice > 0 && (
                              <span className="line-through text-zinc-400 ml-2">${p.price}</span>
                            )}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
