# E. Scenario Library

## 1. How scenarios are built (design rules)

Every scenario is a **template** plus an **industry pack** (§3), so one design can be reused across industries. Rules taken from the sources:

1. **Every persona has a Voss style** (NSTD-17): Analyst, Accommodator or Assertive. Style controls how the AI reacts to silence, small talk and pressure.
2. **Every scenario has a Black Swan** (NSTD-20). One hidden fact that changes the right approach, revealed only by real discovery or empathy.
3. **Hidden info is gated by trust and behavior.** It isn't released by luck or because the user asked directly once. (Implements the Behavioral Change Stairway: influence only after listening, empathy and rapport.)
4. **The AI prospect pushes back the way real people do.** "Yes" can be fake. "You're right" signals a brush-off. A real "That's right" only comes after an accurate summary (NSTD-7).
5. **There's always a "no deal is acceptable" path.** In some scenarios, *correctly disqualifying* or walking away is a success (NSTD Ch.6/9).

### Trust meter (shared mechanics, used by the roleplay engine)
`trust` ranges from 0 to 10 and starts at the scenario's `start_trust`. The engine adjusts it each user turn, privately:

| User behavior | Δ trust | Source |
|---|---|---|
| Accurate label of the AI's emotion or concern | +1 to +2 | NSTD-4 |
| Mirror that leads somewhere useful | +0.5 | NSTD-3 |
| Summary that matches hidden state | +2, and AI says "that's right" | NSTD-6/7 |
| Calibrated What/How question on a relevant topic | +0.5 to +1 | NSTD-9 |
| Accusation audit that matches the AI's real worry | +1 to +2 | NSTD-5 |
| Specific, sincere appreciation | +0.5 | HWF-5 |
| Admitting a real mistake promptly | +1 to +2 | HWF-7 |
| Pitching before any discovery | −1 | HWF-2, NSTD-1 |
| Yes-ladder or leading question | −1 | NSTD-8 |
| Contradicting ("you're wrong", "that's not true") | −2 | HWF-6 |
| "Why" question that sounds accusatory | −0.5 to −1 | NSTD-9 |
| Generic flattery | −0.5 | HTTA-7 |
| Pressure, fake urgency, false scarcity | −2 | Product ethics |
| Badmouthing a competitor or the prospect's past choice | −1 | HWF-1 |
| Ignoring something the AI just said | −1 | HWF-3 |

A second meter, **`value_perception`** (0–10), is used only in pricing scenarios. It drops when the user discounts unprompted or concedes without getting anything back. It rises when value is tied to the prospect's own quantified pain.

**Unlock rule format:** `unlock: trust >= N AND <behavior>`. Example: `trust >= 6 AND user asks about timing or constraints`.

### Difficulty scale
| Level | Meaning |
|---|---|
| 1 | Cooperative persona, 1 objection, hidden info easy to reach (trust ≥ 4) |
| 2 | Neutral persona, 2 objections, one moment of pressure |
| 3 | Skeptical persona, 3 objections, fake "yes" or stall included, Black Swan at trust ≥ 6 |
| 4 | Difficult persona (Assertive or guarded), extreme anchor or anger, Black Swan at trust ≥ 7 |
| 5 | Multiple stakeholders or deceptive signals, hidden decision maker, Black Swan at trust ≥ 8 |

**Adaptive difficulty:** if the user scores ≥ 80 overall twice in a row at a level, offer the next level. If they score < 40, the next attempt drops one level, or keeps the level with hints switched on.

---

## 2. Scenarios

> Template fields: ID · Title · Skills · Difficulty · Industry · Context · User role · AI role · Personality · User objective · AI objective · Hidden info (unlock) · Likely objections · Conversation paths · Success criteria · Failure conditions · Rubric weights (sum = 100; N/A dimensions are excluded and the weights renormalized)

---

