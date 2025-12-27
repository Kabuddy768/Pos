


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."expire_old_invitations"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE user_invitations
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending' 
    AND expires_at < now();
END;
$$;


ALTER FUNCTION "public"."expire_old_invitations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invite_token"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_invite_token"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_invite_token"() IS 'Generates a unique secure token for invitations';



CREATE OR REPLACE FUNCTION "public"."generate_transaction_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_transaction_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_invitation_accepted"("token" "text", "user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."mark_invitation_accepted"("token" "text", "user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_invitation_accepted"("token" "text", "user_id" "uuid") IS 'Marks an invitation as accepted and links it to the new user';



CREATE OR REPLACE FUNCTION "public"."set_transaction_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only generate if frontend didn't provide one
  IF NEW.transaction_number IS NULL OR NEW.transaction_number = '' THEN
    -- nextval() is ATOMIC - no race condition possible!
    NEW.transaction_number := 'TXN-' || LPAD(nextval('sales_transaction_seq')::TEXT, 8, '0');
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_transaction_number"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_transaction_number"() IS 'Uses sequence for atomic transaction number generation. Format: TXN-00000001, TXN-00000002, etc.';



CREATE OR REPLACE FUNCTION "public"."update_product_quantity_on_sale"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
$$;


ALTER FUNCTION "public"."update_product_quantity_on_sale"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_invite_token"("token" "text") RETURNS TABLE("is_valid" boolean, "invitation_id" "uuid", "email" "text", "role" "text", "invited_by_name" "text", "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."validate_invite_token"("token" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_invite_token"("token" "text") IS 'Validates an invite token and returns invitation details';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sku" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category_id" "uuid",
    "supplier_id" "uuid",
    "purchase_price" numeric(10,2) NOT NULL,
    "selling_price" numeric(10,2) NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "reorder_point" integer DEFAULT 10 NOT NULL,
    "image_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "products_purchase_price_check" CHECK (("purchase_price" >= (0)::numeric)),
    CONSTRAINT "products_quantity_check" CHECK (("quantity" >= 0)),
    CONSTRAINT "products_reorder_point_check" CHECK (("reorder_point" >= 0)),
    CONSTRAINT "products_selling_price_check" CHECK (("selling_price" >= (0)::numeric))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_person" "text",
    "email" "text",
    "phone" "text",
    "address" "text",
    "city" "text",
    "country" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."low_stock_items" AS
 SELECT "p"."id",
    "p"."sku",
    "p"."name",
    "p"."quantity",
    "p"."reorder_point",
    "c"."name" AS "category_name",
    "s"."name" AS "supplier_name",
    "p"."purchase_price",
    "p"."selling_price"
   FROM (("public"."products" "p"
     LEFT JOIN "public"."categories" "c" ON (("p"."category_id" = "c"."id")))
     LEFT JOIN "public"."suppliers" "s" ON (("p"."supplier_id" = "s"."id")))
  WHERE (("p"."quantity" <= "p"."reorder_point") AND ("p"."is_active" = true))
  ORDER BY "p"."quantity";


ALTER VIEW "public"."low_stock_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sale_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sale_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "product_name" "text" NOT NULL,
    "product_sku" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "line_total" numeric(10,2) NOT NULL,
    "cost_price" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sale_items_cost_price_check" CHECK (("cost_price" >= (0)::numeric)),
    CONSTRAINT "sale_items_line_total_check" CHECK (("line_total" >= (0)::numeric)),
    CONSTRAINT "sale_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "sale_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."sale_items" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."product_performance" AS
 SELECT "p"."id",
    "p"."sku",
    "p"."name",
    "p"."quantity",
    "c"."name" AS "category_name",
    COALESCE("count"("si"."id"), (0)::bigint) AS "times_sold",
    COALESCE("sum"("si"."quantity"), (0)::bigint) AS "total_quantity_sold",
    (COALESCE("sum"("si"."line_total"), (0)::numeric))::numeric(10,2) AS "total_revenue",
    (COALESCE("sum"(("si"."line_total" - ("si"."cost_price" * ("si"."quantity")::numeric))), (0)::numeric))::numeric(10,2) AS "total_profit"
   FROM (("public"."products" "p"
     LEFT JOIN "public"."categories" "c" ON (("p"."category_id" = "c"."id")))
     LEFT JOIN "public"."sale_items" "si" ON (("p"."id" = "si"."product_id")))
  WHERE ("p"."is_active" = true)
  GROUP BY "p"."id", "p"."sku", "p"."name", "p"."quantity", "c"."name"
  ORDER BY ((COALESCE("sum"("si"."line_total"), (0)::numeric))::numeric(10,2)) DESC;


ALTER VIEW "public"."product_performance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "avatar_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "invited_by" "uuid",
    "invitation_accepted_at" timestamp with time zone,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'seller'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_number" "text" NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "customer_name" "text",
    "customer_phone" "text",
    "subtotal" numeric(10,2) NOT NULL,
    "discount_amount" numeric(10,2) DEFAULT 0,
    "discount_percentage" numeric(5,2) DEFAULT 0,
    "tax_amount" numeric(10,2) DEFAULT 0,
    "total_amount" numeric(10,2) NOT NULL,
    "payment_method" "text" NOT NULL,
    "payment_reference" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sales_discount_amount_check" CHECK (("discount_amount" >= (0)::numeric)),
    CONSTRAINT "sales_discount_percentage_check" CHECK ((("discount_percentage" >= (0)::numeric) AND ("discount_percentage" <= (100)::numeric))),
    CONSTRAINT "sales_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'mpesa'::"text", 'card'::"text"]))),
    CONSTRAINT "sales_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "sales_tax_amount_check" CHECK (("tax_amount" >= (0)::numeric)),
    CONSTRAINT "sales_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."sales_transaction_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sales_transaction_seq" OWNER TO "postgres";


COMMENT ON SEQUENCE "public"."sales_transaction_seq" IS 'Thread-safe atomic counter for sales transaction numbers. Prevents race conditions when multiple sellers create sales simultaneously.';



CREATE TABLE IF NOT EXISTS "public"."stock_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "adjustment_type" "text" NOT NULL,
    "quantity_change" integer NOT NULL,
    "previous_quantity" integer NOT NULL,
    "new_quantity" integer NOT NULL,
    "reference_id" "uuid",
    "reference_type" "text",
    "notes" "text",
    "adjusted_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "stock_adjustments_adjustment_type_check" CHECK (("adjustment_type" = ANY (ARRAY['purchase'::"text", 'sale'::"text", 'adjustment'::"text", 'return'::"text", 'damage'::"text"])))
);


ALTER TABLE "public"."stock_adjustments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."stock_valuation" AS
 SELECT ("sum"((("quantity")::numeric * "purchase_price")))::numeric(10,2) AS "cost_value",
    ("sum"((("quantity")::numeric * "selling_price")))::numeric(10,2) AS "retail_value",
    "count"(*) AS "total_products",
    "sum"("quantity") AS "total_units"
   FROM "public"."products"
  WHERE ("is_active" = true);


ALTER VIEW "public"."stock_valuation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "invite_token" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_invitations_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'seller'::"text"]))),
    CONSTRAINT "user_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."user_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_invitations" IS 'Stores user invitation tokens for secure invite-based registration';



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_transaction_number_key" UNIQUE ("transaction_number");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_invite_token_key" UNIQUE ("invite_token");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_logs_created" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_user" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_invitations_email" ON "public"."user_invitations" USING "btree" ("email");



CREATE INDEX "idx_invitations_expires" ON "public"."user_invitations" USING "btree" ("expires_at");



CREATE INDEX "idx_invitations_invited_by" ON "public"."user_invitations" USING "btree" ("invited_by");



CREATE INDEX "idx_invitations_status" ON "public"."user_invitations" USING "btree" ("status");



CREATE INDEX "idx_invitations_token" ON "public"."user_invitations" USING "btree" ("invite_token");



CREATE INDEX "idx_products_category" ON "public"."products" USING "btree" ("category_id");



CREATE INDEX "idx_products_low_stock" ON "public"."products" USING "btree" ("quantity") WHERE (("quantity" <= "reorder_point") AND ("is_active" = true));



CREATE INDEX "idx_products_name" ON "public"."products" USING "btree" ("name");



CREATE INDEX "idx_products_sku" ON "public"."products" USING "btree" ("sku");



CREATE INDEX "idx_products_supplier" ON "public"."products" USING "btree" ("supplier_id");



CREATE INDEX "idx_sale_items_product" ON "public"."sale_items" USING "btree" ("product_id");



CREATE INDEX "idx_sale_items_sale" ON "public"."sale_items" USING "btree" ("sale_id");



CREATE INDEX "idx_sales_created" ON "public"."sales" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_sales_seller" ON "public"."sales" USING "btree" ("seller_id");



CREATE INDEX "idx_sales_transaction" ON "public"."sales" USING "btree" ("transaction_number");



CREATE INDEX "idx_stock_adjustments_created" ON "public"."stock_adjustments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_stock_adjustments_product" ON "public"."stock_adjustments" USING "btree" ("product_id");



CREATE OR REPLACE TRIGGER "invitations_updated_at" BEFORE UPDATE ON "public"."user_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "sale_items_update_stock" AFTER INSERT ON "public"."sale_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_product_quantity_on_sale"();



CREATE OR REPLACE TRIGGER "sales_transaction_number" BEFORE INSERT ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."set_transaction_number"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_adjusted_by_fkey" FOREIGN KEY ("adjusted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can create invitations" ON "public"."user_invitations" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"("auth"."uid"()) AND ("invited_by" = "auth"."uid"())));



