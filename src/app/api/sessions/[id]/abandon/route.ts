import { withUser, type IdContext } from "@/lib/api/handler";
import { abandonSession } from "@/lib/engine/session-service";

/** Abandon an unfinished conversation (not evaluated). */
export const POST = withUser<IdContext>(async ({ user, ctx }) => {
  const { id } = await ctx.params;
  await abandonSession(user.id, id);
  return { ok: true };
});
