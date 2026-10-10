import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, sendMessage, buildInvoiceText, statusFa, logIfError } from "./bale.server";

// Chat ids of everyone who should hear about an order: the store's seller,
// all super-admins, and the customer — but only those who have a bot session.
async function orderRecipientChatIds(orderId: string, storeId: string, customerId: string | null) {
  const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "super_admin");
  const adminIds = (admins ?? []).map((r: any) => r.user_id);
  const { data: store } = await supabaseAdmin.from("stores").select("seller_id").eq("id", storeId).maybeSingle();
  const sellerId = (store as any)?.seller_id;
  const ids = [...new Set([...adminIds, sellerId, customerId].filter(Boolean))];
  if (ids.length === 0) return [];
  const { data: sessions } = await supabaseAdmin.from("bot_sessions").select("chat_id").in("user_id", ids);
  return (sessions ?? []).map((s: any) => Number(s.chat_id));
}

export const notifyOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const built = await buildInvoiceText(data.orderId, { includeStore: true });
    if (!built) return { ok: false, reason: "order_not_found" };
    const { order } = built;

    // Note: we now notify at placement for every payment method, including
    // orders that are still "pending_payment" (bale / card-to-card) — the
    // seller and admin should know about a new order the moment it's placed,
    // not only once it's paid.

    // Find admin chat_ids
    const { data: admins, error: adminsErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    logIfError(`notifyOrder admins(${data.orderId})`, adminsErr);
    const adminIds = (admins ?? []).map((r: any) => r.user_id);

    // Find seller user_id of the store
    const { data: store, error: storeErr } = await supabaseAdmin
      .from("stores")
      .select("seller_id")
      .eq("id", (order as any).store_id)
      .maybeSingle();
    logIfError(`notifyOrder store(${(order as any).store_id})`, storeErr);
    const sellerId = (store as any)?.seller_id;

    const customerId = (order as any).customer_id;
    const recipientUserIds = [...new Set([...adminIds, sellerId, customerId].filter(Boolean))];
    if (recipientUserIds.length === 0) return { ok: true, sent: 0 };

    const { data: sessions, error: sessionsErr } = await supabaseAdmin
      .from("bot_sessions")
      .select("chat_id, user_id")
      .in("user_id", recipientUserIds);
    logIfError(`notifyOrder sessions(${data.orderId})`, sessionsErr);

    console.log("[notifyOrder]", {
      orderId: data.orderId,
      recipients: recipientUserIds,
      sessions: (sessions ?? []).length,
    });

    let sent = 0;
    for (const s of sessions ?? []) {
      await sendMessage(Number((s as any).chat_id), built.text);
      sent++;
    }
    return { ok: true, sent };
  });

// Concise "status changed" notice (seller + admin + customer). Sent on every
// order status transition — the full invoice is only sent once, at placement.
export const notifyOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("order_number, status, total_amount, store_id, customer_id, stores(store_name)")
      .eq("id", data.orderId)
      .maybeSingle();
    logIfError(`notifyOrderStatus(${data.orderId})`, error);
    if (!order) return { ok: false as const, reason: "order_not_found" as const };

    const o = order as any;
    const amount = new Intl.NumberFormat("fa-IR").format(Math.round(Number(o.total_amount))) + " تومان";
    const text =
      "🔄 <b>به‌روزرسانی سفارش</b>\n" +
      `شماره: <code>${o.order_number}</code>\n` +
      (o.stores?.store_name ? `فروشگاه: ${o.stores.store_name}\n` : "") +
      `وضعیت جدید: ${statusFa(o.status)}\n` +
      `مبلغ: ${amount}`;

    const chatIds = await orderRecipientChatIds(data.orderId, o.store_id, o.customer_id);
    let sent = 0;
    for (const chatId of chatIds) { await sendMessage(chatId, text); sent++; }
    return { ok: true as const, sent };
  });