# F. Evaluation Rubrics (Phase 6: scoring system)

## Principles of the scoring system
1. **Observable behavior only.** Every score must cite turn numbers and short transcript quotes. If there's no evidence, the score can't go above the 41–60 band.
2. **Two layers.** (a) **Deterministic metrics** computed in code from the transcript (talk ratio, question counts, concession sizes, words per turn). (b) **LLM judgment** against the band descriptors below, *given those metrics as input*. Code metrics anchor the LLM and reduce score drift.
3. **N/A is allowed.** If a scenario never gave the user a chance to show a dimension (e.g. no price came up), the score is `null` and that dimension's weight is redistributed.
4. **Outcome ≠ score.** A user can "win" the deal with bad technique (lucky) or lose it with good technique (the scenario's acceptable no-deal). Scores measure *behavior*. The outcome is reported separately.
5. **Ethics overrides.** Deception, fabricated urgency or scarcity, false claims about competitors, or invented social proof cap the **Persuasion** and **Closing** scores at 40 and are always called out in feedback (product stance; Carnegie's sincerity principle).

## Deterministic metrics (computed before LLM evaluation)
| Metric | Definition | Used by |
|---|---|---|
| `talk_ratio_user` | user words ÷ total words | Listening |
| `avg_words_per_turn_user` | mean user words per turn | Clarity |
| `long_turns` | user turns > 80 words | Clarity |
| `questions_total`, `questions_open`, `questions_closed`, `questions_why` | classified by a small LLM call or heuristics (What/How/Tell me = open) | Questions |
| `labels_count` | user turns matching "It seems/sounds/looks like…" or an equivalent semantic label | Empathy |
| `mirrors_count` | user turn that is ≤5 words and repeats 1–3 words from the previous AI turn | Listening |
| `summaries_count` | LLM-classified paraphrase + label | Listening |
| `thats_right_earned` | AI said "that's right" (engine emits it only on accurate summaries) | Listening, Empathy |
| `hidden_facts_revealed` / `black_swan_revealed` / `turn_revealed` | from engine state log | Questions |
| `first_price_by` | user / AI / none | Negotiation |
| `concessions[]` | sequence of user concession amounts and whether something was received in return | Negotiation |
| `contradictions_count` | "you're wrong", "that's not true", "actually, no" aimed at the person | Objections, Empathy |
| `pitch_before_discovery` | user described offer features before asking ≥2 questions | Value |
| `ask_made`, `next_step_specificity` | explicit ask present; next step has owner + date + action (0–3) | Closing |
| `trust_start`, `trust_end`, `trust_min` | from engine | all (context only, never scored directly) |

---

## The 10 rubrics (0–100, five bands)

### D1 · CLARITY
| Band | Observable behavior |
|---|---|
| 0–20 | Prospect can't tell what the user offers or wants. Repeated rambling (multiple turns > 80 words). Heavy jargon. |
| 21–40 | Offer is understandable but feature-led and long. The prospect has to ask for clarification. |
| 41–60 | Clear offer and purpose. Some over-explaining, especially around price or objections. |
| 61–80 | Benefit-led value statement in ≤25 words. Turns mostly ≤40 words. Price or boundary stated in ≤2 sentences without a justification spiral. |
| 81–100 | Every turn has a purpose. Uses the prospect's own vocabulary. Explains with an analogy from the prospect's world. No filler. |

### D2 · LISTENING
| Band | Observable behavior |
|---|---|
| 0–20 | Interrupts or ignores answers. User talk ratio > 75% in discovery. Repeats questions already answered. |
| 21–40 | Lets the prospect finish but responses don't use what was said. No mirrors or summaries. |
| 41–60 | Some follow-ups reference earlier answers. 1 summary (fact-only). Talk ratio 55–75%. |
| 61–80 | Talk ratio ≤ 55%. ≥2 mirrors with pauses. ≥1 summary that combines paraphrase and label. Picks up side details. |
| 81–100 | Earns a genuine "that's right". Connects remarks from different points in the call. Notices hesitation ("yeah, I guess…") and explores it. |

### D3 · QUESTIONS
| Band | Observable behavior |
|---|---|
| 0–20 | Asks almost no questions, or only "Are you interested?" type questions. |
| 21–40 | Mostly closed or leading questions. Uses "why" accusingly. Yes-ladders. |
| 41–60 | Useful open questions, but misses key areas (decision process, cost of inaction, timing). Hidden facts not reached. |
| 61–80 | ≥60% open What/How questions. Follow-ups build on answers. Covers pain, impact and decision process. Reveals ≥1 hidden fact. |
| 81–100 | Question sequences uncover deeper motives. **Black Swan revealed.** Prospect reflects ("I hadn't thought of that"). |

### D4 · EMPATHY
| Band | Observable behavior |
|---|---|
| 0–20 | Dismisses or ignores emotion. Contradicts the person. Defensive. |
| 21–40 | Generic "I understand" / "I hear you". Labels start with "I". Empathy used as a transition to a pitch. |
| 41–60 | ≥1 specific label at an emotional moment. Acknowledges a constraint. |
| 61–80 | Accurate labels at most emotional moments. Accusation audit before bad news or price. No contradictions. |
| 81–100 | Labels unspoken fears before they come up. Prospect's trust climbs visibly. Positive dynamics reinforced with labels. |

### D5 · CONFIDENCE
| Band | Observable behavior |
|---|---|
| 0–20 | Begging, over-apologizing, unprompted discounts, or hostile reactions. |
| 21–40 | Hedges heavily ("maybe", "I think possibly"). Fills silence. Caves at the first push. |
| 41–60 | Holds position once. Some hedging around price. |
| 61–80 | States price, boundaries and recommendations plainly. Comfortable hearing "no". Calm under pressure. |
| 81–100 | Steady under extreme anchors or anger. Willing to say "this might not be a fit". Uses pauses deliberately. No neediness. |

*(Voice mode later adds pace, filler-word rate and pitch stability.)*

### D6 · VALUE COMMUNICATION
| Band | Observable behavior |
|---|---|
| 0–20 | Talks only about self or company. Pitches before any discovery. |
| 21–40 | Generic benefits ("save time and money") not tied to this prospect. |
| 41–60 | Benefits linked to ≥1 stated prospect goal. |
| 61–80 | ≥70% of value statements reference the prospect's own words. Cost of inaction quantified with the prospect's data. One concrete example or story. |
| 81–100 | The prospect states the value in their own words. Value framed against their personal stakes as well as the business ones. |

### D7 · OBJECTION HANDLING
| Band | Observable behavior |
|---|---|
| 0–20 | Argues, contradicts, or gives up immediately. |
| 21–40 | Canned rebuttal without understanding. Discounts to make the objection go away. |
| 41–60 | Acknowledges before responding. Sometimes asks a clarifying question. |
| 61–80 | Label → calibrated question → addresses the *real* objection. Handles "fair" without conceding. Doesn't accept a fake "yes" or "you're right". |
| 81–100 | Heads off predictable objections with an accusation audit. The prospect resolves their own objection. Objections turn into discovery. |

### D8 · PERSUASION
| Band | Observable behavior |
|---|---|
| 0–20 | Pressure, manipulation or false claims (also triggers the ethics cap). |
| 21–40 | Logic-only argument, or tells the prospect what they need. |
| 41–60 | Some framing toward the prospect's goals. Uses a relevant example. |
| 61–80 | Builds the recommendation from the prospect's words. Honest loss framing. Appeals to the prospect's values. Offers options. |
| 81–100 | The prospect feels the idea is theirs and proposes the solution. Persuasion is invisible: no pressure, high commitment. |

### D9 · NEGOTIATION
| Band | Observable behavior |
|---|---|
| 0–20 | Names a low number first without information. Splits the difference. Concedes without anything back. |
| 21–40 | Holds once, then makes a large concession. Concessions are equal-sized or growing. |
| 41–60 | Learns the prospect's expectation first or uses a range. Some trading. |
| 61–80 | Every concession traded. Shrinking concession sizes. Graceful refusals ("How am I supposed to…"). ≥1 non-monetary term introduced. |
| 81–100 | Shapes perceived value before numbers come up. Uncovers the real limit or constraint. Final ≥ 90% of target with the relationship intact, or correctly walks away. |

### D10 · CLOSING
| Band | Observable behavior |
|---|---|
| 0–20 | No ask. Call ends with "let me know". |
| 21–40 | One closed "Are you ready to go ahead?". Accepts vague replies. |
| 41–60 | Explicit ask and a next step, but not specific (missing date or owner). |
| 61–80 | Clear ask (no-oriented or direct). Next step with owner + date + action. Checks people behind the table. |
| 81–100 | Rule of Three confirmation. Implementation risks dealt with. Follow-up agreed in advance. Or a clean, mutually agreed no-deal when that's correct. |

---

## Overall score
`overall = Σ (dimension_score × scenario_weight) / Σ weights of non-null dimensions`, rounded to an integer.

**Outcome badge** (separate from score): `Won` · `Advanced (next step)` · `Correct no-deal` · `Stalled` · `Lost`.

## Mapping scores to competency levels (for the skill tree)
For each tree node, use the dimension score from the **last 3 relevant sessions** (median):

| Median | Level |
|---|---|
| 0–20 | L1 Beginner |
| 21–40 | L2 Developing |
| 41–60 | L3 Competent |
| 61–80 | L4 Advanced |
| 81–100 | L5 Expert, *and* ≥1 session at difficulty ≥ 4 |

## Reliability & anti-gaming
- **Calibration set:** 20 hand-scored transcripts (4 per band) are used as few-shot anchors and as a regression test. Re-run them whenever the evaluation prompt changes. Alert if any score moves by more than 10.
- **Consistency check:** evaluate at temperature 0. For the MVP, run twice and average. If the two runs differ by more than 15 on a dimension, run a third pass and use the median.
- **Keyword-stuffing guard:** labels and mirrors only count if they're **relevant to the previous AI turn**. Saying "It seems like…" five times in a row is penalized as robotic (NSTD Ch.3 warns against artificial tics).
- **Length gaming:** scores don't depend on verbosity. Long turns are penalized under Clarity.
- **Engine and evaluator separation:** the evaluator sees the engine's trust log but must justify scores from the transcript. Trust changes alone never decide a score.
