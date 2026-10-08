import "server-only";
import Handlebars from "handlebars";
import { EVALUATION_PROMPT_TEMPLATE, KNOWLEDGE_HASH, RUBRICS_MARKDOWN } from "@/generated/knowledge";
import { callStructured } from "@/lib/ai/client";
import { EvaluationSchema, type EngineState, type Evaluation } from "@/lib/ai/schemas";
import { DIMENSIONS, type RubricWeights } from "@/lib/content/scenario-schema";
import { formatTranscript, sortMessages, type MessageRow } from "@/lib/engine/history";
import { effectiveMinTrust } from "@/lib/engine/render-prompt";
import { loadVariant, type SessionRow } from "@/lib/engine/session-service";
import { serverEnv } from "@/lib/env";
import { computeMetrics } from "@/lib/metrics/compute";
import {
  computeOverall,
  needsThirdRun,
  reconcile,
  representativeRun,
  sanitizeRun,
  scoresOf,
  type TranscriptTurn,
} from "@/lib/scoring/scoring";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateProgress } from "./progress";

const renderEvalPrompt = Handlebars.compile(EVALUATION_PROMPT_TEMPLATE, { noEscape: true, strict: true });
const db = () => supabaseAdmin();

interface ScenarioRow {
  id: string;
  title: string;
  skills: string[];
  difficulty_default: number;
  rubric_weights: RubricWeights;
  sort_order: number;
}

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
    .select("id, title, skills, difficulty_default, rubric_weights, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  const library = (scenarios ?? []) as ScenarioRow[];
  const scenario = library.find((x) => x.id === session.scenario_id);
  if (!scenario) throw new Error(`Scenario ${session.scenario_id} not found`);
  const weights = scenario.rubric_weights;

  const { data: msgData } = await db()
    .from("roleplay_messages")
    .select("turn, role, content, raw_content, engine_state, validation_flags")
    .eq("session_id", session.id);
  const rows = sortMessages((msgData ?? []) as MessageRow[]);
  const transcript: TranscriptTurn[] = rows
    .filter((r) => r.role !== "kickoff")
    .map((r) => ({ turn: r.turn, role: r.role as "user" | "ai", content: r.content }));

  const metrics = computeMetrics(rows, variant);
  const engineLog = rows
    .filter((r) => r.role === "ai")
    .map((r) => {
      const st = r.engine_state as EngineState | null;
      return {
        turn: r.turn,
        trust: st?.trust,
        trust_delta: st?.trust_delta,
        trust_reason: st?.trust_reason,
        value_perception: st?.value_perception,
        revealed: st?.revealed,
        objection_raised: st?.objection_raised,
        thats_right: st?.thats_right,
        fake_yes: st?.fake_yes,
        end: st?.end,
        outcome: st?.outcome,
      };
    });

  const history = await previousAttempts(session);

  const scenarioJson = {
    id: scenario.id,
    title: scenario.title,
    difficulty: session.difficulty,
    attempt_number: session.attempt_number,
    channel: variant.config.channel,
    context: variant.context,
    user_role: variant.user_role,
    user_objective: variant.user_objective,
    ai_objective: variant.ai_objective,
    persona: { name: variant.persona.name, role: variant.persona.role, style: variant.persona.style },
    hidden_facts: variant.hidden_facts.map((f) => ({
      id: f.id,
      fact: f.fact,
      unlock: { min_trust: effectiveMinTrust(f.unlock.min_trust, session.unlock_bonus), behavior: f.unlock.behavior },
    })),
    black_swan: {
      id: "BLACK_SWAN",
      fact: variant.black_swan.fact,
      unlock: {
        min_trust: effectiveMinTrust(variant.black_swan.unlock.min_trust, session.unlock_bonus),
        behavior: variant.black_swan.unlock.behavior,
      },
    },
    objections: variant.objections,
    success_criteria: variant.success_criteria,
    failure_conditions: variant.failure_conditions,
    acceptable_no_deal: variant.config.acceptable_no_deal,
    rubric_weights: Object.fromEntries(DIMENSIONS.map((d) => [d, weights[d] ?? 0])),
    end_reason: session.end_reason,
    available_scenarios_for_next_scenario: library.map((x) => ({
      id: x.id,
      title: x.title,
      skills: x.skills,
      difficulty: x.difficulty_default,
    })),
  };

  const system = renderEvalPrompt({
    scenario_json: JSON.stringify(scenarioJson, null, 2),
    numbered_transcript: formatTranscript(rows),
    per_turn_state_json: JSON.stringify(engineLog),
    deterministic_metrics_json: JSON.stringify(metrics, null, 2),
    rubrics_markdown: RUBRICS_MARKDOWN,
    previous_attempts_json: JSON.stringify(history),
  });

  const evaluateOnce = () =>
    callStructured({
      model: serverEnv.evalModel,
      effort: serverEnv.evalEffort,
      system,
      messages: [{ role: "user", content: "Evaluate this practice conversation now, following your instructions." }],
      schema: EvaluationSchema,
      maxTokens: 16000,
    });

  const calls = await Promise.all([evaluateOnce(), evaluateOnce()]);
  let runs = calls.map((c) => sanitizeRun(c.output, transcript, weights));
  if (needsThirdRun(scoresOf(runs[0]), scoresOf(runs[1]))) {
    const third = await evaluateOnce();
    calls.push(third);
    runs = [...runs, sanitizeRun(third.output, transcript, weights)];
  }

  const finalScores = reconcile(runs.map(scoresOf));
  const overall = computeOverall(finalScores, weights);
  const rep = runs[representativeRun(runs, weights, overall)];

  const dimensions = Object.fromEntries(
    DIMENSIONS.map((d) => [d, { ...rep.dimensions[d], score: finalScores[d] }]),
  ) as Evaluation["dimensions"];

  const ethicsFlags = [...new Set(runs.flatMap((r) => r.ethics_flags))];
  const nextScenario = sanitizeNextScenario(rep.next_scenario, library, session, finalScores);

  const feedback = {
    did_well: rep.did_well,
    biggest_mistake: rep.biggest_mistake,
    missed_opportunity: rep.missed_opportunity,
    better_alternative: rep.better_alternative,
    stronger_response: rep.stronger_response,
    practice_focus: rep.practice_focus,
    next_scenario: nextScenario,
    hidden_info_recap: rep.hidden_info_recap,
    improvement_vs_last: rep.improvement_vs_last,
    ethics_flags: ethicsFlags,
  };

  const usage = calls.reduce(
    (acc, c) => ({ input: acc.input + c.usage.inputTokens, output: acc.output + c.usage.outputTokens }),
    { input: 0, output: 0 },
  );

  const { error } = await db().from("evaluations").insert({
    session_id: session.id,
    user_id: session.user_id,
    prompt_version: KNOWLEDGE_HASH,
    evaluator_model: calls[0].model,
    overall,
    outcome: rep.outcome,
    metrics,
    dimensions,
    feedback,
    runs: runs.map((r) => ({ overall: computeOverall(scoresOf(r), weights), scores: scoresOf(r) })),
    runs_count: runs.length,
    input_tokens: usage.input,
    output_tokens: usage.output,
  });
  if (error) {
    if (error.code === "23505") return; // a concurrent evaluation already finished
    throw error;
  }

  await db()
    .from("skill_scores")
    .insert(
      DIMENSIONS.map((d) => ({
        session_id: session.id,
        user_id: session.user_id,
        scenario_id: session.scenario_id,
        dimension: d,
        score: finalScores[d],
      })),
    );

  await db()
    .from("roleplay_sessions")
    .update({ status: "evaluated", evaluated_at: new Date().toISOString() })
    .eq("id", session.id);

  await updateProgress(session.user_id, finalScores);
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
  library: ScenarioRow[],
  session: SessionRow,
  scores: Record<string, number | null>,
): Evaluation["next_scenario"] {
  const found = library.find((x) => x.id === rec.id);
  if (found) return { ...rec, difficulty: Math.min(5, Math.max(1, rec.difficulty)) };
  const values = Object.values(scores).filter((v): v is number => v !== null);
  const weakest = values.length ? Math.min(...values) : 0;
  if (weakest < 60) {
    return { id: session.scenario_id, difficulty: session.difficulty, reason: "Retry to improve your weakest skill." };
  }
  const idx = library.findIndex((x) => x.id === session.scenario_id);
  const next = library[(idx + 1) % library.length];
  return { id: next.id, difficulty: next.difficulty_default, reason: "Try a new conversation type." };
}
