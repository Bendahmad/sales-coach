/** Browser-side JSON helper for the session API. */
export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly details: Record<string, unknown> | null) {
    super(message);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "POST",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.error;
    throw new ApiError(err?.code ?? "network", err?.message ?? "Network error. Please try again.", err?.details ?? null);
  }
  return json as T;
}
