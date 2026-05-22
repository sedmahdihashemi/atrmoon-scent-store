import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatToman } from "@/lib/cart-session";
import { User as UserIcon, MapPin, Package, Heart, Trash2, Plus, Star, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/account")({ component: AccountPage });

const ORDER_STATUS_FA: Record<string, string> = {
  pending_contact: "در انتظار تماس",
  confirmed_by_seller: "تأییدشده",
  preparing: "در حال آماده‌سازی",
  shipped: "ارسال‌شده",
  completed: "تکمیل‌شده",
  cancelled: "لغو شده",
  rejected_by_seller: "رد شده",
};

function AccountPage() {
  return (
    <PublicLayout>
      <RoleGuard allow={["customer", "seller", "super_admin"]}>
        <AccountInner />
      </RoleGuard>
    </PublicLayout>
  );
}

function AccountInner() {
  const { profile } = useAuth();
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <header className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl text-ink">سلام {profile?.full_name || ""}</h1>
        <p className="text-muted-foreground font-serif italic text-sm mt-1">به عطاری خصوصی‌تان در عطرمون خوش‌آمدید.</p>
      </header>
      <Tabs defaultValue="orders" className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 mb-4 scrollbar-thin">
          <TabsList className="inline-flex w-auto min-w-full md:w-full md:grid md:grid-cols-4 gap-1">
            <TabsTrigger value="orders" className="whitespace-nowrap"><Package className="w-4 h-4 ml-1" />سفارش‌ها</TabsTrigger>
            <TabsTrigger value="addresses" className="whitespace-nowrap"><MapPin className="w-4 h-4 ml-1" />آدرس‌ها</TabsTrigger>
            <TabsTrigger value="favorites" className="whitespace-nowrap"><Heart className="w-4 h-4 ml-1" />علاقه‌مندی‌ها</TabsTrigger>
            <TabsTrigger value="profile" className="whitespace-nowrap"><UserIcon className="w-4 h-4 ml-1" />پروفایل</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="orders"><OrdersTab /></TabsContent>
        <TabsContent value="addresses"><AddressesTab /></TabsContent>
        <TabsContent value="favorites"><FavoritesTab /></TabsContent>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Orders ---------------- */
function OrdersTab() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, total_amount, created_at, store_id, stores(name)")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });
      setOrders(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (selected) return <OrderDetail orderId={selected} onBack={() => setSelected(null)} />;

  if (loading) return <p className="text-muted-foreground text-sm">در حال بارگذاری…</p>;
  if (!orders.length) return <p className="paper-card rounded-md p-6 text-muted-foreground text-sm">هنوز سفارشی ثبت نشده.</p>;

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <button key={o.id} onClick={() => setSelected(o.id)} className="w-full text-right paper-card rounded-md p-4 hover:border-[var(--gold)] transition flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="min-w-0">
            <div className="font-serif text-ink truncate">{(o as any).stores?.name || "فروشگاه"}</div>
            <div className="text-xs text-muted-foreground mt-1">کد: {o.order_number}</div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-serif">{ORDER_STATUS_FA[o.status] ?? o.status}</Badge>
            <span className="font-serif text-ink text-sm">{formatToman(o.total_amount)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function OrderDetail({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: it }, { data: h }] = await Promise.all([
        supabase.from("orders").select("*, stores(name)").eq("id", orderId).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", orderId),
        supabase.from("order_status_history").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
      ]);
      setOrder(o); setItems(it ?? []); setHistory(h ?? []);
    })();
  }, [orderId]);
  if (!order) return <p className="text-muted-foreground text-sm">در حال بارگذاری…</p>;
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-ink hover:text-[var(--gold)]"><ChevronLeft className="w-4 h-4" /> بازگشت</button>
      <div className="paper-card rounded-md p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-serif text-xl text-ink">{(order as any).stores?.name}</h2>
            <p className="text-xs text-muted-foreground mt-1">کد پیگیری: {order.order_number}</p>
          </div>
          <Badge variant="outline" className="font-serif">{ORDER_STATUS_FA[order.status] ?? order.status}</Badge>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-4 text-sm">
          <div><span className="text-muted-foreground">گیرنده: </span>{order.customer_name}</div>
          <div><span className="text-muted-foreground">تلفن: </span>{order.customer_phone}</div>
          <div className="md:col-span-2"><span className="text-muted-foreground">آدرس: </span>{order.city} - {order.shipping_address}</div>
          <div><span className="text-muted-foreground">مبلغ کل: </span>{formatToman(order.total_amount)}</div>
        </div>
      </div>
      <div className="paper-card rounded-md p-5">
        <h3 className="font-serif text-ink mb-3">اقلام</h3>
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between text-sm border-b border-ink/5 pb-2 last:border-0">
              <div className="min-w-0">
                <div className="font-serif text-ink truncate">{i.product_name}</div>
                <div className="text-xs text-muted-foreground">{i.brand_name} · {i.bottle_name} · {i.volume_ml}ml × {i.quantity}</div>
              </div>
              <div className="font-serif">{formatToman(i.total_price)}</div>
            </div>
          ))}
        </div>
      </div>
      {history.length > 0 && (
        <div className="paper-card rounded-md p-5">
          <h3 className="font-serif text-ink mb-3">پیگیری وضعیت</h3>
          <ol className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[var(--gold)]" />
                <span className="font-serif">{ORDER_STATUS_FA[h.new_status] ?? h.new_status}</span>
                <span className="text-xs text-muted-foreground mr-auto">{new Date(h.created_at).toLocaleString("fa-IR")}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ---------------- Addresses ---------------- */
function AddressesTab() {
  const { user } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ full_name: "", phone: "", city: "", address: "", postal_code: "" });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("customer_addresses").select("*").eq("customer_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const submit = async () => {
    if (!user) return;
    if (!form.full_name || !form.phone || !form.city || !form.address) { toast.error("لطفاً همه فیلدها را پر کنید"); return; }
    setSaving(true);
    const { error } = await supabase.from("customer_addresses").insert({ ...form, customer_id: user.id, is_default: list.length === 0 });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("آدرس ذخیره شد");
    setForm({ full_name: "", phone: "", city: "", address: "", postal_code: "" });
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("customer_addresses").delete().eq("id", id);
    load();
  };

  const setDefault = async (id: string) => {
    if (!user) return;
    await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_id", user.id);
    await supabase.from("customer_addresses").update({ is_default: true }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-3">
      {list.map((a) => (
        <div key={a.id} className="paper-card rounded-md p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-serif text-ink">{a.full_name}</span>
              {a.is_default && <Badge className="font-serif">پیش‌فرض</Badge>}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{a.phone}</div>
            <div className="text-sm mt-1">{a.city} - {a.address} {a.postal_code && `(${a.postal_code})`}</div>
          </div>
          <div className="flex items-center gap-2">
            {!a.is_default && <Button size="sm" variant="outline" onClick={() => setDefault(a.id)}>پیش‌فرض</Button>}
            <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      ))}
      {!list.length && !showForm && <p className="paper-card rounded-md p-6 text-muted-foreground text-sm">هنوز آدرسی ثبت نکرده‌اید.</p>}
      {showForm ? (
        <div className="paper-card rounded-md p-5 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>نام گیرنده</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>تلفن</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>شهر</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>کد پستی</Label><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></div>
          </div>
          <div><Label>آدرس کامل</Label><Textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={saving}>ذخیره</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>انصراف</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setShowForm(true)} variant="outline" className="font-serif"><Plus className="w-4 h-4 ml-1" /> افزودن آدرس</Button>
      )}
    </div>
  );
}

