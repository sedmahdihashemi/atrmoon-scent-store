import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, sendMessage, logIfError } from "@/lib/bale.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Super-admin broadcast: compose a message and deliver it through the Bale bot
// to specific people (it lands as a phone notification in their Bale app).
// Gated server-side by a real super_admin session — never trust the client.
async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin");
  logIfError(`assertSuperAdmin(${userId})`, error);
  return (data ?? []).length > 0;
}

// Recipients the admin can message = accounts that are logged into the bot
// (only they can receive). Returns name/phone + the bot chat id.
export const listBotRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await assertSuperAdmin(context.userId))) return { ok: false as const, reason: "forbidden" as const };

    const { data: sessions } = await supabaseAdmin.from("bot_sessions").select("user_id, chat_id");
    const rows = (sessions ?? []) as any[];
    const userIds = [...new Set(rows.map((s) => s.user_id).filter(Boolean))];
    const profById = new Map<string, any>();
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, email, phone").in("id", userIds);
      for (const p of (profs ?? []) as any[]) profById.set(p.id, p);
    }
    const recipients = rows
      .filter((s) => s.user_id)
      .map((s) => {
        const p = profById.get(s.user_id);
        return {
          userId: s.user_id as string,
          name: p?.full_name || "کاربر",
          phone: p?.phone || null,
          email: p?.email && !String(p.email).endsWith("@phone.atrmoon.top") ? p.email : null,
        };
      });
    // de-dup by userId (a user could have more than one bot session row)
    const seen = new Set<string>();
    const unique = recipients.filter((r) => (seen.has(r.userId) ? false : (seen.add(r.userId), true)));
    return { ok: true as const, recipients: unique };
  });

export const sendAdminMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        text: z.string().trim().min(1, "متن پیام خالی است").max(3000),
        // specific recipients, or everyone who is logged into the bot
        userIds: z.array(z.string().uuid()).optional(),
        toAll: z.boolean().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    if (!(await assertSuperAdmin(context.userId))) return { ok: false as const, reason: "forbidden" as const };

    // Resolve the target bot chats.
    let q = supabaseAdmin.from("bot_sessions").select("chat_id, user_id");
    if (!data.toAll) {
      if (!data.userIds || data.userIds.length === 0) return { ok: false as const, reason: "no_recipients" as const };
      q = q.in("user_id", data.userIds);
    }
    const { data: sessions, error } = await q;
    logIfError("sendAdminMessage sessions", error);
    const chatIds = [...new Set((sessions ?? []).map((s: any) => Number(s.chat_id)).filter(Boolean))];
    if (chatIds.length === 0) return { ok: false as const, reason: "no_recipients" as const };

    const body = `📣 پیام از عطرمون\n\n${data.text}`;
    let sent = 0;
    for (const chatId of chatIds) {
      try { await sendMessage(chatId, body); sent++; } catch (e) { console.error("[sendAdminMessage] send failed", chatId, e); }
    }
    return { ok: true as const, sent, total: chatIds.length };
  });
