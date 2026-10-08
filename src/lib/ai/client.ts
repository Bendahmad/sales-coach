import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

let anthropic: Anthropic | null = null;
function client() {
  anthropic ??= new Anthropic({ maxRetries: 2 });
  return anthropic;
}

export type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
export type BetaContentBlock = Anthropic.Beta.Messages.BetaContentBlock;

export class RefusalError extends Error {
  constructor(public readonly category: string | null) {
    super(`Model declined the request${category ? ` (${category})` : ""}`);
  }
}
export class InvalidOutputError extends Error {}

export interface StructuredCallResult<T> {
  output: T;
  /** API content blocks, JSON-cloned for storage and replayed unchanged on later turns. */
  rawContent: BetaContentBlock[];
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
  latencyMs: number;
}

/**
 * One Messages API call with a Zod-typed structured output.
 * - Server-side refusal fallback is on by default.
 * - The system prompt is cached (it's frozen per roleplay session / identical across eval runs).
 */
export async function callStructured<S extends z.ZodType>(args: {
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  system: string;
  messages: BetaMessageParam[];
  schema: S;
  maxTokens: number;
}): Promise<StructuredCallResult<z.infer<S>>> {
  const started = Date.now();
  const response = await client().beta.messages.parse({
    model: args.model,
    max_tokens: args.maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }],
    messages: args.messages,
    output_config: { effort: args.effort, format: betaZodOutputFormat(args.schema) },
  });
  const latencyMs = Date.now() - started;

  if (response.stop_reason === "refusal") {
    throw new RefusalError(response.stop_details?.category ?? null);
  }
  if (response.stop_reason === "max_tokens") {
    throw new InvalidOutputError("Output truncated (max_tokens)");
  }
  const parsed = args.schema.safeParse(response.parsed_output);
  if (!parsed.success) {
    throw new InvalidOutputError(`Structured output failed validation: ${parsed.error.message}`);
  }

  return {
    output: parsed.data,
    rawContent: JSON.parse(JSON.stringify(response.content)) as BetaContentBlock[],
    model: response.model,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    },
    latencyMs,
  };
}
