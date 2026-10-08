import { describe, expect, it } from "vitest";
import type { Profile, ScenarioCard } from "@/lib/data/queries";
import { recommendFromProfile } from "./recommend";

const sc = (id: string, tags: string[], industry: string, difficulty: number, order: number): ScenarioCard => ({
  id, title: id, summary: "", skills: [], difficulty_default: difficulty, primary_industry: industry,
  rubric_weights: {}, challenge_tags: tags, sort_order: order,
});
const scenarios = [
  sc("S01", ["cold_calls"], "restaurants", 2, 1),
  sc("S04", ["price_talks", "objections"], "web_dev", 3, 3),
  sc("S09", ["price_talks"], "freelance", 4, 5),
];
const profile = (o: Partial<Profile>): Profile => ({
  id: "u", email: "", display_name: null, industry: null, experience: null, biggest_challenge: null, onboarded_at: null, ...o,
});

describe("recommendFromProfile", () => {
  it("matches the biggest challenge, preferring the user's industry", () => {
    expect(recommendFromProfile(profile({ biggest_challenge: "price_talks", industry: "freelance" }), scenarios)?.id).toBe("S09");
    expect(recommendFromProfile(profile({ biggest_challenge: "price_talks", industry: "saas" }), scenarios)?.id).toBe("S04");
  });
  it("falls back to the easiest scenario", () => {
    expect(recommendFromProfile(profile({}), scenarios)?.id).toBe("S01");
  });
});
