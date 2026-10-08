import "server-only";
import type { Evaluation } from "@/lib/ai/schemas";
import type { Dimension, RubricWeights } from "@/lib/content/scenario-schema";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Read models for pages. User-owned data is read with the user's RLS-bound client and explicit
 * safe columns; scenario briefs (stored next to hidden facts) are read with the admin client and
 * only the public fields are returned.
 */

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  industry: string | null;
  experience: string | null;
  biggest_challenge: string | null;
  onboarded_at: string | null;
}

export interface ScenarioCard {
  id: string;
  title: string;
  summary: string;
  skills: string[];
  difficulty_default: number;
  primary_industry: string;
  rubric_weights: RubricWeights;
  challenge_tags: string[];
  sort_order: number;
}

export interface ScenarioBrief {
  counterpart: string;
  your_role: string;
  your_goal: string;
  channel: string;
  setting: string;
  max_turns: number;
}

export interface SessionSummary {
  id: string;
  scenario_id: string;
  scenario_industry_id: string;
  attempt_number: number;
  parent_session_id: string | null;
  practice_focus: string | null;
  status: string;
  end_reason: string | null;
  outcome: string | null;
  user_turns: number;
  realism_rating: number | null;
  difficulty: number;
  started_at: string;
  ended_at: string | null;
}

const SESSION_COLUMNS =
  "id, scenario_id, scenario_industry_id, attempt_number, parent_session_id, practice_focus, status, end_reason, outcome, user_turns, realism_rating, difficulty, started_at, ended_at";

export interface EvaluationRecord {
  session_id: string;
  overall: number;
  outcome: string | null;
  dimensions: Evaluation["dimensions"];
  feedback: Omit<
    Evaluation,
    "overall" | "outcome" | "dimensions"
  >;
  created_at: string;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("users")
    .select("id, email, display_name, industry, experience, biggest_challenge, onboarded_at")
    .maybeSingle();
  return (data as Profile) ?? null;
}

export async function listScenarios(): Promise<ScenarioCard[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("scenarios")
    .select("id, title, summary, skills, difficulty_default, primary_industry, rubric_weights, challenge_tags, sort_order")
    .order("sort_order");
  return (data ?? []) as ScenarioCard[];
}

export async function getScenario(id: string): Promise<ScenarioCard | null> {
  const all = await listScenarios();
  return all.find((s) => s.id === id) ?? null;
}

/** Public brief of the scenario's primary variant (no hidden facts). */
export async function getScenarioBrief(scenario: ScenarioCard): Promise<ScenarioBrief | null> {
  const { data } = await supabaseAdmin()
    .from("scenario_industries")
    .select("brief, config")
    .eq("scenario_id", scenario.id)
    .eq("industry", scenario.primary_industry)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const brief = data.brief as Omit<ScenarioBrief, "max_turns">;
  const maxTurns = Math.min((data.config as { max_turns: number }).max_turns, serverEnv.maxUserTurns);
  return { ...brief, max_turns: maxTurns };
}

export async function getActiveSession(): Promise<SessionSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("roleplay_sessions")
    .select(SESSION_COLUMNS)
    .eq("status", "active")
    .maybeSingle();
  return (data as SessionSummary) ?? null;
}

export async function getSession(sessionId: string): Promise<SessionSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("roleplay_sessions").select(SESSION_COLUMNS).eq("id", sessionId).maybeSingle();
  return (data as SessionSummary) ?? null;
}

export interface ChatMessage {
  id: number;
  turn: number;
  role: "user" | "ai";
  content: string;
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("roleplay_messages")
    .select("id, turn, role, content")
    .eq("session_id", sessionId)
    .order("turn")
    .order("id");
  return (data ?? []) as ChatMessage[];
}

export async function getEvaluation(sessionId: string): Promise<EvaluationRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("evaluations")
    .select("session_id, overall, outcome, dimensions, feedback, created_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  return (data as EvaluationRecord) ?? null;
}

/** All evaluated attempts with their overall score, newest first. */
export async function getEvaluatedAttempts(): Promise<
  (SessionSummary & { overall: number | null })[]
> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("roleplay_sessions")
    .select(`${SESSION_COLUMNS}, evaluations(overall)`)
    .eq("status", "evaluated")
    .order("started_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((row) => {
    const ev = (row as { evaluations: { overall: number } | { overall: number }[] | null }).evaluations;
    const overall = Array.isArray(ev) ? ev[0]?.overall ?? null : ev?.overall ?? null;
    return { ...(row as unknown as SessionSummary), overall };
  });
}

/** Overall score of the previous evaluated attempt on the same scenario. */
export async function getPreviousAttemptScore(session: SessionSummary): Promise<number | null> {
  const attempts = await getEvaluatedAttempts();
  const prev = attempts
    .filter((a) => a.scenario_id === session.scenario_id && a.attempt_number < session.attempt_number)
    .sort((a, b) => b.attempt_number - a.attempt_number)[0];
  return prev?.overall ?? null;
}

export interface ProgressRow {
  dimension: Dimension;
  latest_score: number | null;
  best_score: number | null;
  median_last3: number | null;
  level: number | null;
  sessions_count: number;
}

export async function getProgress(): Promise<ProgressRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_skill_progress")
    .select("dimension, latest_score, best_score, median_last3, level, sessions_count");
  return (data ?? []) as ProgressRow[];
}

/** Last N non-null scores per dimension, oldest → newest (for trend sparklines). */
export async function getScoreTrends(limitPerDimension = 5): Promise<Record<string, number[]>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("skill_scores")
    .select("dimension, score, created_at")
    .not("score", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);
  const out: Record<string, number[]> = {};
  for (const row of data ?? []) {
    const list = (out[row.dimension as string] ??= []);
    if (list.length < limitPerDimension) list.push(row.score as number);
  }
  for (const k of Object.keys(out)) out[k].reverse();
  return out;
}

export async function getDailyUsage(): Promise<{ used: number; limit: number }> {
  const supabase = await createSupabaseServerClient();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("roleplay_sessions")
    .select("id", { count: "exact", head: true })
    .gte("started_at", start.toISOString());
  return { used: count ?? 0, limit: serverEnv.dailySessionLimit };
}
