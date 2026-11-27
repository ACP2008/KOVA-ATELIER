import React, { useMemo, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { subscribeToNewsletter } from '../../lib/firestoreService';
import { MENS_CATEGORIES } from '../../data/seedCatalog';
import { Product } from '../../types';
import { ResilientImage } from '../ui/ResilientImage';
import { ProductCard } from './ProductCard';
import { NewsletterPopup } from './NewsletterPopup';

function pickUniqueProducts(source: Product[], predicate: (p: Product) => boolean, count: number): Product[] {
  const matched = source.filter(predicate);
  if (matched.length >= count) return matched.slice(0, count);
  const seen = new Set(matched.map((p) => p.id));
  const padded = [...matched];
  for (const p of source) {
    if (!seen.has(p.id)) {
      padded.push(p);
      seen.add(p.id);
      if (padded.length >= count) break;
    }
  }
  return padded;
}

export function HomePage() {
  const { activeProducts, productsLoading, siteSettings, navigate, addToast } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const newArrivals = useMemo(
    () =>
      pickUniqueProducts(
        activeProducts,
        (p) => p.newArrival || p.badge === 'NEW ARRIVAL',
        4
      ),
    [activeProducts]
  );

  const featuredTShirts = useMemo(
    () => pickUniqueProducts(activeProducts, (p) => p.featured, 4),
    [activeProducts]
  );

  const collectionCategories = useMemo(() => ['All', ...MENS_CATEGORIES], []);

  const shopProducts = useMemo(() => {
    if (selectedCategory === 'All') return activeProducts;
    return activeProducts.filter((p) => p.category === selectedCategory);
  }, [activeProducts, selectedCategory]);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newsletterEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      addToast('error', 'Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setSubmittingEmail(true);
    try {
      await subscribeToNewsletter(trimmed);
      setSubscribed(true);
      try {
        localStorage.setItem('kova_newsletter_subscribed', 'true');
      } catch {
        // Ignore storage errors
      }
      setNewsletterEmail('');
      addToast('success', 'Welcome to KOVA ATELIER', 'You are subscribed to private T-shirt drops.');
    } catch {
      addToast('error', 'Subscription Error', 'Unable to save subscription right now.');
    } finally {
      setSubmittingEmail(false);
    }
  };

  const renderSkeletonGrid = (count = 4) => (
    <div className="grid grid-cols-2 max-[349px]:grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 min-[376px]:gap-4 sm:gap-6 lg:gap-8 pt-6 sm:pt-10">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2.5 sm:space-y-3 animate-pulse">
          <div className="aspect-[3/4] rounded-xl bg-zinc-200" />
          <div className="h-3 w-16 sm:w-20 bg-zinc-200 rounded" />
          <div className="h-4 w-3/4 bg-zinc-200 rounded" />
          <div className="h-3 w-14 bg-zinc-200 rounded" />
        </div>
      ))}
    </div>
  );

  return (
    <main className="bg-[#FAFAFA] w-full overflow-x-clip">
      {/* HERO BANNER */}
      {siteSettings.heroImage === '/assets/aistudio/Kova_Atelier_Bespoke_Collection_8986c047.png' ? (
        <section className="relative w-full bg-[#2E3034] overflow-hidden">
          <div className="relative w-full max-w-[1920px] mx-auto">
            <ResilientImage
              src={siteSettings.heroImage}
              alt="KOVA ATELIER — Bespoke Oversized Men's T-Shirt Collection"
              fallbackTitle={siteSettings.storeName}
              className="w-full h-auto block object-cover"
            />
            <div className="hidden sm:block pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            <div className="relative sm:absolute sm:inset-x-0 sm:bottom-8 flex flex-col items-center gap-3 px-4 py-4 sm:py-0 text-center bg-[#2E3034] sm:bg-transparent">
              <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 p-1.5 rounded-xl bg-black/45 backdrop-blur-xl border border-white/20 shadow-2xl max-w-full">
                <button
                  onClick={() => navigate({ name: 'shop' })}
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 bg-white text-zinc-950 text-[11px] sm:text-xs font-semibold tracking-wider uppercase rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>{siteSettings.heroCtaText || 'SHOP T-SHIRTS'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => navigate({ name: 'shop', filter: 'new' })}
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-white/10 text-white text-[11px] sm:text-xs font-semibold tracking-wider uppercase rounded-lg hover:bg-white/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>EXPLORE NEW ARRIVALS</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="relative w-full h-[72svh] min-h-[460px] max-h-[620px] sm:h-[80vh] sm:min-h-[560px] sm:max-h-[860px] overflow-hidden bg-zinc-950">
          <ResilientImage
            src={siteSettings.heroImage}
            alt={siteSettings.heroTitle}
            fallbackTitle={siteSettings.storeName}
            className="w-full h-full object-cover object-center sm:object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/20" />

          <div className="absolute inset-0 max-w-[1440px] w-full mx-auto px-4 sm:px-8 lg:px-10 pb-10 sm:pb-20 lg:pb-24 flex flex-col justify-end">
            <div className="max-w-2xl space-y-3.5 sm:space-y-5">
              <p className="text-[11px] sm:text-xs font-medium tracking-[0.2em] sm:tracking-[0.26em] uppercase text-zinc-300">
                KOVA ATELIER · MEN&apos;S T-SHIRTS
              </p>
              <h1 className="font-display text-[32px] min-[376px]:text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-[-0.02em] text-white leading-[1.04] text-balance uppercase">
                {siteSettings.heroTitle || 'STYLE BEYOND ORDINARY'}
              </h1>
              <p className="text-sm sm:text-lg text-zinc-200/95 leading-relaxed max-w-xl">
                {siteSettings.heroSubtitle ||
                  "Precision-cut men's T-shirts engineered from heavyweight organic and long-staple Pima cotton."}
              </p>
              <div className="flex flex-col min-[376px]:flex-row min-[376px]:flex-wrap items-stretch min-[376px]:items-center gap-2.5 sm:gap-3.5 pt-2 sm:pt-3">
                <button
                  onClick={() => navigate({ name: 'shop' })}
                  className="inline-flex items-center justify-center gap-2.5 px-5 sm:px-7 py-3 sm:py-3.5 bg-white text-zinc-950 text-xs sm:text-sm font-semibold tracking-[0.08em] uppercase rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>{siteSettings.heroCtaText || 'SHOP T-SHIRTS'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate({ name: 'shop', filter: 'new' })}
                  className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 bg-white/12 backdrop-blur-md border border-white/30 text-white text-xs sm:text-sm font-semibold tracking-[0.08em] uppercase rounded-lg hover:bg-white/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>EXPLORE NEW ARRIVALS</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* NEW ARRIVALS */}
      <section className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 lg:px-10 pt-12 sm:pt-20 lg:pt-24 pb-10 sm:pb-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 pb-5 sm:pb-8 border-b border-zinc-200/80">
          <div className="space-y-1 sm:space-y-1.5">
            <p className="text-[11px] sm:text-xs font-medium tracking-[0.2em] uppercase text-zinc-500">
              Just Dropped
            </p>
            <h2 className="font-display text-2xl sm:text-4xl font-semibold tracking-tight text-zinc-950">
              New Arrivals
            </h2>
          </div>
          <button
            onClick={() => navigate({ name: 'shop', filter: 'new' })}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-900 hover:text-zinc-600 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0 py-1"
          >
            <span>Explore New Arrivals</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {productsLoading ? (
          renderSkeletonGrid(4)
        ) : (
          <div className="grid grid-cols-2 max-[349px]:grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 min-[376px]:gap-4 sm:gap-6 lg:gap-8 pt-6 sm:pt-10">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* FEATURED T-SHIRTS */}
      <section className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 lg:px-10 py-10 sm:py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 pb-5 sm:pb-8 border-b border-zinc-200/80">
          <div className="space-y-1 sm:space-y-1.5">
            <p className="text-[11px] sm:text-xs font-medium tracking-[0.2em] uppercase text-zinc-500">
              Signature Silhouettes
            </p>
            <h2 className="font-display text-2xl sm:text-4xl font-semibold tracking-tight text-zinc-950">
              Featured T-Shirts
            </h2>
          </div>
          <button
            onClick={() => navigate({ name: 'shop', filter: 'featured' })}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-900 hover:text-zinc-600 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0 py-1"
          >
            <span>View Featured T-Shirts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {productsLoading ? (
          renderSkeletonGrid(4)
        ) : (
          <div className="grid grid-cols-2 max-[349px]:grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 min-[376px]:gap-4 sm:gap-6 lg:gap-8 pt-6 sm:pt-10">
            {featuredTShirts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* MAIN T-SHIRT COLLECTION */}
      <section className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 lg:px-10 pt-6 sm:pt-8 pb-16 sm:pb-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 pb-5 sm:pb-6 border-b border-zinc-200/80">
          <div className="space-y-1 sm:space-y-1.5">
            <p className="text-[11px] sm:text-xs font-medium tracking-[0.2em] uppercase text-zinc-500">
              Complete Catalog
            </p>
            <h2 className="font-display text-2xl sm:text-4xl font-semibold tracking-tight text-zinc-950">
              Men&apos;s T-Shirt Collection
            </h2>
          </div>
          <button
            onClick={() => navigate({ name: 'shop' })}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-900 hover:text-zinc-600 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0 py-1"
          >
            <span>Open Full Shop &amp; Filters</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Clean 6-Category T-Shirt Filter Strip (wraps cleanly without horizontal scroll overflow) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-5 pb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {collectionCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 bg-zinc-100/80 sm:bg-transparent hover:text-zinc-950 hover:bg-zinc-200/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <span className="text-xs font-mono tabular-nums text-zinc-500 whitespace-nowrap shrink-0">
            {shopProducts.length} T-shirts
          </span>
        </div>

        {productsLoading ? (
          renderSkeletonGrid(8)
        ) : shopProducts.length === 0 ? (
          <div className="py-14 px-4 text-center bg-white border border-zinc-200/80 rounded-2xl mt-6">
            <p className="text-sm text-zinc-600">No T-shirts currently listed in {selectedCategory}.</p>
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className="mt-4 px-5 py-2.5 bg-zinc-950 text-white text-xs font-medium rounded-lg cursor-pointer"
            >
              Show All T-Shirts
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 max-[349px]:grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 min-[376px]:gap-4 sm:gap-6 lg:gap-8 pt-6 sm:pt-8">
            {shopProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* PRIVATE RELEASES NEWSLETTER */}
      <section className="border-t border-zinc-200/80 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center space-y-4 sm:space-y-5">
          <p className="text-[11px] sm:text-xs font-medium tracking-[0.22em] uppercase text-zinc-500">
            Private Client List
          </p>
          <h2 className="font-display text-2xl sm:text-4xl font-semibold tracking-tight text-zinc-950 text-balance">
            Early Access to Small-Batch T-Shirt Drops
          </h2>
          <p className="text-sm text-zinc-600 max-w-lg mx-auto leading-relaxed">
            Receive first access to limited oversized drops, heavyweight Pima cotton restocks, and
            exclusive graphic T-shirt editions.
          </p>

          {subscribed ? (
            <div className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium mt-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>You are on the KOVA ATELIER client list.</span>
            </div>
          ) : (
            <form
              onSubmit={handleNewsletterSubmit}
              className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 max-w-md mx-auto pt-2 sm:pt-3"
            >
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 min-w-0 px-4 py-3 text-base sm:text-sm bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
              />
              <button
                type="submit"
                disabled={submittingEmail}
                className="px-6 py-3 bg-zinc-950 text-white text-xs font-semibold uppercase tracking-[0.1em] rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {submittingEmail ? 'Joining...' : 'Subscribe'}
              </button>
            </form>
          )}
        </div>
      </section>

      <NewsletterPopup />
    </main>
  );
}
