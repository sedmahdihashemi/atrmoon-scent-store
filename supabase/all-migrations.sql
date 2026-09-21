-- =====================================================================
-- عطرمون — فایل ترکیبی همه‌ی migrationها برای اجرای یک‌باره در SQL Editor
-- ساخته‌شده از ۱۶ فایل داخل supabase/migrations/ به ترتیب زمانی.
--
-- تغییرات نسبت به فایل‌های اصلی:
--  - فایل 20260528131151_email_infra.sql حذف شد چون دقیقاً کپی
--    20260528131138_email_infra.sql بود (idempotent، تکرارش لازم نیست).
--  - از داخل email_infra.sql: ساخت اکستنشن‌های pg_cron / pg_net /
--    supabase_vault / pgmq، صف‌های pgmq، و ۴ تابع کمکی صف ایمیل
--    (enqueue_email / read_email_batch / delete_email / move_to_dlq)
--    حذف شدند چون به اکستنشن pgmq نیاز دارند که ممکن است روی پروژه‌ی
--    جدید فعال نباشد و کل اسکریپت را در همان نقطه متوقف کند. جدول‌های
--    خودِ سیستم ایمیل نگه داشته شدند (بی‌خطرند، فقط فعلاً بلااستفاده).
--  - در migration بعدی (20260528132509) چهار خط ALTER FUNCTION که به
--    همان ۴ تابع حذف‌شده اشاره می‌کردند هم حذف شدند.
-- =====================================================================


-- #####################################################################
-- # 1) 20260516184201 — ساختار اصلی: enumها، جدول‌ها، توابع نقش، RLS، seed
-- #####################################################################

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'seller', 'customer');
CREATE TYPE public.user_status AS ENUM ('active', 'pending', 'blocked');
CREATE TYPE public.store_status AS ENUM ('pending', 'approved', 'rejected', 'disabled');
CREATE TYPE public.product_status AS ENUM ('draft', 'active', 'inactive', 'out_of_stock');
CREATE TYPE public.variant_status AS ENUM ('active', 'inactive', 'out_of_stock');
CREATE TYPE public.product_gender AS ENUM ('male', 'female', 'unisex');
CREATE TYPE public.product_concentration AS ENUM ('edt', 'edp', 'parfum', 'extrait', 'cologne');
CREATE TYPE public.scent_note_type AS ENUM ('top', 'middle', 'base', 'general');
CREATE TYPE public.order_status AS ENUM (
  'pending_contact','confirmed_by_seller','preparing','shipped','completed','cancelled','rejected_by_seller'
);
CREATE TYPE public.email_status AS ENUM ('sent', 'failed');
CREATE TYPE public.notification_type AS ENUM ('order', 'store', 'inventory', 'system');
CREATE TYPE public.review_status AS ENUM ('pending', 'approved', 'rejected');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT,
  status public.user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- has_role security definer to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- get primary role (lowest privilege ordering for routing): super_admin > seller > customer
CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'seller' THEN 2
    WHEN 'customer' THEN 3
  END
  LIMIT 1
$$;

-- ============ STORES ============
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  city TEXT,
  address TEXT,
  support_phone TEXT,
  support_email TEXT NOT NULL,
  whatsapp_number TEXT,
  instagram_url TEXT,
  telegram_id TEXT,
  status public.store_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stores_seller ON public.stores(seller_id);
CREATE INDEX idx_stores_status ON public.stores(status);

-- ============ REFERENCE TABLES ============
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.scent_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.scent_note_type NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bottle_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  volume_ml INTEGER NOT NULL,
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  gender public.product_gender NOT NULL DEFAULT 'unisex',
  concentration public.product_concentration NOT NULL DEFAULT 'edp',
  main_image_url TEXT,
  status public.product_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_store ON public.products(store_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_brand ON public.products(brand_id);
CREATE INDEX idx_products_category ON public.products(category_id);

CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.product_scent_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  scent_note_id UUID NOT NULL REFERENCES public.scent_notes(id) ON DELETE CASCADE,
  UNIQUE(product_id, scent_note_id)
);

CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  bottle_type_id UUID NOT NULL REFERENCES public.bottle_types(id) ON DELETE RESTRICT,
  volume_ml INTEGER NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  discount_price NUMERIC(12,2),
  sku TEXT,
  status public.variant_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_variants_product ON public.product_variants(product_id);

CREATE TABLE public.product_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  total_stock_ml INTEGER NOT NULL DEFAULT 0,
  reserved_stock_ml INTEGER NOT NULL DEFAULT 0,
  available_stock_ml INTEGER NOT NULL DEFAULT 0,
  low_stock_alert_ml INTEGER NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

-- ============ CARTS ============
CREATE TABLE public.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_carts_customer ON public.carts(customer_id);
CREATE INDEX idx_carts_session ON public.carts(session_id);

CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ ADDRESSES ============
CREATE TABLE public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  postal_code TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT,
  total_amount NUMERIC(12,2) NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending_contact',
  seller_note TEXT,
  customer_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_store ON public.orders(store_id);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  brand_name TEXT,
  volume_ml INTEGER NOT NULL,
  bottle_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ EMAIL LOGS / NOTIFICATIONS / AUDIT ============
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status public.email_status NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'system',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);

CREATE TABLE public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  status public.review_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ TRIGGER: handle_new_user ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_full_name TEXT;
  v_phone TEXT;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'customer');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_phone := NEW.raw_user_meta_data->>'phone';

  INSERT INTO public.profiles (id, full_name, email, phone, status)
  VALUES (NEW.id, v_full_name, NEW.email, v_phone, 'active');

  -- never trust frontend for super_admin: ignore any super_admin requests at signup
  IF v_role = 'super_admin' THEN
    v_role := 'customer';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ TRIGGER: updated_at ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'profiles','stores','brands','categories','scent_notes','bottle_types',
    'products','product_variants','carts','cart_items','customer_addresses',
    'orders','reviews'
  ])
  LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);
  END LOOP;
END$$;

