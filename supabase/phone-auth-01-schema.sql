BEGIN;

-- Three of your own test accounts currently share the same real phone
-- number (09912525873): the admin/customer account, and two seller test
-- accounts. Since phone is about to become a login identifier, it must be
-- unique per account. You chose to keep it on the admin/customer account;
-- the other two just lose the phone value (they still log in fine with
-- email+password, and can set a phone from account settings later).
UPDATE public.profiles SET phone = NULL WHERE id IN (
  'fad5858c-377e-4247-84d3-a9abf5479b73', -- 3edmahdihashemi@gmail.com (seller test)
  '72cdecc4-ee80-41bb-a7b4-4fc255202fa2'  -- 3edmahdihashemijob@gmail.com (seller test)
);

-- This one (33196384) isn't a valid Iranian mobile number at all — clear it
-- too so the format check below doesn't reject it.
UPDATE public.profiles SET phone = NULL WHERE id = 'abeda307-380a-4287-aa5e-2805d9c24c63';

-- Normalize whatever's left to a strict 09XXXXXXXXX shape (strip
-- formatting, fold +98/0098/98 prefixes) so the CHECK constraint below
-- doesn't reject legitimate existing values.
UPDATE public.profiles
SET phone = regexp_replace(phone, '\D', '', 'g')
WHERE phone IS NOT NULL;

UPDATE public.profiles
SET phone = '0' || substring(phone from 3)
WHERE phone ~ '^989\d{9}$';

UPDATE public.profiles
SET phone = '0' || phone
WHERE phone ~ '^9\d{9}$';

-- Anything that still doesn't match a real mobile number after normalizing
-- (e.g. leftover junk/test values) gets cleared rather than blocking this
-- migration.
UPDATE public.profiles
SET phone = NULL
WHERE phone IS NOT NULL AND phone !~ '^09\d{9}$';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_format_check
  CHECK (phone IS NULL OR phone ~ '^09\d{9}$');

CREATE UNIQUE INDEX profiles_phone_unique_idx
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

COMMIT;
