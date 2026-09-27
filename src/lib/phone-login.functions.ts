import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeIranPhone } from "@/lib/phone";

// Phone is never sent to Supabase Auth itself (auth.users.phone is unused
// in this project) — it's just an alternate lookup key on profiles that
// resolves to the account's real email, which is then used for the normal
// email+password sign-in. The client establishes the browser session from
// the returned tokens via supabase.auth.setSession(...).
export const loginWithPhone = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string(), password: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const phone = normalizeIranPhone(data.phone);
    // Same generic failure for "no such phone" and "wrong password" below —
    // never reveal whether a given phone number has an account.
    if (!phone) return { ok: false as const, reason: "invalid_credentials" as const };

    const { data: profile, error } = await supabaseAdmin.from("profiles").select("email").eq("phone", phone).maybeSingle();
    if (error) console.error("[loginWithPhone] lookup", error);
    if (!profile?.email) return { ok: false as const, reason: "invalid_credentials" as const };

    const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await anon.auth.signInWithPassword({ email: profile.email, password: data.password });
    if (authError || !authData.session) {
      if (authError) console.error("[loginWithPhone] signInWithPassword failed", authError.status, authError.message);
      return { ok: false as const, reason: "invalid_credentials" as const };
    }

    return {
      ok: true as const,
      session: { access_token: authData.session.access_token, refresh_token: authData.session.refresh_token },
    };
  });