-- ============ ENABLE RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scent_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bottle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_scent_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- user_roles: only admin manages; users can view own
CREATE POLICY "roles_self_view" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- stores
CREATE POLICY "stores_public_approved" ON public.stores FOR SELECT USING (status = 'approved');
CREATE POLICY "stores_seller_own" ON public.stores FOR SELECT TO authenticated USING (seller_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "stores_seller_insert" ON public.stores FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid() AND public.has_role(auth.uid(),'seller'));
CREATE POLICY "stores_seller_update_own" ON public.stores FOR UPDATE TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid() AND status NOT IN ('approved','disabled','rejected'));
CREATE POLICY "stores_admin_all" ON public.stores FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- brands / categories / scent_notes / bottle_types - public read, admin manage
CREATE POLICY "brands_public_read" ON public.brands FOR SELECT USING (true);
CREATE POLICY "brands_admin_all" ON public.brands FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "cat_public_read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "cat_admin_all" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "notes_public_read" ON public.scent_notes FOR SELECT USING (true);
CREATE POLICY "notes_admin_all" ON public.scent_notes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "bottle_public_read" ON public.bottle_types FOR SELECT USING (true);
CREATE POLICY "bottle_admin_all" ON public.bottle_types FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- products
CREATE POLICY "products_public_active" ON public.products FOR SELECT USING (
  status = 'active' AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.status = 'approved')
);
CREATE POLICY "products_seller_own" ON public.products FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid())
  OR public.has_role(auth.uid(),'super_admin')
);
CREATE POLICY "products_seller_manage" ON public.products FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid() AND s.status = 'approved')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid() AND s.status = 'approved')
);
CREATE POLICY "products_admin_all" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- product_images
CREATE POLICY "pimg_public_read" ON public.product_images FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id=p.store_id
          WHERE p.id = product_id AND p.status='active' AND s.status='approved')
);
CREATE POLICY "pimg_seller_manage" ON public.product_images FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id=p.store_id
          WHERE p.id = product_id AND s.seller_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id=p.store_id
          WHERE p.id = product_id AND s.seller_id = auth.uid())
);
CREATE POLICY "pimg_admin_all" ON public.product_images FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- product_scent_notes
CREATE POLICY "psn_public_read" ON public.product_scent_notes FOR SELECT USING (true);
CREATE POLICY "psn_seller_manage" ON public.product_scent_notes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id=p.store_id
          WHERE p.id = product_id AND s.seller_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id=p.store_id
          WHERE p.id = product_id AND s.seller_id = auth.uid())
);
CREATE POLICY "psn_admin_all" ON public.product_scent_notes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- product_variants
CREATE POLICY "pv_public_read" ON public.product_variants FOR SELECT USING (
  status='active' AND EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id=p.store_id
                              WHERE p.id = product_id AND p.status='active' AND s.status='approved')
);
CREATE POLICY "pv_seller_manage" ON public.product_variants FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id=p.store_id
          WHERE p.id = product_id AND s.seller_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id=p.store_id
          WHERE p.id = product_id AND s.seller_id = auth.uid())
);
CREATE POLICY "pv_admin_all" ON public.product_variants FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- product_inventory
CREATE POLICY "inv_public_read_avail" ON public.product_inventory FOR SELECT USING (true);
CREATE POLICY "inv_seller_manage" ON public.product_inventory FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid())
);
CREATE POLICY "inv_admin_all" ON public.product_inventory FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- carts (guest + customer)
CREATE POLICY "carts_owner_all" ON public.carts FOR ALL USING (
  (customer_id IS NOT NULL AND customer_id = auth.uid())
  OR (customer_id IS NULL AND session_id IS NOT NULL)
) WITH CHECK (
  (customer_id IS NOT NULL AND customer_id = auth.uid())
  OR (customer_id IS NULL AND session_id IS NOT NULL)
);

CREATE POLICY "cart_items_owner_all" ON public.cart_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND (
    (c.customer_id IS NOT NULL AND c.customer_id = auth.uid())
    OR (c.customer_id IS NULL AND c.session_id IS NOT NULL)
  ))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND (
    (c.customer_id IS NOT NULL AND c.customer_id = auth.uid())
    OR (c.customer_id IS NULL AND c.session_id IS NOT NULL)
  ))
);

-- customer_addresses
CREATE POLICY "addr_own_all" ON public.customer_addresses FOR ALL TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "addr_admin_all" ON public.customer_addresses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- orders (customer reads own, seller reads own store's, admin all)
CREATE POLICY "orders_customer_own" ON public.orders FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "orders_seller_store" ON public.orders FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid())
);
CREATE POLICY "orders_seller_update" ON public.orders FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid())
);
CREATE POLICY "orders_admin_all" ON public.orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
-- Insert orders only via edge function (service role bypasses RLS). No client insert policy.

-- order_items
CREATE POLICY "oi_customer_own" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
);
CREATE POLICY "oi_seller" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o JOIN public.stores s ON s.id = o.store_id WHERE o.id = order_id AND s.seller_id = auth.uid())
);
CREATE POLICY "oi_admin" ON public.order_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- order_status_history
CREATE POLICY "osh_customer_own" ON public.order_status_history FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
);
CREATE POLICY "osh_seller" ON public.order_status_history FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o JOIN public.stores s ON s.id = o.store_id WHERE o.id = order_id AND s.seller_id = auth.uid())
);
CREATE POLICY "osh_seller_insert" ON public.order_status_history FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o JOIN public.stores s ON s.id = o.store_id WHERE o.id = order_id AND s.seller_id = auth.uid())
  AND changed_by_user_id = auth.uid()
);
CREATE POLICY "osh_admin" ON public.order_status_history FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- email_logs: admin + seller for own store
CREATE POLICY "el_seller" ON public.email_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid())
);
CREATE POLICY "el_admin" ON public.email_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- notifications: owner
CREATE POLICY "notif_own" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

