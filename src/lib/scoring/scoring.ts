import type { DimensionResult, Evaluation } from "@/lib/ai/schemas";
import { DIMENSIONS, type Dimension, type RubricWeights } from "@/lib/content/scenario-schema";

/**
 * Code-side scoring rules from knowledge-system/04-rubrics.md and prompt I:
 * evidence validation, the 60-point cap without evidence, the ethics cap,
 * run reconciliation, overall weighting, and score → level mapping.
 */

export const NO_EVIDENCE_CAP = 60;
export const ETHICS_CAP = 40;
export const RECONCILE_GAP = 15;

export interface TranscriptTurn {
  turn: number;
  role: "user" | "ai";
  content: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

/** Keeps only evidence whose turn exists and whose quote appears in that turn. */
export function validateEvidence(
  evidence: DimensionResult["evidence"],
  transcript: TranscriptTurn[],
): DimensionResult["evidence"] {
  return evidence.filter((e) => {
    const texts = transcript.filter((t) => t.turn === e.turn).map((t) => norm(t.content));
    const quote = norm(e.quote).replace(/^["']|["']$/g, "").replace(/(\.\.\.|…)$/g, "").trim();
    return quote.length > 0 && texts.some((t) => t.includes(quote));
  });
}

const isWeighted = (weights: RubricWeights, d: Dimension) => (weights[d] ?? 0) > 0;

/** Applies evidence validation, N/A for unweighted dimensions and the caps to one run. */
export function sanitizeRun(run: Evaluation, transcript: TranscriptTurn[], weights: RubricWeights): Evaluation {
  const ethics = run.ethics_flags.length > 0;
  const dimensions = { ...run.dimensions };
  for (const d of DIMENSIONS) {
    const r = run.dimensions[d];
    const evidence = validateEvidence(r.evidence, transcript);
    let score = isWeighted(weights, d) ? r.score : null;
    if (score !== null) {
      score = Math.max(0, Math.min(100, Math.round(score)));
      if (evidence.length === 0) score = Math.min(score, NO_EVIDENCE_CAP);
      if (ethics && (d === "persuasion" || d === "closing")) score = Math.min(score, ETHICS_CAP);
    }
    dimensions[d] = { ...r, score, evidence };
  }
  return { ...run, dimensions };
}

export type DimensionScores = Record<Dimension, number | null>;

export function scoresOf(run: Evaluation): DimensionScores {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, run.dimensions[d].score])) as DimensionScores;
}

/** True when two runs disagree by more than the allowed gap on any dimension. */
export function needsThirdRun(a: DimensionScores, b: DimensionScores): boolean {
  return DIMENSIONS.some((d) => {
    const x = a[d];
    const y = b[d];
    if (x === null && y === null) return false;
    if (x === null || y === null) return true;
    return Math.abs(x - y) > RECONCILE_GAP;
  });
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Two runs → mean; three or more → median. Null only if every run is null. */
export function reconcile(runs: DimensionScores[]): DimensionScores {
  const out = {} as DimensionScores;
  for (const d of DIMENSIONS) {
    const vals = runs.map((r) => r[d]).filter((v): v is number => v !== null);
    if (vals.length === 0) out[d] = null;
    else if (runs.length >= 3) out[d] = Math.round(median(vals));
    else out[d] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return out;
}

/** Weighted average over non-null dimensions (weights renormalized). */
export function computeOverall(scores: DimensionScores, weights: RubricWeights): number {
  let num = 0;
  let den = 0;
  for (const d of DIMENSIONS) {
    const w = weights[d] ?? 0;
    const s = scores[d];
    if (w > 0 && s !== null) {
      num += s * w;
      den += w;
    }
  }
  return den === 0 ? 0 : Math.round(num / den);
}

/** Index of the run whose overall is closest to the reconciled overall (its feedback text is used). */
export function representativeRun(runs: Evaluation[], weights: RubricWeights, overall: number): number {
  let best = 0;
  let bestGap = Infinity;
  runs.forEach((r, i) => {
    const gap = Math.abs(computeOverall(scoresOf(r), weights) - overall);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  });
  return best;
}

/** 04-rubrics.md "Mapping scores to competency levels". */
export function levelFor(medianScore: number, hasHardSession: boolean): number {
  if (medianScore <= 20) return 1;
  if (medianScore <= 40) return 2;
  if (medianScore <= 60) return 3;
  if (medianScore <= 80) return 4;
  return hasHardSession ? 5 : 4;
}

export function medianOf(values: number[]): number | null {
  return values.length === 0 ? null : Math.round(median(values));
}
