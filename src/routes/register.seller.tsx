import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/register/seller")({ component: SellerRegister });

const schema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  phone: z.string().trim().min(8).max(20),
  password: z.string().min(8),
  confirm: z.string(),
  store_name: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(50),
  support_phone: z.string().trim().min(8).max(20),
  support_email: z.string().email(),
  description: z.string().trim().max(500).optional().or(z.literal("")),
}).refine((d) => d.password === d.confirm, { message: "رمزها یکسان نیستند", path: ["confirm"] });

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-آ-ی]/gi, "").slice(0, 50) + "-" + Math.random().toString(36).slice(2, 7);
}

function SellerRegister() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) {
      setErrors(Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([k,v]) => [k, v?.[0] ?? ""])));
      return;
    }
    setErrors({});
    setLoading(true);
    const { data: signupData, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: parsed.data.full_name, phone: parsed.data.phone, role: "seller" },
      },
    });
    if (error || !signupData.user) { setLoading(false); toast.error("ثبت‌نام ناموفق", { description: error?.message }); return; }
    // Create store as pending
    const { error: storeErr } = await supabase.from("stores").insert({
      seller_id: signupData.user.id,
      store_name: parsed.data.store_name,
      slug: slugify(parsed.data.store_name),
      description: parsed.data.description || null,
      city: parsed.data.city,
      support_phone: parsed.data.support_phone,
      support_email: parsed.data.support_email,
      status: "pending",
    });
    setLoading(false);
    if (storeErr) { toast.error("ثبت فروشگاه ناموفق", { description: storeErr.message }); return; }
    toast.success("درخواست شما ثبت شد");
    nav({ to: "/seller/pending" });
  }

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-16 max-w-xl">
        <div className="paper-card rounded-md p-8">
          <h1 className="font-serif text-3xl text-ink text-center mb-1">گشودن عطاری فروشنده</h1>
          <p className="text-center text-muted-foreground text-sm mb-8 font-serif italic">پس از ثبت، فروشگاه شما به دست عطرمون بررسی می‌شود.</p>
          <form onSubmit={onSubmit} className="space-y-5">
            <Section title="اطلاعات شخصی">
              <div className="grid md:grid-cols-2 gap-4">
                <F name="full_name" label="نام کامل" err={errors.full_name} />
                <F name="phone" label="موبایل" err={errors.phone} type="tel" />
                <F name="email" label="ایمیل" err={errors.email} type="email" />
                <span />
                <F name="password" label="رمز عبور" err={errors.password} type="password" />
                <F name="confirm" label="تکرار رمز" err={errors.confirm} type="password" />
              </div>
            </Section>
            <Section title="اطلاعات فروشگاه">
              <div className="grid md:grid-cols-2 gap-4">
                <F name="store_name" label="نام فروشگاه" err={errors.store_name} />
                <F name="city" label="شهر" err={errors.city} />
                <F name="support_phone" label="تلفن پشتیبانی" err={errors.support_phone} type="tel" />
                <F name="support_email" label="ایمیل پشتیبانی" err={errors.support_email} type="email" />
              </div>
              <div className="mt-4">
                <Label htmlFor="description">معرفی کوتاه</Label>
                <Textarea id="description" name="description" rows={3} placeholder="درباره فروشگاه شما…" />
              </div>
            </Section>
            <Button type="submit" className="w-full font-serif" loading={loading} loadingText="در حال ثبت…">
              ثبت درخواست
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-lg text-ink mb-3 pb-2 border-b border-ink/10">{title}</h2>
      {children}
    </div>
  );
}

function F({ name, label, type = "text", err }: { name: string; label: string; type?: string; err?: string }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required />
      {err && <p className="text-xs text-destructive mt-1">{err}</p>}
    </div>
  );
}