CREATE POLICY "Admins can delete invitations" ON "public"."user_invitations" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can delete products" ON "public"."products" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can delete profiles" ON "public"."profiles" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can insert products" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can insert profiles" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can manage categories" ON "public"."categories" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can manage sales" ON "public"."sales" FOR UPDATE TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can manage suppliers" ON "public"."suppliers" TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can update own invitations" ON "public"."user_invitations" FOR UPDATE TO "authenticated" USING ((("invited_by" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"()))) WITH CHECK ((("invited_by" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "Admins can update products" ON "public"."products" FOR UPDATE TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can update profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can view all invitations" ON "public"."user_invitations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



COMMENT ON POLICY "Admins can view all invitations" ON "public"."user_invitations" IS 'Only admins can browse invitations. Token validation happens via validate_invite_token() RPC function.';



CREATE POLICY "Admins can view all products" ON "public"."products" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can view all sales" ON "public"."sales" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can view audit logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Anyone can view active products" ON "public"."products" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Anyone can view categories" ON "public"."categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view stock adjustments" ON "public"."stock_adjustments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view suppliers" ON "public"."suppliers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Sellers can create sales" ON "public"."sales" FOR INSERT TO "authenticated" WITH CHECK (("seller_id" = "auth"."uid"()));



CREATE POLICY "Sellers can insert sale items" ON "public"."sale_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sales"
  WHERE (("sales"."id" = "sale_items"."sale_id") AND ("sales"."seller_id" = "auth"."uid"())))));



