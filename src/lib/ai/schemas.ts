import { z } from "zod";

/**
 * Output schemas mirror the OUTPUT FORMAT sections of the spec prompts:
 *  - prompt H: knowledge-system/prompts/roleplay-system-prompt.md
 *  - prompt I: knowledge-system/prompts/evaluation-system-prompt.md
 * Range checks (0–10, 0–100) are enforced in code after parsing, not in the JSON schema.
 */

export const OUTCOMES = ["won", "advanced", "correct_no_deal", "stalled", "lost"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const RoleplayTurnSchema = z.object({
  reply: z.string(),
  state: z.object({
    trust: z.number(),
    trust_delta: z.number(),
    trust_reason: z.string(),
    value_perception: z.number().nullable(),
    revealed: z.array(z.string()),
    objection_raised: z.string().nullable(),
    thats_right: z.boolean(),
    fake_yes: z.boolean(),
    end: z.boolean(),
    outcome: z.enum(OUTCOMES).nullable(),
  }),
});
export type RoleplayTurn = z.infer<typeof RoleplayTurnSchema>;
export type EngineState = RoleplayTurn["state"];

const Evidence = z.object({ turn: z.number().int(), quote: z.string() });

const DimensionResult = z.object({
  score: z.number().int().nullable(),
  evidence: z.array(Evidence),
  rationale: z.string(),
});
export type DimensionResult = z.infer<typeof DimensionResult>;

export const EvaluationSchema = z.object({
  overall: z.number().int(),
  outcome: z.enum(OUTCOMES),
  dimensions: z.object({
    clarity: DimensionResult,
    listening: DimensionResult,
    questions: DimensionResult,
    empathy: DimensionResult,
    confidence: DimensionResult,
    value: DimensionResult,
    objections: DimensionResult,
    persuasion: DimensionResult,
    negotiation: DimensionResult,
    closing: DimensionResult,
  }),
  did_well: z.array(z.object({ turn: z.number().int(), text: z.string() })),
  biggest_mistake: z.object({
    turn: z.number().int(),
    quote: z.string(),
    text: z.string(),
    skill_id: z.string(),
  }),
  missed_opportunity: z.object({ turn: z.number().int(), text: z.string() }),
  better_alternative: z.string(),
  stronger_response: z.object({ turn: z.number().int(), original: z.string(), improved: z.string() }),
  practice_focus: z.object({ skill_id: z.string(), drill: z.string(), instruction: z.string() }),
  next_scenario: z.object({ id: z.string(), difficulty: z.number().int(), reason: z.string() }),
  hidden_info_recap: z.array(
    z.object({ id: z.string(), revealed: z.boolean(), how_to_unlock: z.string() }),
  ),
  improvement_vs_last: z.string().nullable(),
  ethics_flags: z.array(z.string()),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;
