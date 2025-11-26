-- Migration: Fix stock update trigger with SECURITY DEFINER
-- This replaces the existing function to bypass RLS policies

-- Drop the existing function and trigger
DROP FUNCTION IF EXISTS update_product_quantity_on_sale() CASCADE;

-- Create the function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION update_product_quantity_on_sale()
RETURNS TRIGGER 
SECURITY DEFINER -- Runs with function owner's privileges, bypassing RLS
SET search_path = public
AS $$
DECLARE
  seller_id_val UUID;
  prev_qty INTEGER;
  new_qty INTEGER;
BEGIN
  -- Get the seller ID from the sale
  SELECT seller_id INTO seller_id_val 
  FROM sales 
  WHERE id = NEW.sale_id;
  
  -- Get current quantity before update
  SELECT quantity INTO prev_qty
  FROM products
  WHERE id = NEW.product_id;
  
  -- Update product quantity
  UPDATE products
  SET quantity = quantity - NEW.quantity,
      updated_at = now()
  WHERE id = NEW.product_id;
  
  -- Calculate new quantity
  new_qty := prev_qty - NEW.quantity;
  
  -- Insert stock adjustment record
  INSERT INTO stock_adjustments (
    product_id, 
    adjustment_type, 
    quantity_change,
    previous_quantity, 
    new_quantity, 
    reference_id,
    reference_type, 
    adjusted_by
  ) VALUES (
    NEW.product_id, 
    'sale', 
    -NEW.quantity,
    prev_qty, 
    new_qty,
    NEW.sale_id, 
    'sale', 
    seller_id_val
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER sale_items_update_stock
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_product_quantity_on_sale();

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_product_quantity_on_sale() TO authenticated;