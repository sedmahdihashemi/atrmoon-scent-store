import { createServerFn } from "@tanstack/react-start";

// Plain runtime env checks (no VITE_ build-time baking needed) so ops can
// flip BALE_PAY_ENABLED in .env and just restart the container — no rebuild
// required to turn the checkout button on/off.
export const getBalePayConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    enabled: process.env.BALE_PAY_ENABLED === "true",
    botUsername: process.env.BALE_BOT_USERNAME || null,
  };
});
