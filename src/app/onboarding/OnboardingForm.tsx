"use client";

import { useActionState } from "react";
import { btn } from "@/components/ui";
import { CHALLENGES, EXPERIENCE, INDUSTRY_OPTIONS } from "@/lib/labels";
import { saveOnboarding, type OnboardingState } from "./actions";

function Choice({ name, value, label }: { name: string; value: string; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ring-1 ring-slate-200 has-[:checked]:bg-indigo-50 has-[:checked]:ring-2 has-[:checked]:ring-indigo-500 hover:bg-slate-50">
      <input type="radio" name={name} value={value} required className="accent-indigo-600" />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

export function OnboardingForm() {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(saveOnboarding, {});
  return (
    <form action={action} className="space-y-8">
      <div>
        <label htmlFor="display_name" className="block font-semibold">
          What should we call you? <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input
          id="display_name"
          name="display_name"
          maxLength={60}
          className="mt-2 block w-full rounded-lg border-0 px-3 py-2.5 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600"
        />
      </div>
      <fieldset>
        <legend className="font-semibold">1. What do you sell?</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {INDUSTRY_OPTIONS.map((o) => (
            <Choice key={o.value} name="industry" value={o.value} label={o.label} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="font-semibold">2. How long have you been selling?</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {EXPERIENCE.map((o) => (
            <Choice key={o.value} name="experience" value={o.value} label={o.label} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="font-semibold">3. Which conversation scares you most?</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {CHALLENGES.map((o) => (
            <Choice key={o.value} name="biggest_challenge" value={o.value} label={o.label} />
          ))}
        </div>
      </fieldset>
      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${btn.primary} w-full sm:w-auto`}>
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
