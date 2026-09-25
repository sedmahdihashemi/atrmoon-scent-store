import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin, logIfError } from "@/lib/bale.server";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ATTEMPTS = 10;
const MIN_INTERVAL_MS = 30 * 1000; // 30s between submissions

// Checks the actual file bytes (magic numbers), not the filename extension
// or the declared Content-Type, both of which are trivially spoofable.
function detectImageType(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export const Route = createFileRoute("/api/public/orders/submit-receipt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let form: FormData;
        try {
          form = await request.formData();
        } catch (e) {
          console.error("[submit-receipt] form parse failed", e);
          return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
        }

        const orderId = form.get("orderId");
        const note = form.get("note");
        const file = form.get("file");

        if (typeof orderId !== "string" || !/^[0-9a-fA-F-]{36}$/.test(orderId)) {
          return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
        }
        const noteText = typeof note === "string" ? note.trim().slice(0, 500) : "";
        const hasFile = file instanceof File && file.size > 0;
        if (!noteText && !hasFile) {
          return Response.json({ ok: false, reason: "empty" }, { status: 400 });
        }

        const { data: order, error: orderErr } = await supabaseAdmin
          .from("orders")
          .select(
            "id, status, payment_method, payment_expires_at, card_transfer_attempt_count, card_transfer_submitted_at, card_transfer_receipt_path"
          )
          .eq("id", orderId)
          .maybeSingle();
        logIfError(`submit-receipt order(${orderId})`, orderErr);
        if (!order) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });

        const o = order as any;
        if (o.payment_method !== "card_transfer" || o.status !== "pending_payment") {
          return Response.json({ ok: false, reason: "not_pending" }, { status: 409 });
        }
        const expiresAt = o.payment_expires_at ? new Date(o.payment_expires_at).getTime() : 0;
        if (expiresAt && expiresAt < Date.now()) {
          return Response.json({ ok: false, reason: "expired" }, { status: 409 });
        }
        if ((o.card_transfer_attempt_count ?? 0) >= MAX_ATTEMPTS) {
          return Response.json({ ok: false, reason: "too_many_attempts" }, { status: 429 });
        }
        if (o.card_transfer_submitted_at) {
          const last = new Date(o.card_transfer_submitted_at).getTime();
          if (Date.now() - last < MIN_INTERVAL_MS) {
            return Response.json({ ok: false, reason: "rate_limited" }, { status: 429 });
          }
        }

        let receiptPath: string | null = o.card_transfer_receipt_path ?? null;
        if (hasFile) {
          const f = file as File;
          if (f.size > MAX_SIZE) {
            return Response.json({ ok: false, reason: "file_too_large" }, { status: 400 });
          }
          const buf = new Uint8Array(await f.arrayBuffer());
          const kind = detectImageType(buf);
          if (!kind) {
            return Response.json({ ok: false, reason: "invalid_file_type" }, { status: 400 });
          }
          const randomName = `${crypto.randomUUID()}.${kind}`;
          const path = `${orderId}/${randomName}`;
          const { error: upErr } = await supabaseAdmin.storage.from("payment-receipts").upload(path, buf, {
            contentType: kind === "jpg" ? "image/jpeg" : kind === "png" ? "image/png" : "image/webp",
            upsert: false,
          });
          if (upErr) {
            console.error("[submit-receipt] upload failed", upErr);
            return Response.json({ ok: false, reason: "upload_failed" }, { status: 500 });
          }
          receiptPath = path;
        }

        const { error: updErr } = await supabaseAdmin
          .from("orders")
          .update({
            card_transfer_receipt_path: receiptPath,
            card_transfer_note: noteText || null,
            card_transfer_submitted_at: new Date().toISOString(),
            card_transfer_reviewed_at: null,
            card_transfer_rejection_reason: null,
            card_transfer_attempt_count: (o.card_transfer_attempt_count ?? 0) + 1,
          })
          .eq("id", orderId);
        if (updErr) {
          console.error("[submit-receipt] order update failed", updErr);
          return Response.json({ ok: false, reason: "error" }, { status: 500 });
        }

        return Response.json({ ok: true });
      },
      GET: async () => new Response("submit-receipt endpoint ready"),
    },
  },
});
