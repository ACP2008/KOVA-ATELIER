import React from 'react';
import { Heart, Plus } from 'lucide-react';
import { Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { getBadgeStyleClasses, resolveProductBadges } from '../../lib/productBadges';
import { ResilientImage } from '../ui/ResilientImage';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { navigate, wishlist, toggleWishlist, addToCart, siteSettings } = useStore();
  const isWishlisted = wishlist.includes(product.id);
  const effectivePrice = product.discountPrice > 0 ? product.discountPrice : product.price;
  const outOfStock = product.stockQuantity <= 0;
  const badges = resolveProductBadges(product, siteSettings.lowStockThreshold);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (outOfStock) return;
    const defaultSize = product.sizes[Math.min(1, product.sizes.length - 1)] || product.sizes[0] || 'M';
    const defaultColor = product.colors[0]?.name || 'Obsidian';
    const variantQty = product.variantStock[`${defaultSize}_${defaultColor}`] ?? product.stockQuantity;
    addToCart({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      price: effectivePrice,
      originalPrice: product.price,
      quantity: 1,
      size: defaultSize,
      color: defaultColor,
      image: product.images[0] || '',
      maxStock: Math.max(1, variantQty),
    });
  };

  return (
    <article
      onClick={() => navigate({ name: 'product', id: product.id })}
      className="group cursor-pointer flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-zinc-100">
        <ResilientImage
          src={product.images[0]}
          alt={product.name}
          fallbackTitle={product.name}
          className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />

        {/* Top-left glassmorphism product badges (strictly max 2) */}
        {badges.length > 0 && (
          <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5 pointer-events-none">
            {badges.map((badge) => (
              <span
                key={badge}
                className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none backdrop-blur-md border shadow-xs whitespace-nowrap ${getBadgeStyleClasses(
                  badge
                )}`}
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Wishlist toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-zinc-800 hover:bg-white transition-colors shadow-xs cursor-pointer"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              isWishlisted ? 'fill-zinc-950 text-zinc-950' : 'text-zinc-700'
            }`}
          />
        </button>

        {/* Quick add glass bar on hover */}
        {!outOfStock && (
          <div className="absolute inset-x-3 bottom-3 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
            <button
              type="button"
              onClick={handleQuickAdd}
              className="w-full py-2.5 px-4 rounded-lg bg-white/90 hover:bg-white backdrop-blur-md text-zinc-950 text-xs font-medium tracking-wide flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Quick Add</span>
            </button>
          </div>
        )}
      </div>

      {/* Uniform, clean unboxed metadata */}
      <div className="pt-3.5 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5 truncate">
            <span className="uppercase tracking-wider text-[11px]">{product.category}</span>
            {outOfStock && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-red-600 font-medium">Sold Out</span>
              </>
            )}
          </div>
        </div>

        <h3 className="text-[15px] font-medium text-zinc-950 leading-snug group-hover:underline underline-offset-4 decoration-zinc-300">
          {product.name}
        </h3>

        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-baseline gap-2 font-mono text-sm tabular-nums">
            <span className="font-medium text-zinc-950">${effectivePrice}</span>
            {product.discountPrice > 0 && (
              <span className="text-xs text-zinc-400 line-through">${product.price}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5" aria-label="Available colors">
            {product.colors.slice(0, 4).map((c) => (
              <span
                key={c.name}
                title={c.name}
                className="w-2.5 h-2.5 rounded-full border border-zinc-300"
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
