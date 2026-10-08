# Database Schema (Supabase PostgreSQL, V1)

Derived from `knowledge-system/06-product-and-mvp.md` §L, renamed to the requested entities (errata E5) and limited to MVP tables. Phase 2 tables from the spec (curriculum, prep sheets, streaks, achievements) are **not** created in V1.

## Entity overview

```
auth.users 1─1 users
users 1─* roleplay_sessions *─1 scenario_industries *─1 scenarios
roleplay_sessions 1─* roleplay_messages
roleplay_sessions 1─1 evaluations
roleplay_sessions 1─* skill_scores (10 per evaluated session)
users 1─* user_skill_progress (10 per user)
roleplay_sessions (retry) *─1 roleplay_sessions (parent_session_id)
```

| Table | Purpose | Client access (RLS) | Written by |
|---|---|---|---|
| `users` | Profile + onboarding answers | select/update own (limited columns) | trigger on signup, onboarding route |
| `scenarios` | Public scenario metadata (cards, brief, weights) | select (authenticated) | seed script |
| `scenario_industries` | Industry variant: persona, **hidden facts**, objections, config | **none** (server only) | seed script |
| `roleplay_sessions` | One attempt at a scenario | select own | server (service role) |
| `roleplay_messages` | Transcript + per-turn engine state | select own (content columns only via view) | server |
| `evaluations` | Coach output for a session | select own | server |
| `skill_scores` | 10 dimension scores per session | select own | server |
| `user_skill_progress` | Rolling progress per dimension | select own | server |

## Enumerations

```sql
create type dimension as enum (
  'clarity','listening','questions','empathy','confidence',
  'value','objections','persuasion','negotiation','closing'
);                                                   -- 04-rubrics.md D1–D10
create type industry as enum (
  'web_dev','saas','real_estate','restaurants','agency','freelance','b2b_services'
);                                                   -- 03-scenarios.md §3
create type persona_style as enum ('analyst','accommodator','assertive');   -- NSTD-17
create type session_status as enum (
  'active','ended','evaluating','evaluated','eval_failed','abandoned'
);
create type end_reason as enum ('ai_end','user_end','max_turns','hang_up');
create type session_outcome as enum ('won','advanced','correct_no_deal','stalled','lost');
create type message_role as enum ('kickoff','user','ai');
```

## DDL: `supabase/migrations/0001_init.sql`

