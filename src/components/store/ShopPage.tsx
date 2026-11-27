import React, { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { MENS_CATEGORIES, MENS_SIZES } from '../../data/seedCatalog';
import { ShopCollectionFilter } from '../../types';
import { ProductCard } from './ProductCard';

const CATEGORIES = ['All', ...MENS_CATEGORIES];
const SIZES = MENS_SIZES;

type SortOption = 'featured' | 'newest' | 'price-asc' | 'price-desc';
type QuickFilterState = 'all' | ShopCollectionFilter;

const COLLECTION_HEADINGS: Record<ShopCollectionFilter, string> = {
  new: 'New Arrivals',
  sale: 'On Sale T-Shirts',
  featured: 'Featured T-Shirts',
};

export function ShopPage() {
  const { activeProducts, route, recentlyViewed } = useStore();

  const initialCat =
    route.name === 'shop' && route.category && CATEGORIES.includes(route.category)
      ? route.category
      : 'All';
  const initialFilter: QuickFilterState =
    route.name === 'shop' && route.filter && route.filter in COLLECTION_HEADINGS
      ? route.filter
      : 'all';

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCat);
  const [quickFilter, setQuickFilter] = useState<QuickFilterState>(initialFilter);
  const [search, setSearch] = useState('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<number>(200);
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (route.name === 'shop') {
      setSelectedCategory(
        route.category && CATEGORIES.includes(route.category) ? route.category : 'All'
      );
      setQuickFilter(
        route.filter && route.filter in COLLECTION_HEADINGS ? route.filter : 'all'
      );
    }
  }, [route]);

  const availableColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of activeProducts) {
      for (const c of p.colors) {
        if (!map.has(c.name)) map.set(c.name, c.hex);
      }
    }
    return Array.from(map.entries()).map(([name, hex]) => ({ name, hex }));
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = activeProducts.filter((p) => {
      const effectivePrice = p.discountPrice > 0 ? p.discountPrice : p.price;
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (quickFilter === 'new' && !p.newArrival && p.badge !== 'NEW ARRIVAL') return false;
      if (
        quickFilter === 'sale' &&
        !(p.discountPrice > 0 && p.discountPrice < p.price) &&
        p.badge !== 'SALE'
      ) {
        return false;
      }
      if (quickFilter === 'featured' && !p.featured) return false;
      if (selectedSize && !p.sizes.includes(selectedSize)) return false;
      if (selectedColor && !p.colors.some((c) => c.name === selectedColor)) return false;
      if (effectivePrice > maxPrice) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q) &&
        !p.description.toLowerCase().includes(q) &&
        !p.sku.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const pa = a.discountPrice > 0 ? a.discountPrice : a.price;
      const pb = b.discountPrice > 0 ? b.discountPrice : b.price;
      if (sortBy === 'price-asc') return pa - pb;
      if (sortBy === 'price-desc') return pb - pa;
      if (sortBy === 'newest') return Number(b.newArrival) - Number(a.newArrival);
      return Number(b.featured) - Number(a.featured);
    });
  }, [activeProducts, selectedCategory, quickFilter, search, selectedSize, selectedColor, maxPrice, sortBy]);

  const recentProducts = useMemo(
    () =>
      recentlyViewed
        .map((id) => activeProducts.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .slice(0, 4),
    [recentlyViewed, activeProducts]
  );

  const hasActiveFilters =
    selectedCategory !== 'All' ||
    quickFilter !== 'all' ||
    Boolean(search) ||
    Boolean(selectedSize) ||
    Boolean(selectedColor) ||
    maxPrice < 200;

  const resetFilters = () => {
    setSelectedCategory('All');
    setQuickFilter('all');
    setSearch('');
    setSelectedSize('');
    setSelectedColor('');
    setMaxPrice(200);
    setSortBy('featured');
  };

  const pageHeading =
    quickFilter !== 'all'
      ? COLLECTION_HEADINGS[quickFilter]
      : selectedCategory === 'All'
        ? "All Men's T-Shirts"
        : selectedCategory;

  return (
    <main className="bg-[#FAFAFA] min-h-screen">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-16">
        {/* Page Heading */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6 pb-6 sm:pb-8 border-b border-zinc-200/80">
          <div className="space-y-1.5 sm:space-y-2">
            <p className="text-[11px] sm:text-xs font-medium tracking-[0.2em] uppercase text-zinc-500">
              KOVA ATELIER · Men&apos;s T-Shirts
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight text-zinc-950">
              {pageHeading}
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search oversized, graphic, plain tees..."
                className="w-full pl-10 pr-4 py-2 text-base sm:text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
              />
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-medium bg-white border border-zinc-200 rounded-lg text-zinc-800 hover:border-zinc-900 transition-colors cursor-pointer whitespace-nowrap min-w-0"
              >
                <SlidersHorizontal className="w-4 h-4 shrink-0" />
                <span>Filters</span>
              </button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort T-shirts"
                className="w-full sm:w-auto min-w-0 px-3 sm:px-3.5 py-2.5 sm:py-2 text-xs sm:text-sm bg-white border border-zinc-200 rounded-lg text-zinc-800 focus:outline-none focus:border-zinc-900 cursor-pointer"
              >
                <option value="featured">Sort: Featured</option>
                <option value="newest">Sort: Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Navigation Strip (6 Dedicated Men's T-Shirt Categories) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 py-4 sm:py-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  if (cat !== 'All') setQuickFilter('all');
                }}
                className={`px-3 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-zinc-950 text-white'
                    : 'bg-white sm:bg-transparent border border-zinc-200 sm:border-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4 text-xs text-zinc-500 whitespace-nowrap shrink-0">
            <span className="font-mono tabular-nums">{filteredProducts.length} T-shirts</span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-zinc-900 underline underline-offset-4 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Clear filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Glass Filter Drawer */}
        {filtersOpen && (
          <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-white border border-zinc-200/80 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {/* Quick Filter */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Collection Filter
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'all', label: 'All T-Shirts' },
                    { id: 'new', label: 'New Arrivals' },
                    { id: 'featured', label: 'Featured' },
                    { id: 'sale', label: 'On Sale' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setQuickFilter(f.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                      quickFilter === f.id
                        ? 'border-zinc-950 bg-zinc-950 text-white'
                        : 'border-zinc-200 text-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Size Filter */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                T-Shirt Size
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SIZES.map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(selectedSize === sz ? '' : sz)}
                    className={`w-11 h-9 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                      selectedSize === sz
                        ? 'border-zinc-950 bg-zinc-950 text-white'
                        : 'border-zinc-200 text-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Filter */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Color</p>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {availableColors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedColor(selectedColor === c.name ? '' : c.name)}
                    title={c.name}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                      selectedColor === c.name
                        ? 'border-zinc-950 bg-zinc-100 text-zinc-950 font-medium'
                        : 'border-zinc-200 text-zinc-600 hover:border-zinc-400'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-zinc-300"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Price Ceiling */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Max Price
                </p>
                <span className="text-xs font-mono tabular-nums font-medium text-zinc-950">
                  Up to ${maxPrice}
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={200}
                step={10}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-zinc-950 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                <span>$30</span>
                <span>$200</span>
              </div>
            </div>
          </div>
        )}

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-24 text-center bg-white border border-zinc-200/80 rounded-2xl">
            <h2 className="font-display text-3xl font-semibold text-zinc-950">No matching T-shirts</h2>
            <p className="text-sm text-zinc-500 mt-2">
              Try broadening your category, color, size, or price filter.
            </p>
            <button
              onClick={resetFilters}
              className="mt-6 px-6 py-2.5 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 max-[349px]:grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 min-[376px]:gap-4 sm:gap-6 lg:gap-8 pt-3 sm:pt-4">
            {filteredProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {/* Recently Viewed Section */}
        {recentProducts.length > 0 && (
          <section className="mt-16 sm:mt-24 pt-10 sm:pt-12 border-t border-zinc-200/80">
            <div className="flex items-end justify-between mb-6 sm:mb-8">
              <div>
                <p className="text-[11px] sm:text-xs tracking-[0.18em] uppercase text-zinc-500">Your History</p>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-zinc-950 mt-1">
                  Recently Viewed
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 max-[349px]:grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 min-[376px]:gap-4 sm:gap-6 lg:gap-8">
              {recentProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
