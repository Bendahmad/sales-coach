import { AppShell } from "@/components/AppShell";
import { ScenarioCardView } from "@/components/ScenarioCardView";
import { getEvaluatedAttempts, getProfile, listScenarios } from "@/lib/data/queries";
import { recommendFromProfile } from "@/lib/recommend";

export default async function ScenariosPage() {
  const [scenarios, attempts, profile] = await Promise.all([listScenarios(), getEvaluatedAttempts(), getProfile()]);
  const recommended = profile ? recommendFromProfile(profile, scenarios) : null;
  return (
    <AppShell wide>
      <h1 className="text-2xl font-bold tracking-tight">Scenarios</h1>
      <p className="mt-1 text-slate-600">Pick a conversation to practice. Each one hides something the prospect won&apos;t say unless you earn it.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {scenarios.map((s) => {
          const mine = attempts.filter((a) => a.scenario_id === s.id && a.overall !== null);
          const best = mine.length ? Math.max(...mine.map((a) => a.overall as number)) : null;
          return (
            <ScenarioCardView
              key={s.id}
              scenario={s}
              best={best}
              attempts={mine.length}
              recommended={attempts.length === 0 && recommended?.id === s.id}
            />
          );
        })}
      </div>
    </AppShell>
  );
}