-- wishlists
CREATE POLICY "wish_own" ON public.wishlists FOR ALL TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

-- reviews
CREATE POLICY "reviews_public_approved" ON public.reviews FOR SELECT USING (status='approved');
CREATE POLICY "reviews_own_select" ON public.reviews FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "reviews_own_insert" ON public.reviews FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "reviews_own_update" ON public.reviews FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "reviews_admin_all" ON public.reviews FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- audit_logs: admin only
CREATE POLICY "audit_admin_all" ON public.audit_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- ============ SEED REFERENCE DATA ============
INSERT INTO public.bottle_types (name, volume_ml, description) VALUES
  ('شیشه ساده', 10, 'بطری ساده ۱۰ میلی‌لیتری'),
  ('اسپری استاندارد', 25, 'بطری اسپری ۲۵ میلی‌لیتری'),
  ('اسپری بزرگ', 50, 'بطری اسپری ۵۰ میلی‌لیتری'),
  ('لوکس', 100, 'بطری لوکس ۱۰۰ میلی‌لیتری');

INSERT INTO public.categories (name, slug, description) VALUES
  ('مردانه','men','عطرهای مردانه'),
  ('زنانه','women','عطرهای زنانه'),
  ('یونیسکس','unisex','عطرهای یونیسکس'),
  ('نیش','niche','عطرهای نیش'),
  ('اقتصادی','economic','عطرهای اقتصادی'),
  ('لوکس','luxury','عطرهای لوکس');

INSERT INTO public.scent_notes (name, type) VALUES
  ('برگاموت','top'),('لیمو','top'),('گریپ‌فروت','top'),
  ('گل رز','middle'),('یاسمن','middle'),('اسطوخودوس','middle'),
  ('چوب صندل','base'),('عنبر','base'),('مشک','base'),('وانیل','base');


