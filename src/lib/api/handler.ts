import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/supabase/server";

type Handler<C> = (args: { req: Request; user: User; ctx: C }) => Promise<unknown>;

/** Wraps a route handler: requires a signed-in user and maps AppError to JSON responses. */
export function withUser<C>(handler: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      const user = await getCurrentUser();
      if (!user) throw new AppError("unauthorized", "Please sign in");
      const result = await handler({ req, user, ctx });
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      if (e instanceof AppError) {
        return NextResponse.json(
          { error: { code: e.code, message: e.message, details: e.details ?? null } },
          { status: e.status },
        );
      }
      console.error(e);
      return NextResponse.json(
        { error: { code: "internal", message: "Something went wrong. Please try again." } },
        { status: 500 },
      );
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError("invalid_input", "Invalid JSON body");
  }
}

export type IdContext = { params: Promise<{ id: string }> };
