import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, sendMessage, logIfError } from "@/lib/bale.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Wholesale buyers — step 3: membership lifecycle (request / review / list).
//
// Pricing itself is NEVER computed or exposed here — the wholesale price is
// derived server-side inside place_order (step 2) and in the display function
// (step 5). These functions only move a membership through
// pending → approved / rejected, and let each side see what they're allowed to.
// ---------------------------------------------------------------------------

// Is this user the seller of the store, or a super-admin? Used to gate every
// seller-side action by a real logged-in session (not just knowing an id).
async function assertCanManageStore(userId: string, storeId: string) {
  const { data: roles, error: rolesErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  logIfError(`wholesale assertCanManageStore roles(${userId})`, rolesErr);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "super_admin");
  if (isAdmin) return { ok: true as const, isAdmin: true };

  const { data: store, error: storeErr } = await supabaseAdmin
    .from("stores")
    .select("seller_id")
    .eq("id", storeId)
    .maybeSingle();
  logIfError(`wholesale assertCanManageStore store(${storeId})`, storeErr);
  if (!store) return { ok: false as const, reason: "not_found" as const };
  if ((store as any).seller_id !== userId) return { ok: false as const, reason: "forbidden" as const };
  return { ok: true as const, isAdmin: false };
}

async function chatIdForUser(userId: string | null | undefined): Promise<number | null> {
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from("bot_sessions")
    .select("chat_id")
    .eq("user_id", userId)
    .limit(1);
  const chat = (data ?? [])[0] as any;
  return chat?.chat_id ? Number(chat.chat_id) : null;
}

// --- Customer: wholesale price for a set of variants -----------------------
// Returns, per variant, the wholesale price — ONLY for variants whose store
// has approved this buyer AND has a wholesale rate AND a formula cost. Same
// math as place_order (the authority); this is purely for display, so the
// numbers the buyer sees match what they'll be charged. No cost/profit inputs
// are ever returned — only the final price.
export const getWholesaleVariantPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ variantIds: z.array(z.string().uuid()).min(1).max(200) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: variants } = await supabaseAdmin
      .from("product_variants")
      .select("id, price, volume_ml, product_id, products(id, store_id)")
      .in("id", data.variantIds);
    const vs = (variants ?? []) as any[];
    if (vs.length === 0) return { ok: true as const, prices: {} as Record<string, number> };

    const storeIds = [...new Set(vs.map((v) => v.products?.store_id).filter(Boolean))];
    const productIds = [...new Set(vs.map((v) => v.product_id).filter(Boolean))];

    // Which of these stores has approved this buyer, and at what override rate.
    const { data: memberships } = await supabaseAdmin
      .from("wholesale_memberships")
      .select("store_id, oil_profit_percent")
      .eq("customer_id", userId)
      .eq("status", "approved")
      .in("store_id", storeIds);
    const overrideByStore = new Map<string, number | null>();
    for (const m of (memberships ?? []) as any[]) overrideByStore.set(m.store_id, m.oil_profit_percent);
    if (overrideByStore.size === 0) return { ok: true as const, prices: {} as Record<string, number> };

    const { data: sps } = await supabaseAdmin
      .from("store_pricing_settings")
      .select("store_id, wholesale_oil_profit_percent")
      .in("store_id", [...overrideByStore.keys()]);
    const storeDefault = new Map<string, number | null>();
    for (const s of (sps ?? []) as any[]) storeDefault.set(s.store_id, s.wholesale_oil_profit_percent);

    const { data: pps } = await supabaseAdmin
      .from("product_pricing_settings")
      .select("product_id, cost_per_gram_toman, concentration_percent, oil_profit_percent")
      .in("product_id", productIds);
    const pricingByProduct = new Map<string, any>();
    for (const p of (pps ?? []) as any[]) pricingByProduct.set(p.product_id, p);

    const prices: Record<string, number> = {};
    for (const v of vs) {
      const storeId = v.products?.store_id;
      if (!storeId || !overrideByStore.has(storeId)) continue; // not approved here
      const wsProfit = overrideByStore.get(storeId) ?? storeDefault.get(storeId) ?? null;
      if (wsProfit == null) continue; // no wholesale rate → retail
      const pr = pricingByProduct.get(v.product_id);
      if (!pr || pr.cost_per_gram_toman == null) continue; // not formula-priced → retail

      const retail = Number(v.price);
      const oilBase =
        Number(v.volume_ml) * (Number(pr.concentration_percent) / 100) * Number(pr.cost_per_gram_toman);
      const raw = retail - oilBase * ((Number(pr.oil_profit_percent) - Number(wsProfit)) / 100);
      const ws = Math.round(raw / 1000) * 1000;
      prices[v.id] = Math.min(ws, retail); // never above retail
    }

    return { ok: true as const, prices };
  });

