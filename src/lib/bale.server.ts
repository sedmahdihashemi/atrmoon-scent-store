import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BALE_API = "https://tapi.bale.ai";

function token() {
  const t = process.env.BALE_BOT_TOKEN;
  if (!t) throw new Error("BALE_BOT_TOKEN is not configured");
  return t;
}

export async function baleCall(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${BALE_API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    console.error("[bale]", method, res.status, data);
  }
  return data;
}

export async function sendMessage(chat_id: number, text: string, extra: Record<string, unknown> = {}) {
  const clean = stripHtml(text);
  return baleCall("sendMessage", { chat_id, text: clean, ...extra });
}

function stripHtml(s: string) {
  return s
    .replace(/<\/?(b|i|u|s|strong|em|code|pre|br)\b[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");
}

export { supabaseAdmin };

const STATUS_FA: Record<string, string> = {
  pending_contact: "در انتظار تماس",
  contacted: "تماس گرفته شد",
  preparing: "در حال آماده‌سازی",
  shipped: "ارسال شد",
  delivered: "تحویل داده شد",
  cancelled: "لغو شد",
};

export function statusFa(s: string) {
  return STATUS_FA[s] ?? s;
}

function fmtMoney(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return new Intl.NumberFormat("fa-IR").format(Math.round(v)) + " تومان";
}

export async function buildInvoiceText(orderId: string, opts: { includeStore?: boolean } = {}) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("*, stores(store_name), order_items(*)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;

  const items = (order as any).order_items as any[];
  const lines: string[] = [];
  lines.push(`🧾 <b>فاکتور سفارش</b>`);
  lines.push(`شماره: <code>${order.order_number}</code>`);
  lines.push(`وضعیت: ${statusFa(order.status)}`);
  if (opts.includeStore && (order as any).stores?.store_name) {
    lines.push(`فروشگاه: ${(order as any).stores.store_name}`);
  }
  lines.push("");
  lines.push(`👤 <b>مشتری</b>`);
  lines.push(`نام: ${order.customer_name}`);
  lines.push(`تلفن: ${order.customer_phone}`);
  if (order.customer_email) lines.push(`ایمیل: ${order.customer_email}`);
  lines.push(`شهر: ${order.city}`);
  lines.push(`نشانی: ${order.shipping_address}`);
  if (order.postal_code) lines.push(`کد پستی: ${order.postal_code}`);
  if (order.customer_note) lines.push(`یادداشت: ${order.customer_note}`);
  lines.push("");
  lines.push(`🛒 <b>اقلام</b>`);
  for (const it of items) {
    lines.push(`• ${it.product_name}${it.brand_name ? ` (${it.brand_name})` : ""} — ${it.bottle_name} × ${it.quantity} = ${fmtMoney(it.total_price)}`);
  }
  lines.push("");
  lines.push(`💰 <b>مبلغ کل:</b> ${fmtMoney(order.total_amount)}`);
  lines.push(`📅 ${new Date(order.created_at).toLocaleString("fa-IR")}`);
  return { text: lines.join("\n"), order };
}