import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin, logIfError } from "@/lib/bale.server";
import { confirmBalePayment } from "@/lib/bale-payment.server";

// Called every few minutes by a plain Linux cron job on the host (not
// pg_cron — this Supabase project doesn't have it enabled). Two jobs:
//  1. Cancel pending_payment orders whose 30-minute window passed and
//     release their reserved inventory (expire_pending_bale_orders()).
//  2. Retry confirming any successful_payment whose first inquireTransaction
//     call failed (network/API error) rather than returned a definitive
//     answer — only within a short window, since a mismatch or
//     already-processed result is terminal and re-checking it won't change
//     the outcome, it would just spam admin alerts on every cron tick.
export const Route = createFileRoute("/api/public/bale/cron-expire")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          console.error("[bale cron] CRON_SECRET is not configured");
          return Response.json({ error: "not configured" }, { status: 500 });
        }
        const auth = request.headers.get("authorization");
        if (auth !== `Bearer ${secret}`) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        const { data: expiredCount, error: expireErr } = await supabaseAdmin.rpc(
          "expire_pending_bale_orders"
        );
        logIfError("cron expire_pending_bale_orders", expireErr);

        // Same window as the order's own payment_expires_at (30 min): once
        // that passes, expire_pending_bale_orders() above already cancels
        // the order, so retrying inquireTransaction past that point is moot.
        const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data: unresolved, error: unresolvedErr } = await supabaseAdmin
          .from("bale_payment_events")
          .select("order_id, chat_id, transaction_id, amount_rial")
          .eq("matched", false)
          .not("order_id", "is", null)
          .not("transaction_id", "is", null)
          .gte("created_at", cutoff);
        logIfError("cron unresolved bale_payment_events", unresolvedErr);

        let retried = 0;
        let retriedConfirmed = 0;
        for (const ev of unresolved ?? []) {
          retried++;
          const result = await confirmBalePayment({
            orderId: (ev as any).order_id,
            transactionId: (ev as any).transaction_id,
            chatId: (ev as any).chat_id ?? null,
            amountRial: Number((ev as any).amount_rial) || 0,
          });
          if (result === "confirmed") retriedConfirmed++;
        }

        console.log("[bale cron]", { expired: expiredCount ?? 0, retried, retriedConfirmed });

        return Response.json({
          ok: true,
          expired: expiredCount ?? 0,
          retried,
          retriedConfirmed,
        });
      },
      GET: async () => new Response("bale cron endpoint ready"),
    },
  },
});
