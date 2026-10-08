import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ScenarioCardView } from "@/components/ScenarioCardView";
import { Sparkline } from "@/components/Sparkline";
import { btn, card, label } from "@/components/ui";
import { DIMENSIONS } from "@/lib/content/scenario-schema";
import {
  getActiveSession,
  getEvaluatedAttempts,
  getEvaluation,
  getProfile,
  getProgress,
  getScoreTrends,
  listScenarios,
} from "@/lib/data/queries";
import { abandonStaleSessions } from "@/lib/engine/session-service";
import { DIMENSION_LABELS, scoreTone } from "@/lib/labels";
import { recommendFromProfile } from "@/lib/recommend";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (profile) await abandonStaleSessions(profile.id);

  const [active, attempts, scenarios, progress, trends] = await Promise.all([
    getActiveSession(),
    getEvaluatedAttempts(),
    listScenarios(),
    getProgress(),
    getScoreTrends(),
  ]);

  const last = attempts[0];
  const lastEval = last ? await getEvaluation(last.id) : null;
  const prevSame = last
    ? attempts.find((a) => a.scenario_id === last.scenario_id && a.attempt_number < last.attempt_number)
    : undefined;
  const delta = last?.overall != null && prevSame?.overall != null ? last.overall - prevSame.overall : null;

  const nextId = lastEval?.feedback.next_scenario.id;
  const recommended =
    scenarios.find((s) => s.id === nextId) ?? (profile ? recommendFromProfile(profile, scenarios) : scenarios[0]);
  const activeScenario = active ? scenarios.find((s) => s.id === active.scenario_id) : null;

  const byDim = new Map(progress.map((p) => [p.dimension, p]));
  const weakest = progress
    .filter((p) => p.sessions_count >= 2 && p.median_last3 !== null)
    .sort((a, b) => (a.median_last3 ?? 0) - (b.median_last3 ?? 0))[0];

  return (
    <AppShell wide>
      <h1 className="text-2xl font-bold tracking-tight">
        {profile?.display_name ? `Welcome back, ${profile.display_name}` : "Your practice"}
      </h1>

      {active && activeScenario && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <div>
            <p className={`${label} text-amber-700`}>Unfinished conversation</p>
            <p className="mt-1 font-semibold">{activeScenario.title}</p>
          </div>
          <Link href={`/session/${active.id}`} className={btn.primary}>
            Continue
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <p className={label}>{last ? "Recommended next" : "Start here"}</p>
          <div className="mt-2">{recommended && <ScenarioCardView scenario={recommended} recommended={!last} />}</div>
          {lastEval && <p className="mt-2 text-sm text-slate-600">{lastEval.feedback.next_scenario.reason}</p>}
        </div>

        <div>
          <p className={label}>Your last score</p>
          {last && last.overall !== null ? (
            <Link href={`/session/${last.id}/feedback`} className={`${card} mt-2 block hover:border-indigo-300`}>
              <div className="flex items-baseline gap-3">
                <span className={`text-4xl font-bold ${scoreTone(last.overall)}`}>{last.overall}</span>
                {delta !== null && (
                  <span className={`font-semibold ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {delta >= 0 ? "+" : ""}
                    {delta}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {scenarios.find((s) => s.id === last.scenario_id)?.title} · attempt {last.attempt_number} ·{" "}
                {new Date(last.started_at).toLocaleDateString()}
              </p>
            </Link>
          ) : (
            <div className={`${card} mt-2 text-sm text-slate-600`}>
              No scored conversations yet. Your first one sets your baseline across 10 skills.
            </div>
          )}
        </div>
      </div>

      {weakest && (
        <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <p className={`${label} text-indigo-700`}>Your focus</p>
          <p className="mt-1 font-semibold text-indigo-950">
            {DIMENSION_LABELS[weakest.dimension]}: median {weakest.median_last3} over your last sessions
          </p>
        </div>
      )}

      <section className={`${card} mt-6`}>
        <h2 className="font-semibold">Skill snapshot</h2>
        {progress.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Complete a conversation to see your skills here.</p>
        ) : (
          <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {DIMENSIONS.map((d) => {
              const p = byDim.get(d);
              return (
                <div key={d} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{DIMENSION_LABELS[d]}</span>
                  <span className="flex items-center gap-3">
                    <Sparkline values={trends[d] ?? []} />
                    <span className={`w-8 text-right font-semibold ${scoreTone(p?.latest_score)}`}>
                      {p?.latest_score ?? "—"}
                    </span>
                    <span className="w-8 rounded bg-slate-100 px-1.5 py-0.5 text-center text-xs text-slate-600">
                      {p?.level != null ? `L${p.level}` : "—"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
