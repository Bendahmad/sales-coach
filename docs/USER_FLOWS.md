# User Flows (V1)

Core flow (from the brief), mapped to screens and API calls:

```
Landing → Sign up → (Onboarding, first time only) → Dashboard → Choose scenario → Scenario brief
→ Start roleplay → AI acts as prospect ⇄ User responds → Conversation ends
→ AI evaluation (waiting screen) → Score → Feedback → Retry ↺ → Progress saved (Dashboard / History)
```

Journey source: `knowledge-system/06-product-and-mvp.md` §M (MVP journey).

---

## F1 · Landing → Sign up → Onboarding → Dashboard

| Step | Screen / route | What the user sees / does | System |
|---|---|---|---|
| 1 | `/` Landing | Promise ("Practice real sales conversations with AI before they happen in real life."), sample transcript with 2–3 coach annotations (static), 3 scenario cards, "how scoring works" (10 dimensions), CTA **"Try a free practice call"**, note: *don't paste real client secrets* | Static page |
| 2 | `/login` | Email field → "Send magic link" | `supabase.auth.signInWithOtp({ email, emailRedirectTo: /auth/callback })` |
| 3 | Email | Click link | — |
| 4 | `/auth/callback` | — | Exchange code for session. Trigger has created the `users` row. Redirect to `/onboarding` if `onboarded_at` is null, otherwise `/dashboard` |
| 5 | `/onboarding` (1 screen, 3 questions, spec §M step 3) | **What do you sell?** (industry, 7 options) · **How long have you been selling?** (new / some / experienced) · **Which conversation scares you most?** (cold calls / price talks / objections / asking for the sale) | Server action updates `users` and sets `onboarded_at` → `/dashboard` |
| 6 | `/dashboard` | See F6 | — |

**Edge cases:** expired or used link → `/login?error=link_expired` with a resend option. A signed-in user visiting `/` or `/login` is redirected to `/dashboard`. Unauthenticated access to an app route → `/login?next=…`.

---

## F2 · Choose scenario → Brief → Start

| Step | Screen | Content | System |
|---|---|---|---|
| 1 | `/dashboard` → "Recommended next" card, or `/scenarios` | Scenario list: 6 cards (title, industry, difficulty dots, skills trained, best score if attempted). The card matching onboarding answers is marked **Recommended** | `scenarios` (RLS select) + user's best scores |
| 2 | `/scenarios/[id]` Brief | Who you're talking to (name, role, company), your role, your goal, channel, setting. Tips: "Type naturally; `/end` finishes the conversation." **No hidden info, no persona style, no trust.** If attempted before: previous score + practice focus | Server reads `scenario_industries.brief` only |
| 3 | Click **Start conversation** | Button shows "Connecting…" | `POST /api/sessions { scenarioId }` → checks: authenticated, daily cap, no other active session (if one exists, offer **Resume** or **Abandon**). Creates session, renders + freezes prompt H. If `ai_speaks_first`, generates the AI opening line. → `{ sessionId }` → navigate to `/session/[id]` |

**Edge cases:**
- **Daily cap reached:** the Start button is disabled with "You've done 10 practice calls today. Come back tomorrow." (env-configurable).
- **Active session exists:** modal: "You have an unfinished conversation with Marco." [Resume] [Abandon & start new]. Abandon sets `status = 'abandoned'`. Abandoned sessions are **not evaluated**.

---

## F3 · Roleplay (AI acts as prospect ⇄ user responds)

**Screen `/session/[id]`:** a chat layout. The header shows the counterpart's name and role, the channel icon, and "Turn 3 / 20". There is no trust meter, no hints and no coaching (prompt H: the AI must not teach during the roleplay). Footer: text input (600-char limit with counter), Send, an **End conversation** button, and a collapsible "Your goal" reminder (from the brief).

| Event | UI | System |
|---|---|---|
| Page load | Transcript rendered (resume-safe) | Server Component loads messages (excluding `kickoff`) for an active session owned by the user. Ended → redirect to feedback |
| User sends message | User bubble appears instantly, input locked, "Marco is typing…" | `POST /api/sessions/[id]/turn { text }` → engine (TECH §4.2) → `{ reply, ended, endReason }` |
| AI replies | AI bubble | Input unlocked |
| User types `/end` or clicks End | Confirm: "End the conversation and get feedback?" | `POST /api/sessions/[id]/end { reason: 'user_end' }` |
| AI ends the conversation (deal, meeting, decline, hang-up, max turns) | AI's closing line, then a system line "Conversation ended", then auto-navigate to feedback after 2 s (or a button) | Turn route already ended the session and scheduled evaluation |
| Turn 18 of 20 | Subtle banner: "2 turns left" | — |
| AI call fails (network / 5xx after SDK retries) | Inline error under the user's bubble: "The prospect didn't answer. Retry" | User message stays saved. Retry re-runs the AI step for the same turn (idempotent on `(session_id, turn, 'ai')`) |
| Refusal (`stop_reason = refusal`) | "The prospect didn't respond to that. Try rephrasing." | Logged with flag. Turn not counted |
| User closes the tab mid-session | — | Session stays `active` and can be resumed from the dashboard ("Continue your call with Marco"). Sessions inactive for > 24 h become `abandoned` (lazy check on next dashboard load) |

