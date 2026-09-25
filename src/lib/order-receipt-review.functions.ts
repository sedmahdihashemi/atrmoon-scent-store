import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, logIfError } from "@/lib/bale.server";
import { notifyOrder } from "@/lib/bale-notify.functions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Unlike the customer-facing order functions (bearer-token-by-UUID), the
// receipt image is a real financial document — reviewing it is restricted
// to the store's own seller (or an admin), verified by a real logged-in
// session (requireSupabaseAuth), not just knowledge of the order id.
async function assertCanReview(userId: string, orderId: string) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, store_id, payment_method, status, card_transfer_receipt_path")
    .eq("id", orderId)
    .maybeSingle();
  logIfError(`assertCanReview order(${orderId})`, error);
  if (!order) return { ok: false as const, reason: "not_found" as const };

  const { data: roles, error: rolesErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  logIfError(`assertCanReview roles(${userId})`, rolesErr);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "super_admin");

  if (!isAdmin) {
    const { data: store, error: storeErr } = await supabaseAdmin
      .from("stores")
      .select("seller_id")
      .eq("id", (order as any).store_id)
      .maybeSingle();
    logIfError(`assertCanReview store(${(order as any).store_id})`, storeErr);
    if ((store as any)?.seller_id !== userId) return { ok: false as const, reason: "forbidden" as const };
  }

  return { ok: true as const, order: order as any };
}

export const getReceiptSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const check = await assertCanReview(context.userId, data.orderId);
    if (!check.ok) return { ok: false as const, reason: check.reason };
    if (!check.order.card_transfer_receipt_path) return { ok: false as const, reason: "no_receipt" as const };

    const { data: signed, error } = await supabaseAdmin.storage
      .from("payment-receipts")
      .createSignedUrl(check.order.card_transfer_receipt_path, 300); // 5 minutes
    if (error || !signed) {
      console.error("[getReceiptSignedUrl] sign failed", error);
      return { ok: false as const, reason: "error" as const };
    }
    return { ok: true as const, url: signed.signedUrl };
  });

export const reviewCardTransferReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        orderId: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        reason: z.string().max(500).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const check = await assertCanReview(context.userId, data.orderId);
    if (!check.ok) return { ok: false as const, reason: check.reason };
    if (check.order.payment_method !== "card_transfer" || check.order.status !== "pending_payment") {
      return { ok: false as const, reason: "not_pending" as const };
    }

    if (data.decision === "approve") {
      const { error } = await supabaseAdmin
        .from("orders")
        .update({
          status: "pending_contact",
          paid_at: new Date().toISOString(),
          card_transfer_reviewed_at: new Date().toISOString(),
          card_transfer_reviewed_by: context.userId,
          card_transfer_rejection_reason: null,
        })
        .eq("id", data.orderId)
        .eq("status", "pending_payment");
      if (error) {
        console.error("[reviewCardTransferReceipt] approve", error);
        return { ok: false as const, reason: "error" as const };
      }
      try {
        await notifyOrder({ data: { orderId: data.orderId } });
      } catch (e) {
        console.error("[reviewCardTransferReceipt] notifyOrder failed", e);
      }
      return { ok: true as const };
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        card_transfer_reviewed_at: new Date().toISOString(),
        card_transfer_reviewed_by: context.userId,
        card_transfer_rejection_reason: data.reason?.trim() || "مدرک نامعتبر بود، لطفاً دوباره ارسال کنید.",
      })
      .eq("id", data.orderId)
      .eq("status", "pending_payment");
    if (error) {
      console.error("[reviewCardTransferReceipt] reject", error);
      return { ok: false as const, reason: "error" as const };
    }
    return { ok: true as const };
  });
