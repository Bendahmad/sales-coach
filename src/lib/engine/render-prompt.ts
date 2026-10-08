import Handlebars from "handlebars";
import { ROLEPLAY_PROMPT_TEMPLATE } from "@/generated/knowledge";
import { INDUSTRY_LABELS, type ScenarioVariant } from "@/lib/content/scenario-schema";

const STYLE_LABEL = {
  analyst: "Analyst",
  accommodator: "Accommodator",
  assertive: "Assertive",
} as const;

const CHANNEL_LABEL = {
  phone: "phone",
  video: "video call",
  in_person: "in-person",
  email: "email",
} as const;

const compiled = Handlebars.compile(ROLEPLAY_PROMPT_TEMPLATE, { noEscape: true, strict: true });

export interface RenderOptions {
  difficulty: number;
  /** Added to every unlock threshold (retries make hidden facts harder to earn). */
  unlockBonus: number;
  maxTurns: number;
}

/** Effective trust needed to reveal a fact, capped at 10. */
export function effectiveMinTrust(minTrust: number, unlockBonus: number): number {
  return Math.min(10, minTrust + unlockBonus);
}

function unlockRule(rule: { min_trust: number; behavior: string }, bonus: number): string {
  return `trust >= ${effectiveMinTrust(rule.min_trust, bonus)} AND ${rule.behavior}`;
}

/** Variables for prompt H, named exactly as the template's {{placeholders}}. */
export function buildRoleplayVariables(v: ScenarioVariant, opts: RenderOptions) {
  return {
    persona: {
      name: v.persona.name,
      role: v.persona.role,
      company: v.persona.company,
      style: STYLE_LABEL[v.persona.style],
      mood_at_start: v.persona.mood_at_start,
      public_facts: v.persona.public_facts.join("; "),
      budget_real: v.persona.budget_real,
      budget_stated: v.persona.budget_stated,
    },
    industry: INDUSTRY_LABELS[v.industry],
    ai_objective: v.ai_objective,
    industry_pack: { vocabulary: v.vocabulary.join(", ") },
    context: v.context,
    user_role: v.user_role,
    user_objective: v.user_objective,
    hidden_facts: v.hidden_facts.map((f) => ({
      id: f.id,
      fact: f.fact,
      unlock_rule: unlockRule(f.unlock, opts.unlockBonus),
    })),
    black_swan: {
      fact: v.black_swan.fact,
      unlock_rule: unlockRule(v.black_swan.unlock, opts.unlockBonus),
    },
    objections: v.objections,
    start_trust: v.config.start_trust,
    hang_up_threshold: v.config.hang_up_threshold,
    value_perception_enabled: v.config.value_perception_enabled,
    start_value: v.config.start_value ?? 5,
    channel: CHANNEL_LABEL[v.config.channel],
    max_turns: opts.maxTurns,
    difficulty: opts.difficulty,
  };
}

export function renderRoleplayPrompt(v: ScenarioVariant, opts: RenderOptions): string {
  return compiled(buildRoleplayVariables(v, opts));
}
