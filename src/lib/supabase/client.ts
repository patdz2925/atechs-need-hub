import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv, isSupabaseConfigured } from "./config";

/** Browser-side Supabase client (cookie session via @supabase/ssr).
 *  Returns null until .env.local holds real credentials. */
export function getBrowserSupabase() {
  if (!isSupabaseConfigured()) return null;
  const { url, key } = getSupabaseEnv();
  return createBrowserClient(url, key);
}
