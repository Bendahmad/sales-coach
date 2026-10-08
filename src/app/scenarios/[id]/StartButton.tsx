"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn } from "@/components/ui";
import { api, ApiError } from "@/lib/api/client";

export function StartButton({
  scenarioId,
  retryOf,
  disabledReason,
}: {
  scenarioId: string;
  retryOf?: string;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const { sessionId } = await api<{ sessionId: string }>("/api/sessions", { body: { scenarioId, retryOf } });
      router.push(`/session/${sessionId}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "active_session_exists" && typeof e.details?.sessionId === "string") {
        setActiveId(e.details.sessionId);
      } else {
        setError(e instanceof Error ? e.message : "Couldn't start the conversation.");
      }
      setPending(false);
    }
  }

  async function abandonAndStart() {
    if (!activeId) return;
    setPending(true);
    try {
      await api(`/api/sessions/${activeId}/abandon`);
      setActiveId(null);
      await start();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div>
      <button className={`${btn.primary} w-full sm:w-auto`} onClick={start} disabled={pending || Boolean(disabledReason)}>
        {pending ? "Connecting…" : retryOf ? "Start retry" : "Start conversation"}
      </button>
      {disabledReason && <p className="mt-2 text-sm text-slate-500">{disabledReason}</p>}
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

      {activeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">You have an unfinished conversation</h2>
            <p className="mt-2 text-sm text-slate-600">
              Resume it, or abandon it and start this one. Abandoned conversations aren&apos;t scored.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button className={btn.ghost} onClick={() => setActiveId(null)}>
                Cancel
              </button>
              <button className={btn.danger} onClick={abandonAndStart} disabled={pending}>
                Abandon &amp; start new
              </button>
              <button className={btn.primary} onClick={() => router.push(`/session/${activeId}`)}>
                Resume
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
