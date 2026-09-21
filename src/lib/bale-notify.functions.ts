import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, sendMessage, buildInvoiceText, logIfError } from "./bale.server";

export const notifyOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const built = await buildInvoiceText(data.orderId, { includeStore: true });
    if (!built) return { ok: false, reason: "order_not_found" };
    const { order } = built;

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