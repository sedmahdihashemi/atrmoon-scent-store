import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeIranPhone } from "@/lib/phone";

// Anon clients can't SELECT profiles.phone directly (RLS), so signup forms
// need this to pre-check uniqueness before calling supabase.auth.signUp —
// otherwise a duplicate phone only fails deep inside the handle_new_user
// trigger, after auth.users has already been created.
export const checkPhoneAvailable = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const phone = normalizeIranPhone(data.phone);
    if (!phone) return { available: false, reason: "invalid" as const };
    const { data: existing, error } = await supabaseAdmin.from("profiles").select("id").eq("phone", phone).maybeSingle();
    if (error) {
      console.error("[checkPhoneAvailable]", error);
      return { available: false, reason: "error" as const };
    }
    return existing ? { available: false, reason: "taken" as const } : { available: true };
  });
