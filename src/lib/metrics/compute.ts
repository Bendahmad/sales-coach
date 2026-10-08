import type { EngineState } from "@/lib/ai/schemas";
import type { ScenarioVariant } from "@/lib/content/scenario-schema";
import { sortMessages } from "@/lib/engine/history";
import { BLACK_SWAN_ID } from "@/lib/engine/validate-state";

/**
 * Deterministic metrics from knowledge-system/04-rubrics.md ("computed before LLM evaluation").
 * Heuristic V1 implementations; a field is null when the heuristic can't be trusted for the
 * scenario. The evaluator treats these as anchors, not verdicts.
 */

export interface MetricRow {
  turn: number;
  role: "kickoff" | "user" | "ai";
  content: string;
  engine_state: EngineState | null;
}

export interface Metrics {
  user_turns: number;
  talk_ratio_user: number;
  avg_words_per_turn_user: number;
  long_turns: number;
  questions_total: number;
  questions_open: number;
  questions_closed: number;
  questions_why: number;
  labels_count: number;
  mirrors_count: number;
  summaries_count: number;
  contradictions_count: number;
  pitch_before_discovery: boolean;
  thats_right_earned: boolean;
  fake_yes_count: number;
  hidden_facts_revealed: { id: string; turn: number }[];
  black_swan_revealed: boolean;
  black_swan_turn: number | null;
  trust_start: number;
  trust_end: number;
  trust_min: number;
  first_price_by: "user" | "ai" | null;
  user_price_points: { turn: number; amount: number }[] | null;
  ask_made: boolean;
  next_step_specificity: number;
}

const STOPWORDS = new Set(
  "a an the and or but so to of in on at for with is are was were be it that this i you we they he she my your our me".split(
    " ",
  ),
);

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s$]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Splits text into sentences, keeping the terminal punctuation. */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]*/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

export type QuestionKind = "open" | "closed" | "why";

