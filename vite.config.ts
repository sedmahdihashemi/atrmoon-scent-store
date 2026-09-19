import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Self-host builds (your own server / Docker): run with SELF_HOST=1
  // to emit a plain Node.js server instead of the default edge output.
  ...(process.env.SELF_HOST ? { nitro: { preset: "node-server" } } : {}),
});
