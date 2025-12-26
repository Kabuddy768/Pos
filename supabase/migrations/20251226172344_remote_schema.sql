drop trigger if exists "products_updated_at" on "public"."products";

drop trigger if exists "profiles_updated_at" on "public"."profiles";

drop trigger if exists "sale_items_update_stock" on "public"."sale_items";

drop trigger if exists "sales_transaction_number" on "public"."sales";

drop trigger if exists "invitations_updated_at" on "public"."user_invitations";

drop policy "Admins can view audit logs" on "public"."audit_logs";

drop policy "Admins can manage categories" on "public"."categories";

drop policy "Admins can delete products" on "public"."products";

drop policy "Admins can insert products" on "public"."products";

drop policy "Admins can update products" on "public"."products";

drop policy "Admins can view all products" on "public"."products";

drop policy "Admins can delete profiles" on "public"."profiles";

drop policy "Admins can insert profiles" on "public"."profiles";

drop policy "Admins can update profiles" on "public"."profiles";

drop policy "Admins can view all profiles" on "public"."profiles";

drop policy "Sellers can insert sale items" on "public"."sale_items";

drop policy "Users can view accessible sale items" on "public"."sale_items";

drop policy "Admins can manage sales" on "public"."sales";

drop policy "Admins can view all sales" on "public"."sales";

drop policy "Admins can manage suppliers" on "public"."suppliers";

drop policy "Admins can create invitations" on "public"."user_invitations";

drop policy "Admins can delete invitations" on "public"."user_invitations";

drop policy "Admins can update own invitations" on "public"."user_invitations";

drop policy "Admins can view all invitations" on "public"."user_invitations";

alter table "public"."audit_logs" drop constraint "audit_logs_user_id_fkey";

alter table "public"."products" drop constraint "products_category_id_fkey";

alter table "public"."products" drop constraint "products_supplier_id_fkey";

alter table "public"."profiles" drop constraint "profiles_invited_by_fkey";

alter table "public"."sale_items" drop constraint "sale_items_product_id_fkey";

alter table "public"."sale_items" drop constraint "sale_items_sale_id_fkey";

alter table "public"."sales" drop constraint "sales_seller_id_fkey";

alter table "public"."stock_adjustments" drop constraint "stock_adjustments_adjusted_by_fkey";

alter table "public"."stock_adjustments" drop constraint "stock_adjustments_product_id_fkey";

alter table "public"."user_invitations" drop constraint "user_invitations_invited_by_fkey";

alter table "public"."audit_logs" add constraint "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_user_id_fkey";

alter table "public"."products" add constraint "products_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL not valid;

alter table "public"."products" validate constraint "products_category_id_fkey";

alter table "public"."products" add constraint "products_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL not valid;

alter table "public"."products" validate constraint "products_supplier_id_fkey";

alter table "public"."profiles" add constraint "profiles_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_invited_by_fkey";

alter table "public"."sale_items" add constraint "sale_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) not valid;

alter table "public"."sale_items" validate constraint "sale_items_product_id_fkey";

alter table "public"."sale_items" add constraint "sale_items_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE not valid;

alter table "public"."sale_items" validate constraint "sale_items_sale_id_fkey";

alter table "public"."sales" add constraint "sales_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES public.profiles(id) not valid;

alter table "public"."sales" validate constraint "sales_seller_id_fkey";

alter table "public"."stock_adjustments" add constraint "stock_adjustments_adjusted_by_fkey" FOREIGN KEY (adjusted_by) REFERENCES public.profiles(id) not valid;

alter table "public"."stock_adjustments" validate constraint "stock_adjustments_adjusted_by_fkey";

alter table "public"."stock_adjustments" add constraint "stock_adjustments_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE not valid;

alter table "public"."stock_adjustments" validate constraint "stock_adjustments_product_id_fkey";

alter table "public"."user_invitations" add constraint "user_invitations_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."user_invitations" validate constraint "user_invitations_invited_by_fkey";

create or replace view "public"."low_stock_items" as  SELECT p.id,
    p.sku,
    p.name,
    p.quantity,
    p.reorder_point,
    c.name AS category_name,
    s.name AS supplier_name,
    p.purchase_price,
    p.selling_price
   FROM ((public.products p
     LEFT JOIN public.categories c ON ((p.category_id = c.id)))
     LEFT JOIN public.suppliers s ON ((p.supplier_id = s.id)))
  WHERE ((p.quantity <= p.reorder_point) AND (p.is_active = true))
  ORDER BY p.quantity;


