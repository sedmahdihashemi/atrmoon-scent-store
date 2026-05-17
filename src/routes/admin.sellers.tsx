import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { toast } from "sonner";
import { Store, Check, X } from "lucide-react";

export const Route = createFileRoute("/admin/sellers")({ component: SellerApproval });

function SellerApproval() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("stores").select("*, profiles:seller_id(full_name, email, phone)").eq("status", "pending").order("created_at", { ascending: true });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const decide = async (id: string, status: "approved" | "rejected") => {
    setBusy(id);
    const { error } = await supabase.from("stores").update({ status }).eq("id", id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "فروشگاه تأیید شد" : "فروشگاه رد شد");
    load();
  };

  if (!rows) return <LoadingState />;
  if (rows.length === 0) return <EmptyState title="درخواست تازه‌ای نیست" message="همه‌ی فروشگاه‌ها بررسی شده‌اند." icon={<Store className="w-8 h-8" />} />;

  return (
    <div className="space-y-3">
      {rows.map((s: any) => (
        <div key={s.id} className="paper-card rounded-md p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="font-serif text-lg text-ink">{s.store_name} <Badge variant="outline" className="ms-2">{s.slug}</Badge></h3>
              <p className="text-xs text-muted-foreground mt-1">{s.profiles?.full_name} — {s.profiles?.email} {s.profiles?.phone ? `— ${s.profiles.phone}` : ""}</p>
              {s.city && <p className="text-xs text-ink/70 mt-1">شهر: {s.city}</p>}
              {s.description && <p className="text-sm text-ink/80 leading-loose mt-2">{s.description}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" disabled={busy === s.id} onClick={() => decide(s.id, "approved")}><Check className="w-4 h-4 me-1" />تأیید</Button>
              <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => decide(s.id, "rejected")}><X className="w-4 h-4 me-1" />رد</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
