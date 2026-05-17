import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";

const statusLabels: Record<string, string> = { pending: "در انتظار", approved: "تأییدشده", rejected: "ردشده", disabled: "غیرفعال" };

export const Route = createFileRoute("/admin/stores")({ component: StoresList });

function StoresList() {
  const [rows, setRows] = useState<any[] | null>(null);
  const load = async () => {
    const { data: stores, error } = await supabase.from("stores").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setRows([]); return; }
    const ids = Array.from(new Set((stores ?? []).map((s: any) => s.seller_id).filter(Boolean)));
    const map = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      (profs ?? []).forEach((p: any) => map.set(p.id, p));
    }
    setRows((stores ?? []).map((s: any) => ({ ...s, profile: map.get(s.seller_id) })));
  };
  useEffect(() => { load(); }, []);
  const change = async (id: string, status: string) => {
    const { error } = await supabase.from("stores").update({ status: status as any }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("به‌روزرسانی شد"); load();
  };
  if (!rows) return <LoadingState />;
  return (
    <div className="paper-card rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b border-ink/10">
          <tr><th className="text-start p-3">فروشگاه</th><th className="text-start p-3">فروشنده</th><th className="text-start p-3">وضعیت</th><th className="text-start p-3">عملیات</th></tr>
        </thead>
        <tbody>
          {rows.map((s: any) => (
            <tr key={s.id} className="border-b border-ink/5">
              <td className="p-3"><div className="font-serif text-ink">{s.store_name}</div><div className="text-xs text-muted-foreground">{s.slug}</div></td>
              <td className="p-3"><div>{s.profile?.full_name || "—"}</div><div className="text-xs text-muted-foreground" dir="ltr">{s.profile?.email || ""}</div></td>
              <td className="p-3"><Badge variant="outline">{statusLabels[s.status]}</Badge></td>
              <td className="p-3">
                <select className="text-xs border border-ink/20 bg-transparent rounded-sm px-2 py-1 font-serif" value={s.status} onChange={(e) => change(s.id, e.target.value)}>
                  {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
