import { z } from "zod";
import { readJson, withUser } from "@/lib/api/handler";
import { startSession } from "@/lib/engine/session-service";
import { AppError } from "@/lib/errors";

export const maxDuration = 60;

const Body = z.object({ scenarioId: z.string().regex(/^S\d{2}$/), retryOf: z.string().uuid().optional() });

/** Start a roleplay session (or a retry of a previous one). */
export const POST = withUser(async ({ req, user }) => {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new AppError("invalid_input", "Invalid scenario");
  return startSession({ userId: user.id, scenarioId: parsed.data.scenarioId, retryOf: parsed.data.retryOf });
});
