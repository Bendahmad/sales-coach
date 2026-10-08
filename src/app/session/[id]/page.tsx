import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getMessages, getScenario, getScenarioBrief, getSession } from "@/lib/data/queries";
import { ChatWindow } from "./ChatWindow";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  if (session.status !== "active") redirect(`/session/${id}/feedback`);

  const scenario = await getScenario(session.scenario_id);
  const brief = scenario ? await getScenarioBrief(scenario) : null;
  if (!scenario || !brief) notFound();

  const messages = await getMessages(id);
  const last = messages[messages.length - 1];
  // Awaiting a reply: the last message is the user's, or the AI's opening line failed.
  const pendingReply = last ? last.role === "user" : true;
  const prospectName = brief.counterpart.split(",")[0].trim();

  return (
    <AppShell>
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{scenario.title}</p>
        <h1 className="text-lg font-bold">{brief.counterpart}</h1>
      </div>
      <ChatWindow
        sessionId={id}
        prospectName={prospectName}
        initialMessages={messages}
        initialUserTurns={session.user_turns}
        maxTurns={brief.max_turns}
        initialPendingReply={pendingReply}
        goal={brief.your_goal}
      />
    </AppShell>
  );
}
