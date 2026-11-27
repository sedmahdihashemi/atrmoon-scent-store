import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { Plus, FileText, ChevronLeft } from "lucide-react";
import { formatToman, faDate } from "@/lib/invoice";

export const Route = createFileRoute("/seller/invoices/")({ component: InvoicesPage });

function InvoicesPage() {
  const { storeId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!storeId) return;
    supabase
      .from("seller_invoices")
      .select("id, invoice_no, customer_name, total_toman, issued_at, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setRows(data ?? []);
        setLoading(false);
      });
  }, [storeId]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl text-ink flex items-center gap-2"><FileText className="w-5 h-5 text-[var(--gold)]" /> فاکتورها</h2>
          <p className="text-xs text-muted-foreground font-serif mt-1">فاکتور دستی یا از روی سفارش بسازید، PDF بگیرید و برای مشتری بفرستید.</p>
        </div>
        <Button asChild className="gap-1.5 shrink-0"><Link to="/seller/invoices/new"><Plus className="w-4 h-4" /> فاکتور جدید</Link></Button>
      </div>

      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <div className="paper-card rounded-md p-10 text-center space-y-3">
          <FileText className="w-10 h-10 text-ink/20 mx-auto" />
          <p className="font-serif text-ink">هنوز فاکتوری نساخته‌اید.</p>
          <Button asChild variant="outline" className="gap-1.5"><Link to="/seller/invoices/new"><Plus className="w-4 h-4" /> ساخت اولین فاکتور</Link></Button>
        </div>
      ) : (
        <div className="paper-card rounded-md divide-y divide-ink/5">
          {rows.map((r) => (
            <Link key={r.id} to="/seller/invoices/$id" params={{ id: r.id }} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink/5 transition group">
              <div className="min-w-0">
                <p className="font-serif text-ink text-sm" dir="ltr">#{r.invoice_no}</p>
                <p className="text-xs text-muted-foreground truncate">{r.customer_name || "بدون نام"} · {faDate(r.issued_at || r.created_at)}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-serif text-[var(--gold-deep)] text-sm">{formatToman(r.total_toman)} تومان</span>
                <ChevronLeft className="w-4 h-4 text-ink/30 group-hover:text-[var(--gold)]" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
