-- Sales Coach V1 schema. See docs/DATABASE_SCHEMA.md.

-- ENUMS -------------------------------------------------------------------------
create type public.dimension as enum (
  'clarity','listening','questions','empathy','confidence',
  'value','objections','persuasion','negotiation','closing'
);
create type public.industry as enum (
  'web_dev','saas','real_estate','restaurants','agency','freelance','b2b_services'
);
create type public.session_status as enum (
  'active','ended','evaluating','evaluated','eval_failed','abandoned'
);
create type public.end_reason as enum ('ai_end','user_end','max_turns','hang_up');
create type public.session_outcome as enum ('won','advanced','correct_no_deal','stalled','lost');
create type public.message_role as enum ('kickoff','user','ai');

-- USERS -------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  industry public.industry,
  experience text check (experience in ('new','some','experienced')),
  biggest_challenge text check (biggest_challenge in ('cold_calls','price_talks','objections','closing')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- SCENARIOS (public metadata) -------------------------------------------------------
create table public.scenarios (
  id text primary key,
  title text not null,
  summary text not null,
  skills text[] not null,
  difficulty_default smallint not null check (difficulty_default between 1 and 5),
  primary_industry public.industry not null,
  rubric_weights jsonb not null,
  challenge_tags text[] not null default '{}',
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- SCENARIO_INDUSTRIES (variant content; contains hidden facts — server only) -----------
create table public.scenario_industries (
  id uuid primary key default gen_random_uuid(),
  scenario_id text not null references public.scenarios(id) on delete cascade,
  industry public.industry not null,
  version int not null default 1,
  brief jsonb not null,
  persona jsonb not null,
  context text not null,
  user_role text not null,
  user_objective text not null,
  ai_objective text not null,
  hidden_facts jsonb not null,
  black_swan jsonb not null,
  objections jsonb not null,
  success_criteria jsonb not null,
  failure_conditions jsonb not null,
  vocabulary text[] not null default '{}',
  config jsonb not null,
  is_active boolean not null default true,
  unique (scenario_id, industry, version)
);

-- ROLEPLAY_SESSIONS --------------------------------------------------------------
create table public.roleplay_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  scenario_id text not null references public.scenarios(id),
  scenario_industry_id uuid not null references public.scenario_industries(id),
  scenario_version int not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  attempt_number int not null,
  parent_session_id uuid references public.roleplay_sessions(id),
  practice_focus text,
  unlock_bonus smallint not null default 0,
  rendered_system_prompt text not null,
  prompt_version text not null,
  roleplay_model text not null,
  status public.session_status not null default 'active',
  end_reason public.end_reason,
  outcome public.session_outcome,
  user_turns smallint not null default 0,
  final_trust numeric(4,1),
  final_value_perception numeric(4,1),
  realism_rating smallint check (realism_rating between 1 and 5),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  ended_at timestamptz,
  evaluated_at timestamptz
);
create index roleplay_sessions_user_started on public.roleplay_sessions (user_id, started_at desc);
create index roleplay_sessions_user_scenario on public.roleplay_sessions (user_id, scenario_id, attempt_number);
create unique index one_active_session_per_user
  on public.roleplay_sessions (user_id) where status = 'active';

-- ROLEPLAY_MESSAGES ---------------------------------------------------------------
create table public.roleplay_messages (
  id bigserial primary key,
  session_id uuid not null references public.roleplay_sessions(id) on delete cascade,
  turn smallint not null,
  role public.message_role not null,
  content text not null,
  raw_content jsonb,
  engine_state jsonb,
  validation_flags jsonb,
  model text,
  input_tokens int,
  output_tokens int,
  cache_read_tokens int,
  latency_ms int,
  created_at timestamptz not null default now(),
  unique (session_id, turn, role)
);

-- EVALUATIONS ---------------------------------------------------------------------
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.roleplay_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  prompt_version text not null,
  evaluator_model text not null,
  overall smallint not null check (overall between 0 and 100),
  outcome public.session_outcome,
  metrics jsonb not null,
  dimensions jsonb not null,
  feedback jsonb not null,
  runs jsonb not null,
  runs_count smallint not null,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);

-- SKILL_SCORES --------------------------------------------------------------------
create table public.skill_scores (
  session_id uuid not null references public.roleplay_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  scenario_id text not null references public.scenarios(id),
  dimension public.dimension not null,
  score smallint check (score between 0 and 100),
  created_at timestamptz not null default now(),
  primary key (session_id, dimension)
);
create index skill_scores_user_dimension on public.skill_scores (user_id, dimension, created_at desc);

-- USER_SKILL_PROGRESS ---------------------------------------------------------------
create table public.user_skill_progress (
  user_id uuid not null references public.users(id) on delete cascade,
  dimension public.dimension not null,
  latest_score smallint,
  best_score smallint,
  median_last3 smallint,
  level smallint check (level between 1 and 5),
  sessions_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, dimension)
);

-- ROW LEVEL SECURITY -------------------------------------------------------------------
alter table public.users               enable row level security;
alter table public.scenarios           enable row level security;
alter table public.scenario_industries enable row level security;  -- no policies: server only
alter table public.roleplay_sessions   enable row level security;
alter table public.roleplay_messages   enable row level security;
alter table public.evaluations         enable row level security;
alter table public.skill_scores        enable row level security;
alter table public.user_skill_progress enable row level security;

create policy "own profile read" on public.users
  for select to authenticated using (id = auth.uid());
create policy "scenarios readable" on public.scenarios
  for select to authenticated using (is_active);
create policy "own sessions" on public.roleplay_sessions
  for select to authenticated using (user_id = auth.uid());
create policy "own messages" on public.roleplay_messages
  for select to authenticated using (
    role <> 'kickoff' and exists (
      select 1 from public.roleplay_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );
create policy "own evaluations" on public.evaluations
  for select to authenticated using (user_id = auth.uid());
create policy "own skill scores" on public.skill_scores
  for select to authenticated using (user_id = auth.uid());
create policy "own progress" on public.user_skill_progress
  for select to authenticated using (user_id = auth.uid());
-- No insert/update/delete policies: all writes go through server routes using the service role.

-- COLUMN-LEVEL PROTECTION ----------------------------------------------------------------
-- Columns that contain hidden scenario facts or engine state are never readable by clients.
revoke all on public.scenario_industries from anon, authenticated;
revoke select on public.roleplay_sessions from anon, authenticated;
grant select (
  id, user_id, scenario_id, scenario_industry_id, scenario_version, difficulty, attempt_number,
  parent_session_id, practice_focus, status, end_reason, outcome, user_turns, realism_rating,
  started_at, last_activity_at, ended_at, evaluated_at
) on public.roleplay_sessions to authenticated;
revoke select on public.roleplay_messages from anon, authenticated;
grant select (id, session_id, turn, role, content, created_at)
  on public.roleplay_messages to authenticated;
