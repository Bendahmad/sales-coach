"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { btn } from "@/components/ui";
import { api } from "@/lib/api/client";

const STEPS = ["Counting your questions", "Scoring 10 skills", "Writing your feedback"];

export function EvaluationPoller({ sessionId, initialStatus }: { sessionId: string; initialStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (status === "eval_failed") return;
    const poll = setInterval(async () => {
      try {
        const res = await api<{ status: string }>(`/api/sessions/${sessionId}/status`, { method: "GET" });
        setStatus(res.status);
        if (res.status === "evaluated") router.refresh();
      } catch {
        /* keep polling */
      }
    }, 2000);
    const stepper = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 12000);
    return () => {
      clearInterval(poll);
      clearInterval(stepper);
    };
  }, [sessionId, status, router]);

  async function retry() {
    setStatus("evaluating");
    setStep(0);
    await api(`/api/sessions/${sessionId}/evaluate`).catch(() => setStatus("eval_failed"));
  }

  if (status === "eval_failed") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <p className="font-semibold text-rose-900">We couldn&apos;t finish your review.</p>
        <button className={`${btn.primary} mt-4`} onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="font-semibold">Your coach is reviewing the conversation…</p>
      <p className="mt-1 text-sm text-slate-500">This usually takes 30–90 seconds.</p>
      <ol className="mt-5 space-y-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                i < step ? "bg-emerald-500 text-white" : i === step ? "animate-pulse bg-indigo-500 text-white" : "bg-slate-200"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span className={i <= step ? "text-slate-900" : "text-slate-400"}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