export function classifyQuestion(q: string): QuestionKind {
  const s = q.trim().toLowerCase().replace(/^(and|so|but|ok(ay)?|well|just curious|out of curiosity)[,\s]+/, "");
  if (/^why\b/.test(s)) return "why";
  if (/^(what|what's|whats|how|which|who|tell me|walk me|describe|help me understand)\b/.test(s)) return "open";
  if (/^(can|could) you (tell|walk|describe|help me understand)\b/.test(s)) return "open";
  return "closed";
}

const LABEL_RE = /^(it|that|this)\s+(seems|sounds|looks|feels)\s+(like|as if|as though)\b/i;
const SUMMARY_RE =
  /^(so,?\s+(if i('m| am)|what i('m| am)|let me|you('re| are) saying|basically|to recap)|let me (make sure|recap|summari[sz]e)|if i('m| am) hearing|what i('m| am) hearing|to summari[sz]e|just to recap)/i;
const CONTRADICTION_RE =
  /\b(you('re| are) wrong|that('s| is) not true|that('s| is) (just )?incorrect|that('s| is) not how|actually,? no\b|no,? that('s| is) not)/i;
const ASK_RE =
  /\b(would it be (a )?(bad|terrible|ridiculous|crazy) idea|can we (schedule|book|set up|lock in|put)|shall we|let'?s (schedule|book|set up|get|lock|go ahead|move forward)|how about (we )?(meet|book|schedule|start)|would you be (open|against)|are you (open|ready) to|does .{1,40} work for you|ready to (sign|move forward|go ahead)|move forward|go ahead with)\b/i;
const MONEY_RE = /(\$|€|£)\s?\d[\d,.]*\s?k?\b|\b\d[\d,.]*\s?(k|usd|dollars|euros?|eur)\b/gi;
const DAY_RE =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|this week|\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2}:\d{2}|jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(tember)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/i;
const ACTION_RE =
  /\b(send|call|meet|meeting|visit|demo|sign|review|introduce|intro|walk ?through|stop by|come by|book|schedule|set up|talk|chat|look at|minutes)\b/i;
const AGREE_RE = /\b(ok(ay)?|sounds good|works for me|that works|deal|see you|perfect|great,? (see|talk)|sure)\b/i;

function parseAmount(raw: string): number | null {
  const m = raw.toLowerCase().match(/(\d[\d,.]*)\s?(k)?/);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ""));
  if (Number.isNaN(n)) return null;
  if (m[2] === "k") n *= 1000;
  return n;
}

/** Speaker-perspective swap so "it kills me" is mirrored by "kills you?". */
const PRONOUN_SWAP: Record<string, string> = {
  you: "me",
  your: "my",
  "you're": "i'm",
  yours: "mine",
  yourself: "myself",
};

function isMirror(userText: string, prevAi: string | undefined): boolean {
  if (!prevAi) return false;
  const u = normalize(userText.replace(/\?+$/, ""));
  const uw = words(u);
  if (uw.length === 0 || uw.length > 5) return false;
  if (uw.every((w) => STOPWORDS.has(w))) return false;
  const swapped = uw.map((w) => PRONOUN_SWAP[w] ?? w).join(" ");
  const haystack = ` ${normalize(prevAi)} `;
  return haystack.includes(` ${u} `) || haystack.includes(` ${swapped} `);
}

export function computeMetrics(rows: MetricRow[], variant: ScenarioVariant): Metrics {
  const ordered = sortMessages(rows).filter((r) => r.role !== "kickoff");
  const user = ordered.filter((r) => r.role === "user");
  const ai = ordered.filter((r) => r.role === "ai");

  const userWords = user.reduce((n, r) => n + words(r.content).length, 0);
  const aiWords = ai.reduce((n, r) => n + words(r.content).length, 0);

  let open = 0,
    closed = 0,
    why = 0,
    labels = 0,
    summaries = 0,
    contradictions = 0,
    mirrors = 0,
    longTurns = 0,
    asks = 0;
  let questionsSeen = 0;
  let pitchBeforeDiscovery = false;

  let prevAi: string | undefined;
  for (const r of ordered) {
    if (r.role === "ai") {
      prevAi = r.content;
      continue;
    }
    const wc = words(r.content).length;
    if (wc > 80) longTurns++;
    const mirror = isMirror(r.content, prevAi);
    if (mirror) mirrors++;
    if (SUMMARY_RE.test(r.content.trim()) && wc >= 12) summaries++;
    if (CONTRADICTION_RE.test(r.content)) contradictions++;
    if (ASK_RE.test(r.content)) asks++;

    const sents = sentences(r.content);
    let questionsInTurn = 0;
    for (const s of sents) {
      if (LABEL_RE.test(s)) labels++;
      // A mirror ends in "?" but is a listening move, not a closed question.
      if (s.endsWith("?") && !mirror) {
        questionsInTurn++;
        const kind = classifyQuestion(s);
        if (kind === "open") open++;
        else if (kind === "why") why++;
        else closed++;
      }
    }
    if (questionsSeen < 2 && questionsInTurn === 0 && wc > 30) pitchBeforeDiscovery = true;
    questionsSeen += questionsInTurn;
  }

  // Hidden information and trust come from the validated engine log.
  const revealed: { id: string; turn: number }[] = [];
  let trustMin = variant.config.start_trust;
  let trustEnd = variant.config.start_trust;
  let thatsRight = false;
  let fakeYes = 0;
  for (const r of ai) {
    const st = r.engine_state;
    if (!st) continue;
    for (const id of st.revealed) revealed.push({ id, turn: r.turn });
    trustMin = Math.min(trustMin, st.trust);
    trustEnd = st.trust;
    if (st.thats_right) thatsRight = true;
    if (st.fake_yes) fakeYes++;
  }
  const swan = revealed.find((x) => x.id === BLACK_SWAN_ID);

  // Pricing metrics only for scenarios that track value perception (S04, S09, S15).
  const pricing = variant.config.value_perception_enabled;
  let firstPriceBy: Metrics["first_price_by"] = null;
  let pricePoints: Metrics["user_price_points"] = null;
  if (pricing) {
    pricePoints = [];
    for (const r of ordered) {
      const matches = r.content.match(MONEY_RE);
      if (!matches) continue;
      if (!firstPriceBy) firstPriceBy = r.role === "user" ? "user" : "ai";
      if (r.role === "user") {
        for (const m of matches) {
          const amount = parseAmount(m);
          if (amount !== null && amount >= 100) pricePoints.push({ turn: r.turn, amount });
        }
      }
    }
  }

  // Next-step specificity over the closing exchange (last 4 messages): date/time, action, agreement.
  const tail = ordered.slice(-4);
  const tailText = tail.map((r) => r.content).join(" ");
  const aiTail = tail.filter((r) => r.role === "ai").map((r) => r.content).join(" ");
  const specificity =
    (DAY_RE.test(tailText) ? 1 : 0) + (ACTION_RE.test(tailText) ? 1 : 0) + (AGREE_RE.test(aiTail) ? 1 : 0);

  const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  return {
    user_turns: user.length,
    talk_ratio_user: userWords + aiWords === 0 ? 0 : round(userWords / (userWords + aiWords)),
    avg_words_per_turn_user: user.length === 0 ? 0 : round(userWords / user.length, 1),
    long_turns: longTurns,
    questions_total: open + closed + why,
    questions_open: open,
    questions_closed: closed,
    questions_why: why,
    labels_count: labels,
    mirrors_count: mirrors,
    summaries_count: summaries,
    contradictions_count: contradictions,
    pitch_before_discovery: pitchBeforeDiscovery,
    thats_right_earned: thatsRight,
    fake_yes_count: fakeYes,
    hidden_facts_revealed: revealed,
    black_swan_revealed: Boolean(swan),
    black_swan_turn: swan?.turn ?? null,
    trust_start: variant.config.start_trust,
    trust_end: trustEnd,
    trust_min: trustMin,
    first_price_by: firstPriceBy,
    user_price_points: pricePoints,
    ask_made: asks > 0,
    next_step_specificity: specificity,
  };
}
