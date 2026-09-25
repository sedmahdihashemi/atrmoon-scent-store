-- =====================================================================
-- بازگرداندن fix-seller-store-update-01.sql به حالت قبلی (همان حالتِ
-- دارای باگ که فروشنده‌های approved نمی‌توانستند ذخیره کنند).
-- فقط در صورت نیاز واقعی اجرا کنید.
-- =====================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_prevent_seller_status_change ON public.stores;
DROP FUNCTION IF EXISTS public.prevent_seller_status_change();

DROP POLICY IF EXISTS stores_seller_update_own ON public.stores;
CREATE POLICY stores_seller_update_own ON public.stores
FOR UPDATE TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid() AND status NOT IN ('approved','disabled','rejected'));

COMMIT;
