import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/bale.server";

// Anon customers can only SELECT a limited column set on stores (no
// card_number/card_holder_name — those are intentionally not in the public
// grant, since making them broadly queryable would let anyone scrape every
// seller's card number). This goes through the service role instead, same
// reasoning as every other guest-facing piece of the payment flow.
export const getStoreCardPayment = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ storeId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("card_number, card_holder_name")
      .eq("id", data.storeId)
      .maybeSingle();
    return {
      cardNumber: (store as any)?.card_number ?? null,
      cardHolderName: (store as any)?.card_holder_name ?? null,
    };
  });
