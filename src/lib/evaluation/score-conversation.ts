import "server-only";
import Handlebars from "handlebars";
import { EVALUATION_PROMPT_TEMPLATE, RUBRICS_MARKDOWN } from "@/generated/knowledge";
import { callStructured } from "@/lib/ai/client";
import { EvaluationSchema, type EngineState, type Evaluation } from "@/lib/ai/schemas";
import { DIMENSIONS, type RubricWeights, type ScenarioVariant } from "@/lib/content/scenario-schema";
import { formatTranscript, sortMessages } from "@/lib/engine/history";
import { effectiveMinTrust } from "@/lib/engine/render-prompt";
import { serverEnv } from "@/lib/env";
import { computeMetrics, type MetricRow, type Metrics } from "@/lib/metrics/compute";
import {
  computeOverall,
  needsThirdRun,
  reconcile,
  representativeRun,
  sanitizeRun,
  scoresOf,
  type DimensionScores,
  type TranscriptTurn,
} from "@/lib/scoring/scoring";

const renderEvalPrompt = Handlebars.compile(EVALUATION_PROMPT_TEMPLATE, { noEscape: true, strict: true });

export interface LibraryEntry {
  id: string;
  title: string;
  skills: string[];
  difficulty_default: number;
  rubric_weights: RubricWeights;
}

export interface ScoreInput {
  variant: ScenarioVariant;
  scenario: LibraryEntry;
  library: LibraryEntry[];
  rows: MetricRow[];
  session: {
    difficulty: number;
    attempt_number: number;
    unlock_bonus: number;
    end_reason: string | null;
  };
  /** Prompt I <history> block: previous attempts + current practice focus. */
  history: unknown;
}

export interface ScoreResult {
  metrics: Metrics;
  overall: number;
  outcome: Evaluation["outcome"];
  scores: DimensionScores;
  dimensions: Evaluation["dimensions"];
  feedback: Omit<Evaluation, "overall" | "outcome" | "dimensions">;
  runs: { overall: number; scores: DimensionScores }[];
  model: string;
  usage: { input: number; output: number };
}

/**
 * Runs prompt I on a finished conversation and applies the code-side scoring rules
 * (TECHNICAL_ARCHITECTURE §5). Pure of database access so the smoke-eval script can reuse it.
 */
export async function scoreConversation(input: ScoreInput): Promise<ScoreResult> {
  const { variant, scenario, library, session } = input;
  const weights = scenario.rubric_weights;
  const rows = sortMessages(input.rows);
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

  const unlock = (rule: { min_trust: number; behavior: string }) => ({
    min_trust: effectiveMinTrust(rule.min_trust, session.unlock_bonus),
    behavior: rule.behavior,
  });
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
    hidden_facts: variant.hidden_facts.map((f) => ({ id: f.id, fact: f.fact, unlock: unlock(f.unlock) })),
    black_swan: { id: "BLACK_SWAN", fact: variant.black_swan.fact, unlock: unlock(variant.black_swan.unlock) },
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
    previous_attempts_json: JSON.stringify(input.history),
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

  // Two independent runs; a third (median) when they disagree by more than 15 on any dimension.
  const calls = await Promise.all([evaluateOnce(), evaluateOnce()]);
  let runs = calls.map((c) => sanitizeRun(c.output, transcript, weights));
  if (needsThirdRun(scoresOf(runs[0]), scoresOf(runs[1]))) {
    const third = await evaluateOnce();
    calls.push(third);
    runs = [...runs, sanitizeRun(third.output, transcript, weights)];
  }

  const scores = reconcile(runs.map(scoresOf));
  const overall = computeOverall(scores, weights);
  const rep = runs[representativeRun(runs, weights, overall)];
  const dimensions = Object.fromEntries(
    DIMENSIONS.map((d) => [d, { ...rep.dimensions[d], score: scores[d] }]),
  ) as Evaluation["dimensions"];

  return {
    metrics,
    overall,
    outcome: rep.outcome,
    scores,
    dimensions,
    feedback: {
      did_well: rep.did_well,
      biggest_mistake: rep.biggest_mistake,
      missed_opportunity: rep.missed_opportunity,
      better_alternative: rep.better_alternative,
      stronger_response: rep.stronger_response,
      practice_focus: rep.practice_focus,
      next_scenario: rep.next_scenario,
      hidden_info_recap: rep.hidden_info_recap,
      improvement_vs_last: rep.improvement_vs_last,
      ethics_flags: [...new Set(runs.flatMap((r) => r.ethics_flags))],
    },
    runs: runs.map((r) => ({ overall: computeOverall(scoresOf(r), weights), scores: scoresOf(r) })),
    model: calls[0].model,
    usage: calls.reduce(
      (acc, c) => ({ input: acc.input + c.usage.inputTokens, output: acc.output + c.usage.outputTokens }),
      { input: 0, output: 0 },
    ),
  };
}
