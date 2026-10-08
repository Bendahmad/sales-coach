import "server-only";
import { KNOWLEDGE_HASH } from "@/generated/knowledge";
import { callStructured, InvalidOutputError, RefusalError } from "@/lib/ai/client";
import { RoleplayTurnSchema, type EngineState } from "@/lib/ai/schemas";
import { ScenarioVariantSchema, type ScenarioVariant } from "@/lib/content/scenario-schema";
import { serverEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildApiMessages, KICKOFF_TEXT, type MessageRow } from "./history";
import { renderRoleplayPrompt } from "./render-prompt";
import { validateState } from "./validate-state";

const STALE_SESSION_MS = 24 * 60 * 60 * 1000;
/** The model may overrun the wrap-up instruction by this many turns before a forced end. */
const HARD_STOP_EXTRA_TURNS = 2;

export interface SessionRow {
  id: string;
  user_id: string;
  scenario_id: string;
  scenario_industry_id: string;
  difficulty: number;
  attempt_number: number;
  parent_session_id: string | null;
  practice_focus: string | null;
  unlock_bonus: number;
  rendered_system_prompt: string;
  roleplay_model: string;
  status: "active" | "ended" | "evaluating" | "evaluated" | "eval_failed" | "abandoned";
  end_reason: string | null;
  outcome: string | null;
  user_turns: number;
  final_trust: number | null;
  final_value_perception: number | null;
  last_activity_at: string;
}

export interface VariantWithId extends ScenarioVariant {
  id: string;
  scenario_id: string;
}

const db = () => supabaseAdmin();

// ---------------------------------------------------------------- loading

export async function loadVariant(variantId: string): Promise<VariantWithId> {
  const { data, error } = await db().from("scenario_industries").select("*").eq("id", variantId).single();
  if (error || !data) throw new AppError("not_found", "Scenario variant not found");
  const variant = ScenarioVariantSchema.parse(data);
  return { ...variant, id: data.id as string, scenario_id: data.scenario_id as string };
}

async function primaryVariantId(scenarioId: string): Promise<string> {
  const { data: scenario } = await db()
    .from("scenarios")
    .select("primary_industry, is_active")
    .eq("id", scenarioId)
    .single();
  if (!scenario?.is_active) throw new AppError("not_found", "Scenario not found");
  const { data } = await db()
    .from("scenario_industries")
    .select("id")
    .eq("scenario_id", scenarioId)
    .eq("industry", scenario.primary_industry)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  if (!data) throw new AppError("not_found", "Scenario has no active variant");
  return data.id as string;
}

/** Loads a session and checks ownership. */
export async function getOwnedSession(userId: string, sessionId: string): Promise<SessionRow> {
  const { data } = await db().from("roleplay_sessions").select("*").eq("id", sessionId).single();
  if (!data) throw new AppError("not_found", "Session not found");
  if (data.user_id !== userId) throw new AppError("forbidden", "Not your session");
  return data as SessionRow;
}

async function loadMessages(sessionId: string): Promise<MessageRow[]> {
  const { data, error } = await db()
    .from("roleplay_messages")
    .select("turn, role, content, raw_content, engine_state, validation_flags")
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export function maxTurnsFor(variant: ScenarioVariant): number {
  return Math.min(variant.config.max_turns, serverEnv.maxUserTurns);
}

// ---------------------------------------------------------------- lifecycle

/** Marks this user's active sessions with no activity for 24h as abandoned. */
export async function abandonStaleSessions(userId: string) {
  const cutoff = new Date(Date.now() - STALE_SESSION_MS).toISOString();
  await db()
    .from("roleplay_sessions")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "active")
    .lt("last_activity_at", cutoff);
}

export async function abandonSession(userId: string, sessionId: string) {
  const session = await getOwnedSession(userId, sessionId);
  if (session.status !== "active") return;
  await db()
    .from("roleplay_sessions")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .eq("id", sessionId);
}

