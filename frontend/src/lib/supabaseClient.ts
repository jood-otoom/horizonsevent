import { createClient } from "@supabase/supabase-js";

const configuredDataMode = import.meta.env.VITE_DATA_MODE;
if (configuredDataMode !== undefined && configuredDataMode !== "demo" && configuredDataMode !== "live") {
  throw new Error("VITE_DATA_MODE must be demo or live.");
}
export const dataMode = configuredDataMode === "live" ? "live" : "demo";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = dataMode === "live" && supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
