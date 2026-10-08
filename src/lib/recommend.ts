import type { Profile, ScenarioCard } from "@/lib/data/queries";

/** First-time recommendation from onboarding answers (USER_FLOWS F2). */
export function recommendFromProfile(profile: Profile, scenarios: ScenarioCard[]): ScenarioCard | null {
  if (scenarios.length === 0) return null;
  const score = (s: ScenarioCard) =>
    (profile.biggest_challenge && s.challenge_tags.includes(profile.biggest_challenge) ? 10 : 0) +
    (profile.industry && s.primary_industry === profile.industry ? 3 : 0) -
    s.difficulty_default;
  return [...scenarios].sort((a, b) => score(b) - score(a) || a.sort_order - b.sort_order)[0];
}
