"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { btn } from "@/components/ui";
import { api, ApiError } from "@/lib/api/client";

interface Msg {
  key: string;
  role: "user" | "ai" | "system";
  content: string;
}

interface TurnResponse {
  reply: string;
  ended: boolean;
  endReason: string | null;
}

const MAX_CHARS = 600;

export function ChatWindow(props: {
  sessionId: string;
  prospectName: string;
  initialMessages: { id: number; role: "user" | "ai"; content: string }[];
  initialUserTurns: number;
  maxTurns: number;
  initialPendingReply: boolean;
  goal: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(
    props.initialMessages.map((m) => ({ key: `db-${m.id}`, role: m.role, content: m.content })),
  );
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [needsRetry, setNeedsRetry] = useState(props.initialPendingReply);
  const [error, setError] = useState<string | null>(
    props.initialPendingReply ? "The prospect didn't answer. Retry to continue." : null,
  );
  const [userTurns, setUserTurns] = useState(props.initialUserTurns);
  const [ended, setEnded] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, waiting]);

  const turnsLeft = props.maxTurns - userTurns;
  const locked = waiting || ended || needsRetry;

  function goToFeedback(delayMs: number) {
    setTimeout(() => router.push(`/session/${props.sessionId}/feedback`), delayMs);
  }

  function handleReply(res: TurnResponse) {
    setMessages((m) => [...m, { key: `ai-${Date.now()}`, role: "ai", content: res.reply }]);
    if (res.ended) {
      setEnded(true);
      setMessages((m) => [...m, { key: `sys-${Date.now()}`, role: "system", content: "Conversation ended" }]);
      goToFeedback(2500);
    } else {
      inputRef.current?.focus();
    }
  }

  function handleError(e: unknown) {
    if (e instanceof ApiError) {
      if (e.code === "ai_failed") {
        setNeedsRetry(true);
        setError(e.message);
        return;
      }
      if (e.code === "session_not_active" || e.code === "turn_limit") {
        setEnded(true);
        goToFeedback(500);
        return;
      }
      if (e.code === "conflict") {
        router.refresh();
        return;
      }
      setError(e.message);
      return;
    }
    setNeedsRetry(true);
    setError("Network error. Retry to continue.");
  }

  async function send() {
    const text = input.trim();
    if (!text || locked) return;
    if (text.toLowerCase() === "/end") {
      setInput("");
      setConfirmEnd(true);
      return;
    }
    setError(null);
    setInput("");
    setMessages((m) => [...m, { key: `u-${Date.now()}`, role: "user", content: text }]);
    setUserTurns((t) => t + 1);
    setWaiting(true);
    try {
      handleReply(await api<TurnResponse>(`/api/sessions/${props.sessionId}/turn`, { body: { text } }));
    } catch (e) {
      // A refusal means the message wasn't processed: put it back so the user can rephrase.
      if (e instanceof ApiError && e.code === "ai_refused") {
        setMessages((m) => m.slice(0, -1));
        setUserTurns((t) => t - 1);
        setInput(text);
      }
      handleError(e);
    } finally {
      setWaiting(false);
    }
  }

  async function retryReply() {
    setError(null);
    setNeedsRetry(false);
    setWaiting(true);
    try {
      handleReply(await api<TurnResponse>(`/api/sessions/${props.sessionId}/retry-reply`));
    } catch (e) {
      handleError(e);
    } finally {
      setWaiting(false);
    }
  }

  async function endConversation() {
    setConfirmEnd(false);
    setEnded(true);
    try {
      await api(`/api/sessions/${props.sessionId}/end`);
    } finally {
      router.push(`/session/${props.sessionId}/feedback`);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col sm:h-[calc(100dvh-7rem)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <button className="text-left text-sm text-slate-500 hover:text-slate-900" onClick={() => setShowGoal((s) => !s)}>
          {showGoal ? "Hide goal ▲" : "Your goal ▼"}
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-sm ${turnsLeft <= 2 ? "font-semibold text-amber-600" : "text-slate-500"}`}>
            Turn {Math.min(userTurns, props.maxTurns)} / {props.maxTurns}
          </span>
          <button className={btn.secondary} onClick={() => setConfirmEnd(true)} disabled={ended}>
            End conversation
          </button>
        </div>
      </div>
      {showGoal && <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{props.goal}</p>}

      <div className="flex-1 space-y-3 overflow-y-auto py-4" aria-live="polite">
        {messages.map((m) =>
          m.role === "system" ? (
            <p key={m.key} className="text-center text-xs font-medium uppercase tracking-wide text-slate-400">
              {m.content}
            </p>
          ) : (
            <div key={m.key} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                  m.role === "user" ? "bg-indigo-600 text-white" : "bg-white text-slate-900 ring-1 ring-slate-200"
                }`}
              >
                {m.role === "ai" && <p className="mb-0.5 text-xs font-semibold text-slate-500">{props.prospectName}</p>}
                {m.content}
              </div>
            </div>
          ),
        )}
        {waiting && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
              <span className="sr-only">{props.prospectName} is typing</span>
              <span className="flex gap-1" aria-hidden>
                <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" />
                <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" />
                <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" />
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center gap-3 text-sm text-rose-600">
            <span>{error}</span>
            {needsRetry && (
              <button className="font-semibold underline" onClick={retryReply}>
                Retry
              </button>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {turnsLeft <= 2 && turnsLeft > 0 && !ended && (
        <p className="pb-2 text-center text-xs text-amber-700">
          {turnsLeft} turn{turnsLeft === 1 ? "" : "s"} left — time to land your next step.
        </p>
      )}

      <form
        className="flex items-end gap-2 border-t border-slate-200 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="flex-1">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            disabled={ended}
            placeholder={ended ? "Conversation ended" : "Type what you'd say… (Enter to send, /end to finish)"}
            className="block w-full resize-none rounded-xl border-0 px-3 py-2.5 text-[15px] ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600 disabled:bg-slate-100"
            aria-label="Your message"
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {input.length}/{MAX_CHARS}
          </p>
        </div>
        <button type="submit" className={`${btn.primary} mb-6`} disabled={locked || !input.trim()}>
          Send
        </button>
      </form>

      {confirmEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">End the conversation?</h2>
            <p className="mt-2 text-sm text-slate-600">Your coach will review it and score your skills.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className={btn.ghost} onClick={() => setConfirmEnd(false)}>
                Keep talking
              </button>
              <button className={btn.primary} onClick={endConversation}>
                End &amp; get feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
