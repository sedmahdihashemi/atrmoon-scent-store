import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";
import { Trash2, Plus, Save } from "lucide-react";
import { slugify } from "@/lib/seller-utils";

export type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
};

type Row = Record<string, any> & { id: string };

export function RefDataManager({
  title, description, table, fields, autoSlugFrom, extra,
}: {
  title: string;
  description?: string;
  table: "brands" | "categories" | "scent_notes" | "bottle_types";
  fields: Field[];
  autoSlugFrom?: string; // field key to derive slug from on insert (for brands/categories)
  extra?: (row: Row, refresh: () => void) => ReactNode;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from(table).select("*").order("name");
    if (error) toast.error(error.message);
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); }, [table]);

  const create = async () => {
    for (const f of fields) {
      if (f.required && !form[f.key]) { toast.error(`${f.label} الزامی است`); return; }
    }
    setSaving(true);
    const payload: any = { ...form };
    if (autoSlugFrom && payload[autoSlugFrom] && !payload.slug) payload.slug = slugify(payload[autoSlugFrom]);
    if (payload.volume_ml) payload.volume_ml = Number(payload.volume_ml);
    const { error } = await supabase.from(table).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setForm({}); toast.success("افزوده شد"); load();
  };

  const updateRow = async (id: string, patch: any) => {
    if (patch.volume_ml !== undefined) patch.volume_ml = Number(patch.volume_ml);
    const { error } = await supabase.from(table).update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("ذخیره شد"); load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف شود؟")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("حذف شد"); load();
  };

  if (!rows) return <LoadingState />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl text-ink">{title}</h2>
        {description && <p className="text-xs text-muted-foreground font-serif italic mt-1">{description}</p>}
      </div>

      <div className="paper-card rounded-md p-4">
        <div className="text-xs font-serif text-ink/80 mb-2 flex items-center gap-1"><Plus className="w-3 h-3" /> افزودن جدید</div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
          {fields.map((f) => (
            <FieldInput key={f.key} f={f} value={form[f.key] ?? ""} onChange={(v) => setForm({ ...form, [f.key]: v })} />
          ))}
          <Button onClick={create} disabled={saving} className="h-9 sm:col-span-2 md:col-span-1"><Plus className="w-4 h-4 me-1" />افزودن</Button>
        </div>
      </div>

      <div className="paper-card rounded-md divide-y divide-ink/5">
        {rows.length === 0 && <p className="text-sm text-muted-foreground font-serif italic p-6 text-center">موردی ثبت نشده.</p>}
        {rows.map((r) => (
          <RowEditor key={r.id} row={r} fields={fields} onSave={(patch) => updateRow(r.id, patch)} onDelete={() => remove(r.id)} extra={extra ? extra(r, load) : null} />
        ))}
      </div>
    </div>
  );
}

function FieldInput({ f, value, onChange }: { f: Field; value: any; onChange: (v: any) => void }) {
  if (f.type === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 px-3 rounded-md border border-input bg-background text-sm font-serif">
        <option value="">{f.label}</option>
        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  return <Input type={f.type === "number" ? "number" : "text"} placeholder={f.placeholder ?? f.label} value={value} onChange={(e) => onChange(e.target.value)} />;
}

function RowEditor({ row, fields, onSave, onDelete, extra }: { row: Row; fields: Field[]; onSave: (p: any) => void; onDelete: () => void; extra: ReactNode }) {
  const [edit, setEdit] = useState<any>({});
  const [dirty, setDirty] = useState(false);
  const merged = { ...row, ...edit };
  const set = (k: string, v: any) => { setEdit({ ...edit, [k]: v }); setDirty(true); };
  return (
    <div className="p-3 flex flex-wrap items-center gap-2">
      <div className="flex-1 min-w-0 grid sm:grid-cols-2 md:grid-cols-3 gap-2">
        {fields.map((f) => (
          <FieldInput key={f.key} f={f} value={merged[f.key] ?? ""} onChange={(v) => set(f.key, v)} />
        ))}
      </div>
      <div className="flex gap-2 shrink-0">
        {extra}
        <Button size="sm" variant="outline" disabled={!dirty} onClick={() => { onSave(edit); setEdit({}); setDirty(false); }}><Save className="w-4 h-4" /></Button>
        <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="w-4 h-4 text-destructive" /></Button>
      </div>
    </div>
  );
}
