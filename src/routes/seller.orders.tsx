import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { formatToman } from "@/lib/cart-session";
import { orderStatusLabels } from "@/lib/seller-utils";
import { ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/seller/orders")({ component: OrdersPage });

function OrdersPage() {
  const matches = useMatches();
  if (matches.some((m) => m.routeId === "/seller/orders/$id")) return <Outlet />;
  return <OrdersList />;
}

function OrdersList() {
  const { storeId } = useAuth();
  const [orders, setOrders] = useState<any[] | null>(null);

  useEffect(() => {
    if (!storeId) return;
    supabase.from("orders").select("id, order_number, customer_name, customer_phone, total_amount, status, created_at")
      .eq("store_id", storeId).order("created_at", { ascending: false })
      .then(({ data }) => setOrders(data ?? []));
  }, [storeId]);

  if (orders === null) return <LoadingState />;
  if (orders.length === 0) return <EmptyState title="هنوز سفارشی نرسیده" message="نخستین سفارش به‌زودی از راه می‌رسد." icon={<ShoppingBag className="w-7 h-7" />} />;

  return (
    <div className="space-y-3">
      <h2 className="font-serif text-xl text-ink mb-2">سفارش‌ها</h2>
      <div className="paper-card rounded-md divide-y divide-ink/5 overflow-hidden">
        {orders.map((o) => (
          <Link key={o.id} to="/seller/orders/$id" params={{ id: o.id }} className="flex items-center gap-3 p-3 hover:bg-ink/5">
            <div className="flex-1 min-w-0">
              <p className="font-serif text-ink text-sm">{o.order_number}</p>
              <p className="text-xs text-muted-foreground">{o.customer_name} · {o.customer_phone}</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-sm bg-ink/5 font-serif">{orderStatusLabels[o.status] ?? o.status}</span>
            <span className="font-serif text-[var(--gold)] text-sm shrink-0">{formatToman(o.total_amount)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}