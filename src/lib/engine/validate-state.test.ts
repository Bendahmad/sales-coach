import { describe, expect, it } from "vitest";
import { loadScenarioFiles } from "@/lib/content/load-scenarios";
import type { EngineState } from "@/lib/ai/schemas";
import { validateState } from "./validate-state";

const s04 = loadScenarioFiles().find((s) => s.id === "S04")!.variants[0]; // F1 @5, BLACK_SWAN @6, value on

function raw(overrides: Partial<EngineState> = {}): EngineState {
  return {
    trust: 5,
    trust_delta: 0,
    trust_reason: "",
    value_perception: 5,
    revealed: [],
    objection_raised: null,
    thats_right: false,
    fake_yes: false,
    end: false,
    outcome: null,
    ...overrides,
  };
}

const base = { previousValue: 5, variant: s04, unlockBonus: 0, alreadyRevealed: new Set<string>() };

describe("validateState", () => {
  it("clamps trust changes to ±2 per turn", () => {
    const r = validateState({ ...base, raw: raw({ trust: 9 }), previousTrust: 5 });
    expect(r.state.trust).toBe(7);
    expect(r.state.trust_delta).toBe(2);
    expect(r.flags.trust_clamped).toBe(true);
  });

  it("keeps trust within 0–10", () => {
    expect(validateState({ ...base, raw: raw({ trust: -3 }), previousTrust: 1 }).state.trust).toBe(0);
    expect(validateState({ ...base, raw: raw({ trust: 12 }), previousTrust: 9.5 }).state.trust).toBe(10);
  });

  it("rejects a reveal when trust is below the threshold", () => {
    const r = validateState({ ...base, raw: raw({ trust: 5, revealed: ["BLACK_SWAN"] }), previousTrust: 5 });
    expect(r.state.revealed).toEqual([]);
    expect(r.flags.invalid_reveals).toEqual(["BLACK_SWAN"]);
  });

  it("accepts a reveal once the threshold is met", () => {
    const r = validateState({ ...base, raw: raw({ trust: 6, revealed: ["BLACK_SWAN", "F1"] }), previousTrust: 5 });
    expect(r.state.revealed).toEqual(["BLACK_SWAN", "F1"]);
    expect(r.flags.invalid_reveals).toBeUndefined();
  });

  it("applies the retry unlock bonus", () => {
    const r = validateState({
      ...base,
      unlockBonus: 1,
      raw: raw({ trust: 6, revealed: ["BLACK_SWAN"] }),
      previousTrust: 5,
    });
    expect(r.flags.invalid_reveals).toEqual(["BLACK_SWAN"]);
  });

  it("drops unknown and already-revealed ids", () => {
    const r = validateState({
      ...base,
      alreadyRevealed: new Set(["F1"]),
      raw: raw({ trust: 6, revealed: ["F1", "F9"] }),
      previousTrust: 6,
    });
    expect(r.state.revealed).toEqual([]);
    expect(r.flags.unknown_ids).toEqual(["F9"]);
  });

  it("clamps value perception and nulls outcome unless the conversation ended", () => {
    const r = validateState({
      ...base,
      raw: raw({ value_perception: 1, outcome: "won" }),
      previousTrust: 5,
    });
    expect(r.state.value_perception).toBe(3);
    expect(r.state.outcome).toBeNull();
  });
});
