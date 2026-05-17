import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

const schema = z.object({
  email: z.string().email("ایمیل معتبر وارد کنید"),
  password: z.string().min(6, "حداقل ۶ کاراکتر"),
});

function LoginPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) {
      setErrors(Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([k,v]) => [k, v?.[0] ?? ""])));
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) { toast.error("ورود ناموفق", { description: error.message }); return; }
    toast.success("خوش‌آمدید");
    // Determine target by role
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

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-16 max-w-md">
        <div className="paper-card rounded-md p-8">
          <h1 className="font-serif text-3xl text-ink text-center mb-1">بازگشت به عطرمون</h1>
          <p className="text-center text-muted-foreground text-sm mb-8 font-serif italic">عطاری شما منتظر بازگشت‌تان است.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">ایمیل</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="password">رمز عبور</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
            </div>
            <Button type="submit" className="w-full font-serif" disabled={loading}>
              {loading ? "در حال ورود…" : "ورود"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            هنوز عضو نیستید؟ <Link to="/register" className="text-[var(--gold)] hover:underline">ثبت‌نام</Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}