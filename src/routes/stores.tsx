import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { LoadingState, EmptyState } from "@/components/ui/loading-state";
import { Store, ArrowLeft } from "lucide-react";
export const Route = createFileRoute("/stores")({ component: StoresLayout });
function StoresLayout() {
  const matches = useMatches();
  if (matches.some((m) => m.routeId === "/stores/$slug")) return <Outlet />;
  return <StoresPage />;
}
function StoresPage() {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => { supabase.from("stores").select("id, store_name, slug, city, description, logo_url").eq("status","approved").then(({ data }) => setItems(data ?? [])); }, []);
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12">
        <h1 className="font-serif text-4xl text-ink text-center mb-10">عطرفروشی‌ها</h1>
        {items === null ? <LoadingState /> : items.length === 0 ? <EmptyState title="هنوز عطرفروشی‌ای تأیید نشده" icon={<Store className="w-8 h-8" />} /> :
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((s) => (
              <Link key={s.id} to="/stores/$slug" params={{ slug: s.slug }} className="paper-card rounded-md p-6 hover:border-[var(--gold)] transition group block">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-sm bg-[var(--moon)]/40 flex items-center justify-center shrink-0 overflow-hidden">
                    {s.logo_url ? <img src={s.logo_url} alt={s.store_name} className="w-full h-full object-cover" /> : <Store className="w-6 h-6 text-[var(--gold)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-serif text-xl text-ink truncate">{s.store_name}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{s.city}</p>
                  </div>
                </div>
                {s.description && <p className="text-sm text-ink/70 mt-3 leading-7 line-clamp-3">{s.description}</p>}
                <p className="mt-4 text-xs font-serif text-[var(--gold)] flex items-center gap-1 group-hover:gap-2 transition-all">
                  مشاهده رایحه‌ها <ArrowLeft className="w-3 h-3" />
                </p>
              </Link>
            ))}
          </div>}
      </div>
    </PublicLayout>
  );
}