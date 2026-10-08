import Link from "next/link";
import { btn, card } from "@/components/ui";
import { DIMENSION_LABELS } from "@/lib/labels";

const SAMPLE: { who: "ai" | "you"; text: string; note?: { tone: "good" | "bad"; text: string } }[] = [
  { who: "ai", text: "Marco's Pizzeria, yeah?" },
  {
    who: "you",
    text: "Hi Marco, it's Sam. Did I catch you at a bad time?",
    note: { tone: "good", text: "No-oriented opener: easy for a busy owner to say “no, go ahead”." },
  },
  { who: "ai", text: "Kind of. We're prepping. What is it?" },
  {
    who: "you",
    text: "I build websites for restaurants. Do you want more customers?",
    note: { tone: "bad", text: "Yes-seeking question. A label about the delivery apps would have opened him up." },
  },
  { who: "ai", text: "Everybody wants more customers. Send me an email." },
];

const SCENARIOS = [
  { title: "Cold call a busy restaurant owner", tag: "Cold calls" },
  { title: "“It's more than I expected”", tag: "Price objection" },
  { title: "A founder lowballs your fee", tag: "Negotiation" },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <span className="text-base font-bold tracking-tight">
          Sales<span className="text-indigo-600">Coach</span>
        </span>
        <Link href="/login" className={btn.ghost}>
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20">
        <section className="grid items-center gap-10 py-10 md:grid-cols-2 md:py-16">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Practice real sales conversations with AI before they happen in real life.
            </h1>
            <p className="mt-5 text-lg text-slate-600">
              Talk to realistic prospects who push back, stall and hide what they really think. Get scored on 10
              communication skills, see exactly what to say better — then try again.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className={btn.primary}>
                Try a free practice call
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Text chat · about 10 minutes per conversation · no credit card
            </p>
          </div>

          <div className={`${card} space-y-3`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sample conversation · coach notes
            </p>
            {SAMPLE.map((m, i) => (
              <div key={i} className={m.who === "you" ? "flex flex-col items-end" : "flex flex-col items-start"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.who === "you" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-900"
                  }`}
                >
                  {m.text}
                </div>
                {m.note && (
                  <p
                    className={`mt-1 max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${
                      m.note.tone === "good" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {m.note.tone === "good" ? "✓ " : "⚠ "}
                    {m.note.text}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="py-10">
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              ["Pick a conversation", "Cold call, price objection, negotiation, “I'll think about it”…"],
              ["Talk to the prospect", "The AI stays in character. It won't help you — just like a real buyer."],
              ["Get coached", "Scores backed by quotes from your conversation, plus a stronger version of your weakest line."],
              ["Retry and improve", "Same prospect, one thing to focus on. Watch your score move."],
            ].map(([t, d], i) => (
              <li key={t} className={card}>
                <span className="text-sm font-semibold text-indigo-600">Step {i + 1}</span>
                <p className="mt-1 font-semibold">{t}</p>
                <p className="mt-1 text-sm text-slate-600">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-8 py-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Scenarios you can practice</h2>
            <ul className="mt-5 space-y-3">
              {SCENARIOS.map((s) => (
                <li key={s.title} className={`${card} flex items-center justify-between`}>
                  <span className="font-medium">{s.title}</span>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{s.tag}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">How scoring works</h2>
            <p className="mt-3 text-slate-600">
              Every score is based on what you actually said — the coach must quote your words as evidence. You&apos;re scored
              on up to 10 skills:
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.values(DIMENSION_LABELS).map((d) => (
                <span key={d} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-slate-200">
                  {d}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className={`${card} mt-6 text-center`}>
          <p className="text-lg font-semibold">Your next important call is coming. Rehearse it first.</p>
          <Link href="/login" className={`${btn.primary} mt-4`}>
            Start practicing
          </Link>
          <p className="mt-4 text-xs text-slate-500">
            Practice conversations are stored to show your progress. Please don&apos;t enter real client names or confidential
            details.
          </p>
        </section>
      </main>
    </div>
  );
}
