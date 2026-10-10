import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin, sendMessage, logIfError } from "@/lib/bale.server";

// Weekly digest (triggered by a host cron job): for each store whose seller is
// logged into the bot, send a summary of what's currently sitting in customers'
// carts. This replaces per-add notifications, which would flood the seller.
export const Route = createFileRoute("/api/public/cron-cart-summary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return Response.json({ error: "not configured" }, { status: 500 });
        if (request.headers.get("authorization") !== `Bearer ${secret}`) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        // stores + their seller's bot chat
        const { data: stores, error: storesErr } = await supabaseAdmin
          .from("stores")
          .select("id, store_name, seller_id");
        logIfError("cartSummary stores", storesErr);
        const sellerIds = [...new Set((stores ?? []).map((s: any) => s.seller_id).filter(Boolean))];
        if (sellerIds.length === 0) return Response.json({ ok: true, sent: 0 });

        const { data: sessions } = await supabaseAdmin
          .from("bot_sessions")
          .select("chat_id, user_id")
          .in("user_id", sellerIds);
        const chatBySeller = new Map<string, number>();
        for (const s of sessions ?? []) chatBySeller.set((s as any).user_id, Number((s as any).chat_id));

        let sent = 0;
        for (const store of (stores ?? []) as any[]) {
          const chatId = chatBySeller.get(store.seller_id);
          if (!chatId) continue; // seller not in the bot — nothing to send to

          const { data: carts } = await supabaseAdmin.from("carts").select("id").eq("store_id", store.id);
          const cartIds = (carts ?? []).map((c: any) => c.id);
          if (cartIds.length === 0) continue;

          const { data: items } = await supabaseAdmin
            .from("cart_items")
            .select("cart_id, quantity, products(name), product_variants(volume_ml, bottle_name)")
            .in("cart_id", cartIds);
          if (!items || items.length === 0) continue;

          // group by product + variant
          const map = new Map<string, { label: string; qty: number; carts: Set<string> }>();
          for (const it of items as any[]) {
            const name = it.products?.name ?? "محصول";
            const vol = it.product_variants?.volume_ml;
            const bottle = it.product_variants?.bottle_name;
            const label = `${name}${vol ? ` — ${vol} میلی‌لیتر` : ""}${bottle ? ` (${bottle})` : ""}`;
            const key = label;
            if (!map.has(key)) map.set(key, { label, qty: 0, carts: new Set() });
            const e = map.get(key)!;
            e.qty += Number(it.quantity) || 0;
            e.carts.add(it.cart_id);
          }

          const lines = [...map.values()]
            .sort((a, b) => b.qty - a.qty)
            .map((e) => `• ${e.label} — ${e.qty.toLocaleString("fa-IR")} عدد در ${e.carts.size.toLocaleString("fa-IR")} سبد`);
          const totalCarts = new Set((items as any[]).map((i) => i.cart_id)).size;

          const text =
            `📊 <b>خلاصه‌ی هفتگی سبدهای خرید — ${store.store_name}</b>\n\n` +
            lines.join("\n") +
            `\n\nمجموع: ${totalCarts.toLocaleString("fa-IR")} سبد فعال`;

          await sendMessage(chatId, text);
          sent++;
        }

        console.log("[cart summary]", { sent });
        return Response.json({ ok: true, sent });
      },
      GET: async () => new Response("cart summary cron endpoint ready"),
    },
  },
});
