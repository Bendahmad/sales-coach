import { after } from "next/server";
import { z } from "zod";
import { readJson, withUser, type IdContext } from "@/lib/api/handler";
import { takeTurn } from "@/lib/engine/session-service";
import { AppError } from "@/lib/errors";
import { evaluateSession } from "@/lib/evaluation/evaluate";

// Evaluation may run after the response when the prospect ends the conversation.
export const maxDuration = 300;

const Body = z.object({ text: z.string() });

export const POST = withUser<IdContext>(async ({ req, user, ctx }) => {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new AppError("invalid_input", "Message is required");
  const result = await takeTurn(user.id, id, parsed.data.text);
  if (result.ended) after(() => evaluateSession(id));
  return result;
});