create or replace view "public"."product_performance" as  SELECT p.id,
    p.sku,
    p.name,
    p.quantity,
    c.name AS category_name,
    COALESCE(count(si.id), (0)::bigint) AS times_sold,
    COALESCE(sum(si.quantity), (0)::bigint) AS total_quantity_sold,
    (COALESCE(sum(si.line_total), (0)::numeric))::numeric(10,2) AS total_revenue,
    (COALESCE(sum((si.line_total - (si.cost_price * (si.quantity)::numeric))), (0)::numeric))::numeric(10,2) AS total_profit
   FROM ((public.products p
     LEFT JOIN public.categories c ON ((p.category_id = c.id)))
     LEFT JOIN public.sale_items si ON ((p.id = si.product_id)))
  WHERE (p.is_active = true)
  GROUP BY p.id, p.sku, p.name, p.quantity, c.name
  ORDER BY ((COALESCE(sum(si.line_total), (0)::numeric))::numeric(10,2)) DESC;


create or replace view "public"."stock_valuation" as  SELECT (sum(((quantity)::numeric * purchase_price)))::numeric(10,2) AS cost_value,
    (sum(((quantity)::numeric * selling_price)))::numeric(10,2) AS retail_value,
    count(*) AS total_products,
    sum(quantity) AS total_units
   FROM public.products
  WHERE (is_active = true);



  create policy "Admins can view audit logs"
  on "public"."audit_logs"
  as permissive
  for select
  to authenticated
using (public.is_admin(auth.uid()));



  create policy "Admins can manage categories"
  on "public"."categories"
  as permissive
  for all
  to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));



  create policy "Admins can delete products"
  on "public"."products"
  as permissive
  for delete
  to authenticated
using (public.is_admin(auth.uid()));



  create policy "Admins can insert products"
  on "public"."products"
  as permissive
  for insert
  to authenticated
with check (public.is_admin(auth.uid()));



  create policy "Admins can update products"
  on "public"."products"
  as permissive
  for update
  to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));



  create policy "Admins can view all products"
  on "public"."products"
  as permissive
  for select
  to authenticated
using (public.is_admin(auth.uid()));



  create policy "Admins can delete profiles"
  on "public"."profiles"
  as permissive
  for delete
  to authenticated
using (public.is_admin(auth.uid()));



  create policy "Admins can insert profiles"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check (public.is_admin(auth.uid()));



  create policy "Admins can update profiles"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));



  create policy "Admins can view all profiles"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (public.is_admin(auth.uid()));



  create policy "Sellers can insert sale items"
  on "public"."sale_items"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.sales
  WHERE ((sales.id = sale_items.sale_id) AND (sales.seller_id = auth.uid())))));



  create policy "Users can view accessible sale items"
  on "public"."sale_items"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.sales
  WHERE ((sales.id = sale_items.sale_id) AND ((sales.seller_id = auth.uid()) OR public.is_admin(auth.uid()))))));



  create policy "Admins can manage sales"
  on "public"."sales"
  as permissive
  for update
  to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));



  create policy "Admins can view all sales"
  on "public"."sales"
  as permissive
  for select
  to authenticated
using (public.is_admin(auth.uid()));



  create policy "Admins can manage suppliers"
  on "public"."suppliers"
  as permissive
  for all
  to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));



  create policy "Admins can create invitations"
  on "public"."user_invitations"
  as permissive
  for insert
  to authenticated
with check ((public.is_admin(auth.uid()) AND (invited_by = auth.uid())));



  create policy "Admins can delete invitations"
  on "public"."user_invitations"
  as permissive
  for delete
  to authenticated
using (public.is_admin(auth.uid()));



  create policy "Admins can update own invitations"
  on "public"."user_invitations"
  as permissive
  for update
  to authenticated
using (((invited_by = auth.uid()) OR public.is_admin(auth.uid())))
with check (((invited_by = auth.uid()) OR public.is_admin(auth.uid())));



  create policy "Admins can view all invitations"
  on "public"."user_invitations"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER sale_items_update_stock AFTER INSERT ON public.sale_items FOR EACH ROW EXECUTE FUNCTION public.update_product_quantity_on_sale();

CREATE TRIGGER sales_transaction_number BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_transaction_number();

CREATE TRIGGER invitations_updated_at BEFORE UPDATE ON public.user_invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


