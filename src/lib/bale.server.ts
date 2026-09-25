import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { orderStatusLabels } from "@/lib/seller-utils";

const BALE_API = "https://tapi.bale.ai";

function token() {
  const t = process.env.BALE_BOT_TOKEN;
  if (!t) throw new Error("BALE_BOT_TOKEN is not configured");
  return t;
}

// Never log this value — it authorizes real money movement on the bot's wallet.
function paymentToken() {
  const t = process.env.BALE_PAYMENT_TOKEN;
  if (!t) throw new Error("BALE_PAYMENT_TOKEN is not configured");
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

// Supabase queries in the bot code often ignore the `error` field and just
// use `data` (which is null/empty on failure), so a bad key or RLS issue
// silently looks like "no rows" instead of surfacing anywhere. Call this
// wherever such a result is read so failures at least show up in the logs.
export function logIfError(context: string, error: unknown) {
  if (error) console.error("[bale]", context, error);
}

// Single source of truth for Persian status labels — shared with the
// seller/admin panels (seller-utils.ts) so the bot can never drift out of
// sync with what real order_status values actually exist again.
export function statusFa(s: string) {
  return orderStatusLabels[s] ?? s;
}

function fmtMoney(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return new Intl.NumberFormat("fa-IR").format(Math.round(v)) + " تومان";
}

// The server runs in UTC, so a bare toLocaleString("fa-IR") shows GMT time
// instead of Iran time — always pass the explicit timeZone.
export function fmtTehranDate(d: string | number | Date) {
  return new Date(d).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" });
}

export async function buildInvoiceText(orderId: string, opts: { includeStore?: boolean } = {}) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*, stores(store_name), order_items(*)")
    .eq("id", orderId)
    .maybeSingle();
  logIfError(`buildInvoiceText(${orderId})`, error);
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
    lines.push(
      `• ${it.product_name}${it.brand_name ? ` (${it.brand_name})` : ""} — ${it.bottle_name} ${it.volume_ml} میلی‌لیتر × ${it.quantity} = ${fmtMoney(it.total_price)}`
    );
  }
  lines.push("");
  lines.push(`💰 <b>مبلغ کل:</b> ${fmtMoney(order.total_amount)}`);
  lines.push(`📅 ${fmtTehranDate(order.created_at)}`);
  return { text: lines.join("\n"), order };
}

// ============ Bale wallet payment ============

// orders.total_amount is stored in Toman; Bale's payment API wants a plain
// integer number of Rial (no /100 or other sub-unit convention — confirmed
// against the docs, not assumed from Telegram's convention).
export function tomanToRial(toman: number | string): number {
  return Math.round(Number(toman) * 10);
}

export async function sendInvoice(params: {
  chat_id: number;
  title: string;
  description: string;
  payload: string;
  amount_rial: number;
}) {
  return baleCall("sendInvoice", {
    chat_id: params.chat_id,
    title: params.title.slice(0, 32),
    description: params.description.slice(0, 255),
    payload: params.payload,
    provider_token: paymentToken(),
    prices: [{ label: "مبلغ سفارش", amount: params.amount_rial }],
  });
}

export async function answerPreCheckoutQuery(
  pre_checkout_query_id: string,
  ok: boolean,
  error_message?: string
) {
  return baleCall("answerPreCheckoutQuery", {
    pre_checkout_query_id,
    ok,
    ...(error_message ? { error_message } : {}),
  });
}

// Docs don't state the exact endpoint path, so this follows the same
// `bot<token>/<method>` pattern every other documented method uses.
export async function inquireTransaction(transaction_id: string) {
  return baleCall("inquireTransaction", { transaction_id });
}

export async function sendToAdmins(text: string) {
  const { data: admins, error: adminsErr } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin");
  logIfError("sendToAdmins admins", adminsErr);
  const adminIds = (admins ?? []).map((r: any) => r.user_id);
  if (adminIds.length === 0) return;

  const { data: sessions, error: sessionsErr } = await supabaseAdmin
    .from("bot_sessions")
    .select("chat_id")
    .in("user_id", adminIds);
  logIfError("sendToAdmins sessions", sessionsErr);

  for (const s of sessions ?? []) {
    await sendMessage(Number((s as any).chat_id), text);
  }
}