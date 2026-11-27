import React, { useState } from 'react';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
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
      <div className="sticky top-0 z-40">
        {siteSettings.promoBannerActive && !promoDismissed && siteSettings.promoBannerText && (
          <div className="bg-zinc-950 text-zinc-100 text-xs py-2 px-4 flex items-center justify-center relative">
            <p className="truncate pr-8 tracking-wide text-center">
              {siteSettings.promoBannerText}
            </p>
            <button
              onClick={() => setPromoDismissed(true)}
              aria-label="Dismiss announcement"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <header className="glass-nav border-b border-zinc-200/70">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
            {/* Zone 1: Single text element wordmark */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="md:hidden p-2 -ml-2 text-zinc-800 hover:text-black"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate({ name: 'home' })}
                className="font-display text-2xl font-semibold tracking-[0.14em] text-zinc-950 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {siteSettings.logoText || 'KOVA ATELIER'}
              </button>
            </div>

            {/* Zone 2: 4-5 clean single-line text links */}
            <nav className="hidden md:flex items-center gap-7" aria-label="Primary navigation">
              {navItems.map((item) => (
                <button
                  key={item.label}
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
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search catalog"
                className="p-2 text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
              >
                <Search className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={() => navigate({ name: 'wishlist' })}
                aria-label="Saved wishlist"
                className="p-2 text-zinc-700 hover:text-zinc-950 transition-colors relative cursor-pointer"
              >
                <Heart className="w-[18px] h-[18px]" />
                {wishlist.length > 0 && (
                  <span className="absolute top-1 right-1 text-[10px] font-mono font-medium leading-none text-zinc-950">
                    {wishlist.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => navigate({ name: 'account', tab: 'orders' })}
                aria-label={user ? 'My account' : 'Sign in'}
                className="hidden sm:inline-flex p-2 text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
              >
                <User className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={() => setCartOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Bag</span>
                <span className="font-mono tabular-nums">({cartCount})</span>
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-6 border-b border-zinc-200">
              <span className="font-display text-xl font-semibold tracking-[0.14em]">
                {siteSettings.logoText}
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-zinc-500 hover:text-zinc-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col gap-1 py-6">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    item.action();
                    setMobileMenuOpen(false);
                  }}
                  className={`text-left py-3 px-3 rounded-lg text-sm font-medium transition-colors ${
                    item.active ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => {
                  navigate({ name: 'account', tab: 'orders' });
                  setMobileMenuOpen(false);
                }}
                className="text-left py-3 px-3 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Account & Orders
              </button>
              <button
                onClick={() => {
                  navigate({ name: 'wishlist' });
                  setMobileMenuOpen(false);
                }}
                className="text-left py-3 px-3 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Wishlist ({wishlist.length})
              </button>
            </div>
            <div className="mt-auto pt-6 border-t border-zinc-200">
              <button
                onClick={() => {
                  navigate({ name: 'admin', section: 'overview' });
                  setMobileMenuOpen(false);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                Admin Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white/95 backdrop-blur-xl border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-200">
              <Search className="w-5 h-5 text-zinc-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search oversized, regular fit, graphic, plain T-shirts, or SKU..."
                className="w-full bg-transparent text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="p-1.5 text-zinc-400 hover:text-zinc-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto">
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
