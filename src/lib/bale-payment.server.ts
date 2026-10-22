import {
  supabaseAdmin,
  sendMessage,
  sendToAdmins,
  inquireTransaction,
  tomanToRial,
  logIfError,
} from "@/lib/bale.server";
import { sellerAdminChatIds } from "@/lib/bale-notify.functions";

// Official system payment receipt — sent by the bot itself to the customer and
// to the shop side (seller + super-admins). Because it comes from the bot (not
// forwarded by the buyer) and carries Bale's own tracking/reference numbers, a
// customer can't fake it. storeName + bot username anchor it to this shop.
function buildPaymentReceipt(o: {
  storeName: string;
  orderNumber: string;
  totalToman: number;
  trackingId: string | null; // telegram_payment_charge_id — "شماره پیگیری"
  referenceId: string | null; // provider_payment_charge_id — "شماره مرجع"
}): string {
  const fa = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.round(n));
  let when = "";
  try {
    when = new Date().toLocaleString("fa-IR-u-ca-persian", {
      timeZone: "Asia/Tehran",
      dateStyle: "full",
      timeStyle: "medium",
    });
  } catch {
    when = new Date().toLocaleString("fa-IR", { timeZone: "Asia/Tehran" });
  }
  const bot = process.env.BALE_BOT_USERNAME ? `@${process.env.BALE_BOT_USERNAME}` : "";
  return (
    "✅ پرداخت با موفقیت انجام شد\n\n" +
    `🏪 فروشگاه: ${o.storeName}\n` +
    `🧾 شماره سفارش: ${o.orderNumber}\n` +
    `💰 مبلغ واریزی: ${fa(o.totalToman)} تومان (${fa(tomanToRial(o.totalToman))} ریال)\n` +
    `🔖 شماره پیگیری: ${o.trackingId ?? "—"}\n` +
    `🔖 شماره مرجع: ${o.referenceId ?? "—"}\n` +
    `🗓 تاریخ: ${when}\n\n` +
    (bot ? `بابت: پرداخت در عطرمون — ${bot}\n` : "")
  );
}

export type ConfirmBalePaymentResult =
  | "confirmed"
  | "already_processed"
  | "mismatch"
  | "inquire_failed"
  | "order_not_found";

// Shared by the successful_payment webhook handler (first attempt) and the
// cron retry endpoint (later attempts, when the first inquireTransaction
// call failed). Never marks an order paid without a successful
// inquireTransaction confirming status=paid and the exact amount.
export async function confirmBalePayment(params: {
  orderId: string;
  transactionId: string;
  chatId: number | null;
  amountRial: number;
  referenceId?: string | null; // provider_payment_charge_id ("شماره مرجع")
}): Promise<ConfirmBalePaymentResult> {
  const { orderId, transactionId, chatId, amountRial, referenceId = null } = params;

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("id, status, payment_method, total_amount, order_number, store_id, customer_id, stores(store_name)")
    .eq("id", orderId)
    .maybeSingle();
  logIfError(`confirmBalePayment order(${orderId})`, orderErr);
  if (!order) return "order_not_found";

  let verified: any;
  try {
    verified = await inquireTransaction(transactionId);
  } catch (e) {
    console.error("[bale] inquireTransaction threw", { orderId, transactionId, error: String(e) });
    return "inquire_failed";
  }
  if (!verified?.ok || !verified?.result) {
    console.error("[bale] inquireTransaction failed", { orderId, transactionId, response: verified });
    return "inquire_failed";
  }

  const txn = verified.result;
  const expectedRial = tomanToRial((order as any).total_amount);
  if (txn.status !== "paid" || Number(txn.amount) !== expectedRial) {
    console.error("[bale] inquireTransaction mismatch", { orderId, transactionId, txn, expectedRial });
    await sendToAdmins(
      `⚠️ ناهماهنگی در تأیید پرداخت سفارش ${orderId}.\nوضعیت گزارش‌شده: ${txn.status}\nمبلغ: ${txn.amount} (انتظار: ${expectedRial})`
    );
    if (chatId) await sendMessage(chatId, "در تأیید پرداخت مشکلی پیش آمد. لطفاً با پشتیبانی تماس بگیرید.");
    return "mismatch";
  }

  // Atomic + idempotent: only flips orders that are still pending_payment.
  const { data: updated, error: updErr } = await supabaseAdmin
    .from("orders")
    .update({
      status: "pending_contact",
      bale_transaction_id: transactionId,
      bale_reference_id: referenceId,
      paid_amount_rial: amountRial,
      paid_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "pending_payment")
    .select("id")
    .maybeSingle();
  logIfError(`confirmBalePayment update order(${orderId})`, updErr);

  if (!updated) {
    // Real money moved but we can't apply it to an order that's no longer
    // pending_payment (duplicate delivery, or it expired in between).
    // No refund API exists in Bale's docs, so a human has to handle this.
    console.error("[bale] payment confirmed for non-pending order", { orderId, transactionId, amountRial });
    await sendToAdmins(
      `⚠️ پرداخت موفق برای سفارش ${orderId} تأیید شد ولی سفارش دیگر «در انتظار پرداخت» نبود ` +
        `(احتمالاً تکراری یا منقضی‌شده). تراکنش: ${transactionId}، مبلغ: ${amountRial} ریال. ` +
        `نیاز به بررسی دستی (بازپرداخت فقط از طریق پشتیبانی بله ممکن است، API بازپرداختی وجود ندارد).`
    );
    if (chatId) {
      await sendMessage(
        chatId,
        "پرداخت شما دریافت شد. اگر سفارش قبلاً پردازش شده بود، با پشتیبانی تماس بگیرید تا بررسی شود."
      );
    }
    return "already_processed";
  }

  await supabaseAdmin
    .from("bale_payment_events")
    .update({ matched: true })
    .eq("order_id", orderId)
    .eq("transaction_id", transactionId);

  // Official receipt: identical facts to the customer and to the shop side, so
  // the seller has a trustworthy, bot-delivered record (no fake slips).
  const o = order as any;
  const receipt = buildPaymentReceipt({
    storeName: o.stores?.store_name ?? "عطرمون",
    orderNumber: o.order_number,
    totalToman: Number(o.total_amount),
    trackingId: transactionId,
    referenceId,
  });

  try {
    if (chatId) {
      await sendMessage(chatId, receipt + "\nفروشنده به‌زودی برای هماهنگی ارسال با شما تماس می‌گیرد.");
    }
    const shopChats = await sellerAdminChatIds(o.store_id);
    for (const c of shopChats) {
      if (c === chatId) continue; // avoid a duplicate if seller == buyer
      await sendMessage(c, "📥 پرداخت تأییدشده برای سفارش شما\n\n" + receipt + "\nاین رسید رسمیِ سیستم است؛ نیازی به فیشِ دستی نیست.");
    }
  } catch (e) {
    console.error("[bale] sending payment receipt failed", orderId, e);
  }

  return "confirmed";
}
