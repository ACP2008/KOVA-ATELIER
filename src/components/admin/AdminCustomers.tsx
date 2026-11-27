import React, { useMemo, useState } from 'react';
import { Eye, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Order, UserProfile } from '../../types';

interface AdminCustomersProps {
  globalSearch: string;
}

interface EnrichedCustomer {
  profile: UserProfile;
  orders: Order[];
  totalSpent: number;
}

export function AdminCustomers({ globalSearch }: AdminCustomersProps) {
  const { adminCustomers, adminOrders } = useStore();
  const [selectedCustomer, setSelectedCustomer] = useState<EnrichedCustomer | null>(null);

  const customers = useMemo<EnrichedCustomer[]>(() => {
    const q = globalSearch.trim().toLowerCase();
    return adminCustomers
      .map((profile) => {
        const orders = adminOrders.filter((o) => o.userId === profile.uid);
        const totalSpent = orders
          .filter((o) => o.status !== 'Cancelled')
          .reduce((sum, o) => sum + o.total, 0);
        return { profile, orders, totalSpent };
      })
      .filter((c) => {
        if (!q) return true;
        return (
          c.profile.displayName.toLowerCase().includes(q) ||
          c.profile.email.toLowerCase().includes(q) ||
          c.profile.phone.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [adminCustomers, adminOrders, globalSearch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white tracking-tight">
          Customer Directory
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Registered client profiles, contact info, and lifetime order history.
        </p>
      </div>

      <div className="glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden min-w-0">
        {customers.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No customers yet</p>
            <p className="text-xs text-zinc-500 mt-1">
              Customers appear automatically once they sign in to KOVA ATELIER.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-500">
                  <th className="py-3.5 px-5 font-medium">Customer</th>
                  <th className="py-3.5 px-3 font-medium">Email</th>
                  <th className="py-3.5 px-3 font-medium">Phone</th>
                  <th className="py-3.5 px-3 text-right font-medium">Orders</th>
                  <th className="py-3.5 px-3 text-right font-medium">Total Spent</th>
                  <th className="py-3.5 px-5 text-right font-medium">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {customers.map((c) => (
                  <tr key={c.profile.uid} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                    <td className="py-3.5 px-5 font-medium text-zinc-950 dark:text-white">
                      {c.profile.displayName || 'Unnamed Client'}
                    </td>
                    <td className="py-3.5 px-3 text-zinc-600 dark:text-zinc-400">{c.profile.email}</td>
                    <td className="py-3.5 px-3 font-mono text-zinc-500">
                      {c.profile.phone || '—'}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                      {c.orders.length}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-semibold tabular-nums text-zinc-950 dark:text-white">
                      ${c.totalSpent.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => setSelectedCustomer(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-300 text-xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Detail & Order History Drawer */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setSelectedCustomer(null)}
          />
          <aside className="relative w-full max-w-[100vw] sm:max-w-lg bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 h-[100dvh] flex flex-col shadow-2xl text-xs">
            <div className="px-4 sm:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-zinc-950 dark:text-white truncate">
                  {selectedCustomer.profile.displayName || 'Client Profile'}
                </h2>
                <p className="text-zinc-500 truncate">{selectedCustomer.profile.email}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Contact & Saved Address
                </p>
                <p className="font-mono">{selectedCustomer.profile.phone || 'No phone on file'}</p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {selectedCustomer.profile.address
                    ? `${selectedCustomer.profile.address}, ${selectedCustomer.profile.city}, ${selectedCustomer.profile.state} ${selectedCustomer.profile.postalCode}`
                    : 'No shipping address saved yet.'}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Order History ({selectedCustomer.orders.length})
                </p>
                {selectedCustomer.orders.length === 0 ? (
                  <p className="text-zinc-500 py-4">No orders placed yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedCustomer.orders.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-mono font-semibold text-zinc-950 dark:text-white">
                            {order.orderNumber}
                          </p>
                          <p className="text-zinc-500 mt-0.5">
                            {new Date(order.createdAt).toLocaleDateString()} · {order.items.length} item(s) ·{' '}
                            {order.status}
                          </p>
                        </div>
                        <span className="font-mono font-semibold text-sm tabular-nums">
                          ${order.total}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
