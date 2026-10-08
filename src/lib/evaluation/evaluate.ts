import "server-only";
import { KNOWLEDGE_HASH } from "@/generated/knowledge";
import type { Evaluation } from "@/lib/ai/schemas";
import { DIMENSIONS } from "@/lib/content/scenario-schema";
import type { MessageRow } from "@/lib/engine/history";
import { loadVariant, type SessionRow } from "@/lib/engine/session-service";
import type { DimensionScores } from "@/lib/scoring/scoring";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateProgress } from "./progress";
import { scoreConversation, type LibraryEntry } from "./score-conversation";

const db = () => supabaseAdmin();

/**
 * Evaluates an ended session (prompt I), idempotently. Sets status 'evaluated' or 'eval_failed'.
 */
export async function evaluateSession(sessionId: string): Promise<void> {
  const { data: session } = await db().from("roleplay_sessions").select("*").eq("id", sessionId).single();
  if (!session) return;
  const s = session as SessionRow;

  const { data: existing } = await db().from("evaluations").select("id").eq("session_id", sessionId).maybeSingle();
  if (existing) {
    await db().from("roleplay_sessions").update({ status: "evaluated" }).eq("id", sessionId);
    return;
  }
  if (s.status === "active" || s.status === "abandoned") return;
  await db().from("roleplay_sessions").update({ status: "evaluating" }).eq("id", sessionId);

  try {
    await runEvaluation(s);
  } catch (e) {
    console.error("evaluation failed", sessionId, e);
    await db().from("roleplay_sessions").update({ status: "eval_failed" }).eq("id", sessionId);
  }
}

async function runEvaluation(session: SessionRow) {
  const variant = await loadVariant(session.scenario_industry_id);
  const { data: scenarios } = await db()
    .from("scenarios")
    .select("id, title, skills, difficulty_default, rubric_weights")
    .eq("is_active", true)
    .order("sort_order");
  const library = (scenarios ?? []) as LibraryEntry[];
  const scenario = library.find((x) => x.id === session.scenario_id);
  if (!scenario) throw new Error(`Scenario ${session.scenario_id} not found`);

  const { data: msgData } = await db()
    .from("roleplay_messages")
    .select("turn, role, content, engine_state")
    .eq("session_id", session.id);

  const result = await scoreConversation({
    variant,
    scenario,
    library,
    rows: (msgData ?? []) as Pick<MessageRow, "turn" | "role" | "content" | "engine_state">[],
    session,
    history: await previousAttempts(session),
  });

  const feedback = {
    ...result.feedback,
    next_scenario: sanitizeNextScenario(result.feedback.next_scenario, library, session, result.scores),
  };

  const { error } = await db().from("evaluations").insert({
    session_id: session.id,
    user_id: session.user_id,
    prompt_version: KNOWLEDGE_HASH,
    evaluator_model: result.model,
    overall: result.overall,
    outcome: result.outcome,
    metrics: result.metrics,
    dimensions: result.dimensions,
    feedback,
    runs: result.runs,
    runs_count: result.runs.length,
    input_tokens: result.usage.input,
    output_tokens: result.usage.output,
  });
  if (error) {
    if (error.code === "23505") return; // a concurrent evaluation already finished
    throw error;
  }

  const { error: scoreError } = await db()
    .from("skill_scores")
    .insert(
      DIMENSIONS.map((d) => ({
        session_id: session.id,
        user_id: session.user_id,
        scenario_id: session.scenario_id,
        dimension: d,
        score: result.scores[d],
      })),
    );
  if (scoreError) throw scoreError;

  await db()
    .from("roleplay_sessions")
    .update({ status: "evaluated", evaluated_at: new Date().toISOString() })
    .eq("id", session.id);

  await updateProgress(session.user_id, result.scores);
}

/** Previous evaluated attempts on this scenario, for prompt I's <history> block. */
async function previousAttempts(session: SessionRow) {
  const { data } = await db()
    .from("roleplay_sessions")
    .select("id, attempt_number, practice_focus, evaluations(overall, dimensions, feedback)")
    .eq("user_id", session.user_id)
    .eq("scenario_id", session.scenario_id)
    .eq("status", "evaluated")
    .lt("attempt_number", session.attempt_number)
    .order("attempt_number");
  const attempts = (data ?? []).map((row) => {
    const ev = Array.isArray(row.evaluations) ? row.evaluations[0] : row.evaluations;
    const dims = (ev?.dimensions ?? {}) as Record<string, { score: number | null }>;
    return {
      attempt_number: row.attempt_number,
      overall: ev?.overall ?? null,
      scores: Object.fromEntries(DIMENSIONS.map((d) => [d, dims[d]?.score ?? null])),
      practice_focus_given: ev?.feedback?.practice_focus ?? null,
    };
  });
  return { current_practice_focus: session.practice_focus, previous_attempts: attempts };
}

/** Keeps the evaluator's recommendation only if it names a real scenario; otherwise derives one. */
function sanitizeNextScenario(
  rec: Evaluation["next_scenario"],
  library: LibraryEntry[],
  session: SessionRow,
  scores: DimensionScores,
): Evaluation["next_scenario"] {
  if (library.some((x) => x.id === rec.id)) {
    return { ...rec, difficulty: Math.min(5, Math.max(1, rec.difficulty)) };
  }
  const values = Object.values(scores).filter((v): v is number => v !== null);
  if (values.length === 0 || Math.min(...values) < 60) {
    return { id: session.scenario_id, difficulty: session.difficulty, reason: "Retry to improve your weakest skill." };
  }
  const idx = library.findIndex((x) => x.id === session.scenario_id);
  const next = library[(idx + 1) % library.length];
  return { id: next.id, difficulty: next.difficulty_default, reason: "Try a new conversation type." };
}
