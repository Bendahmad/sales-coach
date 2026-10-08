# Product Design, MVP & Business (Phases 8–9, sections J–Q)

## Phase 8: Product surfaces (with build priority)

Priority: **M** = Must-have for MVP · **N** = Nice-to-have (phase 2–3) · **A** = Avoid initially

| # | Surface | What it does | Priority |
|---|---|---|---|
| 1 | **Landing page** | Promise, a 30-second sample conversation (transcript with coach notes), "Try a free call" CTA, 3 scenario cards, how scoring works | **M** (single page) |
| 2 | **Onboarding** | 3 questions: what you sell (industry pack), experience level, biggest fear ("price talks", "cold calls"…) → picks the first scenario | **M** (3 fields) |
| 3 | **Skill assessment** | Day-1 baseline scenario scored on all dimensions | N (MVP: the first roleplay *is* the baseline) |
| 4 | **Dashboard** | Last score, score trend, "continue" button, one recommended next scenario | **M** (minimal) |
| 5 | **Skill tree** | Visual tiers with level per node | N |
| 6 | **Scenario library** | Cards filtered by skill / industry / difficulty | **M** (6 scenarios, simple list) |
| 7 | **AI voice roleplay** | Speech in/out, real-time | N (phase 2). MVP = text chat |
| 8 | **Feedback screen** | Overall + 10 dimension scores, did-well, biggest mistake, stronger response, practice focus, hidden-info recap, **Retry** button | **M** |
| 9 | **Score / progress** | Per-scenario attempt history with deltas | **M** (simple table/sparkline) |
| 10 | **Daily training** | 30-day plan, daily lesson + drill + challenge + reflection | N |
| 11 | **Personal weaknesses** | Lowest 3 dimensions over the last 5 sessions | N (derivable from data later) |
| 12 | **Recommended practice** | Next scenario from evaluator output | **M** (just show `next_scenario`) |
| 13 | **History** | Past sessions, transcript replay with coach annotations (Lowndes "Instant Replay") | **M** (list + transcript), annotations N |
| 14 | **Gamification** | Streaks, XP, badges ("First 'that's right'", "No-discount negotiator"), accountability buddy (Carnegie's game) | N (streak only in phase 2). Leaderboards **A** |

---

## J. Product architecture

```
┌────────────────────────── Client (Next.js, React) ──────────────────────────┐
│ Landing · Auth · Onboarding · Library · Roleplay chat · Feedback · History  │
└───────────────▲──────────────────────────────────────────▲──────────────────┘
                │ HTTPS (server actions / route handlers)  │ streaming tokens
┌───────────────┴──────────── App server (Next.js API) ────┴──────────────────┐
│  SessionService                                                              │
│   ├─ startSession(scenarioId)  → loads scenario + industry pack, builds     │
│   │                              roleplay system prompt, AI opening line    │
│   ├─ turn(sessionId, text)     → calls Roleplay LLM, validates JSON,        │
│   │                              clamps trust, checks unlock rules in code, │
│   │                              stores message + engine_state, streams     │
│   │                              `reply` to client                           │
│   └─ endSession(sessionId)     → MetricsService (deterministic) →           │
│                                  EvaluationService (LLM ×2, reconcile) →    │
│                                  store evaluation, update skill_progress    │
│  ContentService: scenarios, industry packs, rubrics (versioned JSON)        │
│  Guardrails: rate limit, max turns, cost cap per user/day, moderation       │
└──────────────┬──────────────────────────────────┬────────────────────────────┘
               │                                  │
     ┌─────────▼─────────┐              ┌─────────▼───────────┐
     │ Postgres (Supabase)│              │ LLM provider API     │
     │ Auth + RLS         │              │ roleplay: fast model │
     │ tables in §L       │              │ evaluator: strongest │
     └────────────────────┘              │ model, temp 0        │
                                         └──────────────────────┘
Phase 2 adds: STT (streaming) → turn() → TTS (persona voice), audio storage.
```

**Key design decisions**
- **Two separate LLM roles.** The *prospect* never sees the rubric, and the *coach* never role-plays. Mixing them would cause the prospect to drift into teaching.
- **Code validates the LLM.** Unlock rules, trust clamping, metrics and evidence-quote checks all run in code, which makes scores reproducible.
- **Content as data.** Scenarios, packs and rubrics are versioned JSON seeded from these markdown files. Every evaluation stores `scenario_version` and `rubric_version` so scores stay comparable.
- **Model choice.** Use a fast model for roleplay turns (latency matters) and the most capable model for evaluation (accuracy matters, latency doesn't). Confirm the current model IDs and prices at build time. Use prompt caching for the static part of the system prompts.
- **Stack suggestion.** Next.js + Supabase (Auth, Postgres, RLS) + one LLM provider. It's simple, one developer can run it, and a Supabase connector is already available in this environment.

---

## K. MVP feature list (Phase 9)

**The question the MVP must answer:** *Will people do a second and third attempt at a scenario, and do their scores rise across attempts?* If not, nothing else matters.

| # | Feature | Scope in MVP |
|---|---|---|
| 1 | Account creation | Email magic link (Supabase Auth). Profile = name + industry + experience |
| 2 | Choose a scenario | **6 scenarios:** S01 cold call, S03 discovery, S04 price objection, S06 "I'll think about it", S09 negotiating price, S15 free extra work. Industry re-skin from onboarding choice (packs for 3 industries: web dev/freelance, SaaS, agency) |
| 3 | AI plays the prospect | Roleplay prompt (H), text chat, streaming, AI opening line |
| 4 | User responds | Text input; `/end` command; max 20 user turns |
| 5 | AI continues | Trust + hidden-info engine, JSON validation |
| 6 | Conversation ends | Natural end, `/end`, turn limit, or hang-up |
| 7 | AI evaluates | Deterministic metrics + evaluation prompt (I), double-run reconcile |
| 8 | User gets score | Feedback screen (overall, 10 dims, mistake, stronger response, focus, hidden-info recap) |
| 9 | User retries | "Retry with focus on X" button: same scenario, unlock threshold +1 |
| 10 | Progress saved | Sessions, transcripts, evaluations. Simple history page with score deltas |

**Explicitly NOT in MVP:** voice, skill tree UI, 30-day plan, streaks/XP, one-sheet prep screen, custom scenarios, teams, payments (use a waitlist or pre-sale page for willingness-to-pay instead).

**MVP success metrics (hypotheses to test):**
| Metric | Target |
|---|---|
| Activation: finished ≥1 roleplay | ≥ 60% of signups |
| Retry rate: ≥2 attempts on the same scenario | ≥ 40% of activated users |
| Learning signal: median focus-dimension gain, attempt 1 → 3 | ≥ +15 points |
| Week-1 return: came back on a different day | ≥ 25% |
| Willingness to pay: clicked "Get Pro" / pre-ordered | ≥ 5% of activated users |
| Perceived realism: "felt like a real prospect" (1–5) | ≥ 4.0 |

---

## L. Database schema (Postgres)

```sql
-- MVP TABLES ---------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  industry text check (industry in ('web_dev','saas','real_estate','restaurants','agency','freelance','b2b_services')),
  experience text check (experience in ('new','some','experienced')),
  biggest_challenge text,
  created_at timestamptz default now()
);

create table scenarios (
  id text primary key,                 -- 'S01'
  version int not null default 1,
  title text not null,
  primary_industry text not null,
  skills text[] not null,              -- ['COM.OPENING','DIS.CALIBRATED']
  difficulty_default int check (difficulty_default between 1 and 5),
  persona jsonb not null,              -- name, role, style, mood, budgets, public_facts
  hidden_facts jsonb not null,         -- [{id, fact, unlock:{min_trust, behavior}}], incl. BLACK_SWAN
  objections jsonb not null,
  success_criteria jsonb not null,
  failure_conditions jsonb not null,
  rubric_weights jsonb not null,       -- {"clarity":20,...}
  config jsonb not null,               -- start_trust, hang_up_threshold, max_turns, value_perception_enabled, channel, opening_line
  is_active boolean default true,
  unique (id, version)
);

create table industry_packs (
  id text primary key,                 -- 'web_dev'
  version int not null default 1,
  vocabulary text[], hot_buttons text[], persona_variants jsonb, objection_variants jsonb
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  scenario_id text not null references scenarios(id),
  scenario_version int not null,
  industry_pack_id text references industry_packs(id),
  difficulty int not null,
  attempt_number int not null,         -- per user+scenario
  practice_focus text,                 -- skill_id carried from previous evaluation
  status text not null default 'active' check (status in ('active','ended','evaluated','abandoned')),
  outcome text,                        -- won|advanced|correct_no_deal|stalled|lost
  final_trust numeric,
  started_at timestamptz default now(),
  ended_at timestamptz
);
create index on sessions (user_id, scenario_id, started_at desc);

create table messages (
  id bigserial primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  turn int not null,
  role text not null check (role in ('user','ai')),
  content text not null,
  engine_state jsonb,                  -- AI turns only: trust, delta, revealed, objection, thats_right, fake_yes, end
  created_at timestamptz default now()
);
create index on messages (session_id, turn);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique not null references sessions(id) on delete cascade,
  rubric_version int not null,
  evaluator_model text not null,
  overall int not null,
  metrics jsonb not null,              -- deterministic metrics
  dimensions jsonb not null,           -- {clarity:{score,evidence,rationale},...}
  feedback jsonb not null,             -- did_well, biggest_mistake, missed_opportunity, stronger_response, practice_focus, next_scenario, hidden_info_recap, ethics_flags
  created_at timestamptz default now()
);

-- denormalized for fast progress queries
create table dimension_scores (
  session_id uuid references sessions(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  dimension text not null,             -- clarity|listening|...
  score int,                           -- null = N/A
  primary key (session_id, dimension)
);
create index on dimension_scores (user_id, dimension);

-- PHASE 2+ TABLES ------------------------------------------------------------

create table skill_progress (          -- competency level per tree node
  user_id uuid references profiles(id) on delete cascade,
  skill_id text not null,              -- 'EMP.LABEL'
  level int check (level between 1 and 5),
  median_last3 int,
  updated_at timestamptz default now(),
  primary key (user_id, skill_id)
);

create table curriculum_days (
  day int primary key, skill_ids text[], lesson_md text, drill_code text,
  scenario_id text references scenarios(id), difficulty int,
  real_world_challenge text, reflection_question text, success_metric jsonb
);

create table user_day_progress (
  user_id uuid references profiles(id) on delete cascade,
  day int references curriculum_days(day),
  lesson_done boolean default false, drill_done boolean default false,
  session_id uuid references sessions(id), challenge_done boolean default false,
  reflection text, completed_at timestamptz,
  primary key (user_id, day)
);

create table prep_sheets (             -- Voss one sheet
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  session_id uuid references sessions(id),
  goal text, summary text, accusation_audit text[], calibrated_questions text[], noncash_items text[],
  created_at timestamptz default now()
);

create table streaks (
  user_id uuid primary key references profiles(id) on delete cascade,
  current_days int default 0, longest_days int default 0, last_active_date date
);

create table achievements (
  user_id uuid references profiles(id) on delete cascade,
  code text not null,                  -- 'FIRST_THATS_RIGHT', 'NO_DISCOUNT_NEGOTIATOR'
  earned_at timestamptz default now(),
  primary key (user_id, code)
);

-- RLS: every user-owned table gets `using (user_id = auth.uid())` (profiles: id = auth.uid()).
-- scenarios / industry_packs / curriculum_days: read-only to authenticated users.
```

---

## M. User journey

**MVP journey (first session, about 15 minutes)**
1. **Landing:** reads the promise, sees a sample transcript with coach annotations → "Try a free practice call".
2. **Sign up:** magic link.
3. **Onboarding:** "What do you sell?" (industry) · "How long have you been selling?" · "Which conversation scares you most?" → recommended first scenario (e.g. "price talks" → S04).
4. **Scenario brief:** who you're talking to, your goal, channel, "type `/end` to finish". *No hidden info shown.*
5. **Roleplay:** 8–20 turns. The prospect pushes back, gives a fake "yes", hesitates.
6. **Coach mode:** overall score + outcome badge → did well → biggest mistake (quoted) → stronger response → hidden-info recap ("She was worried about editing the site herself. One label would have uncovered it.") → practice focus.
7. **Retry:** "Retry focusing on *labeling hesitation*" → second attempt → feedback shows "+18 Empathy".
8. **Return trigger:** email next day: "Your next scenario: *I'll think about it*" (simple transactional email).

**Phase 2 journey additions:** baseline assessment → 30-day plan → daily 10-minute session (lesson → drill → roleplay → challenge → reflection) → weekly review screen (Carnegie's weekly check) → before a real call, fill in a one sheet and rehearse the exact conversation → after the real call, log a reflection.

---

## N. Monetization ideas

| Model | Description | Notes |
|---|---|---|
| **Freemium individual** | Free: 3 roleplays/week, basic feedback. Pro: unlimited, voice, full 30-day plan, history, prep sheets | Primary model. Price point to test; validate with a pre-sale page |
| **Pre-call rehearsal pack** | Pay per "rehearse my real call": user describes the real prospect → custom persona → 3 attempts | High willingness to pay right before important calls |
| **Industry packs** | Real estate, agency, SaaS packs with specialized personas and vocabulary | Upsell; also good for SEO landing pages per industry |
| **Teams / agencies** | Seats + manager dashboard, team scenarios, onboarding programs for new sales hires | Higher contract value; needs admin features (phase 3) |
| **Bootcamp cohorts** | 30-day program with live human coaching + AI practice | High price, low volume; good for early revenue and learning |
| **White-label / B2B licensing** | Sales-training companies license the engine with their own content | Later; needs a solid content pipeline |

---

## O. Future expansion opportunities
1. **Voice roleplay** with persona voices, interruptions and silence handling. Pace, filler words and tone become measurable (D5 Confidence).
2. **Rehearse my real call:** paste a LinkedIn bio, email thread or notes to generate a persona and Black Swan hypotheses (privacy-safe, user-provided only).
3. **Multi-stakeholder scenarios** (S18), including committee dynamics and the people behind the table.
4. **Multilingual practice:** the same scenarios in other languages and cultural norms (Lowndes's "Clear Customs" point and the summary's own caveat on cultural differences).
5. **Real-call review** (opt-in, with consent): upload a recording and get the same rubric. Requires legal and consent handling.
6. **Manager mode:** assign scenarios, see team weaknesses, calibrate scoring against manager judgment.
7. **Beyond sales:** salary negotiation, landlord, freelancer rate talks, customer support de-escalation. The same engine with different scenario packs.
8. **Knowledge expansion:** add sales-process sources to fill the ○ gaps (qualification, demo, closing, follow-up cadences).

---

## P. Biggest risks and weaknesses

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Sycophantic or unrealistic prospect** | LLMs tend to be agreeable. If the prospect folds easily, practice is worthless. | Trust engine + style rules + code-checked unlock rules. Realism rating after each session. Test harness with scripted "bad salesperson" transcripts that must fail. |
| **Unreliable scoring** | If scores jump around, users stop trusting the coach. | Deterministic metrics, quote validation, temperature 0, double-run reconcile, calibration set regression (`04-rubrics.md`). |
| **Teaching manipulation** | Some techniques (deliberate mislabeling, loss framing, "premature we") can be misused. Reputation risk. | Ethics cap in scoring, sincerity-first coaching (Carnegie). No reward for deception, fake urgency or the "sneaky screen". |
| **Text ≠ real calls** | Real sales are spoken. Typing allows time to think that a live call doesn't. | Ship voice in phase 2. Add a turn timer option in text mode. |
| **Thin source base for sales process** | The three books are about influence and negotiation, not pipeline or closing. | Coverage tags (○) shown in-product. Add sales-process sources before claiming "complete sales training". |
| **Lowndes source is a summary** | Some HTTA concepts may be distorted by the summarizer. | Marked provisional. Get the full book before using them in the curriculum. |
| **Unverified research claims** | The authors cite studies I haven't checked. Some (7-38-55) are commonly misused. | Teach behaviors, not statistics. [GK] caveats in content. |
| **Unit economics** | Long multi-turn chats + double evaluation = significant LLM cost per session. Voice adds more. | Prompt caching, turn caps, a cheaper model for roleplay, per-user daily caps on the free tier. Measure the real cost per session in the MVP before setting prices. |
| **Retention** | Deliberate practice is uncomfortable, and users drop off after the novelty. | Short sessions, retry-with-one-focus loop, visible score deltas, "rehearse my real call" for urgent motivation. |
| **Crowded market** [GK] | Several AI sales-roleplay tools already exist, mostly aimed at enterprise sales teams. | Position for solo sellers: freelancers, agencies, small businesses, real-estate agents. Industry packs. Lower price. Teaching-quality feedback rather than call-center QA. |
| **IP / branding** | The techniques are ideas, but book text, author names and trademarks (e.g. "Black Swan" is the name of Voss's company) shouldn't be used in marketing. | Original wording throughout. Generic technique names in the UI ("label", "calibrated question"). No claims of endorsement. |

---

## Q. What should NOT be built (now)
- ❌ **Voice before text is validated.** Voice adds cost and latency complexity. First prove the retry loop.
- ❌ **Video avatars or facial-expression analysis.** Expensive, gimmicky, and the body-language science is shaky.
- ❌ **Leaderboards against other users.** Practice scores across different scenarios and difficulties aren't comparable, and competition discourages beginners.
- ❌ **Infinite AI-generated scenarios without QA.** Every scenario needs a tested Black Swan and unlock rules. Quality beats quantity.
- ❌ **CRM integrations, team admin, SSO.** Not needed to validate individual value.
- ❌ **Recording and analyzing real calls.** Consent, legal and privacy burden. Phase 3+ and opt-in only.
- ❌ **A full LMS (courses, quizzes, certificates).** The product is *practice*, not content consumption. Keep lessons at 5 minutes.
- ❌ **Native mobile apps.** A responsive web app is enough for the MVP.
- ❌ **Custom scenario builder for users.** Comes after the scenario format is stable (it's the "rehearse my real call" feature later).
- ❌ **Teaching body-language statistics or "persuasion hacks".** Contradicts the product's sincerity stance and the evidence caveats.
