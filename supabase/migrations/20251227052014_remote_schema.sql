drop extension if exists "pg_net";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.expire_old_invitations()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE user_invitations
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending' 
    AND expires_at < now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_invite_token()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  token TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random token (32 characters)
    token := encode(gen_random_bytes(24), 'base64');
    token := replace(token, '/', '_');
    token := replace(token, '+', '-');
    token := replace(token, '=', '');
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM user_invitations WHERE invite_token = token) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN token;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_transaction_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_invitation_accepted(token text, user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Get invitation details
  SELECT id, invited_by INTO invitation_record
  FROM user_invitations
  WHERE invite_token = token AND status = 'pending' AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Update invitation status
  UPDATE user_invitations
  SET status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  WHERE id = invitation_record.id;
  
  -- Update profile with invitation details
  UPDATE profiles
  SET invited_by = invitation_record.invited_by,
      invitation_accepted_at = now()
  WHERE id = user_id;
  
  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_transaction_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only generate if frontend didn't provide one
  IF NEW.transaction_number IS NULL OR NEW.transaction_number = '' THEN
    -- nextval() is ATOMIC - no race condition possible!
    NEW.transaction_number := 'TXN-' || LPAD(nextval('sales_transaction_seq')::TEXT, 8, '0');
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_product_quantity_on_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_invite_token(token text)
 RETURNS TABLE(is_valid boolean, invitation_id uuid, email text, role text, invited_by_name text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (i.status = 'pending' AND i.expires_at > now())::BOOLEAN as is_valid,
    i.id as invitation_id,
    i.email,
    i.role,
    p.full_name as invited_by_name,
    i.expires_at
  FROM user_invitations i
  JOIN profiles p ON i.invited_by = p.id
  WHERE i.invite_token = token;
END;
$function$
;


