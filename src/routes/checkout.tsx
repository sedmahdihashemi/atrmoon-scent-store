import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { EmptyState, LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { formatToman, getOrCreateCartSession } from "@/lib/cart-session";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { notifyOrder } from "@/lib/bale-notify.functions";
import { toast } from "sonner";
import { ShoppingBag, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/checkout")({ component: CheckoutPage });

function CheckoutPage() {
  const { items, loading, subtotal, cartId, resetAfterCheckout } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ number: string } | null>(null);
  const notify = useServerFn(notifyOrder);

  const [form, setForm] = useState({
    customer_name: "", customer_phone: "", customer_email: "",
    shipping_address: "", city: "", postal_code: "", customer_note: "",
  });
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string>("");
  const [useNew, setUseNew] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        customer_name: f.customer_name || profile.full_name || "",
        customer_phone: f.customer_phone || profile.phone || "",
        customer_email: f.customer_email || user?.email || "",
      }));
    } else if (user?.email) {
      setForm((f) => ({ ...f, customer_email: f.customer_email || user.email || "" }));
    }
  }, [profile, user]);

  useEffect(() => {
    if (!user) { setAddresses([]); return; }
    (async () => {
      const { data } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("customer_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      const list = data ?? [];
      setAddresses(list);
      if (list.length && !selectedAddrId) {
        const def = list.find((a: any) => a.is_default) ?? list[0];
        applyAddress(def);
        setSelectedAddrId(def.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const applyAddress = (a: any) => {
    setForm((f) => ({
      ...f,
      customer_name: a.full_name || f.customer_name,
      customer_phone: a.phone || f.customer_phone,
      shipping_address: a.address || "",
      city: a.city || "",
      postal_code: a.postal_code || "",
    }));
  };

  if (loading) return <PublicLayout><LoadingState /></PublicLayout>;

  if (success) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-20 max-w-xl text-center">
          <CheckCircle2 className="w-14 h-14 text-[var(--gold)] mx-auto mb-4" />
          <h1 className="font-serif text-3xl text-ink mb-3">سفارش شما ثبت شد</h1>
          <p className="text-muted-foreground font-serif">شماره سفارش</p>
          <p className="font-serif text-2xl text-[var(--gold)] mt-1 tracking-wider">{success.number}</p>
          <p className="mt-6 text-ink/80 leading-loose font-serif text-[15px]">
            فروشنده‌ی این رایحه به‌زودی با شما تماس می‌گیرد تا جزئیات ارسال و پرداخت را هماهنگ کند.
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            {user ? <Link to="/account"><Button variant="outline">پیگیری در حساب من</Button></Link> : null}
            <Link to="/products"><Button>کشف رایحه‌های دیگر</Button></Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (items.length === 0) {
    return (
      <PublicLayout>
        <div className="container mx-auto px-4 py-16">
          <EmptyState title="سبد خالی‌ست" message="ابتدا رایحه‌ای را به سبد بیفزایید." icon={<ShoppingBag className="w-8 h-8" />} />
          <div className="mt-6 text-center"><Link to="/products"><Button>کشف رایحه‌ها</Button></Link></div>
        </div>
      </PublicLayout>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartId) { toast.error("سبد یافت نشد"); return; }
    if (!form.customer_name.trim() || !form.customer_phone.trim() || !form.shipping_address.trim() || !form.city.trim()) {
      toast.error("لطفاً نام، تلفن، نشانی و شهر را تکمیل کنید"); return;
    }
    setSubmitting(true);
    // Always send the session id if available — handles the case where the cart
    // was created as a guest and the user logged in afterwards (customer_id is null).
    const session = getOrCreateCartSession();
    const { data, error } = await supabase.rpc("place_order", {
      p_cart_id: cartId,
      p_session_id: session,
      p_customer_name: form.customer_name.trim(),
      p_customer_phone: form.customer_phone.trim(),
      p_customer_email: form.customer_email.trim() || null,
      p_shipping_address: form.shipping_address.trim(),
      p_city: form.city.trim(),
      p_postal_code: form.postal_code.trim() || null,
      p_customer_note: form.customer_note.trim() || null,
    } as any);
    setSubmitting(false);
    if (error) {
      const msg = error.message?.includes("insufficient_stock") ? "موجودی کافی نیست" : error.message || "خطا در ثبت سفارش";
      toast.error(msg);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.order_number) {
      setSuccess({ number: row.order_number });
      resetAfterCheckout();
      if (row?.order_id) {
        notify({ data: { orderId: row.order_id } }).catch((e) => console.error("notify failed", e));
      }
    } else {
      toast.error("پاسخی از سرور دریافت نشد");
    }
  };

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <h1 className="font-serif text-3xl md:text-4xl text-ink mb-2">تسویه و ثبت سفارش</h1>
        <p className="text-muted-foreground font-serif italic mb-8">پس از ثبت، فروشنده برای هماهنگی پرداخت و ارسال با شما تماس می‌گیرد.</p>
        <form onSubmit={submit} className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 paper-card rounded-md p-6 space-y-4">
            <h2 className="font-serif text-lg text-ink mb-2">اطلاعات شما</h2>
            {addresses.length > 0 && !useNew && (
              <div className="space-y-2">
                <Label className="text-xs font-serif text-ink/80">انتخاب از آدرس‌های ذخیره‌شده</Label>
                <Select
                  value={selectedAddrId}
                  onValueChange={(v) => {
                    setSelectedAddrId(v);
                    const a = addresses.find((x) => x.id === v);
                    if (a) applyAddress(a);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="یک آدرس را انتخاب کنید" /></SelectTrigger>
                  <SelectContent>
                    {addresses.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.full_name} — {a.city}، {a.address.slice(0, 40)}{a.address.length > 40 ? "…" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button type="button" onClick={() => setUseNew(true)} className="text-xs text-[var(--gold)] underline font-serif">
                  استفاده از آدرس جدید
                </button>
              </div>
            )}
            {addresses.length > 0 && useNew && (
              <button type="button" onClick={() => {
                setUseNew(false);
                const a = addresses.find((x) => x.id === selectedAddrId) ?? addresses[0];
                if (a) { applyAddress(a); setSelectedAddrId(a.id); }
              }} className="text-xs text-[var(--gold)] underline font-serif">
                بازگشت به آدرس‌های ذخیره‌شده
              </button>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="نام و نام خانوادگی *"><Input value={form.customer_name} onChange={set("customer_name")} required /></Field>
              <Field label="شماره تماس *"><Input value={form.customer_phone} onChange={set("customer_phone")} required dir="ltr" /></Field>
              <Field label="ایمیل (اختیاری)"><Input type="email" value={form.customer_email} onChange={set("customer_email")} dir="ltr" /></Field>
              <Field label="شهر *"><Input value={form.city} onChange={set("city")} required /></Field>
              <div className="md:col-span-2">
                <Field label="نشانی کامل *"><Textarea value={form.shipping_address} onChange={set("shipping_address")} required rows={3} /></Field>
              </div>
              <Field label="کد پستی"><Input value={form.postal_code} onChange={set("postal_code")} dir="ltr" /></Field>
            </div>
            <Field label="یادداشت برای فروشنده (اختیاری)">
              <Textarea value={form.customer_note} onChange={set("customer_note")} rows={2} />
            </Field>
            {!user && (
              <p className="text-xs text-muted-foreground font-serif">
                به‌صورت مهمان ثبت سفارش می‌کنید. می‌توانید <Link to="/login" className="text-[var(--gold)] underline">وارد شوید</Link> تا سفارش‌هایتان در حسابتان نگه‌داری شود.
              </p>
            )}
          </div>
          <aside className="paper-card rounded-md p-6 h-fit lg:sticky lg:top-24">
            <h3 className="font-serif text-lg text-ink mb-4">جمع‌بندی سفارش</h3>
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {items.map((it) => (
                <div key={it.id} className="flex justify-between text-sm text-ink/80">
                  <span className="truncate">{it.product.name} × {it.quantity.toLocaleString("fa-IR")}</span>
                  <span className="shrink-0">{formatToman(Number(it.variant?.discount_price ?? it.variant?.price ?? 0) * it.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="ink-divider my-5" />
            <div className="flex justify-between font-serif text-base text-ink mb-5">
              <span>قابل پرداخت</span>
              <span className="text-[var(--gold)]">{formatToman(subtotal)}</span>
            </div>
            <Button type="submit" disabled={submitting} className="w-full h-11 font-serif">
              {submitting ? "در حال ثبت…" : "ثبت سفارش"}
            </Button>
          </aside>
        </form>
      </div>
    </PublicLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-serif text-ink/80 mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}