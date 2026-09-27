import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { DEFAULT_ROLE, isRole, type Role } from "@/lib/roles";

/* Profile record (public.profiles — see supabase/profiles.sql) */
export interface Profile {
  id: string;
  name: string;
  role: Role;
  department_id: string | null;
  created_at?: string;
}

/** Validate the session against the Auth server. Null = not signed in. */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Read the user's profile row. Falls back to a safe member profile when the
 *  profiles table/trigger doesn't exist yet (graceful before SQL is applied). */
export async function getProfile(user: User): Promise<Profile> {
  const fallback: Profile = {
    id: user.id,
    name:
      (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
      user.email?.split("@")[0] ||
      "Member",
    role: DEFAULT_ROLE,
    department_id: null,
  };

  const supabase = await createServerSupabase();
  if (!supabase) return fallback;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role, department_id, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return fallback;
  return { ...data, role: isRole(data.role) ? data.role : DEFAULT_ROLE };
}

/** One-call guard for Hub routes: returns user + profile, or null.
 *  Wrapped in React cache() so layout + page share one auth/profile fetch
 *  per request instead of repeating it. */
export const requireHubUser = cache(
  async (): Promise<{ user: User; profile: Profile } | null> => {
    const user = await getSessionUser();
    if (!user) return null;
    const profile = await getProfile(user);
    return { user, profile };
  }
);
