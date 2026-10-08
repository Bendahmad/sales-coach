import "server-only";
import { DIMENSIONS } from "@/lib/content/scenario-schema";
import { levelFor, medianOf, type DimensionScores } from "@/lib/scoring/scoring";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Updates user_skill_progress after an evaluation (DATABASE_SCHEMA.md "Progress update rule").
 * Recomputed from skill_scores, so it is safe to run more than once.
 */
export async function updateProgress(userId: string, newScores: DimensionScores): Promise<void> {
  const db = supabaseAdmin();

  const { count: hardSessions } = await db
    .from("roleplay_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "evaluated")
    .gte("difficulty", 4);

  const rows = [];
  for (const d of DIMENSIONS) {
    if (newScores[d] === null) continue;
    const { data } = await db
      .from("skill_scores")
      .select("score")
      .eq("user_id", userId)
      .eq("dimension", d)
      .not("score", "is", null)
      .order("created_at", { ascending: false });
    const all = (data ?? []).map((r) => r.score as number);
    const median = medianOf(all.slice(0, 3));
    rows.push({
      user_id: userId,
      dimension: d,
      latest_score: all[0] ?? null,
      best_score: all.length ? Math.max(...all) : null,
      median_last3: median,
      level: median === null ? null : levelFor(median, (hardSessions ?? 0) > 0),
      sessions_count: all.length,
      updated_at: new Date().toISOString(),
    });
  }
  if (rows.length) {
    const { error } = await db.from("user_skill_progress").upsert(rows, { onConflict: "user_id,dimension" });
    if (error) throw error;
  }
}