-- #####################################################################
-- # 2) 20260516184213 — اصلاح search_path و محدودکردن دسترسی توابع
-- #####################################################################

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.get_primary_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_primary_role(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- #####################################################################
-- # 3) 20260516185449 — تابع ثبت سفارش (place_order)
-- #####################################################################

CREATE OR REPLACE FUNCTION public.gen_order_number()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE n text;
BEGIN
  n := 'ATR-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random()*100000))::int::text, 5, '0');
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.place_order(
  p_cart_id uuid,
  p_session_id text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_shipping_address text,
  p_city text,
  p_postal_code text,
  p_customer_note text
)
RETURNS TABLE(order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart record;
  v_uid uuid := auth.uid();
  v_store_id uuid;
  v_total numeric(12,2) := 0;
  v_order_id uuid;
  v_order_number text;
  v_item record;
BEGIN
  SELECT * INTO v_cart FROM carts WHERE id = p_cart_id;
  IF v_cart IS NULL THEN RAISE EXCEPTION 'cart_not_found'; END IF;

  IF v_uid IS NOT NULL AND v_cart.customer_id IS NOT NULL AND v_cart.customer_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_cart.customer_id IS NULL AND (p_session_id IS NULL OR p_session_id <> v_cart.session_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_store_id := v_cart.store_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'empty_cart'; END IF;

  IF NOT EXISTS (SELECT 1 FROM cart_items WHERE cart_id = p_cart_id) THEN
    RAISE EXCEPTION 'empty_cart';
  END IF;

  FOR v_item IN
    SELECT ci.quantity, pv.volume_ml, pv.price, pv.discount_price, pv.id as variant_id,
           p.id as product_id, p.name as product_name, b.name as brand_name, bt.name as bottle_name
    FROM cart_items ci
    JOIN product_variants pv ON pv.id = ci.product_variant_id
    JOIN products p ON p.id = ci.product_id
    JOIN bottle_types bt ON bt.id = pv.bottle_type_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE ci.cart_id = p_cart_id
  LOOP
    PERFORM 1 FROM product_inventory
      WHERE product_id = v_item.product_id
        AND available_stock_ml >= (v_item.quantity * v_item.volume_ml)
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient_stock:%', v_item.product_name;
    END IF;
    v_total := v_total + (COALESCE(v_item.discount_price, v_item.price) * v_item.quantity);
  END LOOP;

  v_order_number := gen_order_number();
  INSERT INTO orders (
    customer_id, store_id, order_number, customer_name, customer_email,
    customer_phone, shipping_address, city, postal_code, total_amount,
    status, customer_note
  ) VALUES (
    v_uid, v_store_id, v_order_number, p_customer_name, p_customer_email,
    p_customer_phone, p_shipping_address, p_city, p_postal_code, v_total,
    'pending_contact', p_customer_note
  ) RETURNING id INTO v_order_id;

  FOR v_item IN
    SELECT ci.quantity, pv.volume_ml, pv.price, pv.discount_price, pv.id as variant_id,
           p.id as product_id, p.name as product_name, b.name as brand_name, bt.name as bottle_name
    FROM cart_items ci
    JOIN product_variants pv ON pv.id = ci.product_variant_id
    JOIN products p ON p.id = ci.product_id
    JOIN bottle_types bt ON bt.id = pv.bottle_type_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE ci.cart_id = p_cart_id
  LOOP
    INSERT INTO order_items (
      order_id, product_id, product_variant_id, product_name, brand_name,
      volume_ml, bottle_name, quantity, unit_price, total_price
    ) VALUES (
      v_order_id, v_item.product_id, v_item.variant_id, v_item.product_name, v_item.brand_name,
      v_item.volume_ml, v_item.bottle_name, v_item.quantity,
      COALESCE(v_item.discount_price, v_item.price),
      COALESCE(v_item.discount_price, v_item.price) * v_item.quantity
    );

    UPDATE product_inventory
       SET available_stock_ml = available_stock_ml - (v_item.quantity * v_item.volume_ml),
           reserved_stock_ml = reserved_stock_ml + (v_item.quantity * v_item.volume_ml),
           updated_at = now()
     WHERE product_id = v_item.product_id;
  END LOOP;

  BEGIN
    INSERT INTO order_status_history (order_id, status, note)
    VALUES (v_order_id, 'pending_contact', 'سفارش ثبت شد');
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  DELETE FROM cart_items WHERE cart_id = p_cart_id;
  UPDATE carts SET store_id = NULL, updated_at = now() WHERE id = p_cart_id;

  -- NOTE: this insert references an email_logs.payload column and a 'queued'
  -- status that don't exist in this schema. It's intentionally left as-is
  -- (matches the original migration) — it silently no-ops via the
  -- undefined_column exception handler above and does not affect order placement.
  BEGIN
    INSERT INTO email_logs (order_id, recipient_email, subject, status, payload)
    SELECT v_order_id, s.support_email,
           'سفارش تازه — ' || v_order_number,
           'queued',
           jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number)
    FROM stores s WHERE s.id = v_store_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  RETURN QUERY SELECT v_order_id, v_order_number;
END $$;

GRANT EXECUTE ON FUNCTION public.place_order(uuid,text,text,text,text,text,text,text,text) TO anon, authenticated;


-- #####################################################################
-- # 4) 20260516185500 — بازتعریف gen_order_number با search_path
-- #####################################################################

CREATE OR REPLACE FUNCTION public.gen_order_number()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n text;
BEGIN
  n := 'ATR-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random()*100000))::int::text, 5, '0');
  RETURN n;
END $$;


-- #####################################################################
-- # 5) 20260522105359 — جلسه‌های ربات بله (bot_sessions)
-- #####################################################################

CREATE TABLE public.bot_sessions (
  chat_id BIGINT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'idle',
  state_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_sessions_user_id ON public.bot_sessions(user_id);

ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_sessions_admin_all"
  ON public.bot_sessions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE TRIGGER trg_bot_sessions_updated_at
  BEFORE UPDATE ON public.bot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- #####################################################################
-- # 6) 20260528075215 — Storage bucket برای عکس محصولات
-- #####################################################################

INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "product_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "product_images_seller_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "product_images_seller_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "product_images_seller_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);


-- #####################################################################
-- # 7) 20260528075725 — اجازه‌ی ثبت رایحه توسط فروشنده
-- #####################################################################

CREATE POLICY "notes_seller_insert" ON public.scent_notes FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'seller'::app_role));


