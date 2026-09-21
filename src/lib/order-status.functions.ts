import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/bale.server";

// Used by the checkout page while it's showing the "pay with Bale" screen,
// to detect payment completion without requiring the customer to be logged
// in (guest checkouts can't read their own order via RLS with the anon
// key — the order id itself is the only credential here, same reasoning as
// the bot's deep-link flow).
export const getOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("status")
      .eq("id", data.orderId)
      .maybeSingle();
    return { status: (order as any)?.status ?? null };
  });
