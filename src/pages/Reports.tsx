import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sale, SaleItem, Product, Profile } from '@/lib/types';
import { Button } from '@/components/common/Button';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { BarChart3, TrendingUp, DollarSign, Package, Users } from 'lucide-react';

export const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Profile[]>([]);

  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    profitMargin: 0,
    totalTransactions: 0,
    averageTransactionValue: 0,
    byPaymentMethod: { cash: 0, mpesa: 0, card: 0 },
    bySeller: {} as Record<string, { revenue: number; transactions: number; profit: number }>,
  });

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const days = parseInt(dateRange);
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      const { data: itemsData } = await supabase
        .from('sale_items')
        .select('*');

      const { data: productsData } = await supabase
        .from('products')
        .select('*');

      const { data: sellersData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'seller');

      setSales(salesData || []);
      setSaleItems(itemsData || []);
      setProducts(productsData || []);
      setSellers(sellersData || []);

      calculateStats(salesData || [], itemsData || [], sellersData || []);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (sales: Sale[], items: SaleItem[], sellers: Profile[]) => {
    const totalRevenue = sales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalCost = items.reduce((sum, item) => sum + item.cost_price * item.quantity, 0);
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const byPaymentMethod = {
      cash: sales.filter((s) => s.payment_method === 'cash').reduce((sum, s) => sum + s.total_amount, 0),
      mpesa: sales.filter((s) => s.payment_method === 'mpesa').reduce((sum, s) => sum + s.total_amount, 0),
      card: sales.filter((s) => s.payment_method === 'card').reduce((sum, s) => sum + s.total_amount, 0),
    };

    // Calculate per-seller statistics
    const bySeller: Record<string, { revenue: number; transactions: number; profit: number }> = {};
    
    sellers.forEach((seller) => {
      const sellerSales = sales.filter((s) => s.seller_id === seller.id);
      const sellerRevenue = sellerSales.reduce((sum, s) => sum + s.total_amount, 0);
      
      // Calculate profit for this seller
      const sellerSaleIds = sellerSales.map((s) => s.id);
      const sellerItems = items.filter((item) => sellerSaleIds.includes(item.sale_id));
      const sellerCost = sellerItems.reduce((sum, item) => sum + item.cost_price * item.quantity, 0);
      const sellerProfit = sellerRevenue - sellerCost;
      
      bySeller[seller.id] = {
        revenue: sellerRevenue,
        transactions: sellerSales.length,
        profit: sellerProfit,
      };
    });

    setStats({
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin,
      totalTransactions: sales.length,
      averageTransactionValue: sales.length > 0 ? totalRevenue / sales.length : 0,
      byPaymentMethod,
      bySeller,
    });
  };

  const topProducts = products
    .map((product) => {
      const productSales = saleItems.filter((item) => item.product_id === product.id);
      const totalQuantity = productSales.reduce((sum, item) => sum + item.quantity, 0);
      const totalRevenue = productSales.reduce((sum, item) => sum + item.line_total, 0);

      return {
        ...product,
        totalQuantity,
        totalRevenue,
      };
    })
    .filter((p) => p.totalQuantity > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);

  const lowStockItems = products
    .filter((p) => p.quantity <= p.reorder_point && p.is_active)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 10);

  // Sort sellers by revenue
  const sortedSellers = sellers
    .map((seller) => ({
      ...seller,
      ...stats.bySeller[seller.id],
    }))
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin">
          <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <div className="flex gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="365">Last Year</option>
            </select>
            <Button variant="secondary">Export Report</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={DollarSign}
            color="blue"
          />
          <StatCard
            title="Total Cost"
            value={formatCurrency(stats.totalCost)}
            icon={Package}
            color="orange"
          />
          <StatCard
            title="Total Profit"
            value={formatCurrency(stats.totalProfit)}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            title="Profit Margin"
            value={`${stats.profitMargin.toFixed(1)}%`}
            icon={BarChart3}
            color="purple"
          />
        </div>

        {/* Seller Performance Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users size={24} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Seller Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Seller</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Transactions</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Revenue</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Profit</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Avg/Sale</th>
                </tr>
              </thead>
              <tbody>
                {sortedSellers.map((seller) => {
                  const avgSale = seller.transactions > 0 ? seller.revenue / seller.transactions : 0;
                  return (
                    <tr key={seller.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-900">{seller.full_name}</p>
                          <p className="text-xs text-gray-600">{seller.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{seller.transactions || 0}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600">
                        {formatCurrency(seller.revenue || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">
                        {formatCurrency(seller.profit || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatCurrency(avgSale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales by Payment Method</h2>
            <div className="space-y-3">
              <PaymentMethodRow label="Cash" amount={stats.byPaymentMethod.cash} color="bg-blue-500" />
              <PaymentMethodRow label="M-Pesa" amount={stats.byPaymentMethod.mpesa} color="bg-green-500" />
              <PaymentMethodRow label="Card" amount={stats.byPaymentMethod.card} color="bg-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600 text-sm">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600 text-sm">Average Transaction</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.averageTransactionValue)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Products</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Product</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Qty Sold</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product) => (
                    <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div>
                          <p className="font-semibold text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-600">{product.sku}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">{product.totalQuantity}</td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {formatCurrency(product.totalRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Low Stock Alert</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Product</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Stock</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Reorder</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((product) => (
                    <tr key={product.id} className="border-b border-gray-200 hover:bg-yellow-50">
                      <td className="px-4 py-2">
                        <div>
                          <p className="font-semibold text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-600">{product.sku}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-red-600">{product.quantity}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{product.reorder_point}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ size: number }>;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

const StatCard = ({ title, value, icon: Icon, color }: StatCardProps) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`${colorClasses[color]} p-3 rounded-lg`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
};

const PaymentMethodRow = ({ label, amount, color }: { label: string; amount: number; color: string }) => {
  return (
    <div className="flex items-center gap-3">
      <div className={`${color} h-3 w-3 rounded-full`}></div>
      <div className="flex-1">
        <p className="text-gray-700">{label}</p>
        <p className="text-sm text-gray-600">{formatCurrency(amount)}</p>
      </div>
    </div>
  );
};