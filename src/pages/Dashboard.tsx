import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useProductStore } from '@/stores/productStore';
import { supabase } from '@/lib/supabase';
import { Sale, SaleItem, Product } from '@/lib/types';
import { BarChart3, ShoppingCart, Package, TrendingUp, LogOut } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { Button } from '@/components/common/Button';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, logout } = useAuthStore();
  const { products, fetchProducts } = useProductStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    lowStockItems: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        await fetchProducts();

        const { data: sales } = await supabase
          .from('sales')
          .select('*')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        const { data: saleItems } = await supabase
          .from('sale_items')
          .select('*');

        const totalRevenue = (sales || []).reduce((sum: number, s: Sale) => sum + s.total_amount, 0);
        const totalCost = (saleItems || []).reduce((sum: number, si: SaleItem) => sum + (si.cost_price * si.quantity), 0);
        const totalProfit = totalRevenue - totalCost;
        const lowStockCount = (products || []).filter((p: Product) => p.quantity <= p.reorder_point).length;

        setStats({
          totalSales: (sales || []).length,
          totalRevenue,
          totalProfit,
          lowStockItems: lowStockCount,
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fetchProducts]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">POS System</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">
              {profile?.full_name} <span className="text-sm text-gray-500">({profile?.role})</span>
            </span>
            <Button
              onClick={handleLogout}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <LogOut size={18} />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Sales"
            value={stats.totalSales}
            icon={ShoppingCart}
            color="blue"
          />
          <StatCard
            title="Revenue (30 days)"
            value={formatCurrency(stats.totalRevenue)}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            title="Profit (30 days)"
            value={formatCurrency(stats.totalProfit)}
            icon={BarChart3}
            color="purple"
          />
          <StatCard
            title="Low Stock Items"
            value={stats.lowStockItems}
            icon={Package}
            color="orange"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {profile?.role === 'seller' && (
            <div className="lg:col-span-3 bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <Button
                onClick={() => navigate('/pos')}
                variant="primary"
                size="lg"
                className="w-full mb-2"
              >
                New Sale
              </Button>
              <Button
                onClick={() => navigate('/inventory')}
                variant="secondary"
                size="lg"
                className="w-full"
              >
                View Inventory
              </Button>
            </div>
          )}

          {profile?.role === 'admin' && (
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onClick={() => navigate('/inventory')}
                variant="primary"
                className="h-16 text-lg"
              >
                Inventory Management
              </Button>
              <Button
                onClick={() => navigate('/reports')}
                variant="primary"
                className="h-16 text-lg"
              >
                Reports & Analytics
              </Button>
              <Button
                onClick={() => navigate('/users')}
                variant="primary"
                className="h-16 text-lg"
              >
                User Management
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
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
