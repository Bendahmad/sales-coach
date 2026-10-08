"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";

export function RealismRating({ sessionId, prospectName, initial }: { sessionId: string; prospectName: string; initial: number | null }) {
  const [rating, setRating] = useState<number | null>(initial);
  const [saved, setSaved] = useState(false);

  async function rate(n: number) {
    setRating(n);
    try {
      await api(`/api/sessions/${sessionId}/rating`, { body: { rating: n } });
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-slate-700">Did {prospectName} feel like a real prospect?</span>
      <div className="flex gap-1" role="radiogroup" aria-label="Realism rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} of 5`}
            onClick={() => rate(n)}
            className={`text-2xl leading-none ${rating !== null && n <= rating ? "text-amber-400" : "text-slate-300"} hover:text-amber-400`}
          >
            ★
          </button>
        ))}
      </div>
      {saved && <span className="text-xs text-emerald-600">Thanks!</span>}
    </div>
  );
}
