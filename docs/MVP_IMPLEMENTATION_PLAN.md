# MVP Implementation Plan (V1)

**Goal:** ship the smallest product that answers *"Does practicing a realistic sales conversation with AI make users want to retry and improve their score?"*

**In scope:** the 10 MVP features in `knowledge-system/06-product-and-mvp.md` §K. **Out of scope:** voice, payments/subscriptions, teams, CRM, complex gamification, marketplace, mobile app, admin dashboard, skill-tree UI, 30-day curriculum, notifications.

**V1 scenarios (spec §K):** S01 Cold call · S03 Discovery · S04 Price objection · S06 "I'll think about it" · S09 Negotiating price · S15 Free extra work. Each ships with its primary-industry variant (errata E3).

---

## Phase 0: Project setup
**Tasks**
- Scaffold `sales-coach/`: Next.js 15 App Router, TypeScript strict, Tailwind v4, ESLint, Vitest, `server-only`.
- Dependencies: `@supabase/ssr`, `@supabase/supabase-js`, `@anthropic-ai/sdk`, `zod`, `handlebars`.
- Supabase CLI local stack (`supabase init`, `supabase start`) for development.
- `.env.example` (TECH §9). npm scripts: `dev`, `build`, `test`, `knowledge:sync`, `knowledge:check`, `db:seed`.

**Done when:** `npm run dev` serves a blank page, `npm test` runs, and the local Supabase stack starts.

