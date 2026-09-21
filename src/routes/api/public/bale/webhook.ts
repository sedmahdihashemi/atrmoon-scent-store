import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  sendMessage,
  supabaseAdmin,
  buildInvoiceText,
  statusFa,
  logIfError,
  sendInvoice,
  answerPreCheckoutQuery,
  inquireTransaction,
  sendToAdmins,
  tomanToRial,
} from "@/lib/bale.server";
import { notifyOrder } from "@/lib/bale-notify.functions";

function authClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getSession(chat_id: number) {
  const { data, error } = await supabaseAdmin
    .from("bot_sessions")
    .select("*")
    .eq("chat_id", chat_id)
    .maybeSingle();
  logIfError(`getSession(${chat_id})`, error);
  return data as any;
}

async function upsertSession(chat_id: number, patch: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from("bot_sessions")
    .upsert({ chat_id, ...patch }, { onConflict: "chat_id" });
  logIfError(`upsertSession(${chat_id})`, error);
}

async function getRole(user_id: string): Promise<"super_admin" | "seller" | "customer" | null> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user_id);
  logIfError(`getRole(${user_id})`, error);
  const roles = (data ?? []).map((r: any) => r.role);
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("seller")) return "seller";
  if (roles.includes("customer")) return "customer";
  return null;
}

const HELP =
  "دستورات:\n" +
  "/login — ورود با ایمیل و رمز\n" +
  "/logout — خروج\n" +
  "/orders — نمایش آخرین سفارش‌ها\n" +
  "/track <کد پیگیری> — وضعیت سفارش\n" +
  "/help — راهنما";

const HELP_CUSTOMER =
  "دستورات:\n" +
  "/orders — سفارش‌های من\n" +
  "/track <کد پیگیری> — وضعیت یک سفارش\n" +
  "/review <کد> <امتیاز ۱ تا ۵> <متن نظر> — ثبت نظر\n" +
  "/logout — خروج از حساب\n" +
  "/help — راهنما";

const HELP_SELLER =
  "دستورات فروشنده:\n" +
  "/orders — آخرین سفارش‌های فروشگاه شما\n" +
  "/track <کد پیگیری> — جزئیات یک سفارش\n" +
  "/logout — خروج\n" +
  "/help — راهنما";

const HELP_ADMIN =
  "دستورات سوپر ادمین:\n" +
  "/orders — آخرین سفارش‌های کل سامانه\n" +
  "/track <کد پیگیری> — جزئیات سفارش\n" +
  "/logout — خروج\n" +
  "/help — راهنما";

function helpFor(role: string | null) {
  if (role === "super_admin") return HELP_ADMIN;
  if (role === "seller") return HELP_SELLER;
  if (role === "customer") return HELP_CUSTOMER;
  return HELP;
}

const WELCOME_START =
  "سلام! 🌹 به ربات <b>عطرمون</b> خوش آمدید.\n\n" +
  "برای استفاده از بات ابتدا وارد حساب کاربری خود شوید.\n\n" +
  "👈 برای ورود، دستور زیر را بفرستید:\n<code>/login</code>\n\n" +
  "سپس از شما ابتدا <b>ایمیل</b> و بعد <b>رمز عبور</b> پرسیده می‌شود.\n\n" +
  "🔎 برای پیگیری سریع یک سفارش بدون ورود:\n<code>/track ATR-XXXXXX-XXXXX</code>";

