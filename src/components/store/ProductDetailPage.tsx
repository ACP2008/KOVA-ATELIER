import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Heart, Minus, Plus, Ruler, ShieldCheck, Truck, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { getBadgeStyleClasses, resolveProductBadges } from '../../lib/productBadges';
import { ResilientImage } from '../ui/ResilientImage';
import { ProductCard } from './ProductCard';

interface ProductDetailPageProps {
  productId: string;
}

const SIZE_GUIDE_ROWS = [
  { size: 'S', chest: '92–96 cm', waist: '76–81 cm', shoulder: '44–46 cm', us: '36 / 46' },
  { size: 'M', chest: '97–102 cm', waist: '82–87 cm', shoulder: '46–48 cm', us: '38 / 48' },
  { size: 'L', chest: '103–108 cm', waist: '88–93 cm', shoulder: '48–50 cm', us: '40 / 50' },
  { size: 'XL', chest: '109–114 cm', waist: '94–99 cm', shoulder: '50–52 cm', us: '42 / 52' },
  { size: 'XXL', chest: '115–121 cm', waist: '100–106 cm', shoulder: '52–54 cm', us: '44 / 54' },
];

export function ProductDetailPage({ productId }: ProductDetailPageProps) {
  const {
    activeProducts,
    navigate,
    addToCart,
    wishlist,
    toggleWishlist,
    recordProductView,
    siteSettings,
  } = useStore();

  const product = useMemo(
    () => activeProducts.find((p) => p.id === productId || p.slug === productId),
    [activeProducts, productId]
  );

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  useEffect(() => {
    if (product) {
      recordProductView(product.id);
      setSelectedImageIdx(0);
      setSelectedSize(product.sizes[Math.min(1, product.sizes.length - 1)] || product.sizes[0] || '');
      setSelectedColor(product.colors[0]?.name || '');
      setQuantity(1);
    }
  }, [product, recordProductView]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    const sameCategory = activeProducts.filter(
      (p) => p.id !== product.id && p.category === product.category
    );
    const others = activeProducts.filter(
      (p) => p.id !== product.id && p.category !== product.category
    );
    return [...sameCategory, ...others].slice(0, 4);
  }, [activeProducts, product]);

  if (!product) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center bg-[#FAFAFA]">
        <h1 className="font-display text-4xl text-zinc-950">Garment Not Found</h1>
        <p className="text-sm text-zinc-500 mt-2">
          This piece may have been archived or removed from the collection.
        </p>
        <button
          onClick={() => navigate({ name: 'shop' })}
          className="mt-6 px-6 py-2.5 bg-zinc-950 text-white text-sm font-medium rounded-lg cursor-pointer"
        >
          Return to Shop
        </button>
      </main>
    );
  }

  const effectivePrice = product.discountPrice > 0 ? product.discountPrice : product.price;
  const isWishlisted = wishlist.includes(product.id);
  const badges = resolveProductBadges(product, siteSettings.lowStockThreshold);
  const variantKey = `${selectedSize}_${selectedColor}`;
  const variantStock =
    variantKey in product.variantStock ? product.variantStock[variantKey] : product.stockQuantity;
  const isVariantAvailable = variantStock > 0 && product.stockQuantity > 0;

  const handleAdd = (goCheckout: boolean) => {
    if (!isVariantAvailable) return;
    addToCart({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      price: effectivePrice,
      originalPrice: product.price,
      quantity,
      size: selectedSize,
      color: selectedColor,
      image: product.images[0] || '',
      maxStock: variantStock,
    });
    if (goCheckout) {
      navigate({ name: 'checkout' });
    }
  };

  return (
    <main className="bg-[#FAFAFA] min-h-screen">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-12">
        {/* Back Breadcrumb */}
        <button
          onClick={() => navigate({ name: 'shop' })}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 mb-5 sm:mb-8 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Collection</span>
        </button>

        {/* Contiguous PDP Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-16 items-start">
          {/* Left: Sticky Multi-Image Lookbook Gallery */}
          <div className="lg:col-span-7 flex flex-col-reverse sm:flex-row gap-4 lg:sticky lg:top-24">
            {product.images.length > 1 && (
              <div className="flex sm:flex-col gap-3 overflow-x-auto sm:w-20 shrink-0">
                {product.images.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    onClick={() => setSelectedImageIdx(idx)}
                    className={`w-16 sm:w-20 aspect-[3/4] rounded-lg overflow-hidden border transition-all shrink-0 cursor-pointer ${
                      selectedImageIdx === idx
                        ? 'border-zinc-950 ring-1 ring-zinc-950'
                        : 'border-zinc-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <ResilientImage
                      src={img}
                      alt={`${product.name} view ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="relative flex-1 aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200/70">
              <ResilientImage
                src={product.images[selectedImageIdx] || product.images[0]}
                alt={product.name}
                fallbackTitle={product.name}
                className="w-full h-full object-cover"
              />
              {badges.length > 0 && (
                <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5 pointer-events-none">
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none backdrop-blur-md border shadow-xs whitespace-nowrap ${getBadgeStyleClasses(
                        badge
                      )}`}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Sticky Purchase Module */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            <div className="space-y-2 pb-5 border-b border-zinc-200/80">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="uppercase tracking-widest">{product.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{product.sku}</span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl font-medium text-zinc-950 leading-tight text-balance">
                {product.name}
              </h1>

              <div className="flex items-baseline gap-3 pt-1 font-mono tabular-nums">
                <span className="text-2xl font-medium text-zinc-950">${effectivePrice}</span>
                {product.discountPrice > 0 && (
                  <>
                    <span className="text-base text-zinc-400 line-through">${product.price}</span>
                    <span className="text-xs text-emerald-700 font-sans font-medium">
                      Save ${product.price - product.discountPrice}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Color Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-900">Color</span>
                <span className="text-zinc-600">{selectedColor}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {product.colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setSelectedColor(c.name);
                      setQuantity(1);
                    }}
                    title={c.name}
                    className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                      selectedColor === c.name
                        ? 'border-zinc-950 ring-2 ring-zinc-950/20'
                        : 'border-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    <span
                      className="w-7 h-7 rounded-full border border-black/10"
                      style={{ backgroundColor: c.hex }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Size Selection + Size Guide */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-900">Size</span>
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(true)}
                  className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-950 underline underline-offset-4 cursor-pointer"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>Size Guide</span>
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {product.sizes.map((sz) => {
                  const key = `${sz}_${selectedColor}`;
                  const szStock = key in product.variantStock ? product.variantStock[key] : product.stockQuantity;
                  const disabled = szStock <= 0;
                  return (
                    <button
                      key={sz}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedSize(sz);
                        setQuantity(1);
                      }}
                      className={`py-2.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        selectedSize === sz
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white text-zinc-800 border-zinc-200 hover:border-zinc-900'
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>

              <div className="text-xs">
                {isVariantAvailable ? (
                  <span className={variantStock <= 3 ? 'text-amber-700 font-medium' : 'text-emerald-700'}>
                    {variantStock <= 3
                      ? `Only ${variantStock} left in ${selectedSize} / ${selectedColor}`
                      : `In Stock (${variantStock} available in ${selectedSize})`}
                  </span>
                ) : (
                  <span className="text-red-600 font-medium">
                    Out of stock for {selectedSize} / {selectedColor}
                  </span>
                )}
              </div>
            </div>

            {/* Quantity & Actions */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3">
                <div className="order-1 inline-flex items-center border border-zinc-300 bg-white rounded-lg h-11 sm:h-12 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="w-10 h-full flex items-center justify-center text-zinc-600 hover:text-zinc-950 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-9 sm:w-10 text-center text-sm font-mono tabular-nums font-medium">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(Math.min(20, variantStock || 1), q + 1))}
                    aria-label="Increase quantity"
                    className="w-10 h-full flex items-center justify-center text-zinc-600 hover:text-zinc-950 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!isVariantAvailable}
                  onClick={() => handleAdd(false)}
                  className="order-3 sm:order-2 basis-full sm:basis-auto sm:flex-1 h-12 px-5 sm:px-6 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                >
                  {isVariantAvailable ? `Add to Bag — $${effectivePrice * quantity}` : 'Sold Out'}
                </button>

                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  aria-label="Toggle wishlist"
                  className="order-2 sm:order-3 ml-auto sm:ml-0 h-11 w-11 sm:h-12 sm:w-12 rounded-lg border border-zinc-300 bg-white flex items-center justify-center text-zinc-800 hover:border-zinc-950 transition-colors cursor-pointer shrink-0"
                >
                  <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-zinc-950 text-zinc-950' : ''}`} />
                </button>
              </div>

              <button
                type="button"
                disabled={!isVariantAvailable}
                onClick={() => handleAdd(true)}
                className="w-full h-11 px-6 bg-white border border-zinc-950 text-zinc-950 text-sm font-medium rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-40 cursor-pointer"
              >
                Buy Now
              </button>
            </div>

            {/* Product Story & Fabric Details */}
            <div className="pt-4 border-t border-zinc-200/80 space-y-5 text-sm">
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">
                  Design & Fit
                </h2>
                <p className="text-zinc-600 leading-relaxed">{product.description}</p>
              </div>

              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">
                  Fabric & Care
                </h2>
                <p className="text-zinc-600 leading-relaxed">{product.fabricInfo}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-zinc-600">
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-white border border-zinc-200/80">
                  <Truck className="w-4 h-4 text-zinc-800 shrink-0 mt-0.5" />
                  <span>
                    Complimentary shipping on orders over ${siteSettings.freeShippingThreshold}.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-white border border-zinc-200/80">
                  <ShieldCheck className="w-4 h-4 text-zinc-800 shrink-0 mt-0.5" />
                  <span>Cash on Delivery & verified bank transfer supported.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 sm:mt-24 pt-10 sm:pt-12 border-t border-zinc-200/80">
            <div className="mb-6 sm:mb-8">
              <p className="text-[11px] sm:text-xs tracking-[0.18em] uppercase text-zinc-500">
                Complete the Silhouette
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-medium text-zinc-950 mt-1">
                Related Pieces
              </h2>
            </div>
            <div className="grid grid-cols-2 max-[349px]:grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 min-[376px]:gap-4 sm:gap-6 lg:gap-8">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Size Guide Modal */}
      {sizeGuideOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onClick={() => setSizeGuideOpen(false)}
        >
          <div
            className="w-full max-w-xl max-h-[90dvh] overflow-y-auto bg-white border border-zinc-200 rounded-2xl p-5 sm:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-zinc-200">
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-zinc-950">
                  Men&apos;s T-Shirt Size Guide
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Body measurements in centimeters — contemporary men&apos;s T-shirt fit.
                </p>
              </div>
              <button
                onClick={() => setSizeGuideOpen(false)}
                aria-label="Close size guide"
                className="p-2 text-zinc-400 hover:text-zinc-900 shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-x-auto mt-5">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 uppercase tracking-wider">
                    <th className="py-2.5 pr-4">Size</th>
                    <th className="py-2.5 px-3">Chest</th>
                    <th className="py-2.5 px-3">Waist</th>
                    <th className="py-2.5 px-3">Shoulder</th>
                    <th className="py-2.5 pl-3">US / EU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono tabular-nums text-zinc-800">
                  {SIZE_GUIDE_ROWS.map((row) => (
                    <tr key={row.size}>
                      <td className="py-3 pr-4 font-sans font-semibold text-zinc-950">{row.size}</td>
                      <td className="py-3 px-3">{row.chest}</td>
                      <td className="py-3 px-3">{row.waist}</td>
                      <td className="py-3 px-3">{row.shoulder}</td>
                      <td className="py-3 pl-3">{row.us}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex items-center gap-2 text-xs text-zinc-500">
              <Check className="w-3.5 h-3.5 text-zinc-900" />
              <span>Model is 186 cm / 6&apos;1&quot; wearing size L for a clean contemporary drape.</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
