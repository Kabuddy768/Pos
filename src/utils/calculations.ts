import { Product, Sale, SaleItem } from '@/lib/types';

export const calculateProfit = (revenue: number, cost: number): number => {
  return revenue - cost;
};

export const calculateProfitMargin = (profit: number, revenue: number): number => {
  if (revenue === 0) return 0;
  return (profit / revenue) * 100;
};

export const calculateMarkup = (cost: number, sellingPrice: number): number => {
  if (cost === 0) return 0;
  return ((sellingPrice - cost) / cost) * 100;
};

export const calculateStockValue = (products: Product[]): { cost: number; retail: number } => {
  return products.reduce(
    (acc, product) => ({
      cost: acc.cost + product.quantity * product.purchase_price,
      retail: acc.retail + product.quantity * product.selling_price,
    }),
    { cost: 0, retail: 0 }
  );
};

export const calculateLowStockPercentage = (quantity: number, reorderPoint: number): number => {
  if (reorderPoint === 0) return 0;
  return (quantity / reorderPoint) * 100;
};

export const calculateSaleMetrics = (sales: Sale[], items: SaleItem[]) => {
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
  const totalCost = items.reduce((sum, item) => sum + item.cost_price * item.quantity, 0);
  const totalProfit = totalRevenue - totalCost;
  const profitMargin = calculateProfitMargin(totalProfit, totalRevenue);

  return {
    totalRevenue,
    totalCost,
    totalProfit,
    profitMargin,
    averageTransactionValue: totalRevenue / (sales.length || 1),
    totalTransactions: sales.length,
  };
};

export const calculateTax = (amount: number, taxRate: number = 0): number => {
  return (amount * taxRate) / 100;
};

export const calculateDiscount = (amount: number, discountPercent: number): number => {
  return (amount * discountPercent) / 100;
};
