import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { loginWithPhone } from "@/lib/phone-login.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "ورود به حساب | عطرمون" },
      { name: "description", content: "ورود امن به حساب مشتری، فروشنده یا مدیر عطرمون." },
      { property: "og:title", content: "ورود به حساب | عطرمون" },
      { property: "og:description", content: "ورود امن به حساب کاربری عطرمون." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({ redirect: typeof s.redirect === "string" ? s.redirect : undefined }),
});

const emailSchema = z.object({
  email: z.string().email("ایمیل معتبر وارد کنید"),
  password: z.string().min(1, "رمز عبور را وارد کنید").max(72, "رمز عبور نمی‌تواند بیشتر از ۷۲ نویسه باشد"),
});

const phoneSchema = z.object({
  phone: z.string().trim().min(1, "شماره موبایل را وارد کنید"),
  password: z.string().min(1, "رمز عبور را وارد کنید").max(72, "رمز عبور نمی‌تواند بیشتر از ۷۲ نویسه باشد"),
});

function LoginPage() {
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fetchLoginWithPhone = useServerFn(loginWithPhone);

  async function afterLogin() {
    toast.success("خوش‌آمدید");
    if (redirect) { nav({ to: redirect }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { nav({ to: "/" }); return; }
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1).maybeSingle();
    const role = roleRow?.role;
    if (role === "super_admin") nav({ to: "/admin" });
    else if (role === "seller") {
      const { data: store } = await supabase.from("stores").select("status").eq("seller_id", user.id).maybeSingle();
      nav({ to: store?.status === "approved" ? "/seller" : "/seller/pending" });
    } else nav({ to: "/account" });
  }

  async function onSubmitEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = emailSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) {
      setErrors(Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""])));
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) { toast.error("ورود ناموفق", { description: error.message }); return; }
    await afterLogin();
  }

  async function onSubmitPhone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = phoneSchema.safeParse({ phone: fd.get("phone"), password: fd.get("password") });
    if (!parsed.success) {
      setErrors(Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""])));
      return;
    }
    setErrors({});
    setLoading(true);
    const res = await fetchLoginWithPhone({ data: parsed.data });
    if (!res.ok) {
      setLoading(false);
      toast.error("ورود ناموفق", { description: "شماره موبایل یا رمز عبور نادرست است" });
      return;
    }
    const { error } = await supabase.auth.setSession(res.session);
    setLoading(false);
    if (error) { toast.error("ورود ناموفق", { description: error.message }); return; }
    await afterLogin();
  }

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-16 max-w-md">
        <div className="paper-card rounded-md p-8">
          <h1 className="font-serif text-3xl text-ink text-center mb-1">بازگشت به عطرمون</h1>
          <p className="text-center text-muted-foreground text-sm mb-8 font-serif italic">عطاری شما منتظر بازگشت‌تان است.</p>

          <div className="grid grid-cols-2 gap-2 mb-6">
            <button
              type="button"
              onClick={() => { setMode("email"); setErrors({}); }}
              className={`rounded-md border px-3 py-2 text-sm font-serif transition-colors ${mode === "email" ? "border-[var(--gold)] text-[var(--gold-deep)] bg-[var(--gold)]/6" : "border-ink/20 text-ink-soft"}`}
            >
              ورود با ایمیل
            </button>
            <button
              type="button"
              onClick={() => { setMode("phone"); setErrors({}); }}
              className={`rounded-md border px-3 py-2 text-sm font-serif transition-colors ${mode === "phone" ? "border-[var(--gold)] text-[var(--gold-deep)] bg-[var(--gold)]/6" : "border-ink/20 text-ink-soft"}`}
            >
              ورود با موبایل
            </button>
          </div>

          {mode === "email" ? (
            <form onSubmit={onSubmitEmail} className="space-y-4">
              <div>
                <Label htmlFor="email">ایمیل</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="password">رمز عبور</Label>
                <PasswordInput id="password" name="password" autoComplete="current-password" maxLength={72} required aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined} />
                {errors.password && <p id="password-error" className="text-xs text-destructive mt-1">{errors.password}</p>}
              </div>
              <Button type="submit" className="w-full font-serif" loading={loading} loadingText="در حال ورود…">
                ورود
              </Button>
            </form>
          ) : (
            <form onSubmit={onSubmitPhone} className="space-y-4">
              <div>
                <Label htmlFor="phone">شماره موبایل</Label>
                <Input id="phone" name="phone" type="tel" inputMode="numeric" dir="ltr" placeholder="09123456789" autoComplete="tel" required />
                {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
              </div>
              <div>
                <Label htmlFor="phone-password">رمز عبور</Label>
                <PasswordInput id="phone-password" name="password" autoComplete="current-password" maxLength={72} required aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "phone-password-error" : undefined} />
                {errors.password && <p id="phone-password-error" className="text-xs text-destructive mt-1">{errors.password}</p>}
              </div>
              <Button type="submit" className="w-full font-serif" loading={loading} loadingText="در حال ورود…">
                ورود
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground font-serif">
            رمز عبور را فراموش کرده‌اید؟ از ربات بله عطرمون دستور <span dir="ltr" className="inline-block">/forgot</span> را بفرستید.
          </p>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            هنوز عضو نیستید؟ <Link to="/register" className="text-[var(--gold)] hover:underline">ثبت‌نام</Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