-- #####################################################################
-- # 8) 20260528113629 — سخت‌گیری روی سبد خرید مهمان + محدودکردن توابع
-- #####################################################################

DROP POLICY IF EXISTS carts_owner_all ON public.carts;
CREATE POLICY carts_owner_all ON public.carts
FOR ALL
USING (
  (customer_id IS NOT NULL AND customer_id = auth.uid())
  OR (customer_id IS NULL AND session_id IS NOT NULL
      AND session_id = nullif(current_setting('request.headers', true)::json->>'x-cart-session', ''))
)
WITH CHECK (
  (customer_id IS NOT NULL AND customer_id = auth.uid())
  OR (customer_id IS NULL AND session_id IS NOT NULL
      AND session_id = nullif(current_setting('request.headers', true)::json->>'x-cart-session', ''))
);

DROP POLICY IF EXISTS cart_items_owner_all ON public.cart_items;
CREATE POLICY cart_items_owner_all ON public.cart_items
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.carts c
  WHERE c.id = cart_items.cart_id
    AND ((c.customer_id IS NOT NULL AND c.customer_id = auth.uid())
      OR (c.customer_id IS NULL AND c.session_id IS NOT NULL
          AND c.session_id = nullif(current_setting('request.headers', true)::json->>'x-cart-session', '')))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.carts c
  WHERE c.id = cart_items.cart_id
    AND ((c.customer_id IS NOT NULL AND c.customer_id = auth.uid())
      OR (c.customer_id IS NULL AND c.session_id IS NOT NULL
          AND c.session_id = nullif(current_setting('request.headers', true)::json->>'x-cart-session', '')))
));

DROP POLICY IF EXISTS inv_public_read_avail ON public.product_inventory;
CREATE POLICY inv_public_read_avail ON public.product_inventory
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_inventory.product_id
      AND p.status = 'active'
      AND s.status = 'approved'
  )
);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_order_number() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
CREATE POLICY product_images_seller_list ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- #####################################################################
-- # 9) 20260528130005 — محدودکردن اطلاعات تماس فروشگاه از anon
-- #####################################################################

DROP POLICY IF EXISTS psn_public_read ON public.product_scent_notes;

CREATE POLICY psn_public_read
ON public.product_scent_notes
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_scent_notes.product_id
      AND p.status = 'active'::product_status
      AND s.status = 'approved'::store_status
  )
);

REVOKE SELECT ON public.stores FROM anon;

GRANT SELECT (
  id,
  store_name,
  slug,
  description,
  logo_url,
  city,
  instagram_url,
  status,
  created_at,
  updated_at
) ON public.stores TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;


-- #####################################################################
-- # 10) 20260528131138 — زیرساخت ایمیل (فقط بخش‌های امن، بدون pg_cron/vault/pgmq)
-- #####################################################################

CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT ALL ON public.email_send_state TO service_role;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

GRANT ALL ON public.suppressed_emails TO service_role;

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- (فایل تکراری 20260528131151_email_infra.sql عمداً حذف شد — دقیقاً همین بود)


-- #####################################################################
-- # 11) 20260528132509 — اصلاح دسترسی anon به موجودی
-- #####################################################################

DROP POLICY IF EXISTS inv_public_read_avail ON public.product_inventory;

