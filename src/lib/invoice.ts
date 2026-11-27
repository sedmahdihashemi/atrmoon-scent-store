// Shared types + helpers for the seller invoice builder.

export type InvoiceItem = {
  title: string;
  qty: number;
  unit_price: number; // Toman
  note?: string;
};

export type InvoiceSettings = {
  header_name?: string; // عطاری display name on the invoice
  phone?: string;
  address?: string;
  footer_note?: string; // e.g. terms, thanks, guarantee
  show_stamp?: boolean; // show the Atrmoon stamp (default true)
};

export type InvoiceDraft = {
  id?: string;
  invoice_no: string;
  customer_name: string;
  customer_phone: string;
  customer_note: string;
  items: InvoiceItem[];
  discount_toman: number;
  shipping_toman: number;
  source_order_id?: string | null;
  issued_at?: string;
};

export function lineTotal(it: InvoiceItem): number {
  return Math.max(0, Math.round((Number(it.qty) || 0) * (Number(it.unit_price) || 0)));
}

export function computeTotals(items: InvoiceItem[], discount: number, shipping: number) {
  const subtotal = items.reduce((s, it) => s + lineTotal(it), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(shipping) || 0));
  return { subtotal, total };
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
export function toFa(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

// Toman, grouped, with Persian digits. e.g. 1250000 -> «۱٬۲۵۰٬۰۰۰»
export function formatToman(n: number): string {
  return toFa((Math.round(Number(n) || 0)).toLocaleString("en-US"));
}

export function faDate(d: Date | string | number = new Date()): string {
  const date = new Date(d);
  try {
    return date.toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran" });
  } catch {
    // Fallback for browsers without the Persian calendar: Latin digits, plain.
    try { return toFa(date.toLocaleDateString("en-GB")); } catch { return ""; }
  }
}

// Human invoice number: yymmdd + 4 random digits, e.g. «۱۴۰۳۰۹۰۶-۴۸۳۱».
export function newInvoiceNo(): string {
  const now = new Date();
  let ymd = "";
  try {
    ymd = now
      .toLocaleDateString("fa-IR-u-nu-latn", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" })
      .replace(/\D/g, "");
  } catch {
    ymd = "";
  }
  if (!ymd) ymd = String(Date.now()).slice(-8); // safe fallback
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${ymd}-${rand}`;
}

export function emptyItem(): InvoiceItem {
  return { title: "", qty: 1, unit_price: 0, note: "" };
}
