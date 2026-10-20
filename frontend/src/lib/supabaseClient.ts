import { createClient } from "@supabase/supabase-js";

export const dataMode = import.meta.env.VITE_DATA_MODE === "live" ? "live" : "demo";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = dataMode === "live" && url && publishableKey
  ? createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
