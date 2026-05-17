import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { formatToman } from "@/lib/cart-session";
import { orderStatusLabels } from "@/lib/seller-utils";
import { ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/admin/orders")({ component: AllOrders });

function AllOrders() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orders").select("*, stores:store_id(store_name)").order("created_at", { ascending: false }).limit(200);
      setRows(data ?? []);
    })();
  }, []);
  if (!rows) return <LoadingState />;
  if (rows.length === 0) return <EmptyState title="سفارشی نیست" message="هنوز سفارشی ثبت نشده." icon={<ShoppingBag className="w-8 h-8" />} />;
  return (
    <div className="paper-card rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b border-ink/10">
          <tr><th className="text-start p-3">شماره</th><th className="text-start p-3">مشتری</th><th className="text-start p-3">فروشگاه</th><th className="text-start p-3">مبلغ</th><th className="text-start p-3">وضعیت</th></tr>
        </thead>
        <tbody>
          {rows.map((o: any) => (
            <tr key={o.id} className="border-b border-ink/5">
              <td className="p-3 font-serif text-ink">{o.order_number}</td>
              <td className="p-3"><div>{o.customer_name}</div><div className="text-xs text-muted-foreground" dir="ltr">{o.customer_phone}</div></td>
              <td className="p-3">{o.stores?.store_name ?? "—"}</td>
              <td className="p-3 text-[var(--gold)] font-serif">{formatToman(o.total_amount)}</td>
              <td className="p-3"><Badge variant="outline">{orderStatusLabels[o.status] ?? o.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
