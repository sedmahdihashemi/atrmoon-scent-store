import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingState } from "@/components/ui/loading-state";
import { listBotRecipients, sendAdminMessage } from "@/lib/admin-message.functions";
import { toast } from "sonner";
import { Send, Search, Users } from "lucide-react";

export const Route = createFileRoute("/admin/message")({ component: AdminMessage });

type Recipient = { userId: string; name: string; phone: string | null; email: string | null };

function AdminMessage() {
  const getRecipients = useServerFn(listBotRecipients);
  const send = useServerFn(sendAdminMessage);
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toAll, setToAll] = useState(false);
  const [q, setQ] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getRecipients()
      .then((r) => setRecipients(r.ok ? (r.recipients as Recipient[]) : []))
      .catch(() => setRecipients([]));
  }, [getRecipients]);

  const filtered = useMemo(() => {
    const list = recipients ?? [];
    if (!q.trim()) return list;
    const s = q.trim();
    return list.filter((r) => r.name.includes(s) || (r.phone ?? "").includes(s) || (r.email ?? "").includes(s));
  }, [recipients, q]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const onSend = async () => {
    if (!text.trim()) { toast.error("متن پیام را بنویسید"); return; }
    if (!toAll && selected.size === 0) { toast.error("حداقل یک گیرنده انتخاب کنید (یا «همه»)"); return; }
    setSending(true);
    const res = await send({ data: { text: text.trim(), toAll, userIds: toAll ? undefined : [...selected] } });
    setSending(false);
    if (!res.ok) {
      toast.error(res.reason === "no_recipients" ? "گیرنده‌ای در ربات پیدا نشد" : "ارسال ناموفق بود");
      return;
    }
    toast.success(`پیام به ${res.sent.toLocaleString("fa-IR")} نفر ارسال شد`);
    setText("");
    setSelected(new Set());
    setToAll(false);
  };

  if (recipients === null) return <LoadingState />;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="font-serif text-xl text-ink flex items-center gap-2"><Send className="w-5 h-5 text-[var(--gold)]" /> ارسال پیام</h2>
        <p className="text-xs text-muted-foreground font-serif mt-1">
          پیام از طریق ربات بله به گیرندگان می‌رسد و روی گوشی‌شان نوتیفیکیشن می‌شود. فقط کسانی که در ربات لاگین‌اند پیام را می‌گیرند.
        </p>
      </div>

      <div className="paper-card rounded-md p-5 space-y-3">
        <Label className="text-sm font-serif text-ink">متن پیام</Label>
        <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="سلام! خبر تازه‌ای از عطرمون…" />
        <p className="text-[11px] text-muted-foreground text-left">{text.length.toLocaleString("fa-IR")} / ۳۰۰۰</p>
      </div>

      <div className="paper-card rounded-md p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-serif text-ink">گیرندگان</Label>
          <label className="flex items-center gap-2 text-sm font-serif text-ink cursor-pointer">
            <Checkbox checked={toAll} onCheckedChange={(v) => setToAll(!!v)} />
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> همه‌ی کاربرانِ ربات</span>
          </label>
        </div>

        {!toAll && (
          <>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40 pointer-events-none" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجوی نام یا شماره…" className="pr-9" />
            </div>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground font-serif py-4 text-center">کسی در ربات لاگین نیست.</p>
            ) : (
              <div className="max-h-72 overflow-auto -mx-1 px-1 space-y-1">
                {filtered.map((r) => (
                  <label key={r.userId} className="flex items-center gap-3 rounded-sm px-2 py-2 hover:bg-ink/5 cursor-pointer">
                    <Checkbox checked={selected.has(r.userId)} onCheckedChange={() => toggle(r.userId)} />
                    <div className="min-w-0">
                      <p className="font-serif text-ink text-sm truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{r.phone || r.email || "—"}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {selected.size > 0 && <p className="text-xs text-[var(--gold-deep)] font-serif">{selected.size.toLocaleString("fa-IR")} گیرنده انتخاب شد</p>}
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={onSend} loading={sending} loadingText="در حال ارسال…" className="gap-1.5">
          <Send className="w-4 h-4" /> ارسال پیام
        </Button>
      </div>
    </div>
  );
}
