import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/** Server-side configuration. Never import from client components. */
export const serverEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  roleplayModel: process.env.ROLEPLAY_MODEL ?? "claude-opus-5-5",
  roleplayEffort: (process.env.ROLEPLAY_EFFORT ?? "low") as "low" | "medium" | "high",
  evalModel: process.env.EVAL_MODEL ?? "claude-opus-5-5",
  evalEffort: (process.env.EVAL_EFFORT ?? "high") as "low" | "medium" | "high" | "xhigh" | "max",
  dailySessionLimit: Number(process.env.DAILY_SESSION_LIMIT ?? 10),
  maxUserTurns: Number(process.env.MAX_USER_TURNS ?? 20),
  maxMessageChars: 600,
};
