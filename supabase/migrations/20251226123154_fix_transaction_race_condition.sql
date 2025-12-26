/*
  # Fix Transaction Number Race Condition
  
  ## Problem
  Multiple sellers could read the same MAX(transaction_number) simultaneously,
  causing duplicate key violations when both try to insert the same number.
  
  ## Solution
  Use PostgreSQL SEQUENCE for atomic, thread-safe counter increments.
  
  ## Changes
  1. Create dedicated sequence for transaction numbers
  2. Replace MAX() query with nextval() for atomic increments
  3. Synchronize sequence with existing data
*/

-- =====================================================
-- STEP 1: Create the Sequence (Thread-Safe Counter)
-- =====================================================
CREATE SEQUENCE IF NOT EXISTS sales_transaction_seq 
  START 1
  INCREMENT 1
  NO CYCLE;

-- =====================================================
-- STEP 2: Create/Replace the Trigger Function
-- =====================================================
CREATE OR REPLACE FUNCTION set_transaction_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if frontend didn't provide one
  IF NEW.transaction_number IS NULL OR NEW.transaction_number = '' THEN
    -- nextval() is ATOMIC - no race condition possible!
    NEW.transaction_number := 'TXN-' || LPAD(nextval('sales_transaction_seq')::TEXT, 8, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 3: Recreate the Trigger
-- =====================================================
DROP TRIGGER IF EXISTS sales_transaction_number ON sales;
CREATE TRIGGER sales_transaction_number
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_transaction_number();

-- =====================================================
-- STEP 4: CRITICAL - Synchronize Sequence with Existing Data
-- =====================================================
-- This prevents sequence from starting at 1 if you already have data
DO $$ 
DECLARE
  max_num BIGINT;
  next_num BIGINT;
BEGIN
  -- Extract the highest number from existing transactions
  -- Example: 'TXN-00000123' -> extract 123
  SELECT COALESCE(
    MAX(
      NULLIF(
        regexp_replace(transaction_number, '\D', '', 'g'), 
        ''
      )::BIGINT
    ), 
    0
  )
  INTO max_num
  FROM sales
  WHERE transaction_number LIKE 'TXN-%';
  
  -- Set sequence to continue from highest existing number
  IF max_num > 0 THEN
    PERFORM setval('sales_transaction_seq', max_num);
    next_num := max_num + 1;
    
    RAISE NOTICE '✅ Sequence synchronized!';
    RAISE NOTICE '   Highest existing: TXN-%', LPAD(max_num::TEXT, 8, '0');
    RAISE NOTICE '   Next transaction: TXN-%', LPAD(next_num::TEXT, 8, '0');
  ELSE
    RAISE NOTICE '✅ No existing transactions. Sequence starts at TXN-00000001';
  END IF;
END $$;

-- =====================================================
-- STEP 5: Verify the Fix
-- =====================================================
-- Test query to see current sequence value
DO $$
DECLARE
  current_val BIGINT;
BEGIN
  current_val := currval('sales_transaction_seq');
  RAISE NOTICE 'Current sequence value: %', current_val;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Sequence not used yet (this is normal on first setup)';
END $$;

-- =====================================================
-- Documentation
-- =====================================================
COMMENT ON SEQUENCE sales_transaction_seq IS 
  'Thread-safe atomic counter for sales transaction numbers. Prevents race conditions when multiple sellers create sales simultaneously.';

COMMENT ON FUNCTION set_transaction_number() IS 
  'Uses sequence for atomic transaction number generation. Format: TXN-00000001, TXN-00000002, etc.';