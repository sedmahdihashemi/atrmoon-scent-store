import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Only enable the Vercel Nitro preset when actually building on/for Vercel.
// Otherwise we keep the default output (`dist/`) so the Lovable build check passes.
const isVercel = !!process.env.VERCEL || process.env.BUILD_TARGET === "vercel";

export default defineConfig({
  // Keep the default Cloudflare Worker output for Lovable builds; only swap to
  // the Nitro Vercel preset when actually building on Vercel.
  cloudflare: !isVercel,
  plugins: isVercel ? [nitro({ preset: "vercel" })] : [],
  tanstackStart: {
    server: { entry: "server" },
  },
});