REVOKE SELECT ON public.product_inventory FROM anon;
GRANT SELECT (product_id, available_stock_ml) ON public.product_inventory TO anon;

CREATE POLICY inv_public_read_avail ON public.product_inventory
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_inventory.product_id
      AND p.status = 'active'::product_status
      AND s.status = 'approved'::store_status
  )
);

-- (چهار خط ALTER FUNCTION مربوط به توابع صف ایمیل که در بخش ۱۰ حذف شدند، عمداً کنار گذاشته شد)


-- #####################################################################
-- # 12) 20260528145354 — آمار wishlist برای فروشنده
-- #####################################################################

CREATE OR REPLACE FUNCTION public.seller_wishlist_stats(p_store_id uuid)
RETURNS TABLE(product_id uuid, product_name text, wishlist_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, COUNT(w.id)::bigint AS wishlist_count
  FROM public.products p
  LEFT JOIN public.wishlists w ON w.product_id = p.id
  WHERE p.store_id = p_store_id
    AND (
      EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p.store_id AND s.seller_id = auth.uid())
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  GROUP BY p.id, p.name
  ORDER BY wishlist_count DESC, p.name
$$;

GRANT EXECUTE ON FUNCTION public.seller_wishlist_stats(uuid) TO authenticated;


-- #####################################################################
-- # 13) 20260528150250 — محصولات پرفروش
-- #####################################################################

CREATE OR REPLACE FUNCTION public.top_selling_products(p_limit integer DEFAULT 8)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  main_image_url text,
  store_id uuid,
  store_name text,
  brand_name text,
  min_price numeric,
  cheapest_variant_id uuid,
  sold_qty bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sales AS (
    SELECT oi.product_id, SUM(oi.quantity)::bigint AS sold_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  ),
  cheap AS (
    SELECT DISTINCT ON (pv.product_id)
      pv.product_id, pv.id AS variant_id,
      COALESCE(pv.discount_price, pv.price) AS price
    FROM product_variants pv
    WHERE pv.status = 'active'
    ORDER BY pv.product_id, COALESCE(pv.discount_price, pv.price) ASC
  )
  SELECT p.id, p.slug, p.name, p.main_image_url, p.store_id,
         s.store_name, b.name AS brand_name,
         c.price AS min_price, c.variant_id AS cheapest_variant_id,
         COALESCE(sa.sold_qty, 0) AS sold_qty
  FROM products p
  LEFT JOIN sales sa ON sa.product_id = p.id
  LEFT JOIN cheap c ON c.product_id = p.id
  LEFT JOIN stores s ON s.id = p.store_id
  LEFT JOIN brands b ON b.id = p.brand_id
  WHERE p.status = 'active' AND c.variant_id IS NOT NULL
  ORDER BY COALESCE(sa.sold_qty, 0) DESC, p.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.top_selling_products(integer) TO anon, authenticated, service_role;


-- #####################################################################
-- # 14) 20260529143356 — محدودکردن ستون‌های نظرات (reviews)
-- #####################################################################

REVOKE SELECT (customer_id, order_id) ON public.reviews FROM anon;
REVOKE SELECT (customer_id, order_id) ON public.reviews FROM authenticated;

GRANT SELECT (id, product_id, rating, comment, status, created_at, updated_at) ON public.reviews TO anon;
GRANT SELECT (id, product_id, rating, comment, status, created_at, updated_at) ON public.reviews TO authenticated;

GRANT ALL ON public.reviews TO service_role;


-- #####################################################################
-- # 15) 20260728205800 — دسترسی موجودی برای کاربران وارد‌شده
-- #####################################################################

CREATE POLICY inv_public_read_avail_auth ON public.product_inventory FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM products p JOIN stores s ON s.id = p.store_id WHERE p.id = product_inventory.product_id AND p.status = 'active' AND s.status = 'approved'));
GRANT SELECT ON public.product_inventory TO authenticated;

-- =====================================================================
-- پایان فایل
-- =====================================================================
