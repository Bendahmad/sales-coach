import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";
import { EVALUATION_PROMPT_TEMPLATE, RUBRICS_MARKDOWN } from "@/generated/knowledge";

describe("evaluation prompt (prompt I)", () => {
  it("renders every input block in strict mode", () => {
    const out = Handlebars.compile(EVALUATION_PROMPT_TEMPLATE, { noEscape: true, strict: true })({
      scenario_json: "{SCENARIO}",
      numbered_transcript: "T1 USER: hi",
      per_turn_state_json: "[STATE]",
      deterministic_metrics_json: "{METRICS}",
      rubrics_markdown: RUBRICS_MARKDOWN,
      previous_attempts_json: "{HISTORY}",
    });
    expect(out).toContain("<scenario>{SCENARIO}</scenario>");
    expect(out).toContain("<transcript>T1 USER: hi</transcript>");
    expect(out).toContain("### D10 · CLOSING");
    expect(out).not.toMatch(/\{\{/);
  });
});
