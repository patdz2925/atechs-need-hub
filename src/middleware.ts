import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";

/* Session boundary for the authenticated Hub.
   - refreshes the Supabase cookie session on every matched route
   - /hub/*  requires a valid session → otherwise /login (+ ?next=)
   - /login   signed-in users skip straight to /hub            */

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isHub = pathname === "/hub" || pathname.startsWith("/hub/");
  let supabaseResponse = NextResponse.next({ request });

  // Not configured yet (scaffold placeholders): keep the public site working,
  // but never expose /hub without a backend.
  if (!isSupabaseConfigured()) {
    if (isHub) return NextResponse.redirect(new URL("/login", request.url));
    return supabaseResponse;
  }

  const { url, key } = getSupabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: getUser() validates the JWT with the Auth server (never trust
  // the cookie alone). Doing this here also refreshes expiring sessions for
  // the Server Components that run afterwards.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isHub && !user) {
    const login = new URL("/login", request.url);
    if (pathname !== "/hub") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/hub", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/hub/:path*", "/login"],
};
