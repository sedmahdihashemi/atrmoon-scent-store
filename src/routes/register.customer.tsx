import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/register/customer")({
  component: CustomerRegister,
  head: () => ({
    meta: [
      { title: "ثبت‌نام مشتری | عطرمون" },
      { name: "description", content: "ساخت حساب مشتری در عطرمون برای خرید و پیگیری رایحه‌ها." },
      { property: "og:title", content: "ثبت‌نام مشتری | عطرمون" },
      { property: "og:description", content: "حساب مشتری عطرمون را بسازید." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const schema = z.object({
  full_name: z.string().trim().min(2, "نام را وارد کنید").max(100),
  email: z.string().email("ایمیل معتبر"),
  phone: z.string().trim().min(8).max(20),
  password: z.string().min(8, "رمز عبور باید حداقل ۸ نویسه باشد").max(72, "رمز عبور نمی‌تواند بیشتر از ۷۲ نویسه باشد"),
  confirm: z.string().min(1, "تکرار رمز عبور را وارد کنید"),
}).refine((d) => d.password === d.confirm, { message: "تکرار رمز عبور با رمز اصلی یکسان نیست", path: ["confirm"] });

function CustomerRegister() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const obj = Object.fromEntries(fd.entries());
    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      setErrors(Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([k,v]) => [k, v?.[0] ?? ""])));
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: parsed.data.full_name, phone: parsed.data.phone, role: "customer" },
      },
    });
    setLoading(false);
    if (error) { toast.error("ثبت‌نام ناموفق", { description: error.message }); return; }
    toast.success("به عطرمون خوش‌آمدید");
    nav({ to: "/account" });
  }

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-16 max-w-md">
        <div className="paper-card rounded-md p-8">
          <h1 className="font-serif text-3xl text-ink text-center mb-1">ثبت‌نام مشتری</h1>
          <p className="text-center text-muted-foreground text-sm mb-8 font-serif italic">با ما به بازار رایحه‌ها وارد شوید.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field name="full_name" label="نام و نام خانوادگی" err={errors.full_name} />
            <Field name="email" label="ایمیل" type="email" err={errors.email} />
            <Field name="phone" label="شماره موبایل" type="tel" err={errors.phone} />
            <PasswordField name="password" label="رمز عبور" err={errors.password} hint="حداقل ۸ و حداکثر ۷۲ نویسه" autoComplete="new-password" />
            <PasswordField name="confirm" label="تکرار رمز عبور" err={errors.confirm} autoComplete="new-password" />
            <Button type="submit" className="w-full font-serif" loading={loading} loadingText="در حال ثبت…">
              ثبت‌نام
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            عضو هستید؟ <Link to="/login" className="text-[var(--gold)] hover:underline">ورود</Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}

function Field({ name, label, type = "text", err }: { name: string; label: string; type?: string; err?: string }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required />
      {err && <p className="text-xs text-destructive mt-1">{err}</p>}
    </div>
  );
}

function PasswordField({ name, label, err, hint, autoComplete }: { name: string; label: string; err?: string; hint?: string; autoComplete: string }) {
  const messageId = `${name}-${err ? "error" : "hint"}`;
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <PasswordInput id={name} name={name} autoComplete={autoComplete} maxLength={72} required aria-invalid={Boolean(err)} aria-describedby={err || hint ? messageId : undefined} />
      {err ? <p id={messageId} className="text-xs text-destructive mt-1">{err}</p> : hint ? <p id={messageId} className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
    </div>
  );
}