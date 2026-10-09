import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeVariantPrice } from "@/lib/pricing";

// Recompute and write product_variants.price for one product using the shared
// formula. Only runs when the store is in 'formula' mode; in 'manual' mode it's
// a no-op (sellers type prices directly and we never overwrite them). Called
// when a seller saves pricing settings; the USD auto-update job (later step)
// will call it the same way.
//
// Writes go through supabaseAdmin after an explicit ownership check, matching
// the pattern used by the receipt-review functions.
async function assertOwnsProduct(userId: string, productId: string) {
  const { data: product, error } = await supabaseAdmin
    .from("products")
    .select("id, store_id")
    .eq("id", productId)
    .maybeSingle();
  if (error) console.error("[recompute] load product", error);
  if (!product) return { ok: false as const, reason: "not_found" as const };

  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "super_admin");
  if (!isAdmin) {
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("seller_id")
      .eq("id", (product as any).store_id)
      .maybeSingle();
    if ((store as any)?.seller_id !== userId) return { ok: false as const, reason: "forbidden" as const };
  }
  return { ok: true as const, storeId: (product as any).store_id as string };
}

export const recomputeProductPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ productId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const check = await assertOwnsProduct(context.userId, data.productId);
    if (!check.ok) return { ok: false as const, reason: check.reason };
    const storeId = check.storeId;

    const { data: storeSettings } = await supabaseAdmin
      .from("store_pricing_settings")
      .select("pricing_mode")
      .eq("store_id", storeId)
      .maybeSingle();
    // Not in formula mode → do nothing, leave manual prices untouched.
    if (!storeSettings || (storeSettings as any).pricing_mode !== "formula") {
      return { ok: true as const, mode: "manual" as const, updated: 0, results: [], skipped: [] };
    }

    const { data: pps } = await supabaseAdmin
      .from("product_pricing_settings")
      .select("cost_per_gram_toman, concentration_percent, oil_profit_percent")
      .eq("product_id", data.productId)
      .maybeSingle();

    const { data: variants } = await supabaseAdmin
      .from("product_variants")
      .select("id, volume_ml, bottle_type_id")
      .eq("product_id", data.productId);

    const { data: bottlePricing } = await supabaseAdmin
      .from("store_bottle_pricing")
      .select("bottle_type_id, cost_toman, profit_percent")
      .eq("store_id", storeId);
    const bottleMap = new Map<string, { cost: number | null; profit: number }>();
    for (const b of (bottlePricing ?? []) as any[]) {
      bottleMap.set(b.bottle_type_id, { cost: b.cost_toman, profit: Number(b.profit_percent) });
    }

    const results: { variantId: string; price: number }[] = [];
    const skipped: { variantId: string; reason: string }[] = [];

    for (const v of (variants ?? []) as any[]) {
      if (!pps || (pps as any).cost_per_gram_toman == null) {
        skipped.push({ variantId: v.id, reason: "no_product_cost" });
        continue;
      }
      const bottle = bottleMap.get(v.bottle_type_id);
      if (!bottle || bottle.cost == null) {
        skipped.push({ variantId: v.id, reason: "no_bottle_pricing" });
        continue;
      }
      const breakdown = computeVariantPrice({
        volumeMl: Number(v.volume_ml),
        concentrationPercent: Number((pps as any).concentration_percent),
        costPerGramToman: Number((pps as any).cost_per_gram_toman),
        oilProfitPercent: Number((pps as any).oil_profit_percent),
        bottleCostToman: Number(bottle.cost),
        bottleProfitPercent: Number(bottle.profit),
      });
      if (!breakdown) {
        skipped.push({ variantId: v.id, reason: "invalid_inputs" });
        continue;
      }
      const { error: updErr } = await supabaseAdmin
        .from("product_variants")
        .update({ price: breakdown.finalPrice })
        .eq("id", v.id);
      if (updErr) {
        console.error("[recompute] update variant", v.id, updErr);
        skipped.push({ variantId: v.id, reason: "update_failed" });
        continue;
      }
      results.push({ variantId: v.id, price: breakdown.finalPrice });
    }

    return { ok: true as const, mode: "formula" as const, updated: results.length, results, skipped };
  });
