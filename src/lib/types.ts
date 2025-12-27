export type UserRole = 'admin' | 'seller';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  email: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category_id?: string;
  supplier_id?: string;
  purchase_price: number;
  selling_price: number;
  quantity: number;
  reorder_point: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
}

export interface Sale {
  id: string;
  transaction_number: string;
  seller_id: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  discount_amount: number;
  discount_percentage: number;
  tax_amount: number;
  total_amount: number;
  payment_method: 'cash' | 'mpesa' | 'card';
  payment_reference?: string;
  notes?: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  cost_price: number;
  created_at: string;
}

export interface StockAdjustment {
  id: string;
  product_id: string;
  adjustment_type: 'purchase' | 'sale' | 'adjustment' | 'return' | 'damage';
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reference_id?: string;
  reference_type?: string;
  notes?: string;
  adjusted_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  table_name: string;
  record_id?: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface SalesReport {
  total_sales: number;
  total_revenue: number;
  total_transactions: number;
  average_transaction_value: number;
  by_payment_method: {
    cash: number;
    mpesa: number;
    card: number;
  };
  by_seller?: Record<string, number>;
  by_category?: Record<string, number>;
}

export interface InventoryReport {
  total_products: number;
  total_units: number;
  cost_value: number;
  retail_value: number;
  low_stock_items: Product[];
  slow_moving_items: Product[];
}

export interface ProfitLossReport {
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  profit_margin: number;
  by_category?: Record<string, {
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
  }>;
}

// Add to the bottom of your types.ts file
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}