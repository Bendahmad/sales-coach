import { z } from "zod";

/**
 * Structured form of the scenario template in knowledge-system/03-scenarios.md
 * (§2 template fields + §3 persona generator fields). Content lives in content/scenarios/*.json.
 */

export const DIMENSIONS = [
  "clarity",
  "listening",
  "questions",
  "empathy",
  "confidence",
  "value",
  "objections",
  "persuasion",
  "negotiation",
  "closing",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const INDUSTRIES = [
  "web_dev",
  "saas",
  "real_estate",
  "restaurants",
  "agency",
  "freelance",
  "b2b_services",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<Industry, string> = {
  web_dev: "Web development",
  saas: "SaaS",
  real_estate: "Real estate",
  restaurants: "Restaurants",
  agency: "Agencies",
  freelance: "Freelancers",
  b2b_services: "B2B services",
};

export const PERSONA_STYLES = ["analyst", "accommodator", "assertive"] as const;
export const CHANNELS = ["phone", "video", "in_person", "email"] as const;

const UnlockRule = z.object({
  min_trust: z.number().min(0).max(10),
  behavior: z.string().min(3),
});

const HiddenFact = z.object({
  id: z.string().regex(/^F\d+$/),
  fact: z.string().min(10),
  unlock: UnlockRule,
});

export const ScenarioVariantSchema = z.object({
  industry: z.enum(INDUSTRIES),
  version: z.number().int().positive(),
  brief: z.object({
    counterpart: z.string(),
    your_role: z.string(),
    your_goal: z.string(),
    channel: z.enum(CHANNELS),
    setting: z.string(),
  }),
  persona: z.object({
    name: z.string(),
    role: z.string(),
    company: z.string(),
    style: z.enum(PERSONA_STYLES),
    mood_at_start: z.string(),
    public_facts: z.array(z.string()).min(1),
    budget_real: z.string(),
    budget_stated: z.string(),
  }),
  context: z.string(),
  user_role: z.string(),
  user_objective: z.string(),
  ai_objective: z.string(),
  hidden_facts: z.array(HiddenFact).min(1),
  black_swan: z.object({ fact: z.string().min(10), unlock: UnlockRule }),
  objections: z.array(z.object({ text: z.string(), trigger: z.string() })).min(1),
  success_criteria: z.array(z.string()).min(1),
  failure_conditions: z.array(z.string()).min(1),
  vocabulary: z.array(z.string()),
  config: z.object({
    start_trust: z.number().min(0).max(10),
    hang_up_threshold: z.number().min(0).max(10),
    max_turns: z.number().int().min(4).max(30),
    value_perception_enabled: z.boolean(),
    start_value: z.number().min(0).max(10).nullable(),
    channel: z.enum(CHANNELS),
    ai_speaks_first: z.boolean(),
    acceptable_no_deal: z.boolean(),
  }),
});
export type ScenarioVariant = z.infer<typeof ScenarioVariantSchema>;

export const RubricWeightsSchema = z
  .partialRecord(z.enum(DIMENSIONS), z.number().int().min(0).max(100))
  .refine(
    (w) => Object.values(w).reduce((a, b) => a + (b ?? 0), 0) === 100,
    "rubric_weights must sum to 100",
  );
export type RubricWeights = Partial<Record<Dimension, number>>;

export const ScenarioFileSchema = z.object({
  id: z.string().regex(/^S\d{2}$/),
  title: z.string(),
  summary: z.string(),
  skills: z.array(z.string()).min(1),
  difficulty_default: z.number().int().min(1).max(5),
  primary_industry: z.enum(INDUSTRIES),
  rubric_weights: RubricWeightsSchema,
  challenge_tags: z.array(z.enum(["cold_calls", "price_talks", "objections", "closing"])),
  sort_order: z.number().int(),
  variants: z.array(ScenarioVariantSchema).min(1),
});
export type ScenarioFile = z.infer<typeof ScenarioFileSchema>;
