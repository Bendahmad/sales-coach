import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { btn, card } from "@/components/ui";
import { getEvaluatedAttempts, listScenarios } from "@/lib/data/queries";
import { OUTCOME_LABELS, scoreTone } from "@/lib/labels";

export default async function HistoryPage() {
  const [attempts, scenarios] = await Promise.all([getEvaluatedAttempts(), listScenarios()]);

  const groups = scenarios
    .map((s) => ({
      scenario: s,
      attempts: attempts.filter((a) => a.scenario_id === s.id).sort((a, b) => a.attempt_number - b.attempt_number),
    }))
    .filter((g) => g.attempts.length > 0);

  return (
    <AppShell wide>
      <h1 className="text-2xl font-bold tracking-tight">History</h1>
      <p className="mt-1 text-slate-600">Every scored attempt, grouped by scenario.</p>

      {groups.length === 0 && (
        <div className={`${card} mt-6 text-center`}>
          <p className="text-slate-600">No scored conversations yet.</p>
          <Link href="/scenarios" className={`${btn.primary} mt-4`}>
            Pick a scenario
          </Link>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {groups.map(({ scenario, attempts: list }) => (
          <section key={scenario.id} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">{scenario.title}</h2>
              <p className="font-mono text-sm" aria-label="Score progression">
                {list.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && <span className="mx-1 text-slate-400">→</span>}
                    <span className={scoreTone(a.overall)}>{a.overall ?? "—"}</span>
                  </span>
                ))}
              </p>
            </div>
            <table className="mt-4 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-1.5 font-semibold">Date</th>
                  <th className="py-1.5 font-semibold">Attempt</th>
                  <th className="py-1.5 font-semibold">Score</th>
                  <th className="py-1.5 font-semibold">Change</th>
                  <th className="hidden py-1.5 font-semibold sm:table-cell">Outcome</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...list].reverse().map((a) => {
                  const prev = list.find((p) => p.attempt_number === a.attempt_number - 1);
                  const delta = prev?.overall != null && a.overall != null ? a.overall - prev.overall : null;
                  const outcome = a.outcome ? OUTCOME_LABELS[a.outcome] : null;
                  return (
                    <tr key={a.id}>
                      <td className="py-2">{new Date(a.started_at).toLocaleDateString()}</td>
                      <td className="py-2">#{a.attempt_number}</td>
                      <td className={`py-2 font-semibold ${scoreTone(a.overall)}`}>{a.overall ?? "—"}</td>
                      <td className="py-2">
                        {delta === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className={delta >= 0 ? "text-emerald-600" : "text-rose-600"}>
                            {delta >= 0 ? "+" : ""}
                            {delta}
                          </span>
                        )}
                      </td>
                      <td className="hidden py-2 sm:table-cell">
                        {outcome && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${outcome.tone}`}>{outcome.label}</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <Link href={`/session/${a.id}/feedback`} className="font-medium text-indigo-600 hover:underline">
                          Feedback
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