**Things the user never sees during the roleplay:** trust, value perception, hidden facts, persona style, objections list, rubric. All are revealed or used only in coach mode.

---

## F4 · Conversation ends → AI evaluation → Score → Feedback

| Step | Screen | Content | System |
|---|---|---|---|
| 1 | `/session/[id]/feedback` (waiting state) | "Your coach is reviewing the conversation…", a 3-step progress (Counting your questions → Scoring 10 skills → Writing feedback), about 30–90 s. Transcript is visible below while waiting | Polls `GET /api/sessions/[id]/status` every 2 s: `evaluating` → `evaluated` / `eval_failed` |
| 2 | Score header | **Overall score** (0–100) + outcome badge (Won / Advanced / Correct no-deal / Stalled / Lost) + improvement vs. last attempt ("+14 since attempt 1") | `evaluations.overall`, `outcome`, `feedback.improvement_vs_last` |
| 3 | Dimension bars | 10 bars (N/A shown greyed out with "not tested in this scenario"). Tap a bar to see rationale + quoted evidence with turn links | `dimensions` |
| 4 | Coach feedback (order fixed by prompt I) | ✅ **What you did well** (2–3, with turn refs) → ⚠️ **Biggest mistake** (quoted turn + why) → 💡 **Missed opportunity** → 🔁 **Stronger response** (original vs improved, side by side) → 🎯 **One thing to practice** (skill + drill instruction) | `feedback.*` |
| 5 | Hidden info recap | "What Marco didn't tell you": each hidden fact with ✓ uncovered / ✗ missed + how to unlock (spec: turns the Black Swan into a learning moment) | `feedback.hidden_info_recap` |
| 6 | Realism question | "Did Marco feel like a real prospect?" 1–5 stars (one tap, optional) | `POST /api/sessions/[id]/rating` |
| 7 | Actions | **[Retry: focus on {practice skill}]** (primary) · [Next recommended: {scenario}] · [View transcript] · [Dashboard] | — |

**Edge cases:**
- `eval_failed` → "We couldn't finish your review. [Try again]" → `POST /api/sessions/[id]/evaluate` (idempotent).
- Conversation too short (< 3 user turns) → evaluation still runs. Most dimensions come back N/A with a note: "Too short to score most skills. Try having a longer conversation."

---

## F5 · Retry

| Step | Screen | System |
|---|---|---|
| 1 | Feedback → **Retry: focus on Labeling** | `POST /api/sessions { scenarioId, retryOf: sessionId }` |
| 2 | Brief screen (pre-filled) with a **Focus banner**: "This time: label the hesitation before answering it." Plus the previous score to beat | New session: `attempt_number + 1`, `parent_session_id`, `practice_focus` from previous evaluation, `unlock_bonus = 1` (hidden facts need +1 trust on retries, per prompt I notes) |
| 3 | Roleplay (F3) | Same scenario variant, same hidden facts. The persona has no memory of the earlier attempt (fresh conversation) |
| 4 | Feedback (F4) | Evaluator receives `<history>` = previous attempts' scores + focus, and reports `improvement_vs_last` explicitly. The score header shows the delta |

---

## F6 · Progress saved: Dashboard & History

**`/dashboard`** (minimal, spec §8 "Dashboard: M (minimal)")
- **Continue** card if an active session exists.
- **Recommended next** card from the latest evaluation's `next_scenario` (or onboarding-based for first-time users).
- **Your last score** + delta + date.
- **Skill snapshot:** 10 dimensions with latest score and a tiny trend (last 5 scores). Data from `user_skill_progress` + `skill_scores`.
- **Weakest skill callout:** lowest `median_last3` among dimensions with ≥ 2 scores ("Your focus: Questions, 42").

**`/history`**
- Table: date · scenario · attempt # · overall · delta vs previous attempt · outcome → link to feedback.
- Per-scenario grouping shows the attempt sequence (e.g. 38 → 52 → 67). This is the main "am I improving?" view.
- Transcript view (read-only) available from each feedback page.

---

## F7 · Returning user

```
Open app (session cookie valid) → /dashboard
  → active session? → "Continue your call with Marco" → /session/[id]
  → else "Recommended next" → brief → start
```
Magic-link sessions persist via Supabase refresh tokens. No emails or notifications are sent in V1 (the spec's day-2 email trigger is deferred, since it isn't needed to measure in-session retry).

---

## Screen inventory (V1 = 10 screens)

| # | Route | Auth | Purpose |
|---|---|---|---|
| 1 | `/` | public | Landing |
| 2 | `/login` | public | Magic link |
| 3 | `/auth/callback` | public | Code exchange (no UI) |
| 4 | `/onboarding` | user | 3 questions |
| 5 | `/dashboard` | user | Continue / recommended / progress snapshot |
| 6 | `/scenarios` | user | Library (6 scenarios) |
| 7 | `/scenarios/[id]` | user | Brief + start (+ retry focus banner) |
| 8 | `/session/[id]` | owner | Roleplay chat |
| 9 | `/session/[id]/feedback` | owner | Evaluation, coaching, retry |
| 10 | `/history` | user | Attempts and score progression |

Explicitly absent: settings page (except sign-out in the header menu), skill tree, curriculum, voice, pricing, teams, admin.
