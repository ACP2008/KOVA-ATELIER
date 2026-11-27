import React, { useMemo } from 'react';
import { Heart } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from './ProductCard';

export function WishlistPage() {
  const { activeProducts, wishlist, navigate } = useStore();

  const savedProducts = useMemo(
    () => activeProducts.filter((p) => wishlist.includes(p.id)),
    [activeProducts, wishlist]
  );

  return (
    <main className="bg-[#FAFAFA] min-h-[75vh] py-8 sm:py-16">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="pb-6 sm:pb-8 border-b border-zinc-200/80 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] sm:text-xs tracking-[0.18em] uppercase text-zinc-500">Saved Pieces</p>
            <h1 className="font-display text-3xl sm:text-5xl font-medium text-zinc-950 mt-1">
              Your Wishlist
            </h1>
          </div>
          <span className="text-xs font-mono tabular-nums text-zinc-500 shrink-0">
            {savedProducts.length} saved
          </span>
        </div>

        {savedProducts.length === 0 ? (
          <div className="py-16 sm:py-24 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-zinc-200/70 flex items-center justify-center mx-auto text-zinc-500">
              <Heart className="w-6 h-6 stroke-[1.4]" />
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-zinc-950">No saved pieces yet</h2>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">
              Tap the heart icon on any garment while browsing to curate your personal seasonal edit.
            </p>
            <button
              onClick={() => navigate({ name: 'shop' })}
              className="mt-2 px-6 py-2.5 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Explore Collection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 max-[349px]:grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 min-[376px]:gap-4 sm:gap-6 lg:gap-8 pt-6 sm:pt-10">
            {savedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