async function handleLoggedIn(chat_id: number, user_id: string, text: string) {
  const role = await getRole(user_id);
  let t = text.trim();
  // Allow sending a bare order code (e.g. ATR-260522-95419) as a /track shortcut
  if (/^ATR-[0-9]{6}-[0-9]{4,6}$/i.test(t)) {
    t = "/track " + t.toUpperCase();
  }

  if (t === "/orders") {
    let query = supabaseAdmin
      .from("orders")
      .select("id, order_number, status, total_amount, created_at, store_id")
      .order("created_at", { ascending: false })
      .limit(5);
    if (role === "seller") {
      const { data: stores, error: storesErr } = await supabaseAdmin
        .from("stores")
        .select("id")
        .eq("seller_id", user_id);
      logIfError(`/orders stores(${user_id})`, storesErr);
      const ids = (stores ?? []).map((s: any) => s.id);
      if (ids.length === 0) {
        await sendMessage(chat_id, "فروشگاهی برای شما ثبت نشده است.");
        return;
      }
      query = query.in("store_id", ids);
    } else if (role === "customer") {
      query = query.eq("customer_id", user_id);
    } else if (role !== "super_admin") {
      await sendMessage(chat_id, "دسترسی ندارید.");
      return;
    }
    const { data: orders, error: ordersErr } = await query;
    logIfError(`/orders query(${user_id})`, ordersErr);
    if (!orders || orders.length === 0) {
      await sendMessage(chat_id, "سفارشی یافت نشد.\nبرای پیگیری یک سفارش خاص: <code>/track ATR-...</code>");
      return;
    }
    const lines = orders.map(
      (o: any) =>
        `• <code>${o.order_number}</code> — ${statusFa(o.status)} — ${new Intl.NumberFormat("fa-IR").format(Number(o.total_amount))} تومان`
    );
    await sendMessage(chat_id, `آخرین سفارش‌ها:\n${lines.join("\n")}\n\nبرای جزئیات: <code>/track شماره</code>`);
    return;
  }

  if (t.startsWith("/track")) {
    const code = t.replace("/track", "").trim().toUpperCase();
    if (!code) {
      await sendMessage(chat_id, "کد پیگیری را وارد کنید: /track ATR-...");
      return;
    }
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, store_id, customer_id")
      .eq("order_number", code)
      .maybeSingle();
    logIfError(`/track order(${code})`, orderErr);
    if (!order) {
      await sendMessage(chat_id, "سفارشی با این کد یافت نشد.");
      return;
    }
    // authorization for non-admin
    if (role !== "super_admin") {
      if (role === "seller") {
        const { data: s, error: sErr } = await supabaseAdmin
          .from("stores")
          .select("seller_id")
          .eq("id", (order as any).store_id)
          .maybeSingle();
        logIfError(`/track store(${(order as any).store_id})`, sErr);
        if ((s as any)?.seller_id !== user_id) {
          await sendMessage(chat_id, "دسترسی ندارید.");
          return;
        }
      } else if (role === "customer") {
        if ((order as any).customer_id !== user_id) {
          await sendMessage(chat_id, "این سفارش متعلق به شما نیست.");
          return;
        }
      }
    }
    const built = await buildInvoiceText((order as any).id, { includeStore: role === "super_admin" });
    if (built) await sendMessage(chat_id, built.text);
    return;
  }

  if (t.startsWith("/review")) {
    if (role !== "customer") {
      await sendMessage(chat_id, "فقط مشتریان می‌توانند نظر ثبت کنند.");
      return;
    }
    const rest = t.replace("/review", "").trim();
    const parts = rest.split(/\s+/);
    const code = parts[0];
    const rating = Number(parts[1]);
    const comment = parts.slice(2).join(" ").trim();
    if (!code || !rating || rating < 1 || rating > 5 || !comment) {
      await sendMessage(
        chat_id,
        "قالب صحیح:\n<code>/review ATR-XXXXXX-XXXXX 5 عالی بود</code>\nامتیاز عددی بین ۱ تا ۵."
      );
      return;
    }
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, customer_id")
      .eq("order_number", code)
      .maybeSingle();
    logIfError(`/review order(${code})`, orderErr);
    if (!order || (order as any).customer_id !== user_id) {
      await sendMessage(chat_id, "این سفارش متعلق به شما نیست یا یافت نشد.");
      return;
    }
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .select("product_id")
      .eq("order_id", (order as any).id);
    logIfError(`/review items(${(order as any).id})`, itemsErr);
    const productIds = [...new Set((items ?? []).map((i: any) => i.product_id).filter(Boolean))];
    if (productIds.length === 0) {
      await sendMessage(chat_id, "محصولی برای ثبت نظر یافت نشد.");
      return;
    }
    const rows = productIds.map((pid) => ({
      product_id: pid,
      customer_id: user_id,
      order_id: (order as any).id,
      rating,
      comment,
    }));
    const { error } = await supabaseAdmin.from("reviews").insert(rows);
    if (error) {
      await sendMessage(chat_id, "ثبت نظر ناموفق بود: " + error.message);
      return;
    }
    await sendMessage(chat_id, "✅ نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود. سپاس از همراهی شما 🌹");
    return;
  }

  if (t === "/logout") {
    await upsertSession(chat_id, { user_id: null, state: "idle", state_data: {} });
    await sendMessage(chat_id, "✅ از حساب خارج شدید.\n\nبرای ورود مجدد با حساب دیگر: <code>/login</code>");
    return;
  }

  if (t === "/login") {
    await sendMessage(chat_id, "شما قبلاً وارد شده‌اید.\nبرای ورود با حساب دیگر ابتدا خارج شوید: /logout");
    return;
  }

  await sendMessage(chat_id, helpFor(role));
}

