import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { btn, card, label } from "@/components/ui";
import { DIMENSIONS } from "@/lib/content/scenario-schema";
import {
  getEvaluation,
  getMessages,
  getPreviousAttemptScore,
  getScenario,
  getScenarioBrief,
  getSession,
} from "@/lib/data/queries";
import { loadHiddenFactTexts } from "@/lib/data/hidden-facts";
import { barTone, DIMENSION_LABELS, OUTCOME_LABELS, scoreTone, skillLabel } from "@/lib/labels";
import { EvaluationPoller } from "./EvaluationPoller";
import { RealismRating } from "./RealismRating";

function TurnRef({ turn }: { turn: number }) {
  return (
    <a href={`#turn-${turn}`} className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 hover:bg-slate-200">
      T{turn}
    </a>
  );
}

export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  if (session.status === "active") redirect(`/session/${id}`);

  const [scenario, messages, evaluation] = await Promise.all([
    getScenario(session.scenario_id),
    getMessages(id),
    getEvaluation(id),
  ]);
  if (!scenario) notFound();
  const brief = await getScenarioBrief(scenario);
  const prospectName = brief?.counterpart.split(",")[0].trim() ?? "The prospect";

  const transcript = (
    <details className={`${card} mt-6`} open={!evaluation}>
      <summary className="cursor-pointer font-semibold">Transcript</summary>
      <div className="mt-4 space-y-2">
        {messages.map((m) => (
          <div key={m.id} id={`turn-${m.turn}`} className="scroll-mt-20 text-sm">
            <span className="mr-2 font-mono text-xs text-slate-400">T{m.turn}</span>
            <span className={`font-semibold ${m.role === "user" ? "text-indigo-700" : "text-slate-700"}`}>
              {m.role === "user" ? "You" : prospectName}:
            </span>{" "}
            <span className="text-slate-800">{m.content}</span>
          </div>
        ))}
      </div>
    </details>
  );

  if (session.status === "abandoned") {
    return (
      <AppShell>
        <h1 className="text-2xl font-bold">{scenario.title}</h1>
        <p className="mt-2 text-slate-600">This conversation was abandoned, so it wasn&apos;t scored.</p>
        <Link href={`/scenarios/${scenario.id}`} className={`${btn.primary} mt-6`}>
          Try this scenario again
        </Link>
        {transcript}
      </AppShell>
    );
  }

  if (!evaluation) {
    return (
      <AppShell>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{scenario.title}</p>
        <h1 className="mb-6 text-2xl font-bold">Feedback</h1>
        <EvaluationPoller sessionId={id} initialStatus={session.status} />
        {transcript}
      </AppShell>
    );
  }

  const fb = evaluation.feedback;
  const previous = await getPreviousAttemptScore(session);
  const delta = previous === null ? null : evaluation.overall - previous;
  const outcome = OUTCOME_LABELS[evaluation.outcome ?? session.outcome ?? ""];
  const factTexts = await loadHiddenFactTexts(session.scenario_industry_id);
  const nextIsSame = fb.next_scenario.id === session.scenario_id;

  return (
    <AppShell>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {scenario.title} · attempt {session.attempt_number}
      </p>

      {/* Score header */}
      <section className={`${card} mt-3 flex flex-wrap items-center justify-between gap-6`}>
        <div>
          <p className={label}>Overall score</p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className={`text-5xl font-bold ${scoreTone(evaluation.overall)}`}>{evaluation.overall}</span>
            {delta !== null && (
              <span className={`text-lg font-semibold ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {delta >= 0 ? "+" : ""}
                {delta} since last attempt
              </span>
            )}
          </div>
          {fb.improvement_vs_last && <p className="mt-2 max-w-md text-sm text-slate-600">{fb.improvement_vs_last}</p>}
        </div>
        {outcome && <span className={`rounded-full px-3 py-1 text-sm font-semibold ${outcome.tone}`}>{outcome.label}</span>}
      </section>

      {/* Primary actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/scenarios/${session.scenario_id}?retryOf=${id}`} className={btn.primary}>
          Retry — focus on {skillLabel(fb.practice_focus.skill_id)}
        </Link>
        {!nextIsSame && (
          <Link href={`/scenarios/${fb.next_scenario.id}`} className={btn.secondary}>
            Next recommended scenario
          </Link>
        )}
      </div>

      {/* Coach feedback, in prompt I order */}
      <section className="mt-8 space-y-4">
        <div className={card}>
          <h2 className="font-semibold text-emerald-700">✓ What you did well</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {fb.did_well.map((d, i) => (
              <li key={i}>
                <TurnRef turn={d.turn} />
                {d.text}
              </li>
            ))}
          </ul>
        </div>

        <div className={card}>
          <h2 className="font-semibold text-rose-700">⚠ Biggest mistake</h2>
          <p className="mt-3 text-sm">
            <TurnRef turn={fb.biggest_mistake.turn} />
            {fb.biggest_mistake.quote && <q className="italic text-slate-700">{fb.biggest_mistake.quote}</q>}
          </p>
          <p className="mt-2 text-sm text-slate-800">{fb.biggest_mistake.text}</p>
        </div>

        <div className={card}>
          <h2 className="font-semibold text-amber-700">💡 Missed opportunity</h2>
          <p className="mt-3 text-sm">
            <TurnRef turn={fb.missed_opportunity.turn} />
            {fb.missed_opportunity.text}
          </p>
          <p className="mt-3 text-sm text-slate-700">
            <span className="font-semibold">Better approach: </span>
            {fb.better_alternative}
          </p>
        </div>

        <div className={card}>
          <h2 className="font-semibold text-indigo-700">🔁 A stronger response</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className={label}>
                You said <TurnRef turn={fb.stronger_response.turn} />
              </p>
              <p className="mt-1 text-slate-700">{fb.stronger_response.original}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 text-sm">
              <p className={label + " text-indigo-700"}>Try instead</p>
              <p className="mt-1 font-medium text-indigo-950">{fb.stronger_response.improved}</p>
            </div>
          </div>
        </div>

        <div className={`${card} border-indigo-200 bg-indigo-50/50`}>
          <h2 className="font-semibold">🎯 One thing to practice</h2>
          <p className="mt-2 font-medium">{skillLabel(fb.practice_focus.skill_id)}</p>
          <p className="mt-1 text-sm text-slate-700">{fb.practice_focus.instruction}</p>
        </div>
      </section>

      {/* Dimension scores */}
      <section className={`${card} mt-8`}>
        <h2 className="font-semibold">Skill scores</h2>
        <p className="mt-1 text-sm text-slate-500">Open a skill to see the evidence from your conversation.</p>
        <div className="mt-4 space-y-2">
          {DIMENSIONS.map((d) => {
            const r = evaluation.dimensions[d];
            const na = r.score === null;
            return (
              <details key={d} className="group rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="w-40 shrink-0 text-sm font-medium">{DIMENSION_LABELS[d]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    {!na && <span className={`block h-full rounded-full ${barTone(r.score)}`} style={{ width: `${r.score}%` }} />}
                  </span>
                  <span className={`w-10 text-right text-sm font-semibold ${scoreTone(r.score)}`}>{na ? "N/A" : r.score}</span>
                </summary>
                <div className="mt-2 ml-1 space-y-2 border-l-2 border-slate-200 pl-3 text-sm text-slate-700">
                  {na ? (
                    <p className="text-slate-500">Not tested in this scenario.</p>
                  ) : (
                    <>
                      <p>{r.rationale}</p>
                      {r.evidence.map((e, i) => (
                        <p key={i}>
                          <TurnRef turn={e.turn} />
                          <q className="italic">{e.quote}</q>
                        </p>
                      ))}
                    </>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      {/* Hidden info recap */}
      {fb.hidden_info_recap.length > 0 && (
        <section className={`${card} mt-6`}>
          <h2 className="font-semibold">What {prospectName} didn&apos;t tell you</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {fb.hidden_info_recap.map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className={`mt-0.5 font-bold ${h.revealed ? "text-emerald-600" : "text-rose-500"}`}>
                  {h.revealed ? "✓" : "✗"}
                </span>
                <div>
                  <p className="font-medium text-slate-900">
                    {h.id === "BLACK_SWAN" && (
                      <span className="mr-2 rounded bg-slate-900 px-1.5 py-0.5 text-xs text-white">Game changer</span>
                    )}
                    {factTexts[h.id] ?? h.id}
                  </p>
                  <p className="mt-0.5 text-slate-600">
                    {h.revealed ? "You uncovered this. " : "Missed. "}
                    {h.how_to_unlock}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {fb.ethics_flags.length > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Integrity note</p>
          <ul className="mt-1 list-disc pl-5">
            {fb.ethics_flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <p className="mt-2">Pressure tactics and false claims cap Persuasion and Closing at 40.</p>
        </section>
      )}

      <section className={`${card} mt-6`}>
        <RealismRating sessionId={id} prospectName={prospectName} initial={session.realism_rating} />
      </section>

      {transcript}

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href={`/scenarios/${session.scenario_id}?retryOf=${id}`} className={btn.primary}>
          Retry this scenario
        </Link>
        <Link href="/dashboard" className={btn.secondary}>
          Dashboard
        </Link>
      </div>
    </AppShell>
  );
}
