import React, { useEffect, useState } from 'react';
import { ArrowLeft, Banknote, Building2, CheckCircle2, Lock, Tag } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  placeCustomerOrder,
  updateUserProfileFields,
  validatePromoCode,
} from '../../lib/firestoreService';
import { PaymentMethod, Promotion } from '../../types';
import { ResilientImage } from '../ui/ResilientImage';

export function CheckoutPage() {
  const {
    cart,
    cartSubtotal,
    clearCart,
    user,
    userProfile,
    loginWithGoogle,
    siteSettings,
    isCatalogSeeded,
    navigate,
    addToast,
  } = useStore();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ promo: Promotion; discount: number } | null>(
    null
  );
  const [promoError, setPromoError] = useState('');
  const [promoChecking, setPromoChecking] = useState(false);

  const [placingOrder, setPlacingOrder] = useState(false);
  const [placedReceipt, setPlacedReceipt] = useState<{
    orderNumber: string;
    total: number;
    paymentMethod: PaymentMethod;
  } | null>(null);

  useEffect(() => {
    if (userProfile) {
      setCustomerName((v) => v || userProfile.displayName || user?.displayName || '');
      setCustomerEmail((v) => v || userProfile.email || user?.email || '');
      setCustomerPhone((v) => v || userProfile.phone || '');
      setAddress((v) => v || userProfile.address || '');
      setCity((v) => v || userProfile.city || '');
      setStateRegion((v) => v || userProfile.state || '');
      setPostalCode((v) => v || userProfile.postalCode || '');
    } else if (user) {
      setCustomerName((v) => v || user.displayName || '');
      setCustomerEmail((v) => v || user.email || '');
    }
  }, [user, userProfile]);

  const discountAmount = appliedPromo ? appliedPromo.discount : 0;
  const netAfterDiscount = Math.max(0, cartSubtotal - discountAmount);
  const shippingCost =
    netAfterDiscount >= siteSettings.freeShippingThreshold ? 0 : siteSettings.standardShippingCost;
  const finalTotal = netAfterDiscount + shippingCost;

  const handleApplyPromo = async () => {
    setPromoError('');
    setPromoChecking(true);
    try {
      const result = await validatePromoCode(promoInput, cartSubtotal);
      if (result.valid && result.promo) {
        setAppliedPromo({ promo: result.promo, discount: result.discountAmount });
        addToast('success', 'Promotion Applied', `${result.promo.code} saved you $${result.discountAmount}.`);
      } else {
        setAppliedPromo(null);
        setPromoError(result.error || 'Invalid promo code.');
      }
    } finally {
      setPromoChecking(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      addToast('error', 'Sign-In Required', 'Please sign in with Google to place a verified order.');
      return;
    }
    if (cart.length === 0) return;

    setPlacingOrder(true);
    try {
      const result = await placeCustomerOrder({
        userId: user.uid,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress: {
          address,
          city,
          state: stateRegion,
          postalCode,
        },
        items: cart.map((c) => ({
          productId: c.productId,
          name: c.name,
          sku: c.sku,
          price: c.price,
          quantity: c.quantity,
          size: c.size,
          color: c.color,
          image: c.image,
        })),
        promoCode: appliedPromo?.promo.code || '',
        discountAmount,
        shippingCost,
        paymentMethod,
        notes,
      });

      // Save customer shipping details to profile for next checkout
      updateUserProfileFields(user.uid, {
        displayName: customerName,
        phone: customerPhone,
        address,
        city,
        state: stateRegion,
        postalCode,
      }).catch(() => {});

      setPlacedReceipt({
        orderNumber: result.orderNumber,
        total: finalTotal,
        paymentMethod,
      });
      clearCart();
      addToast('success', 'Order Confirmed', `Order ${result.orderNumber} has been received.`);
    } catch (err) {
      console.error('Order checkout error:', err);
      addToast(
        'error',
        'Order Verification Failed',
        !isCatalogSeeded
          ? 'Please sign in as the store admin once to initialize the Firestore product catalog before placing live orders.'
          : 'Could not verify order totals against the server. Please refresh your bag and try again.'
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  if (placedReceipt) {
    return (
      <main className="min-h-[75vh] bg-[#FAFAFA] flex items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
        <div className="max-w-lg w-full bg-white border border-zinc-200 rounded-2xl p-6 sm:p-10 text-center space-y-5">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <p className="text-xs tracking-[0.2em] uppercase text-zinc-500">Order Confirmed</p>
            <h1 className="font-display text-3xl sm:text-4xl font-medium text-zinc-950">
              Thank You for Your Order
            </h1>
            <p className="text-sm text-zinc-600">
              Order <span className="font-mono font-semibold text-zinc-950">{placedReceipt.orderNumber}</span>{' '}
              is now pending confirmation.
            </p>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Total Amount</span>
              <span className="font-mono font-semibold text-zinc-950 tabular-nums">
                ${placedReceipt.total}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Payment Method</span>
              <span className="font-medium text-zinc-900">
                {placedReceipt.paymentMethod === 'cod'
                  ? 'Cash on Delivery'
                  : 'Manually Verified Bank Transfer'}
              </span>
            </div>
            {placedReceipt.paymentMethod === 'bank_transfer' && (
              <p className="text-zinc-600 pt-2 border-t border-zinc-200 leading-relaxed">
                Our concierge team will verify your transfer reference against order{' '}
                <span className="font-mono">{placedReceipt.orderNumber}</span> and update your
                order status once confirmed.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() =>
                navigate({ name: 'account', tab: 'track', orderNumber: placedReceipt.orderNumber })
              }
              className="flex-1 py-3 px-5 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Track Order
            </button>
            <button
              onClick={() => navigate({ name: 'shop' })}
              className="flex-1 py-3 px-5 border border-zinc-300 text-zinc-900 text-sm font-medium rounded-lg hover:border-zinc-900 transition-colors cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main className="min-h-[70vh] bg-[#FAFAFA] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-4xl text-zinc-950">Your Bag Is Empty</h1>
        <p className="text-sm text-zinc-500 mt-2">Add garments to proceed to checkout.</p>
        <button
          onClick={() => navigate({ name: 'shop' })}
          className="mt-6 px-6 py-2.5 bg-zinc-950 text-white text-sm font-medium rounded-lg cursor-pointer"
        >
          Browse Collection
        </button>
      </main>
    );
  }

  return (
    <main className="bg-[#FAFAFA] min-h-screen py-8 sm:py-16">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10">
        <button
          onClick={() => navigate({ name: 'shop' })}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 mb-5 sm:mb-8 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Collection</span>
        </button>

        <h1 className="font-display text-3xl sm:text-4xl font-medium text-zinc-950 mb-6 sm:mb-10">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 items-start">
          {/* Left Form */}
          <div className="lg:col-span-7 space-y-6">
            {!user && (
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-950">
                    Sign in to Place Your Order
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Verified Google authentication protects your order history, live tracking, and server-validated pricing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  className="px-5 py-2.5 bg-zinc-950 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign in with Google
                </button>
              </div>
            )}

            <form
              id="checkout-form"
              onSubmit={handleSubmitOrder}
              className="bg-white border border-zinc-200/80 rounded-2xl p-4 sm:p-8 space-y-7 sm:space-y-8"
            >
              {/* Contact Details */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">
                  1. Contact Details
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Marcus Vance"
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      maxLength={120}
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="marcus@example.com"
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      minLength={6}
                      maxLength={30}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+1 (212) 555-0148"
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="space-y-4 pt-6 border-t border-zinc-200/80">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">
                  2. Delivery Address
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={4}
                      maxLength={200}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="142 Mercer Street, Apt 4B"
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">City *</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={80}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="New York"
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      State / Province *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={80}
                      value={stateRegion}
                      onChange={(e) => setStateRegion(e.target.value)}
                      placeholder="NY"
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      Postal Code *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={20}
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="10012"
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      Delivery Note (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={500}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Leave with doorman"
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-4 pt-6 border-t border-zinc-200/80">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-900">
                  3. Payment Method
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      paymentMethod === 'cod'
                        ? 'border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950'
                        : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 font-medium text-sm text-zinc-950">
                      <Banknote className="w-4 h-4" />
                      <span>Cash on Delivery</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                      Pay in cash or courier terminal upon receiving your parcel.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      paymentMethod === 'bank_transfer'
                        ? 'border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950'
                        : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 font-medium text-sm text-zinc-950">
                      <Building2 className="w-4 h-4" />
                      <span>Verified Bank Transfer</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                      Transfer directly and our concierge manually verifies payment before dispatch.
                    </p>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Right Order Summary */}
          <aside className="lg:col-span-5 bg-white border border-zinc-200/80 rounded-2xl p-4 sm:p-8 space-y-6 lg:sticky lg:top-24">
            <h2 className="font-display text-2xl font-medium text-zinc-950">Order Summary</h2>

            <ul className="divide-y divide-zinc-100 max-h-72 overflow-y-auto pr-1">
              {cart.map((item) => (
                <li
                  key={`${item.productId}-${item.size}-${item.color}`}
                  className="py-3.5 first:pt-0 flex items-center gap-3.5"
                >
                  <ResilientImage
                    src={item.image}
                    alt={item.name}
                    className="w-14 h-18 object-cover rounded-lg bg-zinc-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-950 truncate">{item.name}</p>
                    <p className="text-xs text-zinc-500">
                      {item.size} · {item.color} · Qty {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-mono tabular-nums font-medium text-zinc-950">
                    ${item.price * item.quantity}
                  </span>
                </li>
              ))}
            </ul>

            {/* Promo Code Input */}
            <div className="pt-4 border-t border-zinc-200/80 space-y-2">
              <label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                <span>Promo Code</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="KOVA15"
                  className="flex-1 min-w-0 px-3 py-2 text-sm sm:text-xs font-mono uppercase border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                />
                <button
                  type="button"
                  disabled={promoChecking || !promoInput.trim()}
                  onClick={handleApplyPromo}
                  className="px-4 py-2 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-40 cursor-pointer shrink-0"
                >
                  {promoChecking ? 'Checking...' : 'Apply'}
                </button>
              </div>
              {promoError && <p className="text-xs text-red-600">{promoError}</p>}
              {appliedPromo && (
                <div className="flex items-center justify-between text-xs text-emerald-700 pt-1">
                  <span>
                    Code <span className="font-mono font-semibold">{appliedPromo.promo.code}</span> applied
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedPromo(null);
                      setPromoInput('');
                    }}
                    className="text-zinc-500 underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Financial Breakdown */}
            <div className="pt-4 border-t border-zinc-200/80 space-y-2.5 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">${cartSubtotal}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount ({appliedPromo?.promo.code})</span>
                  <span className="font-mono tabular-nums">-${discountAmount}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-600">
                <span>Shipping</span>
                <span className="font-mono tabular-nums">
                  {shippingCost === 0 ? 'Complimentary' : `$${shippingCost}`}
                </span>
              </div>
              <div className="flex justify-between text-lg font-semibold text-zinc-950 pt-3 border-t border-zinc-200">
                <span>Total Due</span>
                <span className="font-mono tabular-nums">${finalTotal}</span>
              </div>
            </div>

            <button
              type="submit"
              form="checkout-form"
              disabled={placingOrder || !user}
              className="w-full py-3.5 px-6 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>
                {placingOrder ? 'Validating & Placing Order...' : `Place Order — $${finalTotal}`}
              </span>
            </button>

            <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
              Prices and promotions are cryptographically validated server-side against live Firestore catalog records.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