async function handlePublicTrack(chat_id: number, code: string) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("order_number, status, created_at, customer_name")
    .eq("order_number", code)
    .maybeSingle();
  logIfError(`handlePublicTrack(${code})`, error);
  if (!order) {
    await sendMessage(chat_id, "سفارشی با این کد یافت نشد.");
    return;
  }
  await sendMessage(
    chat_id,
    `🔎 وضعیت سفارش\nشماره: <code>${order.order_number}</code>\nوضعیت: ${statusFa(order.status)}\nتاریخ ثبت: ${new Date(order.created_at).toLocaleString("fa-IR")}`
  );
}

// Triggered by the deep link ble.ir/<bot>?start=pay_<orderId>, which Bale
// delivers as a normal /start message with the payload appended
// (confirmed live: text becomes "/start pay_<orderId>").
async function handlePayDeepLink(chat_id: number, orderId: string) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, payment_method, total_amount, payment_expires_at, stores(store_name)")
    .eq("id", orderId)
    .maybeSingle();
  logIfError(`payDeepLink order(${orderId})`, error);

  if (!order) {
    await sendMessage(chat_id, "سفارشی با این شناسه پیدا نشد.");
    return;
  }
  if ((order as any).payment_method !== "bale") {
    await sendMessage(chat_id, "این سفارش برای پرداخت آنلاین ثبت نشده است.");
    return;
  }
  if ((order as any).status !== "pending_payment") {
    await sendMessage(chat_id, "این سفارش قبلاً پرداخت شده یا دیگر معتبر نیست.");
    return;
  }
  const expiresAt = (order as any).payment_expires_at
    ? new Date((order as any).payment_expires_at).getTime()
    : 0;
  if (expiresAt && expiresAt < Date.now()) {
    await sendMessage(chat_id, "مهلت پرداخت این سفارش تمام شده است. لطفاً دوباره از سایت سفارش ثبت کنید.");
    return;
  }

  const storeName = (order as any).stores?.store_name;
  await sendInvoice({
    chat_id,
    title: `سفارش ${(order as any).order_number}`,
    description: (storeName ? `عطرفروشی ${storeName} — ` : "") + "پرداخت سفارش عطرمون",
    payload: orderId,
    amount_rial: tomanToRial((order as any).total_amount),
  });
}