// --- Customer: request wholesale access to a store -------------------------
// Re-requesting after a rejection is allowed (flips it back to pending). An
// already-pending or already-approved membership is a no-op (no spam notice).
export const requestWholesaleMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ storeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("id, store_name, seller_id")
      .eq("id", data.storeId)
      .maybeSingle();
    if (!store) return { ok: false as const, reason: "store_not_found" as const };

    const { data: existing } = await supabaseAdmin
      .from("wholesale_memberships")
      .select("id, status")
      .eq("store_id", data.storeId)
      .eq("customer_id", userId)
      .maybeSingle();

    if (existing && (existing as any).status === "approved")
      return { ok: true as const, status: "approved" as const, already: true };
    if (existing && (existing as any).status === "pending")
      return { ok: true as const, status: "pending" as const, already: true };

    if (existing) {
      // was rejected → re-open as a fresh pending request
      const { error } = await supabaseAdmin
        .from("wholesale_memberships")
        .update({ status: "pending", requested_at: new Date().toISOString(), reviewed_at: null, reviewed_by: null })
        .eq("id", (existing as any).id);
      if (error) {
        console.error("[requestWholesaleMembership] reopen", error);
        return { ok: false as const, reason: "error" as const };
      }
    } else {
      const { error } = await supabaseAdmin
        .from("wholesale_memberships")
        .insert({ store_id: data.storeId, customer_id: userId, status: "pending" });
      if (error) {
        console.error("[requestWholesaleMembership] insert", error);
        return { ok: false as const, reason: "error" as const };
      }
    }

    // Let the seller know (if they're in the bot). Best-effort.
    try {
      const chatId = await chatIdForUser((store as any).seller_id);
      if (chatId) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email, phone")
          .eq("id", userId)
          .maybeSingle();
        const p = prof as any;
        await sendMessage(
          chatId,
          `🛒 درخواست خرید عمده‌ی تازه — ${(store as any).store_name}\n\n` +
            `👤 ${p?.full_name || "کاربر"}\n` +
            `   ایمیل: ${p?.email || "—"}\n` +
            `   تلفن: ${p?.phone || "—"}\n\n` +
            `برای تأیید یا رد، به پنل فروشنده › خریداران عمده بروید.`
        );
      }
    } catch (e) {
      console.error("[requestWholesaleMembership] notify seller failed", e);
    }

    return { ok: true as const, status: "pending" as const, already: false };
  });

// --- Customer: my memberships (status only; no pricing leaked) -------------
export const getMyWholesaleMemberships = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("wholesale_memberships")
      .select("id, status, requested_at, reviewed_at, stores(id, store_name, slug)")
      .eq("customer_id", context.userId)
      .order("requested_at", { ascending: false });
    logIfError(`getMyWholesaleMemberships(${context.userId})`, error);
    return {
      ok: true as const,
      memberships: (data ?? []).map((m: any) => ({
        id: m.id,
        status: m.status as "pending" | "approved" | "rejected",
        requestedAt: m.requested_at,
        reviewedAt: m.reviewed_at,
        storeId: m.stores?.id ?? null,
        storeName: m.stores?.store_name ?? "فروشگاه",
        storeSlug: m.stores?.slug ?? null,
      })),
    };
  });

