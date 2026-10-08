import { withUser, type IdContext } from "@/lib/api/handler";
import { getOwnedSession } from "@/lib/engine/session-service";

/** Polled by the feedback page while the evaluation runs. */
export const GET = withUser<IdContext>(async ({ user, ctx }) => {
  const { id } = await ctx.params;
  const session = await getOwnedSession(user.id, id);
  return { status: session.status };
});
