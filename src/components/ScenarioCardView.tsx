import Link from "next/link";
import type { ScenarioCard } from "@/lib/data/queries";
import { INDUSTRY_OPTIONS, scoreTone, skillLabel } from "@/lib/labels";
import { Difficulty } from "./Difficulty";
import { card } from "./ui";

export function ScenarioCardView({
  scenario,
  best,
  attempts,
  recommended,
}: {
  scenario: ScenarioCard;
  best?: number | null;
  attempts?: number;
  recommended?: boolean;
}) {
  const industry = INDUSTRY_OPTIONS.find((i) => i.value === scenario.primary_industry)?.label;
  return (
    <Link
      href={`/scenarios/${scenario.id}`}
      className={`${card} block transition hover:border-indigo-300 hover:shadow-md ${recommended ? "ring-2 ring-indigo-500" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {recommended && (
            <span className="mb-2 inline-block rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
              Recommended
            </span>
          )}
          <h3 className="font-semibold text-slate-900">{scenario.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{scenario.summary}</p>
        </div>
        {best !== undefined && best !== null && (
          <div className="text-right">
            <div className={`text-2xl font-bold ${scoreTone(best)}`}>{best}</div>
            <div className="text-xs text-slate-500">best · {attempts} tries</div>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-0.5">{industry}</span>
        <Difficulty level={scenario.difficulty_default} />
        <span className="truncate">Trains: {scenario.skills.slice(0, 3).map(skillLabel).join(" · ")}</span>
      </div>
    </Link>
  );
}
