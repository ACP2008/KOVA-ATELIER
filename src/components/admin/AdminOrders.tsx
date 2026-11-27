import React, { useMemo, useState } from 'react';
import { Eye, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { updateOrderByAdmin } from '../../lib/firestoreService';
import { Order, OrderStatus, PaymentStatus } from '../../types';
import { ResilientImage } from '../ui/ResilientImage';

const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
];

const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'verified', 'refunded'];

interface AdminOrdersProps {
  globalSearch: string;
}

export function AdminOrders({ globalSearch }: AdminOrdersProps) {
  const { adminOrders, addToast } = useStore();
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const filteredOrders = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return adminOrders.filter((o) => {
      if (statusFilter !== 'All' && o.status !== statusFilter) return false;
      if (
        q &&
        !o.orderNumber.toLowerCase().includes(q) &&
        !o.customerName.toLowerCase().includes(q) &&
        !o.customerEmail.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [adminOrders, statusFilter, globalSearch]);

  const handleStatusChange = async (order: Order, nextStatus: OrderStatus) => {
    setUpdatingId(order.id);
    try {
      await updateOrderByAdmin(order, { status: nextStatus });
      if (selectedOrder?.id === order.id) {
        setSelectedOrder({ ...order, status: nextStatus });
      }
      addToast('success', 'Order Status Updated', `${order.orderNumber} is now ${nextStatus}.`);
    } catch {
      addToast('error', 'Update Failed', 'Could not update order status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePaymentStatusChange = async (order: Order, nextPay: PaymentStatus) => {
    setUpdatingId(order.id);
    try {
      await updateOrderByAdmin(order, { paymentStatus: nextPay });
      if (selectedOrder?.id === order.id) {
        setSelectedOrder({ ...order, paymentStatus: nextPay });
      }
      addToast('success', 'Payment Status Updated', `${order.orderNumber} payment marked ${nextPay}.`);
    } catch {
      addToast('error', 'Update Failed', 'Could not update payment status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedOrder) return;
    setUpdatingId(selectedOrder.id);
    try {
      await updateOrderByAdmin(selectedOrder, { notes: adminNotes });
      setSelectedOrder({ ...selectedOrder, notes: adminNotes });
      addToast('success', 'Order Notes Saved', `Updated notes on ${selectedOrder.orderNumber}.`);
    } catch {
      addToast('error', 'Save Failed', 'Could not save notes.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white tracking-tight">
          Order Management
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Verify payments, update fulfillment statuses, and inspect customer shipments.
        </p>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(['All', ...ORDER_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              statusFilter === s
                ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No orders found</p>
            <p className="text-xs text-zinc-500 mt-1">
              {statusFilter === 'All'
                ? 'Customer orders placed through checkout will appear here in real time.'
                : `No orders currently have status "${statusFilter}".`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-500">
                  <th className="py-3.5 px-5 font-medium">Order #</th>
                  <th className="py-3.5 px-3 font-medium">Customer</th>
                  <th className="py-3.5 px-3 font-medium">Date</th>
                  <th className="py-3.5 px-3 font-medium">Payment</th>
                  <th className="py-3.5 px-3 font-medium">Fulfillment</th>
                  <th className="py-3.5 px-3 text-right font-medium">Amount</th>
                  <th className="py-3.5 px-5 text-right font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                    <td className="py-3.5 px-5 font-mono font-semibold text-zinc-950 dark:text-white whitespace-nowrap">
                      {order.orderNumber}
                    </td>
                    <td className="py-3.5 px-3">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{order.customerName}</p>
                      <p className="text-[11px] text-zinc-500">{order.customerEmail}</p>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-zinc-500 whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-3">
                      <select
                        disabled={updatingId === order.id}
                        value={order.paymentStatus}
                        onChange={(e) =>
                          handlePaymentStatusChange(order, e.target.value as PaymentStatus)
                        }
                        className="px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs capitalize cursor-pointer"
                      >
                        {PAYMENT_STATUSES.map((ps) => (
                          <option key={ps} value={ps}>
                            {ps} ({order.paymentMethod === 'cod' ? 'COD' : 'Transfer'})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3.5 px-3">
                      <select
                        disabled={updatingId === order.id}
                        value={order.status}
                        onChange={(e) => handleStatusChange(order, e.target.value as OrderStatus)}
                        className="px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium cursor-pointer"
                      >
                        {ORDER_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-semibold tabular-nums text-zinc-950 dark:text-white">
                      ${order.total}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setAdminNotes(order.notes || '');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-300 text-xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setSelectedOrder(null)}
          />
          <aside className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 h-full flex flex-col shadow-2xl text-xs">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="font-mono text-base font-semibold text-zinc-950 dark:text-white">
                  {selectedOrder.orderNumber}
                </h2>
                <p className="text-zinc-500 mt-0.5">
                  Placed {new Date(selectedOrder.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status Controls */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-500 mb-1.5">Order Status</label>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) =>
                      handleStatusChange(selectedOrder, e.target.value as OrderStatus)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-medium"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1.5">Payment Status</label>
                  <select
                    value={selectedOrder.paymentStatus}
                    onChange={(e) =>
                      handlePaymentStatusChange(selectedOrder, e.target.value as PaymentStatus)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 capitalize font-medium"
                  >
                    {PAYMENT_STATUSES.map((ps) => (
                      <option key={ps} value={ps}>
                        {ps}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customer Details */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800 space-y-1.5">
                <p className="font-semibold text-zinc-900 dark:text-white uppercase tracking-wider text-[11px]">
                  Customer & Shipping
                </p>
                <p className="font-medium text-sm text-zinc-950 dark:text-white">
                  {selectedOrder.customerName}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">{selectedOrder.customerEmail}</p>
                <p className="font-mono text-zinc-600 dark:text-zinc-400">
                  {selectedOrder.customerPhone}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400 pt-1">
                  {selectedOrder.shippingAddress.address}, {selectedOrder.shippingAddress.city},{' '}
                  {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.postalCode}
                </p>
              </div>

              {/* Ordered Items */}
              <div className="space-y-3">
                <p className="font-semibold text-zinc-900 dark:text-white uppercase tracking-wider text-[11px]">
                  Ordered Garments ({selectedOrder.items.length})
                </p>
                <div className="divide-y divide-zinc-200/70 dark:divide-zinc-800 border border-zinc-200/70 dark:border-zinc-800 rounded-xl overflow-hidden">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={`${item.productId}-${idx}`} className="p-3 flex items-center gap-3">
                      <ResilientImage
                        src={item.image}
                        alt={item.name}
                        className="w-11 h-14 rounded-lg object-cover bg-zinc-100 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-950 dark:text-white truncate">
                          {item.name}
                        </p>
                        <p className="text-zinc-500 mt-0.5">
                          {item.sku} · {item.size} · {item.color} · Qty {item.quantity}
                        </p>
                      </div>
                      <span className="font-mono font-semibold tabular-nums">
                        ${item.price * item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex justify-between text-zinc-500">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">${selectedOrder.subtotal}</span>
                </div>
                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount ({selectedOrder.promoCode})</span>
                    <span className="font-mono tabular-nums">-${selectedOrder.discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-500">
                  <span>Shipping</span>
                  <span className="font-mono tabular-nums">
                    {selectedOrder.shippingCost === 0 ? 'Complimentary' : `$${selectedOrder.shippingCost}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-zinc-950 dark:text-white pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">${selectedOrder.total}</span>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="block font-medium text-zinc-700 dark:text-zinc-300">
                  Fulfillment / Delivery Notes
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                />
                <button
                  onClick={handleSaveNotes}
                  disabled={updatingId === selectedOrder.id}
                  className="px-4 py-2 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-medium cursor-pointer"
                >
                  Save Notes
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
