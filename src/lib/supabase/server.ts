import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Supabase client bound to the signed-in user's cookies (RLS applies). */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component: cookies are refreshed by middleware instead.
          }
        },
      },
    },
  );
}

/** Returns the authenticated user (verified with the Auth server) or null. */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
