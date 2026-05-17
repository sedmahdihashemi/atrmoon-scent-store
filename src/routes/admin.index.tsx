import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Store, Users, Package, ShoppingBag, Coins, ShieldCheck } from "lucide-react";
import { formatToman } from "@/lib/cart-session";

export const Route = createFileRoute("/admin/")({ component: AdminOverview });

function AdminOverview() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const [pendingStores, allStores, users, products, orders] = await Promise.all([
        supabase.from("stores").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("stores").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("total_amount, status"),
      ]);
      const revenue = (orders.data ?? []).filter((o: any) => ["completed", "shipped"].includes(o.status)).reduce((s: number, o: any) => s + Number(o.total_amount), 0);
      setStats({
        pendingStores: pendingStores.count ?? 0,
        stores: allStores.count ?? 0,
        users: users.count ?? 0,
        products: products.count ?? 0,
        orders: (orders.data ?? []).length,
        revenue,
      });
    })();
  }, []);
  const cards = [
    { label: "فروشندگان در انتظار", value: stats?.pendingStores ?? 0, Icon: ShieldCheck, to: "/admin/sellers" },
    { label: "فروشگاه‌ها", value: stats?.stores ?? 0, Icon: Store, to: "/admin/stores" },
    { label: "کاربران", value: stats?.users ?? 0, Icon: Users, to: "/admin/users" },
    { label: "محصولات", value: stats?.products ?? 0, Icon: Package, to: "/admin/stores" },
    { label: "سفارش‌ها", value: stats?.orders ?? 0, Icon: ShoppingBag, to: "/admin/orders" },
    { label: "گردش مالی", value: formatToman(stats?.revenue ?? 0), Icon: Coins, to: "/admin/orders" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map(({ label, value, Icon, to }) => (
        <Link key={label} to={to as any} className="paper-card rounded-md p-4 hover:bg-ink/5 transition">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-serif"><span>{label}</span><Icon className="w-4 h-4 text-[var(--gold)]" /></div>
          <p className="font-serif text-xl text-ink mt-2 break-words">{typeof value === "number" ? value.toLocaleString("fa-IR") : value}</p>
        </Link>
      ))}
    </div>
  );
}
