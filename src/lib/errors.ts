export type AppErrorCode =
  | "unauthorized"
  | "not_found"
  | "forbidden"
  | "daily_limit"
  | "active_session_exists"
  | "session_not_active"
  | "invalid_input"
  | "turn_limit"
  | "ai_refused"
  | "ai_failed"
  | "conflict";

const STATUS: Record<AppErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  daily_limit: 429,
  active_session_exists: 409,
  session_not_active: 409,
  conflict: 409,
  invalid_input: 400,
  turn_limit: 400,
  ai_refused: 422,
  ai_failed: 502,
};

/** Errors with a stable code the UI can react to. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
  get status() {
    return STATUS[this.code];
  }
}
