import React, { useEffect, useState } from 'react';
import { Check, LogOut, Package, Search, Shield, User } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { cancelOrderByCustomer, updateUserProfileFields } from '../../lib/firestoreService';
import { Order, OrderStatus } from '../../types';
import { ResilientImage } from '../ui/ResilientImage';

const TRACK_STEPS: OrderStatus[] = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];

export function AccountPage() {
  const {
    route,
    navigate,
    user,
    isAdmin,
    userProfile,
    customerOrders,
    loginWithGoogle,
    logout,
    addToast,
    requestConfirm,
  } = useStore();

  const initialTab = route.name === 'account' && route.tab ? route.tab : 'orders';
  const [activeTab, setActiveTab] = useState<'orders' | 'track' | 'profile'>(initialTab);
  const [trackQuery, setTrackQuery] = useState(
    route.name === 'account' && route.orderNumber ? route.orderNumber : ''
  );

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (route.name === 'account') {
      if (route.tab) setActiveTab(route.tab);
      if (route.orderNumber) setTrackQuery(route.orderNumber);
    }
  }, [route]);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setPhone(userProfile.phone || '');
      setAddress(userProfile.address || '');
      setCity(userProfile.city || '');
      setStateRegion(userProfile.state || '');
      setPostalCode(userProfile.postalCode || '');
    }
  }, [userProfile]);

  const trackedOrder: Order | undefined = trackQuery.trim()
    ? customerOrders.find(
        (o) => o.orderNumber.toLowerCase() === trackQuery.trim().toLowerCase()
      )
    : customerOrders[0];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateUserProfileFields(user.uid, {
        displayName,
        phone,
        address,
        city,
        state: stateRegion,
        postalCode,
      });
      addToast('success', 'Profile Saved', 'Your delivery details have been updated.');
    } catch {
      addToast('error', 'Save Failed', 'Unable to update profile details.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelOrder = (order: Order) => {
    requestConfirm({
      title: `Cancel Order ${order.orderNumber}?`,
      message: 'This will permanently cancel your pending order. You cannot undo this action.',
      confirmLabel: 'Cancel Order',
      destructive: true,
      onConfirm: async () => {
        try {
          await cancelOrderByCustomer(order.id);
          addToast('info', 'Order Cancelled', `${order.orderNumber} has been cancelled.`);
        } catch {
          addToast('error', 'Cancellation Failed', 'Only pending orders can be cancelled.');
        }
      },
    });
  };

  if (!user) {
    return (
      <main className="min-h-[75vh] bg-[#FAFAFA] flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-700">
            <User className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-3xl font-medium text-zinc-950">Client Account</h1>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Sign in with your Google account to view your order history, track deliveries in real time, and manage saved shipping addresses.
            </p>
          </div>
          <button
            onClick={loginWithGoogle}
            className="w-full py-3 px-6 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Continue with Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#FAFAFA] min-h-screen py-12 sm:py-16">
      <div className="max-w-[1160px] mx-auto px-6 sm:px-10">
        {/* Account Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-8 border-b border-zinc-200/80">
          <div>
            <p className="text-xs tracking-[0.18em] uppercase text-zinc-500">Client Portal</p>
            <h1 className="font-display text-4xl font-medium text-zinc-950 mt-1">
              {userProfile?.displayName || user.displayName || 'Welcome'}
            </h1>
            <p className="text-xs text-zinc-500 mt-1">{user.email}</p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => navigate({ name: 'admin', section: 'overview' })}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Dashboard</span>
              </button>
            )}
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border border-zinc-300 text-zinc-700 rounded-lg hover:border-zinc-900 transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-200/60 rounded-lg my-8 w-fit">
          {(
            [
              { id: 'orders', label: `Order History (${customerOrders.length})` },
              { id: 'track', label: 'Order Tracking' },
              { id: 'profile', label: 'Profile & Address' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Order History */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {customerOrders.length === 0 ? (
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-12 text-center space-y-3">
                <Package className="w-8 h-8 text-zinc-400 mx-auto stroke-[1.4]" />
                <h2 className="font-display text-2xl text-zinc-950">No orders placed yet</h2>
                <p className="text-sm text-zinc-500">
                  Once you place an order, it will appear here with live status updates.
                </p>
                <button
                  onClick={() => navigate({ name: 'shop' })}
                  className="mt-2 px-5 py-2.5 bg-zinc-950 text-white text-xs font-medium rounded-lg cursor-pointer"
                >
                  Shop Collection
                </button>
              </div>
            ) : (
              customerOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border border-zinc-200/80 rounded-2xl p-6 space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-100">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span className="font-mono font-semibold text-sm text-zinc-950">
                        {order.orderNumber}
                      </span>
                      <span>·</span>
                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                      <span>·</span>
                      <span className="font-medium text-zinc-900">{order.status}</span>
                      <span>·</span>
                      <span className="capitalize">
                        Payment: {order.paymentStatus} ({order.paymentMethod === 'cod' ? 'COD' : 'Bank Transfer'})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold text-base text-zinc-950 tabular-nums">
                        ${order.total}
                      </span>
                      <button
                        onClick={() => {
                          setTrackQuery(order.orderNumber);
                          setActiveTab('track');
                        }}
                        className="text-xs font-medium text-zinc-900 underline underline-offset-4 cursor-pointer"
                      >
                        Track
                      </button>
                      {order.status === 'Pending' && (
                        <button
                          onClick={() => handleCancelOrder(order)}
                          className="text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {order.items.map((item, idx) => (
                      <div key={`${item.productId}-${idx}`} className="flex items-center gap-3">
                        <ResilientImage
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-16 object-cover rounded-lg bg-zinc-100 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-950 truncate">{item.name}</p>
                          <p className="text-[11px] text-zinc-500">
                            {item.size} · {item.color} · Qty {item.quantity}
                          </p>
                          <p className="text-xs font-mono text-zinc-700 tabular-nums">
                            ${item.price * item.quantity}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Order Tracking */}
        {activeTab === 'track' && (
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 sm:p-8 space-y-8">
            <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={trackQuery}
                  onChange={(e) => setTrackQuery(e.target.value)}
                  placeholder="Enter order number (e.g. KV-2026-1042)"
                  className="w-full pl-10 pr-4 py-2.5 text-sm font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                />
              </div>
            </div>

            {!trackedOrder ? (
              <p className="text-sm text-zinc-500">
                {customerOrders.length === 0
                  ? 'You do not have any orders to track yet.'
                  : `No order found matching "${trackQuery}".`}
              </p>
            ) : (
              <div className="space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-zinc-200/80">
                  <div>
                    <p className="text-xs text-zinc-500">Tracking Order</p>
                    <h2 className="font-mono text-xl font-semibold text-zinc-950">
                      {trackedOrder.orderNumber}
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Current Status</p>
                    <p className="text-sm font-semibold text-zinc-950">{trackedOrder.status}</p>
                  </div>
                </div>

                {trackedOrder.status === 'Cancelled' ? (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
                    This order was cancelled. Please contact concierge if you need assistance placing a new order.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                    {TRACK_STEPS.map((step, idx) => {
                      const currentIdx = TRACK_STEPS.indexOf(trackedOrder.status);
                      const completed = idx <= currentIdx;
                      return (
                        <div key={step} className="flex sm:flex-col items-center gap-3 sm:text-center">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-mono border transition-colors ${
                              completed
                                ? 'bg-zinc-950 text-white border-zinc-950'
                                : 'bg-white text-zinc-400 border-zinc-300'
                            }`}
                          >
                            {completed ? <Check className="w-4 h-4" /> : idx + 1}
                          </div>
                          <div>
                            <p
                              className={`text-xs font-medium ${
                                completed ? 'text-zinc-950' : 'text-zinc-400'
                              }`}
                            >
                              {step}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-zinc-100 text-xs text-zinc-600">
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-zinc-900 mb-1.5">
                      Shipping Destination
                    </p>
                    <p>{trackedOrder.customerName}</p>
                    <p>{trackedOrder.shippingAddress.address}</p>
                    <p>
                      {trackedOrder.shippingAddress.city}, {trackedOrder.shippingAddress.state}{' '}
                      {trackedOrder.shippingAddress.postalCode}
                    </p>
                    <p className="font-mono mt-1">{trackedOrder.customerPhone}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-zinc-900 mb-1.5">
                      Order Totals
                    </p>
                    <p>
                      Subtotal: <span className="font-mono tabular-nums">${trackedOrder.subtotal}</span>
                    </p>
                    {trackedOrder.discountAmount > 0 && (
                      <p className="text-emerald-700">
                        Discount ({trackedOrder.promoCode}): -${trackedOrder.discountAmount}
                      </p>
                    )}
                    <p>
                      Shipping:{' '}
                      <span className="font-mono tabular-nums">
                        {trackedOrder.shippingCost === 0 ? 'Complimentary' : `$${trackedOrder.shippingCost}`}
                      </span>
                    </p>
                    <p className="font-semibold text-zinc-950 mt-1">
                      Total: <span className="font-mono tabular-nums">${trackedOrder.total}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Profile & Saved Address */}
        {activeTab === 'profile' && (
          <form
            onSubmit={handleSaveProfile}
            className="bg-white border border-zinc-200/80 rounded-2xl p-6 sm:p-8 max-w-2xl space-y-5"
          >
            <h2 className="font-display text-2xl font-medium text-zinc-950">
              Saved Profile & Delivery Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  maxLength={30}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Street Address</label>
                <input
                  type="text"
                  maxLength={200}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">City</label>
                <input
                  type="text"
                  maxLength={80}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">State</label>
                <input
                  type="text"
                  maxLength={80}
                  value={stateRegion}
                  onChange={(e) => setStateRegion(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Postal Code</label>
                <input
                  type="text"
                  maxLength={20}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-950"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-2.5 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
