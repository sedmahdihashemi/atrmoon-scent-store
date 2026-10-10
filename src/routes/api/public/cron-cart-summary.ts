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

          const { data: carts } = await supabaseAdmin
            .from("carts")
            .select("id, customer_id")
            .eq("store_id", store.id);
          const cartList = (carts ?? []) as any[];
          const cartIds = cartList.map((c) => c.id);
          if (cartIds.length === 0) continue;

          const { data: items } = await supabaseAdmin
            .from("cart_items")
            .select("cart_id, quantity, products(name), product_variants(volume_ml, bottle_name)")
            .in("cart_id", cartIds);
          if (!items || items.length === 0) continue;

          // group the items under each cart
          const byCart = new Map<string, string[]>();
          for (const it of items as any[]) {
            const name = it.products?.name ?? "محصول";
            const vol = it.product_variants?.volume_ml;
            const bottle = it.product_variants?.bottle_name;
            const line = `   • ${name}${vol ? ` — ${vol} میلی‌لیتر` : ""}${bottle ? ` (${bottle})` : ""} × ${(Number(it.quantity) || 0).toLocaleString("fa-IR")}`;
            if (!byCart.has(it.cart_id)) byCart.set(it.cart_id, []);
            byCart.get(it.cart_id)!.push(line);
          }

          // look up who owns each (logged-in) cart
          const customerIds = [...new Set(cartList.filter((c) => c.customer_id).map((c) => c.customer_id))];
          const profById = new Map<string, any>();
          if (customerIds.length) {
            const { data: profs } = await supabaseAdmin
              .from("profiles")
              .select("id, full_name, email, phone")
              .in("id", customerIds);
            for (const p of (profs ?? []) as any[]) profById.set(p.id, p);
          }

          const blocks: string[] = [];
          for (const cart of cartList) {
            const lines = byCart.get(cart.id);
            if (!lines || lines.length === 0) continue;
            let who: string;
            if (cart.customer_id) {
              const p = profById.get(cart.customer_id);
              who =
                `👤 ${p?.full_name || "کاربر"}\n` +
                `   ایمیل: ${p?.email || "—"}\n` +
                `   تلفن: ${p?.phone || "—"}`;
            } else {
              who = "👤 مهمان (بدون حساب)";
            }
            blocks.push(`${who}\n${lines.join("\n")}`);
          }
          if (blocks.length === 0) continue;

          const text =
            `📊 خلاصه‌ی هفتگی سبدهای خرید — ${store.store_name}\n\n` +
            blocks.join("\n\n") +
            `\n\nمجموع: ${blocks.length.toLocaleString("fa-IR")} سبد فعال`;

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
