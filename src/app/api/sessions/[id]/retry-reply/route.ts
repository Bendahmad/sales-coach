import { after } from "next/server";
import { withUser, type IdContext } from "@/lib/api/handler";
import { retryAiReply } from "@/lib/engine/session-service";
import { evaluateSession } from "@/lib/evaluation/evaluate";

export const maxDuration = 300;

/** Re-run the prospect's reply after a failed AI call. */
export const POST = withUser<IdContext>(async ({ user, ctx }) => {
  const { id } = await ctx.params;
  const result = await retryAiReply(user.id, id);
  if (result.ended) after(() => evaluateSession(id));
  return result;
});
