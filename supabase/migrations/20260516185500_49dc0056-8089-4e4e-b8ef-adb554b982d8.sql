
CREATE OR REPLACE FUNCTION public.gen_order_number()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n text;
BEGIN
  n := 'ATR-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random()*100000))::int::text, 5, '0');
  RETURN n;
END $$;
