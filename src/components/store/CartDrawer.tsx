import React, { useEffect } from 'react';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ResilientImage } from '../ui/ResilientImage';

export function CartDrawer() {
  const {
    cart,
    cartCount,
    cartSubtotal,
    cartOpen,
    setCartOpen,
    updateCartQty,
    removeFromCart,
    siteSettings,
    navigate,
  } = useStore();

  useEffect(() => {
    if (!cartOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [cartOpen]);

  if (!cartOpen) return null;

  const threshold = siteSettings.freeShippingThreshold || 200;
  const remainingForFree = Math.max(0, threshold - cartSubtotal);
  const shippingPreview = cart.length === 0 ? 0 : remainingForFree === 0 ? 0 : siteSettings.standardShippingCost;
  const totalSavings = cart.reduce(
    (sum, item) => sum + Math.max(0, item.originalPrice - item.price) * item.quantity,
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs"
        onClick={() => setCartOpen(false)}
      />

      <aside className="relative w-full max-w-[100vw] sm:max-w-md bg-white/95 backdrop-blur-2xl h-[100dvh] flex flex-col shadow-2xl border-l border-zinc-200">
        {/* Drawer Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-medium text-zinc-950">Shopping Bag</h2>
            <span className="text-xs font-mono text-zinc-500 tabular-nums">({cartCount})</span>
          </div>
          <button
            onClick={() => setCartOpen(false)}
            aria-label="Close shopping bag"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Progress */}
        {cart.length > 0 && (
          <div className="px-4 sm:px-6 py-3 bg-zinc-50 border-b border-zinc-200/80 space-y-2 shrink-0">
            <p className="text-xs text-zinc-700">
              {remainingForFree === 0 ? (
                <span>Your order qualifies for complimentary express shipping.</span>
              ) : (
                <span>
                  Add <span className="font-mono font-medium">${remainingForFree}</span> more for
                  complimentary express shipping.
                </span>
              )}
            </p>
            <div className="w-full h-1 bg-zinc-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-zinc-950 transition-all duration-300"
                style={{ width: `${Math.min(100, (cartSubtotal / threshold) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Cart Items or Empty Design */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-4">
              <div className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                <ShoppingBag className="w-6 h-6 stroke-[1.4]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-2xl text-zinc-950">Your bag is empty</h3>
                <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                  Explore our oversized, regular fit, graphic, printed, plain, and premium cotton men&apos;s T-shirts.
                </p>
              </div>
              <button
                onClick={() => {
                  setCartOpen(false);
                  navigate({ name: 'shop' });
                }}
                className="mt-2 px-6 py-2.5 bg-zinc-950 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Explore Collection
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200/80">
              {cart.map((item) => (
                <li
                  key={`${item.productId}-${item.size}-${item.color}`}
                  className="py-5 first:pt-0 flex gap-4"
                >
                  <button
                    onClick={() => {
                      setCartOpen(false);
                      navigate({ name: 'product', id: item.productId });
                    }}
                    className="w-20 aspect-[3/4] rounded-lg overflow-hidden bg-zinc-100 shrink-0 cursor-pointer"
                  >
                    <ResilientImage
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </button>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium text-zinc-950 leading-snug">
                          {item.name}
                        </h3>
                        <button
                          onClick={() => removeFromCart(item.productId, item.size, item.color)}
                          aria-label={`Remove ${item.name}`}
                          className="text-zinc-400 hover:text-red-600 p-0.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        Size {item.size} · {item.color}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3">
                      <div className="inline-flex items-center border border-zinc-200 rounded-md h-9 sm:h-8">
                        <button
                          onClick={() =>
                            updateCartQty(item.productId, item.size, item.color, item.quantity - 1)
                          }
                          aria-label="Decrease quantity"
                          className="w-8 sm:w-7 h-full flex items-center justify-center text-zinc-600 hover:text-zinc-950 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-mono tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateCartQty(item.productId, item.size, item.color, item.quantity + 1)
                          }
                          aria-label="Increase quantity"
                          className="w-8 sm:w-7 h-full flex items-center justify-center text-zinc-600 hover:text-zinc-950 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right font-mono tabular-nums text-sm">
                        <span className="font-medium text-zinc-950">
                          ${item.price * item.quantity}
                        </span>
                        {item.originalPrice > item.price && (
                          <span className="block text-[11px] text-zinc-400 line-through">
                            ${item.originalPrice * item.quantity}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Drawer Footer */}
        {cart.length > 0 && (
          <div className="p-4 sm:p-6 border-t border-zinc-200 bg-zinc-50/70 space-y-4 shrink-0">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">${cartSubtotal}</span>
              </div>
              {totalSavings > 0 && (
                <div className="flex justify-between text-emerald-700 text-xs">
                  <span>Sale Savings</span>
                  <span className="font-mono tabular-nums">-${totalSavings}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-600">
                <span>Estimated Shipping</span>
                <span className="font-mono tabular-nums">
                  {shippingPreview === 0 ? 'Complimentary' : `$${shippingPreview}`}
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold text-zinc-950 pt-2 border-t border-zinc-200">
                <span>Total</span>
                <span className="font-mono tabular-nums">${cartSubtotal + shippingPreview}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setCartOpen(false);
                navigate({ name: 'checkout' });
              }}
              className="w-full py-3.5 px-6 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
