/* Supabase env access — shared by browser client, server client, and middleware.
   Credentials live in .env.local (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)
   and are forwarded to the bundle via next.config.js `env`. Never hard-coded. */

export function getSupabaseEnv(): { url: string; key: string } {
  return {
    url: process.env.VITE_SUPABASE_URL ?? "",
    key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
  };
}

/** False while the scaffold placeholders are still in .env.local. */
export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseEnv();
  return Boolean(
    url.startsWith("https://") &&
      key.length > 20 &&
      !url.includes("YOUR-PROJECT") &&
      !key.startsWith("your-")
  );
}
