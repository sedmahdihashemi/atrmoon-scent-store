import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Only enable the Vercel Nitro preset when actually building on/for Vercel.
// Otherwise we keep the default output (`dist/`) so the Lovable build check passes.
const isVercel = !!process.env.VERCEL || process.env.BUILD_TARGET === "vercel";

export default defineConfig({
  cloudflare: false,
  plugins: isVercel ? [nitro({ preset: "vercel" })] : [],
  tanstackStart: {
    server: { entry: "server" },
  },
});