/* ---------------- Favorites ---------------- */
function FavoritesTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("wishlists")
      .select("id, product_id, products(id, name, slug, brands(name))")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const remove = async (id: string) => {
    await supabase.from("wishlists").delete().eq("id", id);
    load();
  };

  if (loading) return <p className="text-muted-foreground text-sm">در حال بارگذاری…</p>;
  if (!items.length) return <p className="paper-card rounded-md p-6 text-muted-foreground text-sm">لیست علاقه‌مندی‌های شما خالی است.</p>;

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {items.map((w) => (
        <div key={w.id} className="paper-card rounded-md p-4 flex items-center gap-3">
          <Heart className="w-5 h-5 text-[var(--gold)]" />
          <div className="flex-1 min-w-0">
            <div className="font-serif text-ink truncate">{(w as any).products?.name}</div>
            <div className="text-xs text-muted-foreground">{(w as any).products?.brands?.name}</div>
          </div>
          {(w as any).products?.slug && (
            <Link to="/products/$slug" params={{ slug: (w as any).products.slug }}>
              <Button size="sm" variant="outline">مشاهده</Button>
            </Link>
          )}
          <Button size="sm" variant="ghost" onClick={() => remove(w.id)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Profile ---------------- */
function ProfileTab() {
  const { user, profile, refresh } = useAuth();
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || "", phone: profile.phone || "" });
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: form.full_name, phone: form.phone }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("پروفایل به‌روزرسانی شد");
    refresh();
  };

  return (
    <div className="paper-card rounded-md p-5 space-y-3 max-w-xl">
      <div><Label>نام و نام خانوادگی</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
      <div><Label>ایمیل</Label><Input value={profile?.email || ""} disabled /></div>
      <div><Label>تلفن</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      <Button onClick={save} disabled={saving}>ذخیره تغییرات</Button>
    </div>
  );
}