import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Only enable the Vercel Nitro preset when actually building on/for Vercel.
// Otherwise we keep the default output (`dist/`) so the Lovable build check passes.
const isVercel = !!process.env.VERCEL || process.env.BUILD_TARGET === "vercel";

export default defineConfig({
  ...(isVercel ? { cloudflare: false as const } : {}),
  plugins: isVercel ? [nitro({ preset: "vercel" })] : [],
  tanstackStart: {
    server: { entry: "server" },
  },
  // Self-host builds (your own server / Docker): run with SELF_HOST=1
  // to emit a plain Node.js server instead of the default edge output.
  ...(process.env.SELF_HOST ? { nitro: { preset: "node-server" } } : {}),
});