// Bale must respond to the user within 10s of a PreCheckoutQuery, so this
// does exactly one fast DB read before answering. Whether this update type
// actually reaches our webhook at all is unconfirmed — logged either way
// so the first live test settles it.
async function handlePreCheckoutQuery(pcq: any) {
  console.log("[bale pre_checkout_query]", JSON.stringify(pcq).slice(0, 500));

  const orderId: string | undefined = pcq.invoice_payload;
  const totalAmount = Number(pcq.total_amount);

  if (!orderId) {
    console.error("[bale] pre_checkout_query without invoice_payload", pcq);
    await answerPreCheckoutQuery(pcq.id, false, "سفارش یافت نشد.");
    return;
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, payment_method, total_amount, payment_expires_at")
    .eq("id", orderId)
    .maybeSingle();
  logIfError(`preCheckout order(${orderId})`, error);

  if (!order) {
    await answerPreCheckoutQuery(pcq.id, false, "سفارش یافت نشد.");
    return;
  }
  if ((order as any).payment_method !== "bale" || (order as any).status !== "pending_payment") {
    await answerPreCheckoutQuery(pcq.id, false, "این سفارش قبلاً پردازش شده یا معتبر نیست.");
    return;
  }
  const expiresAt = (order as any).payment_expires_at
    ? new Date((order as any).payment_expires_at).getTime()
    : 0;
  if (expiresAt && expiresAt < Date.now()) {
    await answerPreCheckoutQuery(pcq.id, false, "مهلت پرداخت این سفارش تمام شده است.");
    return;
  }
  const expectedRial = tomanToRial((order as any).total_amount);
  if (totalAmount !== expectedRial) {
    console.error("[bale] pre_checkout amount mismatch", { orderId, expectedRial, totalAmount });
    await answerPreCheckoutQuery(pcq.id, false, "مبلغ نامعتبر است.");
    return;
  }

  await answerPreCheckoutQuery(pcq.id, true);
}

// successful_payment webhooks are public input and therefore spoofable —
// this NEVER marks an order paid on the webhook body alone. It always
// re-verifies with inquireTransaction first (mandatory, per instruction).
async function handleSuccessfulPayment(chat_id: number, sp: any) {
  console.log("[bale successful_payment]", JSON.stringify(sp).slice(0, 1000));

  const orderId: string | undefined = sp.invoice_payload;
  const transactionId: string | null =
    sp.provider_payment_charge_id || sp.telegram_payment_charge_id || null;
  const amountRial = Number(sp.total_amount);

  if (!orderId) {
    console.error("[bale] successful_payment without invoice_payload", sp);
    await sendToAdmins(
      `⚠️ پرداخت موفق بدون شناسه‌ی سفارش (invoice_payload خالی).\nمبلغ: ${amountRial} ریال\nتراکنش: ${transactionId}`
    );
    await supabaseAdmin.from("bale_payment_events").insert({
      order_id: null,
      chat_id,
      transaction_id: transactionId,
      amount_rial: Number.isFinite(amountRial) ? amountRial : null,
      matched: false,
      raw_payload: sp,
    });
    await sendMessage(chat_id, "پرداخت شما دریافت شد ولی سفارش مرتبط پیدا نشد. لطفاً با پشتیبانی تماس بگیرید.");
    return;
  }

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("id, status, payment_method, total_amount")
    .eq("id", orderId)
    .maybeSingle();
  logIfError(`successful_payment order(${orderId})`, orderErr);

  // Record the raw event before doing anything else — nothing here should
  // ever be able to make a payment vanish without a trace.
  const { error: evErr } = await supabaseAdmin.from("bale_payment_events").insert({
    order_id: (order as any)?.id ?? null,
    chat_id,
    transaction_id: transactionId,
    amount_rial: Number.isFinite(amountRial) ? amountRial : null,
    matched: false,
    raw_payload: sp,
  });
  logIfError(`successful_payment insert event(${orderId})`, evErr);

  if (!order) {
    console.error("[bale] successful_payment for unknown order", { orderId, transactionId, amountRial });
    await sendToAdmins(
      `⚠️ پرداخت موفق برای سفارشی که پیدا نشد.\nشناسه: ${orderId}\nمبلغ: ${amountRial} ریال\nتراکنش: ${transactionId}`
    );
    await sendMessage(
      chat_id,
      "پرداخت شما دریافت شد ولی سفارش مرتبط پیدا نشد. لطفاً با پشتیبانی تماس بگیرید و همین پیام را نشان دهید."
    );
    return;
  }

  if (!transactionId) {
    console.error("[bale] successful_payment missing transaction id", { orderId, raw: sp });
    await sendToAdmins(`⚠️ پرداخت موفق بدون شناسه‌ی تراکنش برای سفارش ${orderId}. نیاز به بررسی دستی.`);
    await sendMessage(chat_id, "پرداخت شما در حال بررسی است. اگر تا چند دقیقه‌ی دیگر تأیید نشد، با پشتیبانی تماس بگیرید.");
    return;
  }

  // Mandatory server-side verification. On any inquiry failure: log, do NOT
  // confirm, do NOT reject — leave the order pending_payment for the retry
  // pass (step د) to pick up again later.
  let verified: any;
  try {
    verified = await inquireTransaction(transactionId);
  } catch (e) {
    console.error("[bale] inquireTransaction threw", { orderId, transactionId, error: String(e) });
    await sendMessage(
      chat_id,
      "پرداخت شما در حال تأیید است، چند لحظه صبر کنید. اگر تا چند دقیقه‌ی دیگر تأیید نشد، با پشتیبانی تماس بگیرید."
    );
    return;
  }

  if (!verified?.ok || !verified?.result) {
    console.error("[bale] inquireTransaction failed", { orderId, transactionId, response: verified });
    await sendMessage(
      chat_id,
      "پرداخت شما در حال تأیید است، چند لحظه صبر کنید. اگر تا چند دقیقه‌ی دیگر تأیید نشد، با پشتیبانی تماس بگیرید."
    );
    return;
  }

  const txn = verified.result;
  const expectedRial = tomanToRial((order as any).total_amount);
  if (txn.status !== "paid" || Number(txn.amount) !== expectedRial) {
    console.error("[bale] inquireTransaction mismatch", { orderId, transactionId, txn, expectedRial });
    await sendToAdmins(
      `⚠️ ناهماهنگی در تأیید پرداخت سفارش ${orderId}.\nوضعیت گزارش‌شده: ${txn.status}\nمبلغ: ${txn.amount} (انتظار: ${expectedRial})`
    );
    await sendMessage(chat_id, "در تأیید پرداخت مشکلی پیش آمد. لطفاً با پشتیبانی تماس بگیرید.");
    return;
  }

  // Atomic + idempotent: only flips orders that are still pending_payment,
  // so a duplicate webhook delivery for an already-processed order is a
  // guaranteed no-op here (handled below), never a double-update.
  const { data: updated, error: updErr } = await supabaseAdmin
    .from("orders")
    .update({
      status: "pending_contact",
      bale_transaction_id: transactionId,
      paid_amount_rial: amountRial,
      paid_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "pending_payment")
    .select("id")
    .maybeSingle();
  logIfError(`successful_payment update order(${orderId})`, updErr);

  if (!updated) {
    // Real money moved but we can't apply it to an order that's no longer
    // pending_payment (duplicate delivery, or it expired in between).
    // No refund API exists in Bale's docs, so a human has to handle this.
    console.error("[bale] successful_payment for non-pending order", { orderId, transactionId, amountRial });
    await sendToAdmins(
      `⚠️ پرداخت موفق برای سفارش ${orderId} رسید ولی سفارش دیگر «در انتظار پرداخت» نبود ` +
        `(احتمالاً تکراری یا منقضی‌شده). تراکنش: ${transactionId}، مبلغ: ${amountRial} ریال. ` +
        `نیاز به بررسی دستی (بازپرداخت فقط از طریق پشتیبانی بله ممکن است، API بازپرداختی وجود ندارد).`
    );
    await sendMessage(
      chat_id,
      "پرداخت شما دریافت شد. اگر سفارش قبلاً پردازش شده بود، با پشتیبانی تماس بگیرید تا بررسی شود."
    );
    return;
  }

  await supabaseAdmin
    .from("bale_payment_events")
    .update({ matched: true })
    .eq("order_id", orderId)
    .eq("transaction_id", transactionId);

  await sendMessage(chat_id, "✅ پرداخت شما با موفقیت تأیید شد. فروشنده به‌زودی برای هماهنگی ارسال با شما تماس می‌گیرد.");

  try {
    await notifyOrder({ data: { orderId } });
  } catch (e) {
    console.error("[bale] notifyOrder after payment failed", orderId, e);
  }
}

async function handleUpdate(update: any) {
  console.log("[bale update]", JSON.stringify(update).slice(0, 500));

  if (update.pre_checkout_query) {
    await handlePreCheckoutQuery(update.pre_checkout_query);
    return;
  }

  const msg = update.message ?? update.edited_message;
  if (!msg?.chat?.id) {
    console.log("[bale] unhandled update type (no chat id)", JSON.stringify(update).slice(0, 500));
    return;
  }
  const chat_id: number = msg.chat.id;

  if (msg.successful_payment) {
    await handleSuccessfulPayment(chat_id, msg.successful_payment);
    return;
  }

  const text: string = (msg.text ?? "").toString();
  console.log("[bale] chat", chat_id, "text", text);

  let session = await getSession(chat_id);
  if (!session) {
    await upsertSession(chat_id, { state: "idle", state_data: {} });
    session = { chat_id, user_id: null, state: "idle", state_data: {} };
  }

  // Deep link from checkout: ble.ir/<bot>?start=pay_<orderId> arrives as
  // "/start pay_<orderId>". Works regardless of bot login — the order id
  // (a UUID) is unguessable, so it acts as its own bearer token; a guest
  // checkout customer isn't required to /login just to pay.
  const payMatch = text.trim().match(/^\/start\s+pay_([0-9a-fA-F-]{36})$/);
  if (payMatch) {
    await handlePayDeepLink(chat_id, payMatch[1]);
    return;
  }

  // Public /track works without login
  const trimmed = text.trim();
  const bareCode = /^ATR-[0-9]{6}-[0-9]{4,6}$/i.test(trimmed);
  if ((trimmed.startsWith("/track") || (bareCode && !session.user_id)) && !session.user_id) {
    const code = (bareCode ? trimmed : trimmed.replace("/track", "").trim()).toUpperCase();
    if (!code) {
      await sendMessage(chat_id, "کد پیگیری را وارد کنید: /track ATR-...");
      return;
    }
    await handlePublicTrack(chat_id, code);
    return;
  }

  if (text === "/start" || text === "/help") {
    if (session.user_id) {
      const role = await getRole(session.user_id);
      await sendMessage(chat_id, "سلام دوباره! 🌹\n\n" + helpFor(role));
    } else {
      await sendMessage(chat_id, WELCOME_START);
    }
    return;
  }

  // Login flow
  if (text === "/login") {
    await upsertSession(chat_id, { state: "awaiting_email", state_data: {} });
    await sendMessage(chat_id, "📧 لطفاً <b>ایمیل</b> خود را در یک پیام بفرستید:\n(برای انصراف: /cancel)");
    return;
  }

  if (text === "/cancel") {
    await upsertSession(chat_id, { state: "idle", state_data: {} });
    await sendMessage(chat_id, "عملیات لغو شد.");
    return;
  }

  if (session.state === "awaiting_email") {
    const email = text.trim();
    if (email === "/cancel") {
      await upsertSession(chat_id, { state: "idle", state_data: {} });
      await sendMessage(chat_id, "ورود لغو شد.");
      return;
    }
    if (!email.includes("@")) {
      await sendMessage(chat_id, "❌ ایمیل نامعتبر است. لطفاً دوباره ایمیل صحیح را بفرستید یا /cancel کنید.");
      return;
    }
    await upsertSession(chat_id, { state: "awaiting_password", state_data: { email } });
    await sendMessage(chat_id, "🔑 حالا <b>رمز عبور</b> خود را بفرستید:");
    return;
  }

  if (session.state === "awaiting_password") {
    const email = (session.state_data?.email ?? "").trim();
    const password = text;
    if (password === "/cancel") {
      await upsertSession(chat_id, { state: "idle", state_data: {} });
      await sendMessage(chat_id, "ورود لغو شد.");
      return;
    }
    const { data: auth, error } = await authClient().auth.signInWithPassword({ email, password });
    if (error || !auth?.user) {
      await upsertSession(chat_id, { state: "idle", state_data: {} });
      await sendMessage(chat_id, "❌ ایمیل یا رمز نادرست است. برای تلاش دوباره: /login");
      return;
    }
    const role = await getRole(auth.user.id);
    await upsertSession(chat_id, { user_id: auth.user.id, state: "idle", state_data: {} });
    const roleLabel =
      role === "super_admin" ? "سوپر ادمین 👑"
      : role === "seller" ? "فروشنده 🏬"
      : role === "customer" ? "مشتری 🌹"
      : "کاربر";
    let welcome = "";
    if (role === "super_admin") {
      welcome = `✅ خوش آمدید، ${roleLabel}!\nشما به همه سفارش‌ها و فروشگاه‌ها دسترسی دارید.\n\n`;
    } else if (role === "seller") {
      welcome = `✅ خوش آمدید، ${roleLabel}!\nهر سفارش تازه‌ای که برای فروشگاه شما ثبت شود، همین‌جا فاکتورش را دریافت می‌کنید.\n\n`;
    } else if (role === "customer") {
      welcome = `✅ خوش آمدید، ${roleLabel}!\nاز این بات می‌توانید سفارش‌هایتان را پیگیری کنید و برای محصولات نظر بفرستید.\n\n`;
    } else {
      welcome = "✅ خوش آمدید!\n\n";
    }
    await sendMessage(chat_id, welcome + helpFor(role));
    return;
  }

  if (session.user_id) {
    await handleLoggedIn(chat_id, session.user_id, text);
    return;
  }

  await sendMessage(chat_id, "برای شروع، ابتدا وارد شوید: /login\nیا برای پیگیری سفارش: <code>/track ATR-...</code>");
}

export const Route = createFileRoute("/api/public/bale/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const update = await request.json();
          try {
            await handleUpdate(update);
          } catch (e) {
            console.error("[bale handleUpdate error]", e);
          }
        } catch (e) {
          console.error("[bale webhook parse]", e);
        }
        return new Response("ok");
      },
      GET: async () => new Response("bale webhook ready"),
    },
  },
});