## Phase 1: Knowledge pipeline & content
**Tasks**
- `scripts/sync-knowledge.ts`: extract the ```text blocks from both prompt files and the D1–D10 section from `04-rubrics.md`, then write `src/generated/knowledge.ts` + `KNOWLEDGE_HASH`. Add `knowledge:check` to `prebuild`.
- `src/lib/content/scenario-schema.ts`: a Zod schema mirroring the scenario template fields + persona generator fields (03-scenarios.md §1–3).
- Transcribe the 6 scenarios into `content/scenarios/S01.json …`. Hidden facts get IDs and machine-readable unlock rules (`min_trust`, `behavior` text). Brief, persona, objections, success/failure criteria and weights are taken verbatim from the spec.
- `src/lib/engine/render-prompt.ts`: Handlebars render of prompt H using a variant. Unit test: rendered output contains no unresolved `{{`, and every hidden fact is listed.

**Done when:** `npm run knowledge:check` passes, all 6 JSON files validate, and a snapshot test shows the rendered prompt for S04.

## Phase 2: Database & auth
**Tasks**
- `supabase/migrations/0001_init.sql` exactly as in DATABASE_SCHEMA.md (enums, tables, trigger, RLS).
- `scripts/seed.ts`: validate and upsert `scenarios` + `scenario_industries` (service role).
- Supabase clients: browser (anon), server (cookies), admin (service role, `server-only`). `middleware.ts` refreshes the session and guards app routes.
- Pages: `/login` (magic link), `/auth/callback`, `/onboarding` (3 questions), app shell with sign-out.

**Done when:** a new email can sign up locally, a `users` row exists, onboarding saves, `/dashboard` is guarded, and a test confirms that a logged-in client **can't** select `scenario_industries`.

## Phase 3: Roleplay engine
**Tasks**
- `src/lib/ai/client.ts`: Anthropic client, model and effort config, server-side fallback, refusal handling, token and latency logging.
- `src/lib/ai/schemas.ts`: `RoleplayTurnSchema` (from prompt H output format) and `EvaluationSchema` (from prompt I output).
- `src/lib/engine/validate-state.ts`: trust clamp (±2 per turn, 0–10), unlock-rule enforcement with `unlock_bonus`, unknown-id dropping. **Unit tested.**
- `session-service.ts` + routes: `POST /api/sessions` (start/retry, daily cap, single active session), `POST /api/sessions/[id]/turn`, `POST /api/sessions/[id]/end`.
- Opening line via the hidden kickoff message when `ai_speaks_first`.
- Pages: `/scenarios`, `/scenarios/[id]` (brief), `/session/[id]` (chat UI: typing indicator, turn counter, End button, `/end`, error + retry on a failed AI turn, resume on reload).

**Done when:** all 6 scenarios can be played end to end locally. A scripted "pushy salesperson" run of S01 ends in a hang-up within about 4 turns. A scripted "good" run of S04 reveals the Black Swan. No hidden data appears in any network response (checked in browser devtools).

## Phase 4: Evaluation & feedback
**Tasks**
- `src/lib/metrics/compute.ts`: all deterministic metrics from TECH §5 (`null` where unreliable). **Unit tested** with fixture transcripts.
- `src/lib/ai/evaluate.ts`: build prompt I input blocks, run 2 parallel evaluations, validate evidence (turn exists, quote is a substring), reconcile (mean, or 3rd run + median if the gap is > 15), apply the ethics cap and overall recomputation in code. **Reconcile, overall, caps and levels are unit tested.**
- Persist `evaluations` + `skill_scores`, then `ProgressService` upserts `user_skill_progress`.
- `after()` scheduling from the end route, plus `GET status` and `POST evaluate` (idempotent re-run).
- `/session/[id]/feedback`: waiting state, score header with delta, 10 dimension bars with evidence drill-down, coach feedback in prompt I order, hidden-info recap, realism rating, Retry / Next / Transcript buttons.

**Done when:** a finished session shows full feedback within about 90 s. Quote validation removes a deliberately fake quote in a test. Re-evaluating the same session twice gives overall scores within ±10.

## Phase 5: Retry, dashboard, history
**Tasks**
- Retry: start with `retryOf`, which carries `practice_focus` + `unlock_bonus`. The brief shows the focus banner and the score to beat. The evaluator gets `<history>`.
- `/dashboard`: continue card, recommended next, last score + delta, 10-dimension snapshot with trend, weakest-skill callout.
- `/history`: attempts grouped by scenario with score progression. Read-only transcript view.
- Lazy abandon of stale active sessions (> 24 h).

**Done when:** a user can do attempt 1 → feedback → retry → attempt 2 and see "+N since attempt 1" on the feedback page, dashboard and history.

## Phase 6: Landing page & hardening
**Tasks**
- `/` landing: promise, static annotated sample transcript, 3 scenario cards, scoring explainer, CTA, privacy note.
- Limits: daily session cap, 600-char messages, 20-turn cap with hard stop at 22, auth required on every API route.
- Error states for every route (AI failure, refusal, eval failure, cap reached).
- **Smoke evaluation set** (errata E4): 6 scripted transcripts (good/bad × S01, S04, S09). Script `npm run eval:smoke` prints scores. Expected: good ≥ 65, bad ≤ 40. ⚠ Each run calls the API and costs money, so it only runs with your go-ahead.
- Token usage summary query → cost per session (needed before pricing decisions).
- Deploy: Supabase cloud project (apply migration + seed), Vercel project, env vars, Supabase Auth redirect URLs, **custom SMTP for magic links** (Supabase's built-in email is heavily rate-limited and unsuitable for beta users).

**Done when:** the production URL completes the full core flow with a fresh email, and the smoke set meets expected ranges.

---

## Testing strategy
| Layer | What | Tool |
|---|---|---|
| Unit | metrics, validate-state, reconcile, overall, levels, prompt rendering, knowledge sync | Vitest |
| Integration (local) | RLS: client can't read `scenario_industries` or other users' rows; routes reject non-owners | Vitest against the local Supabase stack |
| AI behavior | Scripted transcripts: pushy run → hang-up; good run → Black Swan; smoke eval ranges | Manual scripts (cost-gated) |
| E2E | Manual checklist of the core flow on desktop + mobile-width browser | Checklist in `docs/` |

## Instrumentation for the validation question
No analytics SDK. Everything is answerable from the DB (DATABASE_SCHEMA.md "Validation queries"):
activation (≥ 1 evaluated session) · retry rate · attempt 1→3 gain · week-1 return · realism rating · cost per session.

## Order and effort (rough, for one developer)
| Phase | Size |
|---|---|
| 0 Setup | S |
| 1 Knowledge + content (6 scenario JSONs is the largest content task) | M |
| 2 DB + auth | M |
| 3 Roleplay engine + chat UI | L |
| 4 Evaluation + feedback | L |
| 5 Retry, dashboard, history | M |
| 6 Landing + hardening + deploy | M |

## Decisions needed before implementation
1. **Models:** default is `claude-opus-5-5` for both roleplay (effort low) and evaluation (effort high). Should roleplay use `claude-sonnet-5-5` instead to lower latency and cost? (One env var either way.)
2. **Errata E1–E6** in TECHNICAL_ARCHITECTURE.md §10. In particular E3: **1 variant per scenario (recommended) or 3 industries × 6 = 18 variants** in V1.
3. **Infrastructure:** create a **new** Supabase project for this app (I can do it through the connected Supabase tools with your OK), or use an existing one? Local development uses the Supabase CLI either way.
4. **Hosting:** Vercel assumed (evaluation needs ≥ 120 s function duration).
5. **App location:** `C:\Users\poste\Desktop\ClaudeCode\sales-coach\` (sibling of `knowledge-system/`). Initialize a git repo there?
