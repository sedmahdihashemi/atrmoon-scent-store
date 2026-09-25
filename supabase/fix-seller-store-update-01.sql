-- =====================================================================
-- اصلاح باگ قدیمی: فروشنده‌های تأییدشده نمی‌توانستند تنظیمات فروشگاه را
-- ذخیره کنند، چون WITH CHECK قدیمی هر آپدیتی را که نتیجه‌اش status='approved'
-- باشد رد می‌کرد (که همیشه همین‌طور است، چون status عوض نمی‌شود).
--
-- راه‌حل: چون کاربر ادمین و فروشنده هر دو با یک نقش مشترک پستگرس
-- (authenticated) وصل می‌شوند (نه نقش‌های جدا)، محدودکردن در سطح GRANT
-- ستون امکان ندارد (باعث می‌شد ادمین هم نتواند وضعیت فروشگاه را عوض کند).
-- به‌جایش از یک trigger استفاده می‌شود که مقدار قدیم و جدید status را
-- واقعاً مقایسه می‌کند و فقط اگر تغییر کرده و کاربر super_admin نباشد،
-- رد می‌کند.
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS stores_seller_update_own ON public.stores;
CREATE POLICY stores_seller_update_own ON public.stores
FOR UPDATE TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

CREATE OR REPLACE FUNCTION public.prevent_seller_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'only a super admin can change store status';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_seller_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_seller_status_change ON public.stores;
CREATE TRIGGER trg_prevent_seller_status_change
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.prevent_seller_status_change();

COMMIT;

-- =====================================================================
-- پایان
-- =====================================================================
