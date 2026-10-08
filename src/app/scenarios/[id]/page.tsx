import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Difficulty } from "@/components/Difficulty";
import { card, label } from "@/components/ui";
import {
  getDailyUsage,
  getEvaluation,
  getScenario,
  getScenarioBrief,
  getSession,
} from "@/lib/data/queries";
import { CHANNEL_LABELS, scoreTone, skillLabel } from "@/lib/labels";
import { StartButton } from "./StartButton";

export default async function ScenarioBriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retryOf?: string }>;
}) {
  const { id } = await params;
  const { retryOf } = await searchParams;
  const scenario = await getScenario(id);
  if (!scenario) notFound();
  const brief = await getScenarioBrief(scenario);
  if (!brief) notFound();

  const parent = retryOf ? await getSession(retryOf) : null;
  const parentEval = parent && parent.scenario_id === id ? await getEvaluation(parent.id) : null;
  const usage = await getDailyUsage();
  const limitReached = usage.used >= usage.limit;

  return (
    <AppShell>
      <Link href="/scenarios" className="text-sm text-slate-500 hover:text-slate-900">
        ← All scenarios
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">{scenario.title}</h1>
      <div className="mt-2 flex items-center gap-3 text-sm text-slate-500">
        <span>{CHANNEL_LABELS[brief.channel] ?? brief.channel}</span>
        <Difficulty level={scenario.difficulty_default} />
        <span>Up to {brief.max_turns} turns</span>
      </div>

      {parentEval && (
        <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <p className={label + " text-indigo-700"}>Retry focus</p>
          <p className="mt-1 font-semibold text-indigo-950">{skillLabel(parentEval.feedback.practice_focus.skill_id)}</p>
          <p className="mt-1 text-sm text-indigo-900">{parentEval.feedback.practice_focus.instruction}</p>
          <p className="mt-3 text-sm text-indigo-900">
            Score to beat: <span className={`font-bold ${scoreTone(parentEval.overall)}`}>{parentEval.overall}</span>
          </p>
        </div>
      )}

      <div className={`${card} mt-6 space-y-4`}>
        <div>
          <p className={label}>Who you&apos;re talking to</p>
          <p className="mt-1">{brief.counterpart}</p>
        </div>
        <div>
          <p className={label}>Your role</p>
          <p className="mt-1">{brief.your_role}</p>
        </div>
        <div>
          <p className={label}>Your goal</p>
          <p className="mt-1 font-medium">{brief.your_goal}</p>
        </div>
        <div>
          <p className={label}>Setting</p>
          <p className="mt-1 text-slate-700">{brief.setting}</p>
        </div>
      </div>

      <div className={`${card} mt-4 text-sm text-slate-600`}>
        <p className="font-semibold text-slate-900">Before you start</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Type the way you&apos;d actually speak. Short and natural beats long and perfect.</li>
          <li>The prospect stays in character and won&apos;t help you. That&apos;s the point.</li>
          <li>
            Type <code className="rounded bg-slate-100 px-1">/end</code> or press <em>End conversation</em> when you&apos;re
            done. Then your coach reviews it.
          </li>
        </ul>
      </div>

      <div className="mt-6">
        <StartButton
          scenarioId={scenario.id}
          retryOf={parentEval ? retryOf : undefined}
          disabledReason={
            limitReached ? `You've done ${usage.limit} practice calls today. Come back tomorrow.` : undefined
          }
        />
      </div>
    </AppShell>
  );
}
