import { describe, expect, it } from "vitest";
import type { DimensionResult, Evaluation } from "@/lib/ai/schemas";
import { DIMENSIONS } from "@/lib/content/scenario-schema";
import {
  computeOverall,
  levelFor,
  needsThirdRun,
  reconcile,
  representativeRun,
  sanitizeRun,
  scoresOf,
  validateEvidence,
  type DimensionScores,
  type TranscriptTurn,
} from "./scoring";

const transcript: TranscriptTurn[] = [
  { turn: 0, role: "ai", content: "Marco's Pizzeria, yeah?" },
  { turn: 1, role: "user", content: "Did I catch you at a bad time?" },
  { turn: 1, role: "ai", content: "Kind of. What is it?" },
  { turn: 2, role: "user", content: "It sounds like the delivery apps are eating your margin." },
];

const weights = { clarity: 50, empathy: 30, persuasion: 20 };

function dim(score: number | null, evidence: DimensionResult["evidence"] = []): DimensionResult {
  return { score, evidence, rationale: "" };
}

function run(scores: Partial<Record<(typeof DIMENSIONS)[number], number>>, ethics: string[] = []): Evaluation {
  const dimensions = Object.fromEntries(
    DIMENSIONS.map((d) => [d, dim(scores[d] ?? 50, [{ turn: 2, quote: "delivery apps are eating your margin" }])]),
  ) as Evaluation["dimensions"];
  return {
    overall: 0,
    outcome: "advanced",
    dimensions,
    did_well: [],
    biggest_mistake: { turn: 1, quote: "", text: "", skill_id: "EMP.LABEL" },
    missed_opportunity: { turn: 1, text: "" },
    better_alternative: "",
    stronger_response: { turn: 1, original: "", improved: "" },
    practice_focus: { skill_id: "EMP.LABEL", drill: "DR-LABEL", instruction: "" },
    next_scenario: { id: "S01", difficulty: 2, reason: "" },
    hidden_info_recap: [],
    improvement_vs_last: null,
    ethics_flags: ethics,
  };
}

describe("validateEvidence", () => {
  it("keeps real quotes (case/whitespace-insensitive) and drops invented ones", () => {
    const kept = validateEvidence(
      [
        { turn: 1, quote: "did I catch you at a  bad time" },
        { turn: 2, quote: "I can save you 30%" },
        { turn: 9, quote: "bad time" },
      ],
      transcript,
    );
    expect(kept).toEqual([{ turn: 1, quote: "did I catch you at a  bad time" }]);
  });
});

describe("sanitizeRun", () => {
  it("nulls unweighted dimensions", () => {
    const r = sanitizeRun(run({ clarity: 70 }), transcript, weights);
    expect(r.dimensions.clarity.score).toBe(70);
    expect(r.dimensions.negotiation.score).toBeNull();
  });

  it("caps scores without valid evidence at 60", () => {
    const base = run({ clarity: 90 });
    base.dimensions.clarity = dim(90, [{ turn: 1, quote: "made up" }]);
    expect(sanitizeRun(base, transcript, weights).dimensions.clarity.score).toBe(60);
  });

  it("applies the ethics cap to persuasion and closing", () => {
    const r = sanitizeRun(run({ persuasion: 85, clarity: 85 }, ["fake urgency"]), transcript, weights);
    expect(r.dimensions.persuasion.score).toBe(40);
    expect(r.dimensions.clarity.score).toBe(85);
  });
});

describe("reconcile", () => {
  const a = { ...scoresOf(run({})), clarity: 60, empathy: 70 } as DimensionScores;
  const b = { ...scoresOf(run({})), clarity: 70, empathy: 90 } as DimensionScores;

  it("flags a third run when runs differ by more than 15", () => {
    expect(needsThirdRun(a, b)).toBe(true);
    expect(needsThirdRun(a, { ...b, empathy: 80 })).toBe(false);
  });

  it("averages two runs and takes the median of three", () => {
    expect(reconcile([a, b]).clarity).toBe(65);
    expect(reconcile([a, b, { ...a, empathy: 75 }]).empathy).toBe(75);
  });

  it("keeps null only when all runs are null", () => {
    expect(reconcile([{ ...a, value: null }, { ...b, value: null }]).value).toBeNull();
    expect(reconcile([{ ...a, value: null }, { ...b, value: 40 }]).value).toBe(40);
  });
});

describe("computeOverall", () => {
  it("weights non-null dimensions and renormalizes", () => {
    const s = { ...scoresOf(run({})), clarity: 80, empathy: 60, persuasion: null } as DimensionScores;
    // (80*50 + 60*30) / 80 = 72.5 → 73
    expect(computeOverall(s, weights)).toBe(73);
  });
});

describe("representativeRun", () => {
  it("picks the run closest to the reconciled overall", () => {
    const runs = [run({ clarity: 40, empathy: 40, persuasion: 40 }), run({ clarity: 70, empathy: 70, persuasion: 70 })];
    expect(representativeRun(runs, weights, 65)).toBe(1);
  });
});

describe("levelFor", () => {
  it.each([
    [15, false, 1],
    [35, false, 2],
    [55, false, 3],
    [75, false, 4],
    [90, false, 4],
    [90, true, 5],
  ])("median %i (hard session: %s) → level %i", (m, hard, level) => expect(levelFor(m, hard)).toBe(level));
});