```sql
-- USERS ----------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  industry industry,
  experience text check (experience in ('new','some','experienced')),
  biggest_challenge text,            -- onboarding Q3 (e.g. 'price_talks','cold_calls','objections','closing')
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- create a users row on signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- SCENARIOS (public metadata) -------------------------------------------------
create table public.scenarios (
  id text primary key,                         -- 'S01'
  title text not null,                         -- 'Cold call: online ordering for a restaurant'
  summary text not null,                       -- one-line card text
  skills text[] not null,                      -- skill-tree IDs, e.g. {COM.OPENING, DIS.CALIBRATED}
  difficulty_default smallint not null check (difficulty_default between 1 and 5),
  primary_industry industry not null,
  rubric_weights jsonb not null,               -- {"clarity":20,...}; missing/0 = N/A
  challenge_tags text[] not null default '{}', -- matches users.biggest_challenge for recommendations
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- SCENARIO_INDUSTRIES (variant content; contains secrets) ----------------------
create table public.scenario_industries (
  id uuid primary key default gen_random_uuid(),
  scenario_id text not null references public.scenarios(id) on delete cascade,
  industry industry not null,
  version int not null default 1,
  brief jsonb not null,             -- PUBLIC: {counterpart, your_role, your_goal, channel, setting}
  persona jsonb not null,           -- name, role, company, style, mood_at_start, public_facts,
                                    -- budget_real, budget_stated
  context text not null,
  user_role text not null,
  user_objective text not null,
  ai_objective text not null,
  hidden_facts jsonb not null,      -- [{id, fact, unlock:{min_trust, behavior}}]
  black_swan jsonb not null,        -- {fact, unlock:{min_trust, behavior}}
  objections jsonb not null,        -- [{text, trigger}]
  success_criteria jsonb not null,
  failure_conditions jsonb not null,
  vocabulary text[] not null default '{}',
  config jsonb not null,            -- {start_trust, hang_up_threshold, max_turns,
                                    --  value_perception_enabled, start_value, channel,
                                    --  ai_speaks_first, acceptable_no_deal}
  is_active boolean not null default true,
  unique (scenario_id, industry, version)
);

-- ROLEPLAY_SESSIONS -------------------------------------------------------------
create table public.roleplay_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  scenario_id text not null references public.scenarios(id),
  scenario_industry_id uuid not null references public.scenario_industries(id),
  scenario_version int not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  attempt_number int not null,                  -- per (user, scenario)
  parent_session_id uuid references public.roleplay_sessions(id),  -- set when "Retry"
  practice_focus text,                          -- skill_id carried from previous evaluation
  unlock_bonus smallint not null default 0,     -- +1 on retries (prompt I notes)
  rendered_system_prompt text not null,         -- frozen prompt H for this session (server-only column)
  prompt_version text not null,                 -- KNOWLEDGE_HASH
  roleplay_model text not null,
  status session_status not null default 'active',
  end_reason end_reason,
  outcome session_outcome,
  user_turns smallint not null default 0,
  final_trust numeric(4,1),
  final_value_perception numeric(4,1),
  realism_rating smallint check (realism_rating between 1 and 5),   -- MVP metric "felt real"
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  evaluated_at timestamptz
);
create index on public.roleplay_sessions (user_id, started_at desc);
create index on public.roleplay_sessions (user_id, scenario_id, attempt_number);
create unique index one_active_session_per_user
  on public.roleplay_sessions (user_id) where status = 'active';

-- ROLEPLAY_MESSAGES ---------------------------------------------------------------
create table public.roleplay_messages (
  id bigserial primary key,
  session_id uuid not null references public.roleplay_sessions(id) on delete cascade,
  turn smallint not null,                       -- user and ai share a turn number
  role message_role not null,
  content text not null,                        -- text shown in UI ('kickoff' never shown)
  raw_content jsonb,                            -- ai only: API content blocks, replayed unchanged
  engine_state jsonb,                           -- ai only: validated state (trust, revealed, …)
  validation_flags jsonb,                       -- e.g. {"invalid_reveal":"F2","trust_clamped":true}
  model text,
  input_tokens int, output_tokens int, cache_read_tokens int,
  latency_ms int,
  created_at timestamptz not null default now(),
  unique (session_id, turn, role)
);

-- EVALUATIONS ---------------------------------------------------------------------
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.roleplay_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  prompt_version text not null,                 -- KNOWLEDGE_HASH (prompt I + rubrics)
  evaluator_model text not null,
  overall smallint not null check (overall between 0 and 100),
  outcome session_outcome,
  metrics jsonb not null,                       -- deterministic metrics
  dimensions jsonb not null,                    -- {clarity:{score,evidence[],rationale},…}
  feedback jsonb not null,                      -- did_well, biggest_mistake, missed_opportunity,
                                                -- better_alternative, stronger_response,
                                                -- practice_focus, next_scenario,
                                                -- hidden_info_recap, improvement_vs_last, ethics_flags
  runs jsonb not null,                          -- raw per-run dimension scores (reliability audit)
  runs_count smallint not null,                 -- 2 or 3
  input_tokens int, output_tokens int,
  created_at timestamptz not null default now()
);

-- SKILL_SCORES (per session × dimension) -----------------------------------------------
create table public.skill_scores (
  session_id uuid not null references public.roleplay_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  scenario_id text not null references public.scenarios(id),
  dimension dimension not null,
  score smallint check (score between 0 and 100),   -- null = N/A for this scenario
  created_at timestamptz not null default now(),
  primary key (session_id, dimension)
);
create index on public.skill_scores (user_id, dimension, created_at desc);

-- USER_SKILL_PROGRESS (per user × dimension) --------------------------------------------
create table public.user_skill_progress (
  user_id uuid not null references public.users(id) on delete cascade,
  dimension dimension not null,
  latest_score smallint,
  best_score smallint,
  median_last3 smallint,              -- median of last 3 non-null scores (04-rubrics.md mapping)
  level smallint check (level between 1 and 5),
  sessions_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, dimension)
);
```

