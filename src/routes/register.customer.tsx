import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/register/customer")({ component: CustomerRegister });

const schema = z.object({
  full_name: z.string().trim().min(2, "نام را وارد کنید").max(100),
  email: z.string().email("ایمیل معتبر"),
  phone: z.string().trim().min(8).max(20),
  password: z.string().min(8, "حداقل ۸ کاراکتر"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "رمزها یکسان نیستند", path: ["confirm"] });

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
          <p className="text-center text-muted-foreground text-sm mb-8 font-serif italic">با ما به پاساژ رایحه‌ها وارد شوید.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field name="full_name" label="نام و نام خانوادگی" err={errors.full_name} />
            <Field name="email" label="ایمیل" type="email" err={errors.email} />
            <Field name="phone" label="شماره موبایل" type="tel" err={errors.phone} />
            <Field name="password" label="رمز عبور" type="password" err={errors.password} />
            <Field name="confirm" label="تکرار رمز عبور" type="password" err={errors.confirm} />
            <Button type="submit" className="w-full font-serif" disabled={loading}>
              {loading ? "در حال ثبت…" : "ثبت‌نام"}
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