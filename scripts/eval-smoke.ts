/**
 * Smoke evaluation set (TECHNICAL_ARCHITECTURE errata E4): runs the real evaluator on 6 scripted
 * transcripts and checks good ≥ 65 and bad ≤ 40. Calls the Anthropic API — costs money.
 *
 *   npm run eval:smoke            all transcripts
 *   npm run eval:smoke -- S04-bad one transcript
 *
 * Needs ANTHROPIC_API_KEY (in .env.local). No database required.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EngineState } from "../src/lib/ai/schemas";
import { loadScenarioFiles } from "../src/lib/content/load-scenarios";
import { scoreConversation } from "../src/lib/evaluation/score-conversation";
import type { MetricRow } from "../src/lib/metrics/compute";

interface SmokeCase {
  name: string;
  scenario: string;
  expect: "good" | "bad";
  rows: { turn: number; role: "user" | "ai"; content: string; state?: Partial<EngineState> }[];
}

const GOOD_MIN = 65;
const BAD_MAX = 40;

function toRows(c: SmokeCase): MetricRow[] {
  return c.rows.map((r) => ({
    turn: r.turn,
    role: r.role,
    content: r.content,
    engine_state:
      r.role === "ai"
        ? {
            trust: 5,
            trust_delta: 0,
            trust_reason: "",
            value_perception: null,
            revealed: [],
            objection_raised: null,
            thats_right: false,
            fake_yes: false,
            end: false,
            outcome: null,
            ...r.state,
          }
        : null,
  }));
}

async function main() {
  const filter = process.argv[2];
  const cases = (JSON.parse(readFileSync(join(process.cwd(), "content/smoke/transcripts.json"), "utf8")) as SmokeCase[]).filter(
    (c) => !filter || c.name === filter,
  );
  const files = loadScenarioFiles();
  const library = files.map((f) => ({
    id: f.id,
    title: f.title,
    skills: f.skills,
    difficulty_default: f.difficulty_default,
    rubric_weights: f.rubric_weights,
  }));

  let failures = 0;
  let input = 0;
  let output = 0;
  for (const c of cases) {
    const file = files.find((f) => f.id === c.scenario)!;
    const started = Date.now();
    const result = await scoreConversation({
      variant: file.variants[0],
      scenario: library.find((l) => l.id === c.scenario)!,
      library,
      rows: toRows(c),
      session: { difficulty: file.difficulty_default, attempt_number: 1, unlock_bonus: 0, end_reason: "ai_end" },
      history: { current_practice_focus: null, previous_attempts: [] },
    });
    input += result.usage.input;
    output += result.usage.output;
    const ok = c.expect === "good" ? result.overall >= GOOD_MIN : result.overall <= BAD_MAX;
    if (!ok) failures++;
    const dims = Object.entries(result.scores)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(9)} overall ${String(result.overall).padStart(3)} ` +
        `(expected ${c.expect === "good" ? `>= ${GOOD_MIN}` : `<= ${BAD_MAX}`}) runs=${result.runs.length} ` +
        `${((Date.now() - started) / 1000).toFixed(0)}s\n      ${dims}\n      focus: ${result.feedback.practice_focus.skill_id}` +
        (result.feedback.ethics_flags.length ? `\n      ethics: ${result.feedback.ethics_flags.join("; ")}` : ""),
    );
  }
  console.log(`\n${cases.length - failures}/${cases.length} passed · tokens in ${input}, out ${output}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
