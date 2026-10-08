import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Hidden-fact texts for the post-evaluation recap. Only call this after an evaluation exists:
 * prompt I deliberately reveals hidden information once the attempt is over.
 */
export async function loadHiddenFactTexts(variantId: string): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin()
    .from("scenario_industries")
    .select("hidden_facts, black_swan")
    .eq("id", variantId)
    .maybeSingle();
  if (!data) return {};
  const out: Record<string, string> = {};
  for (const f of data.hidden_facts as { id: string; fact: string }[]) out[f.id] = f.fact;
  out.BLACK_SWAN = (data.black_swan as { fact: string }).fact;
  return out;
}
