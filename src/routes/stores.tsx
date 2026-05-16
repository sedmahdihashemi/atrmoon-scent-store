import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { Store } from "lucide-react";
export const Route = createFileRoute("/stores")({ component: StoresPage });
function StoresPage() {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => { supabase.from("stores").select("id, store_name, slug, city, description").eq("status","approved").then(({ data }) => setItems(data ?? [])); }, []);
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12">
        <h1 className="font-serif text-4xl text-ink text-center mb-10">عطرفروشی‌ها</h1>
        {items === null ? <LoadingState /> : items.length === 0 ? <EmptyState title="هنوز عطرفروشی‌ای تأیید نشده" icon={<Store className="w-8 h-8" />} /> :
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((s) => (
              <div key={s.id} className="paper-card rounded-md p-6">
                <Store className="w-6 h-6 text-[var(--gold)] mb-2" />
                <h2 className="font-serif text-xl text-ink">{s.store_name}</h2>
                <p className="text-xs text-muted-foreground mt-1">{s.city}</p>
                {s.description && <p className="text-sm text-ink/70 mt-3 leading-7 line-clamp-3">{s.description}</p>}
              </div>
            ))}
          </div>}
      </div>
    </PublicLayout>
  );
}