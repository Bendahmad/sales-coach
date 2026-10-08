import { z } from "zod";
import { readJson, withUser, type IdContext } from "@/lib/api/handler";
import { getOwnedSession } from "@/lib/engine/session-service";
import { AppError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ rating: z.number().int().min(1).max(5) });

/** "Did the prospect feel real?" — the MVP realism metric. */
export const POST = withUser<IdContext>(async ({ req, user, ctx }) => {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new AppError("invalid_input", "Rating must be 1–5");
  await getOwnedSession(user.id, id);
  await supabaseAdmin().from("roleplay_sessions").update({ realism_rating: parsed.data.rating }).eq("id", id);
  return { ok: true };
});
