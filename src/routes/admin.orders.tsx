import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { formatToman } from "@/lib/cart-session";
import { orderStatusLabels } from "@/lib/seller-utils";
import { ShoppingBag, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/admin/orders")({ component: AllOrders });

function AllOrders() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, any[]>>({});

  useEffect(() => {
    (async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) { console.error(error); setRows([]); return; }
      const list = orders ?? [];
      const storeIds = [...new Set(list.map((o: any) => o.store_id).filter(Boolean))];
      const customerIds = [...new Set(list.map((o: any) => o.customer_id).filter(Boolean))];

      const [{ data: stores }, { data: profs }] = await Promise.all([
        storeIds.length
          ? supabase.from("stores").select("id, store_name, support_phone, seller_id").in("id", storeIds)
          : Promise.resolve({ data: [] as any[] }),
        customerIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", customerIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const sellerIds = [...new Set((stores ?? []).map((s: any) => s.seller_id).filter(Boolean))];
      const { data: sellerProfs } = sellerIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", sellerIds)
        : { data: [] as any[] };

      const sellerMap = new Map((sellerProfs ?? []).map((p: any) => [p.id, p]));
      const storeMap = new Map(
        (stores ?? []).map((s: any) => [s.id, { ...s, profiles: sellerMap.get(s.seller_id) ?? null }]),
      );
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));

      setRows(
        list.map((o: any) => ({
          ...o,
          stores: storeMap.get(o.store_id) ?? null,
          profiles: profMap.get(o.customer_id) ?? null,
        })),
      );
    })();
  }, []);


  const toggle = async (id: string) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    if (!itemsCache[id]) {
      const { data } = await supabase.from("order_items").select("*").eq("order_id", id);
      setItemsCache((c) => ({ ...c, [id]: data ?? [] }));
    }
  };

  if (!rows) return <LoadingState />;
  if (rows.length === 0) return <EmptyState title="سفارشی نیست" message="هنوز سفارشی ثبت نشده." icon={<ShoppingBag className="w-8 h-8" />} />;

  return (
    <div className="paper-card rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b border-ink/10">
          <tr>
            <th className="text-start p-3">شماره</th>
            <th className="text-start p-3">تاریخ</th>
            <th className="text-start p-3">خریدار</th>
            <th className="text-start p-3">از عطاری</th>
            <th className="text-start p-3">فروشنده</th>
            <th className="text-start p-3">مبلغ</th>
            <th className="text-start p-3">وضعیت</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o: any) => {
            const isOpen = open === o.id;
            const items = itemsCache[o.id] ?? [];
            return (
              <>
                <tr key={o.id} className="border-b border-ink/5 hover:bg-ink/[0.02] cursor-pointer" onClick={() => toggle(o.id)}>
                  <td className="p-3 font-serif text-ink">{o.order_number}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("fa-IR")}</td>
                  <td className="p-3">
                    <div>{o.customer_name || o.profiles?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{o.customer_phone}</div>
                  </td>
                  <td className="p-3">{o.stores?.store_name ?? "—"}</td>
                  <td className="p-3 text-xs">
                    <div>{o.stores?.profiles?.full_name ?? "—"}</div>
                    <div className="text-muted-foreground" dir="ltr">{o.stores?.support_phone ?? ""}</div>
                  </td>
                  <td className="p-3 text-[var(--gold)] font-serif">{formatToman(o.total_amount)}</td>
                  <td className="p-3"><Badge variant="outline">{orderStatusLabels[o.status] ?? o.status}</Badge></td>
                  <td className="p-3"><ChevronLeft className={`w-4 h-4 transition-transform ${isOpen ? "-rotate-90" : ""}`} /></td>
                </tr>
                {isOpen && (
                  <tr key={o.id + "-d"} className="bg-paper-deep/30">
                    <td colSpan={8} className="p-4">
                      <div className="text-xs eyebrow mb-2">اقلام سفارش</div>
                      {items.length === 0 ? (
                        <div className="text-xs text-muted-foreground">در حال بارگذاری…</div>
                      ) : (
                        <table className="w-full text-xs">
                          <thead className="text-muted-foreground">
                            <tr>
                              <th className="text-start p-2">عطر</th>
                              <th className="text-start p-2">برند</th>
                              <th className="text-start p-2">حجم / بطری</th>
                              <th className="text-start p-2">تعداد</th>
                              <th className="text-start p-2">قیمت واحد</th>
                              <th className="text-start p-2">جمع</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it: any) => (
                              <tr key={it.id} className="border-t border-ink/5">
                                <td className="p-2 font-serif text-ink">{it.product_name}</td>
                                <td className="p-2">{it.brand_name ?? "—"}</td>
                                <td className="p-2">{it.volume_ml}ml · {it.bottle_name}</td>
                                <td className="p-2">{it.quantity}</td>
                                <td className="p-2">{formatToman(it.unit_price)}</td>
                                <td className="p-2 text-[var(--gold)]">{formatToman(it.total_price)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {o.shipping_address && (
                        <div className="mt-3 text-xs text-muted-foreground">
                          نشانی: {o.city} — {o.shipping_address} {o.postal_code ? `(${o.postal_code})` : ""}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
