import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Service-role client: bypasses RLS. Only use in server code after verifying
 * the user and their ownership of the rows being touched.
 */
export function supabaseAdmin() {
  client ??= createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