export async function startSession(args: {
  userId: string;
  scenarioId: string;
  retryOf?: string;
}): Promise<{ sessionId: string }> {
  const { userId, scenarioId, retryOf } = args;
  await abandonStaleSessions(userId);

  const { data: active } = await db()
    .from("roleplay_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (active) {
    throw new AppError("active_session_exists", "You already have a conversation in progress", {
      sessionId: active.id,
    });
  }

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: today } = await db()
    .from("roleplay_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("started_at", startOfDay.toISOString());
  if ((today ?? 0) >= serverEnv.dailySessionLimit) {
    throw new AppError("daily_limit", `You've reached ${serverEnv.dailySessionLimit} practice calls today`);
  }

  let practiceFocus: string | null = null;
  let unlockBonus = 0;
  if (retryOf) {
    const parent = await getOwnedSession(userId, retryOf);
    if (parent.scenario_id !== scenarioId) throw new AppError("invalid_input", "Retry must use the same scenario");
    const { data: parentEval } = await db()
      .from("evaluations")
      .select("feedback")
      .eq("session_id", retryOf)
      .maybeSingle();
    practiceFocus = parentEval?.feedback?.practice_focus?.skill_id ?? null;
    unlockBonus = 1; // prompt I notes: raise unlock thresholds by +1 on retries
  }

  const variantId = await primaryVariantId(scenarioId);
  const variant = await loadVariant(variantId);
  const { data: scenario } = await db()
    .from("scenarios")
    .select("difficulty_default")
    .eq("id", scenarioId)
    .single();
  const difficulty = scenario!.difficulty_default as number;

  const { data: last } = await db()
    .from("roleplay_sessions")
    .select("attempt_number")
    .eq("user_id", userId)
    .eq("scenario_id", scenarioId)
    .neq("status", "abandoned")
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rendered = renderRoleplayPrompt(variant, {
    difficulty,
    unlockBonus,
    maxTurns: maxTurnsFor(variant),
  });

  const { data: session, error } = await db()
    .from("roleplay_sessions")
    .insert({
      user_id: userId,
      scenario_id: scenarioId,
      scenario_industry_id: variant.id,
      scenario_version: variant.version,
      difficulty,
      attempt_number: (last?.attempt_number ?? 0) + 1,
      parent_session_id: retryOf ?? null,
      practice_focus: practiceFocus,
      unlock_bonus: unlockBonus,
      rendered_system_prompt: rendered,
      prompt_version: KNOWLEDGE_HASH,
      roleplay_model: serverEnv.roleplayModel,
      final_trust: variant.config.start_trust,
      final_value_perception: variant.config.value_perception_enabled ? variant.config.start_value : null,
    })
    .select("*")
    .single();
  if (error) {
    // Unique index one_active_session_per_user: a concurrent start won the race.
    if (error.code === "23505") throw new AppError("active_session_exists", "A conversation is already in progress");
    throw error;
  }

  if (variant.config.ai_speaks_first) {
    await db()
      .from("roleplay_messages")
      .insert({ session_id: session.id, turn: 0, role: "kickoff", content: KICKOFF_TEXT });
    // The opening line is best-effort here; if it fails the chat page offers a retry.
    await runAiStep(session as SessionRow, variant, 0).catch(() => undefined);
  }
  return { sessionId: session.id as string };
}

// ---------------------------------------------------------------- turns

export interface TurnResult {
  reply: string;
  ended: boolean;
  endReason: string | null;
}

export async function takeTurn(userId: string, sessionId: string, text: string): Promise<TurnResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new AppError("invalid_input", "Message is empty");
  if (trimmed.length > serverEnv.maxMessageChars) {
    throw new AppError("invalid_input", `Messages are limited to ${serverEnv.maxMessageChars} characters`);
  }

  const session = await getOwnedSession(userId, sessionId);
  if (session.status !== "active") throw new AppError("session_not_active", "This conversation has ended");
  const variant = await loadVariant(session.scenario_industry_id);

  const turn = session.user_turns + 1;
  if (turn > maxTurnsFor(variant) + HARD_STOP_EXTRA_TURNS) {
    throw new AppError("turn_limit", "This conversation has reached its turn limit");
  }

  const { error } = await db()
    .from("roleplay_messages")
    .insert({ session_id: sessionId, turn, role: "user", content: trimmed });
  if (error) {
    if (error.code === "23505") throw new AppError("conflict", "That message was already sent");
    throw error;
  }
  await db()
    .from("roleplay_sessions")
    .update({ user_turns: turn, last_activity_at: new Date().toISOString() })
    .eq("id", sessionId);

  return runAiStep({ ...session, user_turns: turn }, variant, turn);
}

/** Re-runs the AI reply for the latest user turn (after a failed AI call). Idempotent. */
export async function retryAiReply(userId: string, sessionId: string): Promise<TurnResult> {
  const session = await getOwnedSession(userId, sessionId);
  if (session.status !== "active") throw new AppError("session_not_active", "This conversation has ended");
  const variant = await loadVariant(session.scenario_industry_id);
  const rows = await loadMessages(sessionId);
  const turn = session.user_turns;
  const hasReply = rows.some((r) => r.turn === turn && r.role === "ai");
  if (hasReply) throw new AppError("conflict", "The prospect already replied");
  return runAiStep(session, variant, turn);
}

function lastState(rows: MessageRow[]): EngineState | null {
  const ai = rows.filter((r) => r.role === "ai" && r.engine_state).sort((a, b) => b.turn - a.turn);
  return ai[0]?.engine_state ?? null;
}

