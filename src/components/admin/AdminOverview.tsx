import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, Database } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../../lib/productBadges';

const STATUS_COLORS: Record<string, string> = {
  Pending: '#D97706',
  Confirmed: '#2563EB',
  Processing: '#7C3AED',
  Shipped: '#0891B2',
  Delivered: '#16A34A',
  Cancelled: '#DC2626',
};

export function AdminOverview() {
  const {
    products,
    adminOrders,
    adminDarkMode,
    navigate,
    isCatalogSeeded,
    seedCatalogNow,
    siteSettings,
  } = useStore();

  const lowStockThreshold = siteSettings.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

  const metrics = useMemo(() => {
    const nonCancelled = adminOrders.filter((o) => o.status !== 'Cancelled');
    const totalRevenue = nonCancelled.reduce((sum, o) => sum + o.total, 0);
    const pendingOrders = adminOrders.filter((o) => o.status === 'Pending').length;
    const deliveredOrders = adminOrders.filter((o) => o.status === 'Delivered').length;
    const cancelledOrders = adminOrders.filter((o) => o.status === 'Cancelled').length;
    const lowStockProducts = products.filter((p) => p.stockQuantity <= lowStockThreshold).length;

    return {
      totalOrders: adminOrders.length,
      totalProducts: products.length,
      totalRevenue,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      lowStockProducts,
    };
  }, [adminOrders, products, lowStockThreshold]);

  // Revenue Trends (Last 7 days combining live orders + clean baseline if empty)
  const revenueTrendData = useMemo(() => {
    const days: { date: string; key: string; revenue: number; orders: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days.push({ date: label, key, revenue: 0, orders: 0 });
    }

    for (const order of adminOrders) {
      if (order.status === 'Cancelled') continue;
      const key = order.createdAt.slice(0, 10);
      const slot = days.find((d) => d.key === key);
      if (slot) {
        slot.revenue += order.total;
        slot.orders += 1;
      }
    }
    return days;
  }, [adminOrders]);

  // Category Sales & Inventory Value Overview
  const categoryData = useMemo(() => {
    const map = new Map<string, { category: string; revenue: number; catalogValue: number }>();
    for (const p of products) {
      const eff = p.discountPrice > 0 ? p.discountPrice : p.price;
      const prev = map.get(p.category) || { category: p.category, revenue: 0, catalogValue: 0 };
      prev.catalogValue += eff * p.stockQuantity;
      map.set(p.category, prev);
    }
    for (const o of adminOrders) {
      if (o.status === 'Cancelled') continue;
      for (const item of o.items) {
        const prod = products.find((p) => p.id === item.productId);
        const cat = prod?.category || 'Oversized T-Shirts';
        const prev = map.get(cat) || { category: cat, revenue: 0, catalogValue: 0 };
        prev.revenue += item.price * item.quantity;
        map.set(cat, prev);
      }
    }
    return Array.from(map.values());
  }, [products, adminOrders]);

  // Order Status Breakdown
  const orderStatusData = useMemo(() => {
    const statuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    return statuses
      .map((s) => ({
        name: s,
        value: adminOrders.filter((o) => o.status === s).length,
      }))
      .filter((d) => d.value > 0);
  }, [adminOrders]);

  // Popular Products (ordered units + fallback to featured/best sellers)
  const popularProducts = useMemo(() => {
    const soldMap = new Map<string, { name: string; sku: string; units: number; revenue: number; stock: number }>();
    for (const p of products) {
      soldMap.set(p.id, {
        name: p.name,
        sku: p.sku,
        units: 0,
        revenue: 0,
        stock: p.stockQuantity,
      });
    }
    for (const o of adminOrders) {
      if (o.status === 'Cancelled') continue;
      for (const item of o.items) {
        const curr = soldMap.get(item.productId) || {
          name: item.name,
          sku: item.sku,
          units: 0,
          revenue: 0,
          stock: 0,
        };
        curr.units += item.quantity;
        curr.revenue += item.price * item.quantity;
        soldMap.set(item.productId, curr);
      }
    }
    return Array.from(soldMap.values())
      .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
      .slice(0, 5);
  }, [products, adminOrders]);

  const axisStroke = adminDarkMode ? '#71717A' : '#71717A';
  const gridStroke = adminDarkMode ? '#27272A' : '#E4E4E7';
  const primaryBar = adminDarkMode ? '#FAFAFA' : '#18181B';

  const kpis = [
    { label: 'Total Revenue', value: `$${metrics.totalRevenue.toLocaleString()}`, note: 'Excl. cancelled' },
    { label: 'Total Orders', value: String(metrics.totalOrders), note: 'All time' },
    { label: 'Total Products', value: String(metrics.totalProducts), note: 'Active & draft' },
    { label: 'Pending Orders', value: String(metrics.pendingOrders), note: 'Awaiting review', warn: metrics.pendingOrders > 0 },
    { label: 'Delivered Orders', value: String(metrics.deliveredOrders), note: 'Completed' },
    { label: 'Cancelled Orders', value: String(metrics.cancelledOrders), note: 'Voided' },
    {
      label: 'Low-Stock Alerts',
      value: String(metrics.lowStockProducts),
      note: `≤ ${lowStockThreshold} units left`,
      alert: metrics.lowStockProducts > 0,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white tracking-tight">
            Executive Overview
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time store performance synced with Firestore.
          </p>
        </div>

        {!isCatalogSeeded && (
          <button
            onClick={seedCatalogNow}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-lg hover:opacity-90 cursor-pointer whitespace-nowrap"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Initialize Firestore Catalog</span>
          </button>
        )}
      </div>

      {/* 7-Metric KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between"
          >
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{kpi.label}</p>
            <p
              className={`font-mono text-2xl font-semibold tabular-nums mt-2 ${
                kpi.alert
                  ? 'text-red-600 dark:text-red-400'
                  : kpi.warn
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-zinc-950 dark:text-white'
              }`}
            >
              {kpi.value}
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">{kpi.note}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Revenue Trends + Orders Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                Revenue Trends (Last 7 Days)
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Daily verified & pending gross merchandise value
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-zinc-500">USD</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryBar} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={primaryBar} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" stroke={axisStroke} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={axisStroke} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: adminDarkMode ? '#18181B' : '#FFFFFF',
                    borderColor: adminDarkMode ? '#27272A' : '#E4E4E7',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={primaryBar}
                  strokeWidth={2}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 flex flex-col">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
              Orders Overview
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">Distribution by fulfillment status</p>
          </div>
          {orderStatusData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <p className="text-xs text-zinc-500">
                No orders recorded yet. Place a test order from the storefront to see live charts.
              </p>
            </div>
          ) : (
            <>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                    >
                      {orderStatusData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#52525B'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 text-xs">
                {orderStatusData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[d.name] || '#52525B' }}
                      />
                      <span>{d.name}</span>
                    </span>
                    <span className="font-mono font-medium tabular-nums">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Charts Row 2: Sales Overview by Category + Popular Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                Sales & Stock Value by Category
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {adminOrders.length > 0 ? 'Order revenue per apparel category' : 'Catalog inventory valuation by category'}
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="category" stroke={axisStroke} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={axisStroke} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: adminDarkMode ? '#18181B' : '#FFFFFF',
                    borderColor: adminDarkMode ? '#27272A' : '#E4E4E7',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey={adminOrders.length > 0 ? 'revenue' : 'catalogValue'}
                  name={adminOrders.length > 0 ? 'Revenue ($)' : 'Inventory Value ($)'}
                  fill={primaryBar}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
                Popular Products
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">Top garments by order revenue</p>
            </div>
            <button
              onClick={() => navigate({ name: 'admin', section: 'products' })}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 flex-1">
            {popularProducts.map((item) => (
              <div key={item.sku} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-950 dark:text-zinc-100 truncate">
                    {item.name}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
                    {item.sku} · Stock: {item.stock}
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums shrink-0">
                  <p className="text-xs font-semibold text-zinc-950 dark:text-white">
                    ${item.revenue.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-zinc-500">{item.units} sold</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders Quick Table */}
      <div className="glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Recent Orders</h2>
          <button
            onClick={() => navigate({ name: 'admin', section: 'orders' })}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
          >
            <span>All Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {adminOrders.length === 0 ? (
          <p className="text-xs text-zinc-500 py-8 text-center">
            No customer orders yet. Orders placed on the storefront appear here instantaneously.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-500">
                  <th className="py-2.5 pr-4 font-medium">Order</th>
                  <th className="py-2.5 px-3 font-medium">Customer</th>
                  <th className="py-2.5 px-3 font-medium">Date</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 pl-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {adminOrders.slice(0, 5).map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate({ name: 'admin', section: 'orders' })}
                    className="hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 cursor-pointer"
                  >
                    <td className="py-3 pr-4 font-mono font-medium text-zinc-950 dark:text-white">
                      {o.orderNumber}
                    </td>
                    <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300">{o.customerName}</td>
                    <td className="py-3 px-3 font-mono text-zinc-500">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 font-medium">{o.status}</td>
                    <td className="py-3 pl-3 text-right font-mono font-semibold tabular-nums">
                      ${o.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
