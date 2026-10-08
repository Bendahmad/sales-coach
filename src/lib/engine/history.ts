import type { BetaContentBlock, BetaMessageParam } from "@/lib/ai/client";
import type { EngineState } from "@/lib/ai/schemas";

export const KICKOFF_TEXT = "(The conversation starts now. Say your first line.)";

/** Row shape needed to rebuild the conversation (server-side columns included). */
export interface MessageRow {
  turn: number;
  role: "kickoff" | "user" | "ai";
  content: string;
  raw_content: BetaContentBlock[] | null;
  engine_state: EngineState | null;
  validation_flags: { system_note?: string } & Record<string, unknown> | null;
}

const ROLE_ORDER = { kickoff: 0, user: 1, ai: 2 } as const;

export function sortMessages<T extends Pick<MessageRow, "turn" | "role">>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.turn - b.turn || ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
}

/**
 * Rebuilds the exact message list previously sent to the model (append-only):
 * user/kickoff text, any persisted mid-conversation system note, then the assistant's
 * raw content blocks unchanged.
 */
export function buildApiMessages(rows: MessageRow[]): BetaMessageParam[] {
  const out: BetaMessageParam[] = [];
  for (const row of sortMessages(rows)) {
    if (row.role === "ai") {
      if (row.validation_flags?.system_note) {
        out.push({ role: "system", content: row.validation_flags.system_note });
      }
      out.push({ role: "assistant", content: row.raw_content ?? row.content });
    } else {
      out.push({ role: "user", content: row.content });
    }
  }
  return out;
}

/** "T1 USER: …" / "T1 AI: …" transcript for the evaluator (prompt I input format). */
export function formatTranscript(rows: Pick<MessageRow, "turn" | "role" | "content">[]): string {
  return sortMessages(rows)
    .filter((r) => r.role !== "kickoff")
    .map((r) => `T${r.turn} ${r.role === "user" ? "USER" : "AI"}: ${r.content}`)
    .join("\n");
}