## Row Level Security

```sql
alter table public.users               enable row level security;
alter table public.scenarios           enable row level security;
alter table public.scenario_industries enable row level security;   -- no policies = no client access
alter table public.roleplay_sessions   enable row level security;
alter table public.roleplay_messages   enable row level security;
alter table public.evaluations         enable row level security;
alter table public.skill_scores        enable row level security;
alter table public.user_skill_progress enable row level security;

create policy "own profile read"   on public.users for select using (id = auth.uid());
create policy "scenarios readable" on public.scenarios for select to authenticated using (is_active);
create policy "own sessions"       on public.roleplay_sessions for select using (user_id = auth.uid());
create policy "own messages"       on public.roleplay_messages for select
  using (role <> 'kickoff' and exists (select 1 from public.roleplay_sessions s
                 where s.id = session_id and s.user_id = auth.uid()));
create policy "own evaluations"    on public.evaluations for select using (user_id = auth.uid());
create policy "own skill scores"   on public.skill_scores for select using (user_id = auth.uid());
create policy "own progress"       on public.user_skill_progress for select using (user_id = auth.uid());
-- No insert/update/delete policies: all writes go through server routes with the service role.
```

**Column-level protection.** Clients must never see `roleplay_sessions.rendered_system_prompt` (which contains hidden facts) or `roleplay_messages.engine_state` / `raw_content` *during* an active session. V1 handles this by **not querying these tables from the browser at all**: all reads happen in Server Components or Route Handlers that select explicit safe columns. RLS is defense in depth. Optional hardening (planned): `revoke select (rendered_system_prompt) on roleplay_sessions from authenticated;` and the same for `engine_state, raw_content` on messages.

After evaluation, hidden facts become visible to the user through `evaluations.feedback.hidden_info_recap`. This is intended (prompt I).

## Progress update rule (ProgressService)

For each non-null dimension score in a new evaluation:
```
latest_score   = score
best_score     = max(best_score, score)
median_last3   = median(last 3 non-null skill_scores for user × dimension)
sessions_count += 1
level          = 0–20→1 · 21–40→2 · 41–60→3 · 61–80→4 · 81–100→5
                 (level 5 also requires ≥1 evaluated session at difficulty ≥ 4, per 04-rubrics.md)
```
Implemented in TypeScript (unit-tested) and written in a single upsert.

## Validation queries (answer the MVP question directly)

```sql
-- Retry rate: share of activated users with ≥2 attempts on the same scenario
select avg((max_attempt >= 2)::int) as retry_rate
from (select user_id, max(attempt_number) max_attempt
      from roleplay_sessions where status = 'evaluated' group by user_id, scenario_id) t;

-- Learning signal: median overall gain attempt 1 → attempt 3
select percentile_cont(0.5) within group (order by a3.overall - a1.overall)
from evaluations a1
join roleplay_sessions s1 on s1.id = a1.session_id and s1.attempt_number = 1
join roleplay_sessions s3 on s3.user_id = s1.user_id and s3.scenario_id = s1.scenario_id and s3.attempt_number = 3
join evaluations a3 on a3.session_id = s3.id;

-- Perceived realism
select avg(realism_rating) from roleplay_sessions where realism_rating is not null;
```
