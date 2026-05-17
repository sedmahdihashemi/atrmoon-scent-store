import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";

const statusLabels: Record<string, string> = { active: "فعال", pending: "در انتظار", blocked: "مسدود" };
const roleLabels: Record<string, string> = { super_admin: "ادمین", seller: "فروشنده", customer: "مشتری" };

export const Route = createFileRoute("/admin/users")({ component: UsersList });

function UsersList() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const load = async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => { const a = roleMap.get(r.user_id) ?? []; a.push(r.role); roleMap.set(r.user_id, a); });
    setRows((profiles ?? []).map((p: any) => ({ ...p, roles: roleMap.get(p.id) ?? [] })));
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ status: status as any }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("وضعیت به‌روزرسانی شد"); load();
  };

  const setRole = async (userId: string, current: string[], newRole: string) => {
    if (current.includes(newRole)) return;
    // remove other primary roles, set newRole
    const removable = current.filter((r) => ["customer", "seller"].includes(r));
    if (removable.length) await supabase.from("user_roles").delete().eq("user_id", userId).in("role", removable as any);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
    if (error) { toast.error(error.message); return; }
    toast.success("نقش به‌روزرسانی شد"); load();
  };

  if (!rows) return <LoadingState />;
  const filtered = q ? rows.filter((u) => (u.full_name || "").includes(q) || (u.email || "").includes(q) || (u.phone || "").includes(q)) : rows;

  return (
    <div className="space-y-3">
      <Input placeholder="جستجوی نام/ایمیل/تلفن" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="paper-card rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-ink/10">
            <tr><th className="text-start p-3">کاربر</th><th className="text-start p-3">نقش</th><th className="text-start p-3">وضعیت</th></tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-ink/5">
                <td className="p-3">
                  <div className="font-serif text-ink">{u.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{u.email}</div>
                  {u.phone && <div className="text-xs text-muted-foreground" dir="ltr">{u.phone}</div>}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {u.roles.map((r: string) => <Badge key={r} variant="outline" className="text-[10px]">{roleLabels[r] ?? r}</Badge>)}
                  </div>
                  {!u.roles.includes("super_admin") && (
                    <select className="text-xs border border-ink/20 bg-transparent rounded-sm px-2 py-1 font-serif" value={u.roles.includes("seller") ? "seller" : "customer"} onChange={(e) => setRole(u.id, u.roles, e.target.value)}>
                      <option value="customer">مشتری</option>
                      <option value="seller">فروشنده</option>
                    </select>
                  )}
                </td>
                <td className="p-3">
                  <select className="text-xs border border-ink/20 bg-transparent rounded-sm px-2 py-1 font-serif" value={u.status} onChange={(e) => setStatus(u.id, e.target.value)}>
                    {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
