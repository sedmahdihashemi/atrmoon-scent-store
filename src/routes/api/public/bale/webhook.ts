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

async function handleLoggedIn(chat_id: number, user_id: string, text: string) {
  const role = await getRole(user_id);
  const t = text.trim();

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
    } else if (role !== "super_admin") {
      await sendMessage(chat_id, "دسترسی ندارید.");
      return;
    }
    const { data: orders } = await query;
    if (!orders || orders.length === 0) {
      await sendMessage(chat_id, "سفارشی یافت نشد.");
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
    const code = t.replace("/track", "").trim();
    if (!code) {
      await sendMessage(chat_id, "کد پیگیری را وارد کنید: /track ATR-...");
      return;
    }
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, store_id")
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
      }
    }
    const built = await buildInvoiceText((order as any).id, { includeStore: role === "super_admin" });
    if (built) await sendMessage(chat_id, built.text);
    return;
  }

  if (t === "/logout") {
    await upsertSession(chat_id, { user_id: null, state: "idle", state_data: {} });
    await sendMessage(chat_id, "از حساب خارج شدید.");
    return;
  }

  if (t === "/login") {
    await sendMessage(chat_id, "شما قبلاً وارد شده‌اید. برای خروج: /logout");
    return;
  }

  await sendMessage(chat_id, HELP);
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
  const msg = update.message ?? update.edited_message;
  if (!msg?.chat?.id) return;
  const chat_id: number = msg.chat.id;
  const text: string = (msg.text ?? "").toString();

  let session = await getSession(chat_id);
  if (!session) {
    await upsertSession(chat_id, { state: "idle", state_data: {} });
    session = { chat_id, user_id: null, state: "idle", state_data: {} };
  }

  // Public /track works without login
  if (text.trim().startsWith("/track") && !session.user_id) {
    const code = text.replace("/track", "").trim();
    if (!code) {
      await sendMessage(chat_id, "کد پیگیری را وارد کنید: /track ATR-...");
      return;
    }
    await handlePublicTrack(chat_id, code);
    return;
  }

  if (text === "/start" || text === "/help") {
    await sendMessage(
      chat_id,
      "سلام! 🌹 به ربات عطرمون خوش آمدید.\n\n" + HELP
    );
    return;
  }

  // Login flow
  if (text === "/login") {
    await upsertSession(chat_id, { state: "awaiting_email", state_data: {} });
    await sendMessage(chat_id, "ایمیل خود را وارد کنید:");
    return;
  }

  if (session.state === "awaiting_email") {
    const email = text.trim();
    if (!email.includes("@")) {
      await sendMessage(chat_id, "ایمیل نامعتبر است. دوباره وارد کنید:");
      return;
    }
    await upsertSession(chat_id, { state: "awaiting_password", state_data: { email } });
    await sendMessage(chat_id, "رمز عبور خود را وارد کنید:");
    return;
  }

  if (session.state === "awaiting_password") {
    const email = (session.state_data?.email ?? "").trim();
    const password = text;
    const { data: auth, error } = await authClient().auth.signInWithPassword({ email, password });
    if (error || !auth?.user) {
      await upsertSession(chat_id, { state: "idle", state_data: {} });
      await sendMessage(chat_id, "❌ ایمیل یا رمز نادرست است. برای تلاش دوباره: /login");
      return;
    }
    const role = await getRole(auth.user.id);
    if (role !== "super_admin" && role !== "seller") {
      await upsertSession(chat_id, { state: "idle", state_data: {} });
      await sendMessage(chat_id, "این ربات فقط برای ادمین و فروشندگان است.");
      return;
    }
    await upsertSession(chat_id, { user_id: auth.user.id, state: "idle", state_data: {} });
    await sendMessage(chat_id, `✅ خوش آمدید! نقش شما: ${role === "super_admin" ? "سوپر ادمین" : "فروشنده"}\n\n${HELP}`);
    return;
  }

  if (session.user_id) {
    await handleLoggedIn(chat_id, session.user_id, text);
    return;
  }

  await sendMessage(chat_id, "برای شروع: /login یا /track <کد>");
}

export const Route = createFileRoute("/api/public/bale/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const update = await request.json();
          // Respond fast to Bale, process in background
          handleUpdate(update).catch((e) => console.error("[bale webhook]", e));
        } catch (e) {
          console.error("[bale webhook parse]", e);
        }
        return new Response("ok");
      },
      GET: async () => new Response("bale webhook ready"),
    },
  },
});