async function runAiStep(session: SessionRow, variant: VariantWithId, turn: number): Promise<TurnResult> {
  const rows = await loadMessages(session.id);
  const prev = lastState(rows);
  const previousTrust = prev?.trust ?? variant.config.start_trust;
  const previousValue = prev?.value_perception ?? variant.config.start_value;
  const alreadyRevealed = new Set(rows.flatMap((r) => (r.role === "ai" ? r.engine_state?.revealed ?? [] : [])));

  const maxTurns = maxTurnsFor(variant);
  let systemNote: string | undefined;
  if (turn >= maxTurns) {
    systemNote =
      "The user has used their last turn. Wrap up the conversation naturally in this reply and set end to true.";
  }

  const messages = buildApiMessages(rows);
  const call = async (note?: string) => {
    const msgs = note ? [...messages, { role: "system" as const, content: note }] : messages;
    return callStructured({
      model: session.roleplay_model,
      effort: serverEnv.roleplayEffort,
      system: session.rendered_system_prompt,
      messages: msgs,
      schema: RoleplayTurnSchema,
      maxTokens: 2000,
    });
  };

  let result;
  try {
    result = await call(systemNote);
    let validated = validateState({
      raw: result.output.state,
      previousTrust,
      previousValue,
      variant,
      unlockBonus: session.unlock_bonus,
      alreadyRevealed,
    });

    // A hidden fact was revealed before it was earned: regenerate once with an operator note.
    if (validated.flags.invalid_reveals?.length) {
      const ids = validated.flags.invalid_reveals.join(", ");
      const note = [
        systemNote,
        `Hidden information ${ids} has not been earned yet at this point (trust is below its unlock threshold). ` +
          `Answer again without revealing or hinting at it. It may still be revealed later once its unlock rule is met.`,
      ]
        .filter(Boolean)
        .join("\n");
      const retry = await call(note);
      const revalidated = validateState({
        raw: retry.output.state,
        previousTrust,
        previousValue,
        variant,
        unlockBonus: session.unlock_bonus,
        alreadyRevealed,
      });
      result = retry;
      systemNote = note;
      validated = {
        state: revalidated.state,
        flags: { ...revalidated.flags, regenerated_for: validated.flags.invalid_reveals },
      } as typeof validated;
    }

    const state = validated.state;
    const forcedEnd = turn >= maxTurns + HARD_STOP_EXTRA_TURNS;
    const ended = state.end || forcedEnd;
    let endReason: "ai_end" | "max_turns" | "hang_up" | null = null;
    if (ended) {
      if (forcedEnd && !state.end) endReason = "max_turns";
      else if (state.trust < variant.config.hang_up_threshold) endReason = "hang_up";
      else if (turn >= maxTurns) endReason = "max_turns";
      else endReason = "ai_end";
    }

    const { error } = await db()
      .from("roleplay_messages")
      .insert({
        session_id: session.id,
        turn,
        role: "ai",
        content: result.output.reply,
        raw_content: result.rawContent,
        engine_state: state,
        validation_flags: { ...validated.flags, ...(systemNote ? { system_note: systemNote } : {}) },
        model: result.model,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        cache_read_tokens: result.usage.cacheReadTokens,
        latency_ms: result.latencyMs,
      });
    if (error) {
      if (error.code === "23505") throw new AppError("conflict", "The prospect already replied");
      throw error;
    }

    await db()
      .from("roleplay_sessions")
      .update({
        final_trust: state.trust,
        final_value_perception: state.value_perception,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    if (ended && endReason) {
      await endSession(session.id, endReason, state.outcome ?? (endReason === "hang_up" ? "lost" : "stalled"));
    }
    return { reply: result.output.reply, ended, endReason };
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e instanceof RefusalError) throw new AppError("ai_refused", "The prospect didn't respond to that. Try rephrasing.");
    if (e instanceof InvalidOutputError) throw new AppError("ai_failed", "The prospect didn't answer. Please retry.");
    console.error("roleplay AI step failed", e);
    throw new AppError("ai_failed", "The prospect didn't answer. Please retry.");
  }
}

// ---------------------------------------------------------------- ending

/**
 * Ends an active session and marks it ready for evaluation. Returns false if it was
 * already ended (idempotent). The caller schedules the evaluation.
 */
export async function endSession(
  sessionId: string,
  reason: "ai_end" | "user_end" | "max_turns" | "hang_up",
  outcome?: string | null,
): Promise<boolean> {
  const { data } = await db()
    .from("roleplay_sessions")
    .update({
      status: "evaluating",
      end_reason: reason,
      outcome: outcome ?? null,
      ended_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("status", "active")
    .select("id");
  return (data?.length ?? 0) > 0;
}

export async function endSessionByUser(userId: string, sessionId: string): Promise<void> {
  const session = await getOwnedSession(userId, sessionId);
  if (session.status !== "active") return;
  const rows = await loadMessages(sessionId);
  await endSession(sessionId, "user_end", lastState(rows)?.outcome ?? "stalled");
}
