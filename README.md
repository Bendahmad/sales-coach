# Sales Coach

> Practice real sales conversations with AI before they happen in real life.

AI Sales Communication Coach, MVP (V1). You hold a text roleplay with an AI prospect, then get an AI evaluation, a score, coaching feedback, a retry, and saved progress.

The product spec lives in [`knowledge-system/`](knowledge-system/00-README.md). Architecture and plan:

- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [User flows](docs/USER_FLOWS.md)
- [MVP implementation plan](docs/MVP_IMPLEMENTATION_PLAN.md)

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase Auth + Postgres (RLS) · Anthropic API (`claude-opus-5-5`) · Vitest

## Local setup

Prerequisites: Node 20.9+, Docker Desktop (running), an Anthropic API key.

```bash
npm install
```

```bash
npx supabase start
```

`supabase start` applies the migration in `supabase/migrations/` and prints the local API URL, anon key and service-role key. Copy `.env.example` to `.env.local` and fill those in, plus `ANTHROPIC_API_KEY`.

```bash
npm run db:seed
```

```bash
npm run dev
```

Open http://localhost:3000 and sign in with any email. Local magic-link emails show up in the Supabase mail viewer (Mailpit / Inbucket), whose URL is printed by `npx supabase status`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (engine rules, metrics, scoring, prompt rendering, content) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run knowledge:sync` | Regenerate `src/generated/knowledge.ts` from `knowledge-system/` |
| `npm run knowledge:check` | Fail if the generated prompts are stale (runs before `build`) |
| `npm run content:validate` | Validate `content/scenarios/*.json` |
| `npm run db:seed` | Upsert scenarios into Supabase (uses `.env.local`) |
| `npm run eval:smoke` | ⚠ Calls the Anthropic API (costs money). Scores 6 scripted transcripts: good must score ≥ 65, bad ≤ 40 |

## How it fits together

- **Prompts are not hand-copied.** The roleplay prompt (H), the evaluation prompt (I) and the rubrics are extracted from `knowledge-system/` into `src/generated/knowledge.ts`, and every session and evaluation records the hash of that text.
- **Scenarios** live in `content/scenarios/*.json` and are validated by `src/lib/content/scenario-schema.ts`. V1 ships S01, S03, S04, S06, S09 and S15, one industry version each.
- **Roleplay engine** (`src/lib/engine/`): the frozen per-session prompt, append-only history, a trust clamp (±2 per turn), and unlock rules enforced in code. A hidden fact revealed before it's earned triggers one regeneration.
- **Evaluation** (`src/lib/evaluation/`): deterministic metrics, then prompt I runs twice (a third run if the two differ by more than 15). Evidence quotes are checked against the transcript, scores without evidence are capped at 60, the ethics cap applies, the weighted overall is computed in code, and progress is updated.
- **Security:** hidden facts and engine state never reach the browser. They're protected by RLS plus column grants, and all writes go through server routes.

## Deploying
See Phase 6 of the [implementation plan](docs/MVP_IMPLEMENTATION_PLAN.md): a Supabase cloud project (migration + seed), Vercel with function duration of at least 120 s, env vars, auth redirect URLs, and custom SMTP for magic links.
