import { describe, expect, it } from "vitest";
import type { EngineState } from "@/lib/ai/schemas";
import { loadScenarioFiles } from "@/lib/content/load-scenarios";
import { classifyQuestion, computeMetrics, type MetricRow } from "./compute";

const files = loadScenarioFiles();
const s01 = files.find((s) => s.id === "S01")!.variants[0];
const s09 = files.find((s) => s.id === "S09")!.variants[0];

const state = (o: Partial<EngineState> = {}): EngineState => ({
  trust: 3,
  trust_delta: 0,
  trust_reason: "",
  value_perception: null,
  revealed: [],
  objection_raised: null,
  thats_right: false,
  fake_yes: false,
  end: false,
  outcome: null,
  ...o,
});

const ai = (turn: number, content: string, s: Partial<EngineState> = {}): MetricRow => ({
  turn,
  role: "ai",
  content,
  engine_state: state(s),
});
const user = (turn: number, content: string): MetricRow => ({ turn, role: "user", content, engine_state: null });

describe("classifyQuestion", () => {
  it.each([
    ["What's the biggest challenge with orders?", "open"],
    ["How do decisions like this get made?", "open"],
    ["So, how does that affect Friday nights?", "open"],
    ["Why don't you want to switch?", "why"],
    ["Do you have two minutes?", "closed"],
    ["Is now a bad time?", "closed"],
  ])("%s → %s", (q, kind) => expect(classifyQuestion(q)).toBe(kind));
});

describe("computeMetrics", () => {
  const convo: MetricRow[] = [
    { turn: 0, role: "kickoff", content: "(start)", engine_state: null },
    ai(0, "Marco's Pizzeria, yeah?"),
    user(1, "Hi Marco, it's Sam. Did I catch you at a bad time?"),
    ai(1, "Kind of. We're prepping. What is it?", { trust: 3.5 }),
    user(2, "I help pizzerias take orders online without the delivery-app commission. How much of your business comes through the apps?"),
    ai(2, "Too much. They take a big cut, honestly it kills me.", { trust: 4.5, revealed: ["F1"] }),
    user(3, "Kills you?"),
    ai(3, "Thirty percent on every order. Thirty!", { trust: 5 }),
    user(4, "It sounds like you feel you're working for the app instead of for yourself. Who else would weigh in on changing how orders come in?"),
    ai(4, "My daughter does the computer stuff, she'd have to be there.", { trust: 6.5, revealed: ["BLACK_SWAN"] }),
    user(5, "Would it be a bad idea to set 15 minutes with both of you on Thursday at 3pm to look at it?"),
    ai(5, "Okay, Thursday at 3 works. See you then.", { trust: 7, end: true, outcome: "advanced", thats_right: false }),
  ];
  const m = computeMetrics(convo, s01);

  it("counts questions by type", () => {
    expect(m.questions_open).toBe(2);
    expect(m.questions_closed).toBe(2);
    expect(m.questions_why).toBe(0);
  });
  it("detects mirrors and labels", () => {
    expect(m.mirrors_count).toBe(1);
    expect(m.labels_count).toBe(1);
  });
  it("reads reveals and trust from the engine log", () => {
    expect(m.hidden_facts_revealed).toEqual([
      { id: "F1", turn: 2 },
      { id: "BLACK_SWAN", turn: 4 },
    ]);
    expect(m.black_swan_revealed).toBe(true);
    expect(m.black_swan_turn).toBe(4);
    expect(m.trust_end).toBe(7);
    expect(m.trust_min).toBe(3);
  });
  it("detects the ask and a specific next step", () => {
    expect(m.ask_made).toBe(true);
    expect(m.next_step_specificity).toBe(3);
  });
  it("leaves pricing metrics null for non-pricing scenarios", () => {
    expect(m.first_price_by).toBeNull();
    expect(m.user_price_points).toBeNull();
  });
  it("computes the talk ratio and no contradictions", () => {
    expect(m.talk_ratio_user).toBeGreaterThan(0.4);
    expect(m.contradictions_count).toBe(0);
    expect(m.pitch_before_discovery).toBe(false);
  });

  it("tracks price points and who named a price first", () => {
    const pricing = computeMetrics(
      [
        ai(0, "So, what would this cost me? I was thinking $3,000."),
        user(1, "Projects like this usually land between $8,000 and $10,000."),
        ai(1, "That's not fair."),
        user(2, "I could do $7.5k if we split payment."),
      ],
      s09,
    );
    expect(pricing.first_price_by).toBe("ai");
    expect(pricing.user_price_points).toEqual([
      { turn: 1, amount: 8000 },
      { turn: 1, amount: 10000 },
      { turn: 2, amount: 7500 },
    ]);
  });

  it("flags contradictions and pitching before discovery", () => {
    const bad = computeMetrics(
      [
        ai(0, "Hello?"),
        user(
          1,
          "Hi, I'm a full stack developer with ten years of experience building React and Next.js websites with modern hosting, SEO, analytics, ordering systems, integrations and great design for restaurants like yours across the city.",
        ),
        ai(1, "Not interested."),
        user(2, "You're wrong, every restaurant needs this."),
      ],
      s01,
    );
    expect(bad.pitch_before_discovery).toBe(true);
    expect(bad.contradictions_count).toBe(1);
  });
});
