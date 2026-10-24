import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command, mode }) => {
  if (command === "build" && mode === "production") {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    if (env.VITE_DATA_MODE !== "live") {
      throw new Error("Production build requires VITE_DATA_MODE=live.");
    }
    if (env.VITE_SUPABASE_URL !== "https://kkiambvltxuieuncwtfz.supabase.co") {
      throw new Error("Production build requires the approved Supabase project URL.");
    }
    if (!env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")) {
      throw new Error("Production build requires a Supabase publishable key.");
    }
  }
  return {
    plugins: [react(), tailwindcss()],
    test: { setupFiles: ["./tests/setup.ts"] },
  };
});
