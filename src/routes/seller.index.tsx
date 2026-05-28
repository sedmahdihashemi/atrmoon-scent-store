import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Package, ShoppingBag, AlertCircle, Coins, Heart } from "lucide-react";
import { formatToman } from "@/lib/cart-session";
import { orderStatusLabels } from "@/lib/seller-utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/seller/")({ component: Overview });

function Overview() {
  const { storeId } = useAuth();
  const [stats, setStats] = useState<{ products: number; pending: number; revenue: number; lowStock: number } | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [wishStats, setWishStats] = useState<{ product_id: string; product_name: string; wishlist_count: number }[] | null>(null);

  useEffect(() => {
    if (!storeId) return;
    (async () => {
      const [p, ords, low, recentOrds, wish] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("orders").select("total_amount, status").eq("store_id", storeId),
        supabase.from("product_inventory").select("id, available_stock_ml, low_stock_alert_ml").eq("store_id", storeId),
        supabase.from("orders").select("id, order_number, customer_name, total_amount, status, created_at").eq("store_id", storeId).order("created_at", { ascending: false }).limit(5),
        (supabase as any).rpc("seller_wishlist_stats", { p_store_id: storeId }),
      ]);
      const orders = ords.data ?? [];
      const revenue = orders.filter((o: any) => ["completed", "shipped"].includes(o.status)).reduce((s: number, o: any) => s + Number(o.total_amount), 0);
      const pending = orders.filter((o: any) => o.status === "pending_contact").length;
      const lowStock = (low.data ?? []).filter((r: any) => r.available_stock_ml <= r.low_stock_alert_ml).length;
      setStats({ products: p.count ?? 0, pending, revenue, lowStock });
      setRecent(recentOrds.data ?? []);
      const ws = (wish?.data ?? []) as any[];
      setWishStats(ws.map((r) => ({ product_id: r.product_id, product_name: r.product_name, wishlist_count: Number(r.wishlist_count) })));
    })();
  }, [storeId]);

  const cards = [
    { label: "محصولات فعال", value: stats?.products ?? 0, Icon: Package, suffix: "" },
    { label: "سفارش‌های در انتظار", value: stats?.pending ?? 0, Icon: ShoppingBag, suffix: "" },
    { label: "درآمد تکمیل‌شده", value: formatToman(stats?.revenue ?? 0), Icon: Coins, suffix: "" },
    { label: "موجودی کم", value: stats?.lowStock ?? 0, Icon: AlertCircle, suffix: "" },
  ];

  const chartRows = (wishStats ?? []).filter((r) => r.wishlist_count > 0).slice(0, 10);
  const totalWishes = (wishStats ?? []).reduce((s, r) => s + r.wishlist_count, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(({ label, value, Icon }) => (
          <div key={label} className="paper-card rounded-md p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-serif"><span>{label}</span><Icon className="w-4 h-4 text-[var(--gold)]" /></div>
            <p className="font-serif text-xl text-ink mt-2 break-words">{typeof value === "number" ? value.toLocaleString("fa-IR") : value}</p>
          </div>
        ))}
      </div>

      <div className="paper-card rounded-md p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="min-w-0">
            <h2 className="font-serif text-lg text-ink flex items-center gap-2"><Heart className="w-4 h-4 text-[var(--gold)]" /> علاقه‌مندی مشتریان</h2>
            <p className="text-xs text-muted-foreground font-serif mt-0.5">پربازدیدترین رایحه‌ها در فهرست علاقه‌مندی‌ها</p>
          </div>
          {wishStats !== null && (
            <span className="text-xs font-serif text-muted-foreground shrink-0">
              مجموع: <span className="text-ink">{totalWishes.toLocaleString("fa-IR")}</span>
            </span>
          )}
        </div>
        {wishStats === null ? (
          <p className="text-sm text-muted-foreground font-serif italic py-8 text-center">در حال محاسبه…</p>
        ) : chartRows.length === 0 ? (
          <p className="text-sm text-muted-foreground font-serif italic py-8 text-center">هنوز مشتری‌ای رایحه‌ای را به علاقه‌مندی نیفزوده.</p>
        ) : (
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="product_name"
                  tick={{ fontSize: 11, fontFamily: "inherit" }}
                  interval={0}
                  tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + "…" : v)}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  contentStyle={{ background: "var(--paper)", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                  formatter={(v: any) => [Number(v).toLocaleString("fa-IR"), "علاقه‌مند"]}
                  labelFormatter={(l: string) => l}
                />
                <Bar dataKey="wishlist_count" fill="var(--gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="paper-card rounded-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg text-ink">آخرین سفارش‌ها</h2>
          <Link to="/seller/orders" className="text-sm text-[var(--gold)] font-serif">همه</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground font-serif italic py-8 text-center">هنوز سفارشی نرسیده.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((o) => (
              <Link key={o.id} to="/seller/orders/$id" params={{ id: o.id }} className="flex items-center justify-between gap-3 p-3 rounded-sm hover:bg-ink/5 transition border border-ink/5">
                <div className="min-w-0">
                  <p className="font-serif text-ink text-sm truncate">{o.order_number} — {o.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{orderStatusLabels[o.status] ?? o.status}</p>
                </div>
                <span className="font-serif text-[var(--gold)] text-sm shrink-0">{formatToman(o.total_amount)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}