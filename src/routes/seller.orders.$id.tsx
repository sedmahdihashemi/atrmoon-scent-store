import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { formatToman } from "@/lib/cart-session";
import { orderStatusLabels, orderStatusFlow } from "@/lib/seller-utils";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/seller/orders/$id")({ component: OrderDetail });

function OrderDetail() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data: o } = await supabase.from("orders").select("*").eq("id", id).single();
    if (o) { setOrder(o); setStatus(o.status); setNote(o.seller_note ?? ""); }
    const { data: oi } = await supabase.from("order_items").select("*").eq("order_id", id);
    setItems(oi ?? []);
  };
  useEffect(() => { void load(); }, [id]);

  if (!order) return <LoadingState />;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("orders").update({ status: status as any, seller_note: note || null }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("به‌روزرسانی شد");
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/seller/orders" className="hover:text-[var(--gold)]">سفارش‌ها</Link>
        <ChevronRight className="w-4 h-4 rotate-180" />
        <span className="text-ink">{order.order_number}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 paper-card rounded-md p-5">
          <h2 className="font-serif text-lg text-ink mb-4">اقلام سفارش</h2>
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="flex justify-between text-sm border-b border-ink/5 last:border-0 py-2">
                <div>
                  <p className="font-serif text-ink">{it.product_name}</p>
                  <p className="text-xs text-muted-foreground">{it.volume_ml} میلی‌لیتر · {it.bottle_name} × {it.quantity}</p>
                </div>
                <span className="font-serif text-[var(--gold)]">{formatToman(it.total_price)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-serif text-base mt-4 pt-4 border-t border-ink/10">
            <span>جمع کل</span><span className="text-[var(--gold)]">{formatToman(order.total_amount)}</span>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="paper-card rounded-md p-5 space-y-2 text-sm">
            <h3 className="font-serif text-base text-ink mb-2">مشتری</h3>
            <p><span className="text-muted-foreground">نام: </span>{order.customer_name}</p>
            <p dir="ltr" className="text-right"><span className="text-muted-foreground">تلفن: </span>{order.customer_phone}</p>
            {order.customer_email && <p dir="ltr" className="text-right"><span className="text-muted-foreground">ایمیل: </span>{order.customer_email}</p>}
            <p><span className="text-muted-foreground">شهر: </span>{order.city}</p>
            <p><span className="text-muted-foreground">نشانی: </span>{order.shipping_address}</p>
            {order.postal_code && <p dir="ltr" className="text-right"><span className="text-muted-foreground">کدپستی: </span>{order.postal_code}</p>}
            {order.customer_note && <p className="pt-2 border-t border-ink/5"><span className="text-muted-foreground">یادداشت مشتری: </span>{order.customer_note}</p>}
          </div>

          <div className="paper-card rounded-md p-5 space-y-3">
            <h3 className="font-serif text-base text-ink">به‌روزرسانی وضعیت</h3>
            <div>
              <Label className="text-xs font-serif text-ink/80 mb-1.5 block">وضعیت</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {orderStatusFlow.map((s) => <SelectItem key={s} value={s}>{orderStatusLabels[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-serif text-ink/80 mb-1.5 block">یادداشت فروشنده (اختیاری)</Label>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button onClick={save} disabled={saving} className="w-full">{saving ? "ذخیره…" : "ذخیره"}</Button>
          </div>
        </aside>
      </div>
    </div>
  );
}