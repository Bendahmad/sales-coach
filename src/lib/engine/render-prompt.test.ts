import { describe, expect, it } from "vitest";
import { loadScenarioFiles } from "@/lib/content/load-scenarios";
import { effectiveMinTrust, renderRoleplayPrompt } from "./render-prompt";

const scenarios = loadScenarioFiles();

describe("scenario content", () => {
  it("contains the 6 V1 scenarios", () => {
    expect(scenarios.map((s) => s.id)).toEqual(["S01", "S03", "S04", "S06", "S09", "S15"]);
  });
});

describe("renderRoleplayPrompt", () => {
  for (const s of scenarios) {
    const v = s.variants[0];
    it(`${s.id}: renders with no unresolved placeholders and lists every hidden fact`, () => {
      const out = renderRoleplayPrompt(v, { difficulty: s.difficulty_default, unlockBonus: 0, maxTurns: v.config.max_turns });
      expect(out).not.toMatch(/\{\{|\}\}/);
      expect(out).toContain(v.persona.name);
      for (const f of v.hidden_facts) expect(out).toContain(`[${f.id}] ${f.fact}`);
      expect(out).toContain(`[BLACK_SWAN] ${v.black_swan.fact}`);
      expect(out).toContain(`Start at ${v.config.start_trust}.`);
    });
  }

  it("raises unlock thresholds on retries", () => {
    const v = scenarios.find((s) => s.id === "S04")!.variants[0];
    const out = renderRoleplayPrompt(v, { difficulty: 3, unlockBonus: 1, maxTurns: 18 });
    expect(out).toContain(`trust >= ${v.black_swan.unlock.min_trust + 1} AND`);
  });

  it("omits the value_perception block when disabled", () => {
    const v = scenarios.find((s) => s.id === "S01")!.variants[0];
    const out = renderRoleplayPrompt(v, { difficulty: 2, unlockBonus: 0, maxTurns: 14 });
    expect(out).not.toContain("value_perception` 0–10");
  });

  it("caps effective trust at 10", () => {
    expect(effectiveMinTrust(10, 1)).toBe(10);
  });
});