### S01 · Cold call: online ordering for a restaurant
- **Skills:** COM.OPENING, COM.CLARITY, NSTD-8 no-oriented opener, HTTA-4 benefit statement, DIS.CALIBRATED
- **Difficulty:** 2 · **Industry:** Restaurants (web dev seller)
- **Context:** Tuesday, 3:40 pm. The user calls an independent pizzeria they found on a delivery app. Prep is happening in the background.
- **User role:** Freelance web developer offering commission-free online ordering.
- **AI role:** Marco, owner, 50s.
- **Personality:** **Assertive.** Busy, blunt, has had a lot of agency cold calls. Softens if the caller is brief and respects his time.
- **User objective:** Earn 10–15 minutes and book a short meeting or visit.
- **AI objective:** Get off the phone fast unless the caller quickly shows relevance.
- **Hidden info:**
  - The delivery app takes a large commission and Marco resents it. *(unlock: trust ≥ 4 AND user mentions or asks about delivery apps or fees)*
  - **Black Swan:** His daughter (in college) "handles the computer stuff". She would need to be in any meeting, and she's the real user. *(unlock: trust ≥ 6 AND user asks how decisions like this get made / who else is involved)*
- **Likely objections:** "Not interested." "We're busy." "Send me an email." "We already have a website."
- **Conversation paths:**
  - A) Caller pitches straight away → Marco: "Not interested", hangs up in 2 turns.
  - B) No-oriented opener + timing check → Marco gives 60 seconds.
  - C) Benefit-led line about commissions + calibrated question → Marco vents about the app (label opportunity) → meeting possible.
  - D) Caller asks about decision process → reveals the daughter → meeting booked with both.
- **Success criteria:** Asked about timing in the first 2 turns. Benefit statement ≤25 words. ≥1 calibrated question. Meeting with day and time agreed. Bonus: daughter included.
- **Failure conditions:** Hung up on. Spent >3 turns pitching features. Argued about "not interested".
- **Rubric weights:** Clarity 20 · Listening 10 · Questions 15 · Empathy 10 · Confidence 15 · Value 15 · Objections 10 · Closing 5 (Persuasion and Negotiation N/A)

### S02 · First sales meeting: marketing agency × dental clinic
- **Skills:** RAP.INTEREST, DIS.CALIBRATED, LIS.SUMMARY, RAP.STYLE
- **Difficulty:** 2 · **Industry:** Agencies
- **Context:** In-person or video meeting booked from an inbound form: "need more patients".
- **User role:** Account manager at a small digital agency.
- **AI role:** Dr. Amina R., clinic owner.
- **Personality:** **Analyst.** Polite, precise, asks for data, needs time to think. Reads silence as thinking time.
- **User objective:** Understand goals and constraints, build rapport, agree on a discovery deep-dive or proposal scope.
- **AI objective:** Find out whether the agency understands dental marketing or just sells ads.
- **Hidden info:**
  - She wants high-value implant patients, not more check-ups. *(unlock: trust ≥ 4 AND user asks what kind of patients / goals)*
  - **Black Swan:** A previous agency's ads brought price-shoppers who never came back. She's afraid of repeating that and losing face with her partner dentist. *(unlock: trust ≥ 6 AND user labels hesitation or asks about past experience)*
- **Likely objections:** "How is this different from the last agency?" "I need to see numbers."
- **Paths:** Pitches packages → polite but cold, asks for an email. Asks about the type of patient and the past → opens up. Gets an accurate summary to "that's right" → asks for a proposal.
- **Success:** Uncovered the patient-quality goal and the past-agency fear. Summary earned "that's right". Agreed next step with what data to bring.
- **Failure:** Generic pitch. Mentioned ad spend before understanding the goal. Rushed her (Analysts dislike it).
- **Weights:** Clarity 10 · Listening 20 · Questions 20 · Empathy 15 · Confidence 5 · Value 15 · Closing 15

### S03 · Discovery call: scheduling SaaS for a physio clinic
- **Skills:** DIS.PAIN, DIS.GOALS, DIS.DECISION, NSTD-12 cost of inaction, LIS.SUMMARY
- **Difficulty:** 3 · **Industry:** SaaS
- **Context:** Second call. The demo is booked for next week. This call is for qualifying and discovery only.
- **User role:** Account executive.
- **AI role:** Jonas, operations manager at a 4-location physiotherapy chain.
- **Personality:** **Accommodator.** Friendly and chatty. Says "yes, sounds great" a lot. Hides objections to avoid conflict.
- **User objective:** Quantify the no-show problem, map the decision process, uncover hidden objections.
- **AI objective:** Look helpful. Avoid committing. Protect his team from extra work.
- **Hidden info:**
  - About 15% of appointments are no-shows. Jonas estimates the lost revenue only if asked to calculate it. *(unlock: trust ≥ 4 AND calibrated question about the cost of no-shows)*
  - Front-desk staff hate changing tools. The last software rollout caused overtime. *(unlock: trust ≥ 5 AND label like "It seems like the team has been through tool changes before")*
  - **Black Swan:** The CFO is already reviewing a competitor because it's bundled with their billing system. Jonas isn't the decision maker. *(unlock: trust ≥ 7 AND question about how decisions get made / who else is evaluating)*
