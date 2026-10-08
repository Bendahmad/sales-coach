import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Magic-link landing: exchange the code for a session, then route to onboarding or the app. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  if (!code) return NextResponse.redirect(new URL("/login?error=link_expired", url.origin));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=link_expired", url.origin));

  const { data: profile } = await supabase.from("users").select("onboarded_at").maybeSingle();
  const destination = profile?.onboarded_at ? next : "/onboarding";
  return NextResponse.redirect(new URL(destination, url.origin));
}
