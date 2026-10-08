# Technical Architecture: AI Sales Communication Coach (MVP / V1)

**Source of truth:** `../knowledge-system/` (product spec). This document only decides *how* to build it. It doesn't change the methodology. Where the current API forces a deviation from the spec, it's listed in §10 "Spec errata".

**Validation goal:** *Does practicing a realistic sales conversation with AI make users want to retry and improve their score?*

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15 (App Router)**, React 19 | Server Components for pages, Route Handlers for the chat API |
| Language | **TypeScript** (strict) | Zod for runtime validation at every boundary |
| Styling | **Tailwind CSS v4** | No component library. A few hand-written primitives |
| Auth | **Supabase Auth**: email magic link | `@supabase/ssr` cookie sessions; middleware refreshes sessions |
| Database | **Supabase PostgreSQL** with RLS | Migrations via Supabase CLI (`supabase/migrations`) |
| AI | **Anthropic TypeScript SDK** (`@anthropic-ai/sdk`) | Structured outputs via `client.messages.parse` + `zodOutputFormat` |
| Prompt templating | `handlebars` (noEscape) | The spec prompts already use `{{…}}` / `{{#each}}` / `{{#if}}` syntax |
| Tests | **Vitest** | Unit tests for engine, metrics, scoring, prompt rendering |
| Hosting (assumed) | Vercel + Supabase cloud | Evaluation needs a function duration of ≥ 120 s (see §6.4) |

Not used in V1: voice/STT/TTS, payments, queues, Redis, analytics SDKs, component libraries, state-management libraries.

---

## 2. System overview

```
Browser (React)
  │  pages: / · /login · /onboarding · /dashboard · /scenarios · /scenarios/[id]
  │         /session/[id] (chat) · /session/[id]/feedback · /history
  │
  │  fetch JSON
  ▼
Next.js server (Route Handlers + Server Components)
  ├── Auth guard (middleware + getUser())
  ├── SessionService ──────────┐
  │     start / turn / end     │
  ├── RoleplayEngine           │  uses
  │     render prompt, call LLM, validate state (trust clamp, unlock rules)
  ├── MetricsService           │  deterministic, pure TS
  ├── EvaluationService        │  LLM ×2 → reconcile → persist → progress update
  ├── ProgressService          │  skill_scores → user_skill_progress
  └── Content (generated)      │  prompts + rubrics extracted from knowledge-system/
           │                   │
           ▼                   ▼
   Supabase Postgres      Anthropic Messages API
   (RLS; server writes    (roleplay model, evaluator model)
    with service role)
```

**Two separate LLM roles** (spec J): the **prospect** (roleplay prompt H) never sees rubrics, and the **coach** (evaluation prompt I) never role-plays. They're separate calls with separate system prompts and no shared context.

---

## 3. Single source of truth for prompts & rubrics

The spec files are the canonical text. The app **never hand-copies** them.

```
knowledge-system/prompts/roleplay-system-prompt.md    ──┐
knowledge-system/prompts/evaluation-system-prompt.md  ──┼─► scripts/sync-knowledge.ts
knowledge-system/04-rubrics.md (D1–D10 section)       ──┘        │
                                                                 ▼
                                    src/generated/knowledge.ts  (committed)
                                      ROLEPLAY_PROMPT_TEMPLATE  (the ```text block)
                                      EVALUATION_PROMPT_TEMPLATE
                                      RUBRICS_MARKDOWN
                                      KNOWLEDGE_HASH            (sha256 of sources)