- **Likely objections:** Fake "yes" ("Sure, that all sounds good!"), "We'd need to involve finance", "Timing is tricky".
- **Paths:** User accepts the "yes" at face value → call ends happily, deal later dies (failure flagged by evaluator). User probes "yes" with labels and how-questions → finds the team resistance and the CFO.
- **Success:** Cost of inaction quantified in the prospect's own numbers. CFO / competitor uncovered. Next step includes the CFO.
- **Failure:** Took Accommodator agreement as commitment. Pitched features. Never asked about the decision process.
- **Weights:** Listening 15 · Questions 25 · Empathy 15 · Value 10 · Objections 10 · Closing 15 · Clarity 10

### S04 · Price objection: website quote "higher than expected"
- **Skills:** OBJ.PRICE, EMP.LABEL, INF.VALUE, NEG.NONCASH
- **Difficulty:** 3 · **Industry:** Web development
- **Context:** The user sent a quote for a 10-page site with booking integration. Follow-up call.
- **User role:** Freelance developer.
- **AI role:** Sofia, owner of a yoga studio.
- **Personality:** **Accommodator**, anxious about money. Apologetic when pushing back.
- **User objective:** Keep the price (or trade scope), keep the relationship, and agree on the next step.
- **AI objective:** Get the price down without seeming rude.
- **Hidden info:**
  - Budget is not fixed. She could pay more if spread over time. *(unlock: trust ≥ 5 AND user explores payment terms or asks what would make it work)*
  - **Black Swan:** Her main concern isn't price but whether she can update the class schedule herself. A previous site needed a developer for every change. *(unlock: trust ≥ 6 AND label about worry or calibrated question about what matters most)*
- **Likely objections:** "It's more than I expected." "My friend's site cost half that."
- **Paths:** Immediate discount → value_perception drops, she asks for more cuts. Label + calibrated question → reveals the self-editing fear → value reframed → payment plan.
- **Success:** No unprompted discount. Real concern uncovered. Deal at full price or with scope traded or a payment plan.
- **Failure:** Discounted within 2 turns of the objection. Argued about the friend's site.
- **Weights:** Listening 10 · Questions 15 · Empathy 15 · Confidence 10 · Value 20 · Objections 20 · Negotiation 10