// --- Customer: my status for ONE store (drives the request button) --------
export const getMyWholesaleStatusForStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ storeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: m } = await supabaseAdmin
      .from("wholesale_memberships")
      .select("status")
      .eq("store_id", data.storeId)
      .eq("customer_id", context.userId)
      .maybeSingle();
    return {
      ok: true as const,
      status: ((m as any)?.status ?? null) as "pending" | "approved" | "rejected" | null,
    };
  });

// --- Seller: all wholesale requests for one of their stores ----------------
export const listStoreWholesaleRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ storeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const gate = await assertCanManageStore(context.userId, data.storeId);
    if (!gate.ok) return { ok: false as const, reason: gate.reason };

    const { data: rows, error } = await supabaseAdmin
      .from("wholesale_memberships")
      .select("id, status, oil_profit_percent, requested_at, reviewed_at, customer_id")
      .eq("store_id", data.storeId)
      .order("requested_at", { ascending: false });
    logIfError(`listStoreWholesaleRequests(${data.storeId})`, error);

    const customerIds = [...new Set((rows ?? []).map((r: any) => r.customer_id).filter(Boolean))];
    const profById = new Map<string, any>();
    if (customerIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", customerIds);
      for (const p of (profs ?? []) as any[]) profById.set(p.id, p);
    }

    // store default rate, so the UI can show "uses store default (X%)"
    const { data: sps } = await supabaseAdmin
      .from("store_pricing_settings")
      .select("wholesale_oil_profit_percent")
      .eq("store_id", data.storeId)
      .maybeSingle();

    return {
      ok: true as const,
      storeDefaultOilProfit: (sps as any)?.wholesale_oil_profit_percent ?? null,
      requests: (rows ?? []).map((r: any) => {
        const p = profById.get(r.customer_id);
        return {
          id: r.id,
          status: r.status as "pending" | "approved" | "rejected",
          oilProfitPercent: r.oil_profit_percent, // per-buyer override, or null = store default
          requestedAt: r.requested_at,
          reviewedAt: r.reviewed_at,
          customerId: r.customer_id,
          customerName: p?.full_name || "کاربر",
          customerEmail: p?.email || null,
          customerPhone: p?.phone || null,
        };
      }),
    };
  });

// --- Seller: approve / reject (and optionally set a per-buyer rate) --------
export const reviewWholesaleMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        membershipId: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        // per-buyer oil profit %; omit to use the store default, null to clear it
        oilProfitPercent: z.number().min(0).max(1000).nullable().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { data: m } = await supabaseAdmin
      .from("wholesale_memberships")
      .select("id, store_id, customer_id, status, stores(store_name)")
      .eq("id", data.membershipId)
      .maybeSingle();
    if (!m) return { ok: false as const, reason: "not_found" as const };

    const gate = await assertCanManageStore(context.userId, (m as any).store_id);
    if (!gate.ok) return { ok: false as const, reason: gate.reason };

    const patch: Record<string, any> = {
      status: data.decision === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.userId,
    };
    // Only the per-buyer override is touched when the seller explicitly sends it.
    if (data.decision === "approve" && data.oilProfitPercent !== undefined) {
      patch.oil_profit_percent = data.oilProfitPercent;
    }

    const { error } = await supabaseAdmin
      .from("wholesale_memberships")
      .update(patch as any)
      .eq("id", data.membershipId);
    if (error) {
      console.error("[reviewWholesaleMembership] update", error);
      return { ok: false as const, reason: "error" as const };
    }

    // Tell the customer (best-effort, only if they're in the bot).
    try {
      const chatId = await chatIdForUser((m as any).customer_id);
      if (chatId) {
        const storeName = (m as any).stores?.store_name || "فروشگاه";
        const text =
          data.decision === "approve"
            ? `✅ درخواست خرید عمده‌ی شما در «${storeName}» تأیید شد.\nاز این پس قیمت‌های عمده را می‌بینید.`
            : `❌ درخواست خرید عمده‌ی شما در «${storeName}» رد شد.`;
        await sendMessage(chatId, text);
      }
    } catch (e) {
      console.error("[reviewWholesaleMembership] notify customer failed", e);
    }

    return { ok: true as const };
  });
