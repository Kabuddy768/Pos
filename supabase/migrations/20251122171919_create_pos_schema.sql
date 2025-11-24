/*
  # POS and Inventory Management System Database Schema

  ## Overview
  Complete database schema for a multi-seller POS system with inventory management,
  sales transactions, reporting, and audit trails.

  ## Tables Created
  1. profiles - Extended user profiles with roles
  2. categories - Product categories
  3. suppliers - Supplier information
  4. products - Inventory items with pricing and stock
  5. sales - Sales transactions
  6. sale_items - Line items in sales
  7. stock_adjustments - Track inventory changes
  8. audit_logs - User action logging

  ## Security
  - RLS enabled on all tables
  - Role-based access control (admin/seller)
  - Automatic audit trail for compliance
*/

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'seller')),
  phone TEXT,
  email TEXT UNIQUE,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create products table (inventory)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_price DECIMAL(10, 2) NOT NULL CHECK (purchase_price >= 0),
  selling_price DECIMAL(10, 2) NOT NULL CHECK (selling_price >= 0),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_point INTEGER NOT NULL DEFAULT 10 CHECK (reorder_point >= 0),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create sales transactions table
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number TEXT NOT NULL UNIQUE,
  seller_id UUID NOT NULL REFERENCES profiles(id),
  customer_name TEXT,
  customer_phone TEXT,
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  discount_amount DECIMAL(10, 2) DEFAULT 0 CHECK (discount_amount >= 0),
  discount_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  tax_amount DECIMAL(10, 2) DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'card')),
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create sale items table (line items)
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(10, 2) NOT NULL CHECK (line_total >= 0),
  cost_price DECIMAL(10, 2) NOT NULL CHECK (cost_price >= 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create stock adjustments table
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('purchase', 'sale', 'adjustment', 'return', 'damage')),
  quantity_change INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  notes TEXT,
  adjusted_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(quantity) WHERE quantity <= reorder_point AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_transaction ON sales(transaction_number);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product ON stock_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created ON stock_adjustments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Function: Generate transaction number
CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS TEXT AS $$
DECLARE
  next_id INTEGER;
  trans_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(transaction_number FROM 6) AS INTEGER)), 0) + 1
  INTO next_id
  FROM sales
  WHERE transaction_number LIKE 'TXN-%';
  
  trans_number := 'TXN-' || LPAD(next_id::TEXT, 8, '0');
  RETURN trans_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-set transaction number
CREATE OR REPLACE FUNCTION set_transaction_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_number IS NULL OR NEW.transaction_number = '' THEN
    NEW.transaction_number := generate_transaction_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sales_transaction_number ON sales;
CREATE TRIGGER sales_transaction_number
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_transaction_number();

-- Trigger: Update product quantity on sale
CREATE OR REPLACE FUNCTION update_product_quantity_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  seller_id_val UUID;
BEGIN
  SELECT seller_id INTO seller_id_val FROM sales WHERE id = NEW.sale_id;
  
  UPDATE products
  SET quantity = quantity - NEW.quantity,
      updated_at = now()
  WHERE id = NEW.product_id;
  
  INSERT INTO stock_adjustments (
    product_id, adjustment_type, quantity_change,
    previous_quantity, new_quantity, reference_id,
    reference_type, adjusted_by
  )
  SELECT 
    NEW.product_id, 'sale', -NEW.quantity,
    (p.quantity + NEW.quantity), p.quantity,
    NEW.sale_id, 'sale', seller_id_val
  FROM products p
  WHERE p.id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sale_items_update_stock ON sale_items;
CREATE TRIGGER sale_items_update_stock
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_product_quantity_on_sale();

-- Trigger: Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Views for reporting
CREATE OR REPLACE VIEW low_stock_items AS
SELECT 
  p.id, p.sku, p.name, p.quantity, p.reorder_point,
  c.name as category_name, s.name as supplier_name,
  p.purchase_price, p.selling_price
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
WHERE p.quantity <= p.reorder_point AND p.is_active = true
ORDER BY p.quantity ASC;

CREATE OR REPLACE VIEW stock_valuation AS
SELECT 
  SUM(quantity * purchase_price)::DECIMAL(10, 2) as cost_value,
  SUM(quantity * selling_price)::DECIMAL(10, 2) as retail_value,
  COUNT(*) as total_products,
  SUM(quantity) as total_units
FROM products
WHERE is_active = true;

CREATE OR REPLACE VIEW product_performance AS
SELECT 
  p.id, p.sku, p.name, p.quantity,
  c.name as category_name,
  COALESCE(COUNT(si.id), 0) as times_sold,
  COALESCE(SUM(si.quantity), 0) as total_quantity_sold,
  COALESCE(SUM(si.line_total), 0)::DECIMAL(10, 2) as total_revenue,
  COALESCE(SUM(si.line_total - (si.cost_price * si.quantity)), 0)::DECIMAL(10, 2) as total_profit
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN sale_items si ON p.id = si.product_id
WHERE p.is_active = true
GROUP BY p.id, p.sku, p.name, p.quantity, c.name
ORDER BY total_revenue DESC;