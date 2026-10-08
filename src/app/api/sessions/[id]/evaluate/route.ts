import { after } from "next/server";
import { withUser, type IdContext } from "@/lib/api/handler";
import { getOwnedSession } from "@/lib/engine/session-service";
import { AppError } from "@/lib/errors";
import { evaluateSession } from "@/lib/evaluation/evaluate";

export const maxDuration = 300;

/** Retry a failed evaluation (idempotent: does nothing if one already exists). */
export const POST = withUser<IdContext>(async ({ user, ctx }) => {
  const { id } = await ctx.params;
  const session = await getOwnedSession(user.id, id);
  if (session.status === "active" || session.status === "abandoned") {
    throw new AppError("session_not_active", "This conversation hasn't ended");
  }
  after(() => evaluateSession(id));
  return { ok: true };
});
