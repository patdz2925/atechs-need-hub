/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js only exposes NEXT_PUBLIC_* vars to the browser by default.
  // This project's Supabase credentials are named VITE_* (as specified), so we
  // forward them explicitly. Values come from .env.local — never hard-coded.
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  },
};

module.exports = nextConfig;
