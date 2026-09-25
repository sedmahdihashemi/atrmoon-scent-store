import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, logIfError } from "@/lib/bale.server";

// Public order-tracking data for the /track/<orderId> page. The order's
// own UUID is the only credential (unguessable, same reasoning as the
// Bale deep link) — deliberately does NOT return customer_name/phone/
// shipping_address, since this link could end up anywhere (forwarded,
// pasted in a screenshot, etc).
export const getPublicOrderTracking = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        `id, order_number, status, payment_method, total_amount, payment_expires_at,
         card_transfer_note, card_transfer_submitted_at, card_transfer_reviewed_at, card_transfer_rejection_reason,
         created_at, store_id,
         stores(store_name, card_number, card_holder_name),
         order_items(product_name, brand_name, bottle_name, volume_ml, quantity, total_price)`
      )
      .eq("id", data.orderId)
      .maybeSingle();
    logIfError(`getPublicOrderTracking(${data.orderId})`, error);
    if (!order) return { found: false as const };

    const o = order as any;
    return {
      found: true as const,
      id: o.id as string,
      orderNumber: o.order_number as string,
      status: o.status as string,
      paymentMethod: o.payment_method as string,
      totalAmount: Number(o.total_amount),
      paymentExpiresAt: o.payment_expires_at as string | null,
      createdAt: o.created_at as string,
      storeName: o.stores?.store_name ?? null,
      cardNumber: o.stores?.card_number ?? null,
      cardHolderName: o.stores?.card_holder_name ?? null,
      cardTransferNote: o.card_transfer_note as string | null,
      cardTransferSubmittedAt: o.card_transfer_submitted_at as string | null,
      cardTransferReviewedAt: o.card_transfer_reviewed_at as string | null,
      cardTransferRejectionReason: o.card_transfer_rejection_reason as string | null,
      items: (o.order_items ?? []).map((it: any) => ({
        productName: it.product_name as string,
        brandName: it.brand_name as string | null,
        bottleName: it.bottle_name as string,
        volumeMl: it.volume_ml as number,
        quantity: it.quantity as number,
        totalPrice: Number(it.total_price),
      })),
    };
  });
