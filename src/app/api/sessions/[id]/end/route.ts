import { after } from "next/server";
import { withUser, type IdContext } from "@/lib/api/handler";
import { endSessionByUser } from "@/lib/engine/session-service";
import { evaluateSession } from "@/lib/evaluation/evaluate";

export const maxDuration = 300;

/** User ends the conversation ("/end" or the End button); evaluation runs after the response. */
export const POST = withUser<IdContext>(async ({ user, ctx }) => {
  const { id } = await ctx.params;
  await endSessionByUser(user.id, id);
  after(() => evaluateSession(id));
  return { ok: true };
});
