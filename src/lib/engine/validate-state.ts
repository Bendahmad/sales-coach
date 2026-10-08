import type { EngineState } from "@/lib/ai/schemas";
import type { ScenarioVariant } from "@/lib/content/scenario-schema";
import { effectiveMinTrust } from "./render-prompt";

export const BLACK_SWAN_ID = "BLACK_SWAN";
const MAX_TRUST_STEP = 2;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export interface ValidationResult {
  state: EngineState;
  flags: {
    trust_clamped?: boolean;
    value_clamped?: boolean;
    invalid_reveals?: string[];
    unknown_ids?: string[];
  };
}

/** Required trust for each revealable id, after the retry bonus. */
export function unlockThresholds(v: ScenarioVariant, unlockBonus: number): Map<string, number> {
  const map = new Map<string, number>();
  for (const f of v.hidden_facts) map.set(f.id, effectiveMinTrust(f.unlock.min_trust, unlockBonus));
  map.set(BLACK_SWAN_ID, effectiveMinTrust(v.black_swan.unlock.min_trust, unlockBonus));
  return map;
}

/**
 * Enforces the engine rules in code (TECHNICAL_ARCHITECTURE §4.2):
 * trust moves at most ±2 per turn and stays in [0, 10]; a hidden fact can only be
 * revealed once trust meets its (bonus-adjusted) threshold; unknown or repeated ids are dropped.
 */
export function validateState(args: {
  raw: EngineState;
  previousTrust: number;
  previousValue: number | null;
  variant: ScenarioVariant;
  unlockBonus: number;
  alreadyRevealed: Set<string>;
}): ValidationResult {
  const { raw, previousTrust, previousValue, variant, unlockBonus, alreadyRevealed } = args;
  const flags: ValidationResult["flags"] = {};

  const requestedDelta = raw.trust - previousTrust;
  const delta = clamp(requestedDelta, -MAX_TRUST_STEP, MAX_TRUST_STEP);
  const trust = clamp(previousTrust + delta, 0, 10);
  if (trust !== raw.trust) flags.trust_clamped = true;

  let value: number | null = null;
  if (variant.config.value_perception_enabled) {
    const prev = previousValue ?? variant.config.start_value ?? 5;
    const next = raw.value_perception ?? prev;
    value = clamp(prev + clamp(next - prev, -MAX_TRUST_STEP, MAX_TRUST_STEP), 0, 10);
    if (value !== raw.value_perception) flags.value_clamped = true;
  }

  const thresholds = unlockThresholds(variant, unlockBonus);
  const revealed: string[] = [];
  for (const id of new Set(raw.revealed)) {
    const required = thresholds.get(id);
    if (required === undefined) {
      (flags.unknown_ids ??= []).push(id);
    } else if (alreadyRevealed.has(id)) {
      continue;
    } else if (trust < required) {
      (flags.invalid_reveals ??= []).push(id);
    } else {
      revealed.push(id);
    }
  }

  return {
    state: {
      ...raw,
      trust,
      trust_delta: Math.round((trust - previousTrust) * 10) / 10,
      value_perception: value,
      revealed,
      outcome: raw.end ? raw.outcome : null,
    },
    flags,
  };
}
