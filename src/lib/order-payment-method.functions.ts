import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/bale.server";
import { notifyOrder } from "@/lib/bale-notify.functions";

// Lets a customer (logged in or guest — the order id is the only
// credential needed, same bearer-token reasoning as the rest of the
// payment flow) switch a still-pending order to a different payment
// method. Recomputes the expiry window for the new method and, for 'cod',
// moves the order straight to pending_contact (no payment to wait for)
// and fires the normal new-order notification immediately.
export const switchOrderPaymentMethod = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ orderId: z.string().uuid(), method: z.enum(["cod", "bale", "card_transfer"]) })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, status, store_id, payment_method")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderErr) console.error("[switchOrderPaymentMethod] order lookup", orderErr);
    if (!order) return { ok: false, reason: "not_found" as const };
    if ((order as any).status !== "pending_payment") return { ok: false, reason: "not_pending" as const };
    if ((order as any).payment_method === data.method) return { ok: true, status: (order as any).status };

    if (data.method === "bale" && process.env.BALE_PAY_ENABLED !== "true") {
      return { ok: false, reason: "bale_disabled" as const };
    }
    if (data.method === "card_transfer") {
      const { data: store } = await supabaseAdmin
        .from("stores")
        .select("card_number")
        .eq("id", (order as any).store_id)
        .maybeSingle();
      if (!(store as any)?.card_number) return { ok: false, reason: "no_card" as const };
    }

    const newStatus = data.method === "cod" ? "pending_contact" : "pending_payment";
    const newExpiresAt =
      data.method === "bale"
        ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
        : data.method === "card_transfer"
          ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          : null;

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({
        payment_method: data.method,
        status: newStatus,
        payment_expires_at: newExpiresAt,
        // A fresh method switch means any earlier card-transfer submission
        // (if there was one) no longer applies.
        card_transfer_receipt_path: null,
        card_transfer_note: null,
        card_transfer_submitted_at: null,
        card_transfer_reviewed_at: null,
        card_transfer_rejection_reason: null,
      })
      .eq("id", data.orderId)
      .eq("status", "pending_payment");
    if (updErr) {
      console.error("[switchOrderPaymentMethod] update", updErr);
      return { ok: false, reason: "error" as const };
    }

    if (data.method === "cod") {
      try {
        await notifyOrder({ data: { orderId: data.orderId } });
      } catch (e) {
        console.error("[switchOrderPaymentMethod] notifyOrder failed", e);
      }
    }

    return { ok: true, status: newStatus };
  });