CREATE POLICY "Sellers can view own sales" ON "public"."sales" FOR SELECT TO "authenticated" USING (("seller_id" = "auth"."uid"()));



CREATE POLICY "System can insert audit logs" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert stock adjustments" ON "public"."stock_adjustments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view accessible sale items" ON "public"."sale_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sales"
  WHERE (("sales"."id" = "sale_items"."sale_id") AND (("sales"."seller_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"()))))));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sale_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_invitations" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."expire_old_invitations"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_old_invitations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_old_invitations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invite_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invite_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invite_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_transaction_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_transaction_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_transaction_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_invitation_accepted"("token" "text", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_invitation_accepted"("token" "text", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_invitation_accepted"("token" "text", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_transaction_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_transaction_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_transaction_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_quantity_on_sale"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_quantity_on_sale"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_quantity_on_sale"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_invite_token"("token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_invite_token"("token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_invite_token"("token" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."low_stock_items" TO "anon";
GRANT ALL ON TABLE "public"."low_stock_items" TO "authenticated";
GRANT ALL ON TABLE "public"."low_stock_items" TO "service_role";



GRANT ALL ON TABLE "public"."sale_items" TO "anon";
GRANT ALL ON TABLE "public"."sale_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sale_items" TO "service_role";



GRANT ALL ON TABLE "public"."product_performance" TO "anon";
GRANT ALL ON TABLE "public"."product_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."product_performance" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sales_transaction_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sales_transaction_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sales_transaction_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stock_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."stock_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."stock_valuation" TO "anon";
GRANT ALL ON TABLE "public"."stock_valuation" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_valuation" TO "service_role";



GRANT ALL ON TABLE "public"."user_invitations" TO "anon";
GRANT ALL ON TABLE "public"."user_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_invitations" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































