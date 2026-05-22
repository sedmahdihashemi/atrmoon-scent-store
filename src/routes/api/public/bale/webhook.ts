import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  sendMessage,
  supabaseAdmin,
  buildInvoiceText,
  statusFa,
} from "@/lib/bale.server";

function authClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getSession(chat_id: number) {
  const { data } = await supabaseAdmin
    .from("bot_sessions")
    .select("*")
    .eq("chat_id", chat_id)
    .maybeSingle();
  return data as any;
}

async function upsertSession(chat_id: number, patch: Record<string, unknown>) {
  await supabaseAdmin
    .from("bot_sessions")
    .upsert({ chat_id, ...patch }, { onConflict: "chat_id" });
}

async function getRole(user_id: string): Promise<"super_admin" | "seller" | "customer" | null> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user_id);
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
      const { data: stores } = await supabaseAdmin
        .from("stores")
        .select("id")
        .eq("seller_id", user_id);
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
    const { data: orders } = await query;
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
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, store_id, customer_id")
      .eq("order_number", code)
      .maybeSingle();
    if (!order) {
      await sendMessage(chat_id, "سفارشی با این کد یافت نشد.");
      return;
    }
    // authorization for non-admin
    if (role !== "super_admin") {
      if (role === "seller") {
        const { data: s } = await supabaseAdmin
          .from("stores")
          .select("seller_id")
          .eq("id", (order as any).store_id)
          .maybeSingle();
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
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, customer_id")
      .eq("order_number", code)
      .maybeSingle();
    if (!order || (order as any).customer_id !== user_id) {
      await sendMessage(chat_id, "این سفارش متعلق به شما نیست یا یافت نشد.");
      return;
    }
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("product_id")
      .eq("order_id", (order as any).id);
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
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("order_number, status, created_at, customer_name")
    .eq("order_number", code)
    .maybeSingle();
  if (!order) {
    await sendMessage(chat_id, "سفارشی با این کد یافت نشد.");
    return;
  }
  await sendMessage(
    chat_id,
    `🔎 وضعیت سفارش\nشماره: <code>${order.order_number}</code>\nوضعیت: ${statusFa(order.status)}\nتاریخ ثبت: ${new Date(order.created_at).toLocaleString("fa-IR")}`
  );
}

async function handleUpdate(update: any) {
  console.log("[bale update]", JSON.stringify(update).slice(0, 500));
  const msg = update.message ?? update.edited_message;
  if (!msg?.chat?.id) {
    console.log("[bale] no chat id, skipping");
    return;
  }
  const chat_id: number = msg.chat.id;
  const text: string = (msg.text ?? "").toString();
  console.log("[bale] chat", chat_id, "text", text);

  let session = await getSession(chat_id);
  if (!session) {
    await upsertSession(chat_id, { state: "idle", state_data: {} });
    session = { chat_id, user_id: null, state: "idle", state_data: {} };
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