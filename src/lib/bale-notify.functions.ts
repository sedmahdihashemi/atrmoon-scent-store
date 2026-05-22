import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, sendMessage, buildInvoiceText } from "./bale.server";

export const notifyOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const built = await buildInvoiceText(data.orderId, { includeStore: true });
    if (!built) return { ok: false, reason: "order_not_found" };
    const { order } = built;

    // Find admin chat_ids
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    const adminIds = (admins ?? []).map((r: any) => r.user_id);

    // Find seller user_id of the store
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("seller_id")
      .eq("id", (order as any).store_id)
      .maybeSingle();
    const sellerId = (store as any)?.seller_id;

    const recipientUserIds = [...new Set([...adminIds, sellerId].filter(Boolean))];
    if (recipientUserIds.length === 0) return { ok: true, sent: 0 };

    const { data: sessions } = await supabaseAdmin
      .from("bot_sessions")
      .select("chat_id, user_id")
      .in("user_id", recipientUserIds);

    let sent = 0;
    for (const s of sessions ?? []) {
      await sendMessage(Number((s as any).chat_id), built.text);
      sent++;
    }
    return { ok: true, sent };
  });