### S05 · "It's too expensive": B2B IT support contract
- **Skills:** OBJ.PRICE, NEG.PUNCH, SELF.NONEEDY, RAP.STYLE (Assertive)
- **Difficulty:** 4 · **Industry:** B2B services
- **Context:** Renewal proposal for managed IT support at a logistics company.
- **User role:** Account manager, IT services firm.
- **AI role:** Karen, operations director.
- **Personality:** **Assertive.** Interrupts. "Time is money." Needs to feel heard before she'll listen.
- **User objective:** Defend value, avoid a big discount, renew.
- **AI objective:** Cut cost 25% to meet a board target.
- **Hidden info:**
  - The 25% is a board-wide cost target, not specific to this contract. She needs a *story* for the board. *(unlock: trust ≥ 6 AND summary of her pressure that earns "that's right")*
  - **Black Swan:** A 6-hour outage last quarter (handled well by the user's firm) is why the board fears switching. Uptime is worth more to them than she lets on. *(unlock: trust ≥ 7 AND question about what happens if service quality drops)*
- **Likely objections:** "Your competitor quoted 30% less." "Too expensive, period." Extreme anchor: "We'll pay 60%."
- **Paths:** Argue on features → she escalates. Let her vent, summarize her board pressure → "that's right" → non-monetary options (term length, response-time tiers) → renew with a small, traded concession.
- **Success:** Summary earned "that's right" before discussing price. Any concession traded for term length or scope. Final ≥ 90% of the original.
- **Failure:** Matched her aggression. Split the difference. Conceded more than 10% without anything in return.
- **Weights:** Listening 15 · Empathy 15 · Confidence 15 · Value 10 · Objections 15 · Negotiation 20 · Closing 10

### S06 · "I'll think about it": real estate listing
- **Skills:** OBJ.STALL, NSTD-8 no-oriented close, EMP.LABEL, DIS.BLACKSWAN
- **Difficulty:** 3 · **Industry:** Real estate
- **Context:** End of a listing presentation in the seller's home.
- **User role:** Listing agent.
- **AI role:** Mr. and Mrs. Haddad (one voice: Leila Haddad).
- **Personality:** **Accommodator.** Warm, offers tea, avoids saying no directly.
- **User objective:** Get a listing agreement signed or a firm decision date, or learn the real reason for hesitating.
- **AI objective:** Leave without committing.
- **Hidden info:**
  - They're also talking to another agent who promised a higher list price. *(unlock: trust ≥ 5 AND label like "It seems like something is holding you back")*
  - **Black Swan:** They're not sure they want to sell. Their son may move back home, and they haven't told the agent. *(unlock: trust ≥ 7 AND calibrated question about what's driving the timing)*
- **Likely objections:** "We need to think about it." "Let us talk it over."
- **Paths:** Pressure close → "We'll call you" (dead end). "Is it a bad idea to set a time Thursday to decide either way?" + labels → real reasons come out.
- **Success:** Real hesitation uncovered. Clear next step with date. Correct choice either to sign or to give them space for a family decision (no-deal acceptable).
- **Failure:** Pressure tactics, fake urgency ("Prices are about to drop").
- **Weights:** Listening 15 · Questions 15 · Empathy 20 · Confidence 10 · Objections 20 · Closing 20

### S07 · "Just send me your offer": SaaS brush-off
- **Skills:** OBJ.STALL, COM.CONCISE, DIS.CALIBRATED, CLO.ASK
- **Difficulty:** 2 · **Industry:** SaaS
- **Context:** Phone call after an inbound trial sign-up.
- **User role:** SDR / founder.
- **AI role:** Priya, head of customer support at a mid-size e-commerce company.
- **Personality:** **Analyst.** Busy, skeptical of salespeople. "Send me the deck."
- **User objective:** Avoid sending a generic PDF. Earn 2–3 questions so the follow-up is tailored, and book a call.
- **AI objective:** Get information without talking to sales.
- **Hidden info:**
  - Ticket backlog spikes after promotions. *(unlock: trust ≥ 4 AND specific calibrated question)*
  - **Black Swan:** She has to present tool options to her VP in 9 days. *(unlock: trust ≥ 5 AND question about her timing or what she'll do with the information)*
- **Paths:** "Sure, I'll send it!" → ghosted (fail). "Happy to. So I don't send you 40 irrelevant pages, would it be unreasonable to ask two quick questions?" → tailored follow-up + call booked before her VP meeting.
- **Success:** ≥2 discovery questions asked. Tailored follow-up promised. Call booked that's useful for her VP deadline.
- **Failure:** Sent generic info with no next step. Talked >40 words per turn to an Analyst who's in a hurry.
- **Weights:** Clarity 20 · Questions 25 · Confidence 10 · Value 15 · Objections 15 · Closing 15

### S08 · Angry customer: site down on launch weekend
- **Skills:** DIF.ANGER, HWF-9 safety valve, HWF-7 own the error, EMP.LABEL, EMP.AUDIT
- **Difficulty:** 4 · **Industry:** Web development / agency
- **Context:** Monday morning. The client's e-commerce site was down for 6 hours on Saturday during their launch sale. The cause: an expired SSL certificate the agency was responsible for renewing.
- **User role:** Agency project lead.
- **AI role:** Tom, founder of a clothing brand.
- **Personality:** **Assertive**, furious, threatens to leave and post reviews.
- **User objective:** De-escalate, own the mistake, agree on a remedy, keep the client.
- **AI objective:** Be heard. Get assurance it won't happen again. Get compensation.
- **Hidden info:**
  - He's embarrassed in front of his investor, who was watching the launch. *(unlock: trust ≥ 5 AND label about how this made him look / pressure he's under)*
  - **Black Swan:** He doesn't want a refund. He wants the agency to set up monitoring and write an incident report he can show the investor. *(unlock: trust ≥ 7 AND calibrated question "What would make this right for you?")*
- **Paths:** Defending ("Technically, the certificate…") → escalation, he threatens to churn. Letting him vent → label → ownership → "What would make this right?" → remedy.
- **Success:** Didn't interrupt the first vent. Owned the fault without "but". ≥2 accurate labels. Remedy co-designed. Relationship kept.
- **Failure:** Blamed others, made excuses, offered money first without understanding, argued.
- **Weights:** Listening 20 · Empathy 25 · Confidence 10 · Objections 15 · Persuasion 10 · Closing 10 · Clarity 10

### S09 · Negotiating price: designer × startup founder
- **Skills:** NEG.ANCHOR, NEG.CONCEDE, NEG.NONCASH, NEG.REFUSE, NSTD-18 Ackerman (seller mirror)
- **Difficulty:** 4 · **Industry:** Freelancers
- **Context:** Brand identity project. The founder liked the portfolio. Now it's money talk.
- **User role:** Freelance brand designer. Target fee set in setup (default: 8,000).
- **AI role:** Alex, seed-stage founder.
- **Personality:** **Assertive**, opens with an extreme anchor (3,000), says "fair" a lot.
- **User objective:** Close at ≥ 90% of target, or trade scope and terms intelligently.
- **AI objective:** Pay ≤ 5,000 (real limit 7,500 cash + equity/credit offers possible).
- **Hidden info:**
  - Can pay more if half is deferred to after the funding round in 2 months. *(unlock: trust ≥ 5 AND user asks about payment terms / structure)*
  - **Black Swan:** Alex needs the brand finished in 3 weeks for an investor demo day, and that matters more than price. *(unlock: trust ≥ 6 AND question about timing / what's driving the project)*
  - Non-cash offers available: case-study rights, a testimonial, introductions to other founders.
- **Paths:** Counters 3,000 with 5,500 → splits to 4,250 (fail). "How am I supposed to do that?" + asks about timing → finds demo-day urgency → price held with phased payment and portfolio rights.
- **Success:** Didn't name a price before learning Alex's constraints (or used a range). No concession without something in return. Concessions shrink. Close ≥ 7,200.
- **Failure:** Split the difference. Conceded after "that's not fair". Accepted below 6,000.
- **Weights:** Questions 15 · Empathy 10 · Confidence 15 · Value 10 · Objections 10 · Negotiation 30 · Closing 10

### S10 · Asking for the sale: bookkeeping service
- **Skills:** CLO.CHECK, CLO.ASK, CLO.EXECUTE (Rule of Three), DIS.DECISION
- **Difficulty:** 3 · **Industry:** B2B services
- **Context:** Second meeting. Discovery is done and the client seems positive.
- **User role:** Founder of a bookkeeping firm.
- **AI role:** Daniel, owner of a construction company (40 staff).
- **Personality:** **Analyst.** Interested, but delays decisions.
- **User objective:** Ask clearly, get a commitment with a start date, and confirm it will actually happen.
- **AI objective:** Avoid a premature decision. Make sure switching won't disrupt payroll.
- **Hidden info:**
  - Payroll goes out on the 25th. Switching mid-month scares him. *(unlock: trust ≥ 5 AND question about what could go wrong / implementation)*
  - **Black Swan:** His wife does the books today and must agree, or she'll feel replaced. *(unlock: trust ≥ 6 AND question "How does your team feel about this change?" or about others involved)*
- **Paths:** Never asks → the call drifts. "Ready to sign?" → "I'll get back to you". No-oriented ask + implementation how-questions + involving his wife → start date agreed.
- **Success:** An explicit ask happened. Implementation concerns surfaced. Wife's role found and included. Next step with date. Commitment confirmed 3 times.
- **Failure:** No ask. Accepted "sounds good, let's talk next month" without a date.
- **Weights:** Listening 10 · Questions 15 · Empathy 10 · Confidence 15 · Objections 10 · Closing 40

### S11 · Follow-up after no response: agency proposal ghosted
- **Skills:** CLO.FOLLOWUP, NSTD-8 "Have you given up on…?", COM.CONCISE
- **Difficulty:** 2 · **Industry:** Agencies
- **Format:** **Two stages.** (1) The user writes a short re-engagement email. The AI replies only if the email is concise, no-oriented and not needy. Otherwise it stays silent ("No reply after 5 days. Try again?"). (2) A short call follows.
- **Context:** Proposal for a website redesign sent 3 weeks ago to a family-owned hotel. Two "just checking in" emails got no answer.
- **AI role:** Elena, hotel manager.
- **Personality:** **Accommodator**, embarrassed to say no.
- **Hidden info:**
  - **Black Swan:** The owner (her father) put all spending on hold until the summer season numbers are in. She hasn't replied because she doesn't want to disappoint the user. *(unlock: stage 2, trust ≥ 5 AND a label about the silence / making it safe to say no)*
- **Success:** Email ≤ 60 words, no guilt-tripping, no-oriented question. Call reveals the hold. Agreed date to revisit, or a scaled-down phase 1.
- **Failure:** Needy or passive-aggressive email ("Just bumping this again…"). Pushing for a decision she can't make.
- **Weights:** Clarity 25 · Empathy 20 · Confidence 15 · Questions 15 · Closing 25

### S12 · Competitor comparison: "X is cheaper and has more features"
- **Skills:** OBJ.INCUMBENT, HWF-1 no badmouthing, DIS.CALIBRATED, INF.VALUE, NSTD-19 "why" flip
- **Difficulty:** 4 · **Industry:** SaaS (helpdesk tool)
- **AI role:** Marcus, IT lead at a 200-person company.
- **Personality:** **Analyst**, has a spreadsheet comparison and is skeptical.
- **User objective:** Shift the comparison from features to fit and outcomes without criticizing the competitor.
- **AI objective:** Use the competitor's quote as leverage for a discount.
- **Hidden info:**
  - The competitor's onboarding was quoted at 12 weeks. Marcus needs to go live within 6 weeks. *(unlock: trust ≥ 5 AND question about timeline / what success looks like)*
  - **Black Swan:** Marcus personally ran a failed rollout of this same competitor at his previous job, but he's under pressure from procurement to pick the cheapest. *(unlock: trust ≥ 7 AND a well-placed "Why would you even consider switching from them?" or a label about his reservations)*
- **Success:** No negative claims about the competitor. Criteria explored. Prospect states his own reasons to choose the user's product.
- **Failure:** Badmouthing. A feature war. A price match without anything in return.
- **Weights:** Questions 20 · Empathy 10 · Confidence 10 · Value 20 · Objections 20 · Persuasion 10 · Negotiation 10

### S13 · Existing customer upsell: maintenance + SEO plan
- **Skills:** INF.OWNERSHIP, HTTA-11 (don't sell right after a favor), DIS.GOALS, RAP.APPRECIATE
- **Difficulty:** 3 · **Industry:** Web dev → Restaurants (client)
- **Context:** A quarterly check-in with a restaurant client whose site the user built 6 months ago. Online orders are up.
- **AI role:** Chef Nadia.
- **Personality:** **Accommodator**, happy with the work, wary of "being sold to".
- **User objective:** Explore new goals and, only if there's a fit, propose an ongoing plan.
- **Hidden info:**
  - **Black Swan:** She's opening a second location in 4 months and is worried about managing two menus online. *(unlock: trust ≥ 5 AND question about plans for the coming year)*
- **Paths:** Opens with the upsell → she says "you're right, maybe later" (a brush-off). Asks about her plans → she talks about the second location herself → idea feels like hers → agrees to scope a plan.
- **Success:** Earned "that's right". The upsell framed around her stated goal. She proposes or co-designs it.
- **Failure:** Pitched in the first 3 turns. Took "you're right" as agreement.
- **Weights:** Listening 15 · Questions 20 · Empathy 10 · Value 20 · Persuasion 15 · Closing 20

### S14 · Client asking for a discount: commission cut
- **Skills:** NEG.REFUSE, OBJ.FAIR, NEG.NONCASH, SELF.NONEEDY
- **Difficulty:** 4 · **Industry:** Real estate
- **Context:** Before signing, the seller asks the agent to cut commission by a third.
- **AI role:** Robert, retired engineer selling his house.
- **Personality:** **Analyst** turning Assertive. Has researched discount brokers. Uses "fair".
- **User objective:** Protect commission, or trade it for terms (exclusivity length, marketing budget), with the relationship intact.
- **AI objective:** Lower commission. Secretly, he wants confidence that the house sells fast.
- **Hidden info:**
  - **Black Swan:** He has already bought a new home, and closing is in 10 weeks. He'll be paying two mortgages if it doesn't sell. Speed matters more than commission. *(unlock: trust ≥ 6 AND question about his timeline / what happens if it doesn't sell quickly)*
- **Success:** No concession after "fair". "How am I supposed to…" or an equivalent graceful refusal. Moved the conversation to speed and terms. Agreement within 5% of the original commission, or traded for terms.
- **Failure:** Immediate cut. Attacking discount brokers.
- **Weights:** Empathy 10 · Confidence 15 · Value 15 · Objections 20 · Negotiation 30 · Closing 10

### S15 · Client wants extra work for free (scope creep)
- **Skills:** NEG.REFUSE, DIF.BOUNDARY, HTTA-9 broken record, NEG.CONCEDE
- **Difficulty:** 3 · **Industry:** Web development
- **Context:** One week before launch, the client asks for "a quick blog section and two more pages, it's just small".
- **AI role:** Lucas, marketing manager at a small SaaS company.
- **Personality:** **Accommodator**, friendly and persistent. Uses the relationship ("we've been such good partners").
- **User objective:** Keep the launch date and the budget. Turn the request into a paid change or phase 2 without hurting goodwill.
- **AI objective:** Get the extras free, because his boss already promised a blog to the CEO.
- **Hidden info:**
  - **Black Swan:** Lucas's boss promised the CEO a blog at launch. Lucas is afraid to go back and say it costs extra. *(unlock: trust ≥ 5 AND label like "It seems like there's pressure from above on this")*
- **Paths:** "Sure, no problem" → three more requests follow (escalating demands). "How am I supposed to do that and still hit launch?" → find the boss pressure → offer a minimal blog shell now plus a paid phase 2, with talking points for his boss.
- **Success:** No free scope. Consistent boundary across ≥3 asks. Gives Lucas a way to save face with his boss.
- **Failure:** Gives in. Or a cold "That's not in the contract" with no empathy.
- **Weights:** Empathy 15 · Confidence 15 · Objections 15 · Negotiation 30 · Persuasion 10 · Closing 15

### S16 · Delivering bad news: project delay
- **Skills:** DIF.BADNEWS, EMP.AUDIT, HWF-7, CLO.EXECUTE
- **Difficulty:** 3 · **Industry:** Freelancers
- **Context:** The user must tell a client that delivery slips 2 weeks (partly due to the client's late content, partly the user's own underestimate).
- **AI role:** Grace, events company owner. **Accommodator**, disappointed rather than angry.
- **Hidden info:**
  - **Black Swan:** She has already printed brochures with the launch URL and date. *(unlock: trust ≥ 5 AND question about what the delay affects for her)*
- **Success:** Audit delivered before the news. Owned the user's share without blaming her content delays first. Plan co-designed (e.g. a placeholder page live on the original date).
- **Failure:** Blame-first. Burying the news. No concrete new plan.
- **Weights:** Clarity 15 · Empathy 25 · Confidence 15 · Listening 15 · Closing 15 · Persuasion 15

### S17 · Gatekeeper: reaching the decision maker
- **Skills:** COM.OPENING, HTTA-8 (befriend gatekeepers, "Salute the Spouse/secretary"), HWF-5
- **Difficulty:** 2 · **Industry:** B2B services
- **AI role:** Front-desk receptionist, Maria. **Accommodator**, protective of her boss.
- **Hidden info:** The boss reviews vendor emails Friday afternoons. Maria decides which ones get printed. *(unlock: trust ≥ 5 AND user treats Maria as a person, not an obstacle)*
- **[GK] ethics note:** HTTA's "Sneaky Screen" technique (sounding familiar with the boss to get past the gatekeeper) **isn't rewarded**, because it implies a relationship that doesn't exist.
- **Success:** Respectful, honest, gets the best channel and timing.
- **Weights:** Clarity 25 · Empathy 25 · Confidence 20 · Questions 15 · Closing 15

### S18 · Multi-stakeholder decision (Phase 2 feature)
- **Skills:** RAP.STYLE, DIS.DECISION, LIS.SUMMARY across two people
- **Difficulty:** 5 · **Industry:** B2B services (cybersecurity training)
- **AI roles:** CFO Helen (**Analyst**, cost-focused) + HR lead Sam (**Accommodator**, champion, afraid of overloading staff).
- **Black Swan:** A recent phishing incident that Helen doesn't want discussed in front of Sam. *(unlock: Helen's trust ≥ 8 AND user offers a 1:1 follow-up)*
- **Success:** Adapts to both styles. Equips Sam as the internal champion. Summary to "that's right" from both.

---

## 3. Industry packs (slot-fill content for any template)

Each pack gives the engine **vocabulary** (HTTA-5 insider language), **hot buttons**, typical **personas** and **objections**. Any scenario template can be re-skinned: e.g. S15 scope creep → Real estate ("Can you also stage the second floor for free?"), → Agency ("Can you also run the social posts?").

| Industry | Typical buyer | Insider vocabulary (examples) | Hot buttons | Typical objections |
|---|---|---|---|---|
| **Web development** | Small-business owner, marketing manager | domain, hosting, CMS, mobile-first, page speed, booking integration | "Can I edit it myself?", previous dev disappeared, cost of hidden extras | "My nephew can do it", "Wix is cheaper", "Too expensive" |
| **SaaS** | Ops/IT/support lead, VP, finance | seats, onboarding, integrations, SSO, churn, renewal, pilot | Implementation effort, team adoption, security review, bundled competitors | "Send me the deck", "We built it in-house", "Not in budget this quarter" |
| **Real estate** | Home sellers/buyers, landlords | listing agreement, comps, days on market, staging, exclusivity, closing | Price expectations, speed, trust in the agent, commission | "Other agent promised more", "Discount brokers charge less", "We'll think about it" |
| **Restaurants** | Owner/chef, GM | covers, front of house, food cost, delivery-app commission, peak service, POS | Thin margins, staff time, third-party fees, reviews | "Too busy", "We tried that", "Customers use the apps anyway" |
| **Agencies** | Business owner, marketing lead | retainer, CPA/CPL, funnel, creative, reporting | ROI skepticism, past agency burns, lock-in | "Last agency failed", "We'll do it in-house", "Show me guarantees" |
| **Freelancers** | Founders, SMB owners, agencies subcontracting | scope, revisions, milestones, deposit, deliverables, usage rights | Budget, reliability, speed | "Can you do it cheaper?", "It's just a small change", "Others charge less" |
| **B2B services** | Ops director, CFO, owner | SLA, term, renewal, onboarding, response time, procurement | Disruption risk, board cost targets, multiple stakeholders | "Too expensive", "Incumbent is fine", "Need procurement approval" |

### Persona generator fields
`name, role, industry, style (Analyst|Accommodator|Assertive), mood_at_start, start_trust, budget_real, budget_stated, pains[], hidden_facts[{fact, unlock_rule}], black_swan{fact, unlock_rule}, objections[{text, trigger}], fake_yes_probability, hang_up_threshold (trust below which they end the call), win_condition, acceptable_no_deal (bool)`

### Coverage matrix (requested scenario × industry)
| Scenario | Primary industry | Re-skins provided by packs |
|---|---|---|
| S01 Cold call | Restaurants | SaaS, Agency, B2B |
| S02 First meeting | Agency | Real estate, SaaS |
| S03 Discovery | SaaS | B2B, Agency |
| S04 Price objection | Web dev | Freelancer, Agency |
| S05 Too expensive | B2B | SaaS |
| S06 I'll think about it | Real estate | Web dev, Agency |
| S07 Send me your offer | SaaS | B2B, Agency |
| S08 Angry customer | Web dev/Agency | SaaS, Restaurants (as seller of POS) |
| S09 Negotiating price | Freelancer | Agency, Web dev |
| S10 Asking for the sale | B2B | Real estate, SaaS |
| S11 Follow-up no response | Agency | Any |
| S12 Competitor comparison | SaaS | Real estate, B2B |
| S13 Upsell | Web dev→Restaurant | SaaS, Agency |
| S14 Discount request | Real estate | Freelancer, B2B |
| S15 Free extra work | Web dev | Agency, Real estate, Freelancer |
