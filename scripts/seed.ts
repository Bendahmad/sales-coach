/**
 * Validates content/scenarios/*.json and upserts them into `scenarios` + `scenario_industries`.
 *
 *   npm run content:validate   validate only (no DB)
 *   npm run db:seed            validate + upsert (needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 */
import { createClient } from "@supabase/supabase-js";
import { loadScenarioFiles } from "../src/lib/content/load-scenarios";

async function main() {
  const scenarios = loadScenarioFiles();
  console.log(`content: ${scenarios.length} scenarios valid (${scenarios.map((s) => s.id).join(", ")})`);
  if (process.argv.includes("--validate-only")) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const db = createClient(url, key, { auth: { persistSession: false } });

  for (const s of scenarios) {
    const { error: sErr } = await db.from("scenarios").upsert({
      id: s.id,
      title: s.title,
      summary: s.summary,
      skills: s.skills,
      difficulty_default: s.difficulty_default,
      primary_industry: s.primary_industry,
      rubric_weights: s.rubric_weights,
      challenge_tags: s.challenge_tags,
      sort_order: s.sort_order,
      is_active: true,
    });
    if (sErr) throw new Error(`${s.id}: ${sErr.message}`);

    for (const v of s.variants) {
      const { error: vErr } = await db.from("scenario_industries").upsert(
        {
          scenario_id: s.id,
          industry: v.industry,
          version: v.version,
          brief: v.brief,
          persona: v.persona,
          context: v.context,
          user_role: v.user_role,
          user_objective: v.user_objective,
          ai_objective: v.ai_objective,
          hidden_facts: v.hidden_facts,
          black_swan: v.black_swan,
          objections: v.objections,
          success_criteria: v.success_criteria,
          failure_conditions: v.failure_conditions,
          vocabulary: v.vocabulary,
          config: v.config,
          is_active: true,
        },
        { onConflict: "scenario_id,industry,version" },
      );
      if (vErr) throw new Error(`${s.id}/${v.industry}: ${vErr.message}`);
    }
  }
  console.log("seed: done");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