```

- `npm run knowledge:sync` regenerates the file. `npm run knowledge:check` (run in CI and `prebuild`) fails if the generated file is out of date.
- The generated file is committed, so deployment doesn't depend on the sibling folder being present.
- Every evaluation stores `prompt_version = KNOWLEDGE_HASH`, so scores stay traceable to the exact prompt and rubric text.

Scenario content comes from `knowledge-system/03-scenarios.md`. It's transcribed **once** into structured JSON (`content/scenarios/*.json`), validated with a Zod schema, and seeded into the DB. The scenario fields map 1:1 to the template fields in the spec (§2 of 03-scenarios.md) and to the persona generator fields (§3).

---

## 4. Roleplay engine

### 4.1 Session start
1. Verify the user and check the daily cap (§7).
2. Load the `scenarios` row + the `scenario_industries` variant (server-only data incl. hidden facts).
3. If this is a retry: `attempt_number = previous + 1`, `practice_focus = previous evaluation's practice_focus.skill_id`, and `unlock_bonus = 1` (spec: unlock threshold +1 on retries).
4. Render the system prompt: Handlebars(template, variables), where variables come from the variant JSON. The rendered prompt is **frozen for the session** (stored on the session row), so it can be prompt-cached and evaluated later exactly as it was.
5. Opening turn:
   - `ai_speaks_first = true` (cold call answers, meetings): call the model with a fixed hidden kickoff user message `"(The conversation starts now. Say your first line.)"`. It's stored as `role = 'kickoff'` and never shown in the UI.
   - Otherwise the user writes first.

### 4.2 Turn
```
user text (≤ 600 chars)
  → persist user message (turn n)
  → build messages[]: kickoff? + alternating user / assistant (assistant = raw content blocks, replayed unchanged → append-only history)
  → client.messages.parse({ model, system: [{text: renderedPrompt, cache_control}], messages,
                            output_config: { format: zodOutputFormat(RoleplayTurnSchema), effort } })
  → check stop_reason (refusal / max_tokens) → parsed_output
  → validate state in code:
       trust_delta clamped to [-2, +2]; trust clamped to [0, 10]
       each revealed id: required = fact.unlock.min_trust + unlock_bonus
                         if trust < required → INVALID_REVEAL
       ids not in the scenario → dropped
  → on INVALID_REVEAL: regenerate once with a mid-conversation system note
                       ("Fact X has not been earned; do not reveal it."); if it repeats,
                       keep the reply but drop the reveal and set validation_flags.invalid_reveal
  → persist AI message (reply, raw_content, engine_state, validation_flags, tokens, latency)
  → if state.end OR user_turns ≥ max_turns + 2 (hard stop) → end session
  → return { reply, ended, endReason }   // the client never receives trust or hidden ids
```

**Roleplay output schema** (from prompt H's output format):
```ts
RoleplayTurnSchema = z.object({
  reply: z.string(),
  state: z.object({
    trust: z.number(), trust_delta: z.number(), trust_reason: z.string(),
    value_perception: z.number().nullable(),
    revealed: z.array(z.string()),
    objection_raised: z.string().nullable(),
    thats_right: z.boolean(), fake_yes: z.boolean(),
    end: z.boolean(),
    outcome: z.enum(["won","advanced","correct_no_deal","stalled","lost"]).nullable(),
  }),
});
```

### 4.3 Ending
End reasons: `ai_end` (model `end=true`), `user_end` (`/end` or the "End conversation" button), `max_turns`, `hang_up` (trust below the threshold makes the model end it). On end: `status = 'ended'`, then evaluation starts (§5).

### 4.4 Why responses aren't streamed in V1
Prompt H requires one JSON object per turn (`reply` + hidden `state`). Streaming partial JSON and only showing `reply` adds a lot of complexity. V1 returns the full turn with a "Marco is typing…" indicator. Latency per turn is logged (`latency_ms`). If the median goes above about 6 s, V1.1 will stream the `reply` field. Spec J's diagram mentions streaming. This is a deliberate simplification (§10).

---

## 5. Evaluation pipeline

```
session ended
  → MetricsService.compute(transcript, engineLog, scenario)  [pure TS, unit-tested]
  → EvaluationService:
       build input blocks exactly as prompt I specifies:
         <scenario> <transcript> (T1 USER:/T1 AI:) <engine_log> <metrics> <rubrics> <history>
       run 2 evaluations in parallel (structured output = EvaluationSchema from prompt I)
       validate each: cited turns exist, quotes are substrings of that turn's user/ai text;
                      drop invalid evidence; dimensions with weight 0 → null
       reconcile per dimension: |a−b| ≤ 15 → mean; else run a 3rd pass → median
       ethics cap re-applied in code (persuasion, closing ≤ 40 if ethics_flags non-empty)
       overall recomputed in code from scenario weights (renormalized over non-null dims)
  → persist evaluations row + 10 skill_scores rows
  → ProgressService.update(user, dimensions)
  → session.status = 'evaluated'
```

**Deterministic metrics** (spec 04-rubrics.md table). V1 implementation:
- `talk_ratio_user`, `avg_words_per_turn_user`, `long_turns`: word counts.
- Question classification: heuristic. Sentences ending in "?" starting with what/how/tell me/walk me/which/who are **open**; with why → **why**; otherwise **closed** (spec allows "LLM call or heuristics").
- `labels_count`: regex `^(it|that) (seems|sounds|looks) like` (sentence-initial), plus "it feels like".
- `mirrors_count`: user turn ≤ 5 words that shares a 1–3-word sequence with the previous AI turn.
- `summaries_count`, `contradictions_count`: regex lexicons ("so what I'm hearing" / "you're wrong", "that's not true", "actually, no").
- `thats_right_earned`, `hidden_facts_revealed`, `black_swan_revealed`, `turn_revealed`, `trust_*`: from engine_state.
- `first_price_by`, `concessions[]`: currency/number extraction from both sides. **V1 limitation:** this is best-effort, and the evaluator prompt treats it as a hint. It's only used in S09/S04/S15.
- `ask_made`, `next_step_specificity`: lexicon + date/day detection.

The metrics are hints that anchor the LLM. Prompt I already says "Use <metrics> as ground truth for counts". If a heuristic is unreliable, the field is set to `null` instead of a wrong number.

### 5.1 Running the evaluation after responding
`POST /api/sessions/[id]/end` marks the session `evaluating` and schedules the pipeline with Next.js `after()`, so the response returns immediately. The feedback page polls `GET /api/sessions/[id]/status` every 2 s. If evaluation fails, `status = 'eval_failed'` and a "Retry evaluation" button calls `POST /api/sessions/[id]/evaluate`, which is idempotent.

---

## 6. AI configuration

### 6.1 Models (env-configurable)
| Role | Default | Effort | max_tokens |
|---|---|---|---|
| Roleplay (prospect) | `claude-opus-5-5` | `low` (chat-like, latency-sensitive) | 2,000 |
| Evaluator (coach) | `claude-opus-5-5` | `high` (accuracy-sensitive) | 16,000 |

`ROLEPLAY_MODEL`, `ROLEPLAY_EFFORT`, `EVAL_MODEL`, `EVAL_EFFORT` are env vars. **Decision for you:** `claude-sonnet-5-5` for roleplay would cut cost and probably latency. It's one env var change, and we can A/B it on realism ratings later.

### 6.2 API usage notes (current API, verified against SDK docs)
- **Structured outputs:** `client.messages.parse()` with `output_config.format = zodOutputFormat(schema)`. Results are still validated by Zod in code.
- **Thinking:** Opus 5.5 always thinks (it can't be disabled). Depth is controlled only with `output_config.effort`.
- **No `temperature`:** the current models reject sampling parameters. See errata E1.
- **Refusals:** always check `stop_reason` before reading output. `"refusal"` is shown as a neutral "The prospect didn't respond. Try rephrasing." and logged. Server-side fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) is enabled by default on both calls.
- **Prompt caching:** the session's rendered system prompt (stable for the whole session) gets `cache_control: {type: "ephemeral"}`. History is append-only, so the prefix stays cacheable turn after turn. Effective caching is confirmed by logging `usage.cache_read_input_tokens`.
- **Append-only history:** assistant turns are replayed as the raw `content` blocks returned by the API (stored in `raw_content`), never rewritten.
- **Errors:** typed SDK errors. `RateLimitError` / 5xx are retried by the SDK (maxRetries 2). Anything else → the turn fails and the user's message stays saved with a "Retry" action.

### 6.3 Cost controls
- Max **20 user turns** per session (spec K), with a hard stop at 22.
- User message ≤ 600 chars.
- **Daily cap:** 10 started sessions per user per day (env `DAILY_SESSION_LIMIT`).
- Token usage is logged per message and per evaluation, so the real cost per session can be measured (spec P: "measure before pricing").

### 6.4 Function duration
Evaluation (2 parallel calls at high effort, sometimes a third) can take 30–90 s. The route that runs `after()` sets `export const maxDuration = 300`. **Hosting must allow ≥ 120 s.** If it doesn't, the fallback is to move `EvaluationService` into a Supabase Edge Function, with the same code and inputs.

---

## 7. Security & data protection

| Concern | Control |
|---|---|
| Hidden facts / Black Swan leaking to the browser | `scenario_industries` (persona, hidden facts, objections) has **no client RLS policy**. Only the server, using the service role, reads it. The client only gets the public `brief`. Trust and reveal state never go to the client during a session. |
| Users tampering with scores or outcomes | All writes to sessions, messages, evaluations and scores go through server routes using the service role, after `getUser()` + ownership checks. RLS gives clients **read-only** access to their own rows. |
| Service role key | Server-only env var. Never imported into client components (`server-only` package guard). |
| Prompt injection from users ("ignore your instructions…") | Prompt H rule 1 keeps the character. User text only ever goes in `user` messages. The evaluator receives the transcript inside tagged blocks as data. |
| Abuse / cost | Daily session cap, turn cap, message length cap, auth required for every AI call. |
| PII | Transcripts are user-generated practice content. The landing page tells users not to enter real client secrets. Deleting an account cascades to all session data. |

---

## 8. Project structure

```
sales-coach/
├─ docs/                         # these 4 documents
├─ content/scenarios/            # S01.json … (variant content transcribed from 03-scenarios.md)
├─ scripts/
│  ├─ sync-knowledge.ts          # extracts prompts + rubrics → src/generated/knowledge.ts
│  └─ seed.ts                    # validates content/*.json and upserts scenarios + variants
├─ supabase/migrations/0001_init.sql
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                          # landing
│  │  ├─ login/page.tsx  auth/callback/route.ts
│  │  ├─ onboarding/page.tsx
│  │  ├─ dashboard/page.tsx
│  │  ├─ scenarios/page.tsx  scenarios/[id]/page.tsx (brief + Start)
│  │  ├─ session/[id]/page.tsx             # chat
│  │  ├─ session/[id]/feedback/page.tsx
│  │  ├─ history/page.tsx
│  │  └─ api/sessions/
│  │     ├─ route.ts                       # POST start (also used for retry)
│  │     └─ [id]/ turn/route.ts · end/route.ts · status/route.ts · evaluate/route.ts · rating/route.ts
│  ├─ lib/
│  │  ├─ supabase/ server.ts · admin.ts · middleware.ts
│  │  ├─ ai/ client.ts · schemas.ts · roleplay.ts · evaluate.ts
│  │  ├─ engine/ render-prompt.ts · validate-state.ts · session-service.ts
│  │  ├─ metrics/ compute.ts (+ .test.ts)
│  │  ├─ scoring/ reconcile.ts · overall.ts · levels.ts (+ tests)
│  │  └─ content/ scenario-schema.ts
│  ├─ generated/knowledge.ts
│  ├─ components/ (ChatWindow, MessageBubble, ScoreCard, DimensionBars, ScenarioCard, …)
│  └─ middleware.ts
└─ .env.example
```

## 9. Environment variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only
ANTHROPIC_API_KEY=                  # server only
ROLEPLAY_MODEL=claude-opus-5-5
ROLEPLAY_EFFORT=low
EVAL_MODEL=claude-opus-5-5
EVAL_EFFORT=high
DAILY_SESSION_LIMIT=10
MAX_USER_TURNS=20
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 10. Spec errata (deviations forced by implementation reality; please approve)

| # | Spec says | V1 does | Why |
|---|---|---|---|
| E1 | Evaluate at **temperature 0** (04-rubrics.md, prompt I notes) | No temperature parameter. Consistency comes from structured outputs, deterministic metrics, double-run + reconcile, and code-side recomputation of overall/caps | Current Claude models reject sampling parameters. Proposed: update the spec wording to "evaluate twice and reconcile". |
| E2 | Roleplay replies **stream** (06 §J diagram) | Full JSON turn with a typing indicator | Hidden `state` JSON per turn. Revisit if median latency > 6 s. |
| E3 | MVP: **6 scenarios with industry re-skins for 3 industries** (06 §K) | 6 scenarios, **1 authored variant each (primary industry)**. `scenario_industries` supports more variants without code changes. Onboarding industry sorts and recommends scenarios. | Each re-skin needs hand-authored hidden facts and unlock rules (spec Q: "quality beats quantity"). 18 variants triples content work before we've validated anything. **Your call:** 6 or 18 variants in V1. |
| E4 | Calibration set of 20 hand-scored transcripts (04 Reliability) | V1 ships a **6-transcript smoke set** (good/bad × 3 scenarios), run manually before launch | Enough to catch gross mis-scoring. Expand to 20 after real transcripts exist. |
| E5 | Spec table name `profiles`, `dimension_scores`, `industry_packs` | `users`, `skill_scores`, `scenario_industries` | Matches your requested entity names. Same content. |
| E6 | Spec has `skill_progress` per skill-tree node (Phase 2) | `user_skill_progress` per **scored dimension** (10 rows/user) in V1 | The skill-tree UI is out of MVP scope. Dimension → node mapping comes later. |
