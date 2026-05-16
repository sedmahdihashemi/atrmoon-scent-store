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