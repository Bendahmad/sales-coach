# AI Sales Communication Coach: Knowledge System

> "Practice real sales conversations with AI before they happen in real life."

This folder holds the knowledge base, training method, roleplay engine and MVP spec for the product. **No code yet.**

## File index

| File | Contents | Brief sections |
|---|---|---|
| `00-README.md` | Executive summary, sources, evidence legend | A |
| `01-book-principles.md` | Analysis of each book, concept cards, where the books disagree | D (Phase 1) |
| `02-skill-tree-and-competencies.md` | Skill tree and 5-level competency model | B, C |
| `03-scenarios.md` | Scenario library and industry packs | E |
| `04-rubrics.md` | Standardized scoring rubrics | F |
| `05-curriculum-30-day.md` | Learning loop and 30-day plan | G (Phase 7) |
| `prompts/roleplay-system-prompt.md` | Production roleplay prompt | H |
| `prompts/evaluation-system-prompt.md` | Production evaluation (coach) prompt | I |
| `06-product-and-mvp.md` | Architecture, MVP, schema, journey, monetization, risks | J–Q |

---

## Sources actually analyzed

| Code | Book | What was in the PDF | Reliability for this project |
|---|---|---|---|
| **NSTD** | Chris Voss & Tahl Raz, *Never Split the Difference* (2016) | Full text, 10 chapters + appendix | High. Main source for negotiation, questioning, objections and empathy. |
| **HWF** | Dale Carnegie, *How to Win Friends and Influence People* (1936, rev. 1981) | Full text, 4 parts + "Nine Suggestions" | High. Main source for rapport, appreciation, handling complaints, feedback and the learning method. |
| **HTTA** | Leil Lowndes, *How to Talk to Anyone* | **Only a Bookey summary (~10k words)**, not the book. Several techniques are cut off ("Install Bookey App…"). | **Low to medium.** Technique names and gist only, no chapter detail. Concepts from it are tagged `HTTA-summary`. **Recommendation:** get the full book before treating these concepts as final. |

### Coverage gap you should know about
None of the three books is about **sales process**. They cover influence, conversation and negotiation. The parts of the skill tree that have **little or no source support** are:
- formal qualification (budget/authority/need/timing),
- pipeline or multi-call deal strategy,
- product demos and structured value propositions,
- closing techniques beyond Voss's "Yes is nothing without How" and the Rule of Three,
- follow-up cadences (beyond Voss's "Have you given up on this project?" message and Lowndes's tracking).

Every skill-tree node is tagged with its **source coverage** (Strong / Partial / Gap). Nodes tagged Gap are built only from what the books imply, and I've kept them thin on purpose. To fill them properly, add sales-specific sources later (e.g. *SPIN Selling*, *The Challenger Sale*, *Gap Selling*, Cialdini's *Influence*). I haven't drawn on those books because you didn't provide them.

### Evidence legend (used in every file)
- **[R]**: the author cites a named study (e.g. Voss citing Kahneman, Lieberman, Ames & Mason). *I haven't independently checked these citations.* Where a citation is commonly misapplied, I say so.
- **[F]**: the author's own framework or field method (e.g. the FBI Behavioral Change Stairway, the Ackerman model, Carnegie's principles). It's practitioner knowledge, not controlled research.
- **[A]**: supported only by anecdotes in the book (most of Carnegie and Lowndes).
- **[GK]**: a note from general knowledge, *not* from your sources. I add one only to flag a risk or a misused statistic, never to introduce a new principle.

---

## A. Executive summary

**What the three books give us when combined.** They cover three layers of a conversation, and those layers map onto a sales call:

1. **Opening and connection.** Lowndes: presence, small talk, phone manner, networking. Carnegie: genuine interest, names, smiling, making people feel important.
2. **Understanding and influence.** Carnegie: their point of view, their wants, letting the idea be theirs. Voss: mirrors, labels, summaries, calibrated questions.
3. **Resolving resistance and closing terms.** Voss: no-oriented questions, "How am I supposed to do that?", anchoring, the Ackerman model, the Rule of Three, behind-the-table decision makers, Black Swans.

**Framework chosen for the skill tree.** I rebuilt the skill tree in your brief around Voss's **Behavioral Change Stairway** (active listening → empathy → rapport → influence → behavior change, NSTD Ch.5). It's the only *sequenced* model in the three books, and it matches how a sales call actually unfolds. Carnegie's and Lowndes's techniques fit onto its steps. I added an "Inner Game" base layer (self-regulation, preparation, not being needy) because all three authors treat the speaker's own state as a prerequisite.

**Main training principle.** Every skill is defined by **observable conversational behaviors** that an AI can detect in a transcript. Examples: "used a label beginning with *It seems like*", "asked a How/What question after an objection", "summarized and got a *that's right*", "named a range instead of a single number". This makes the scoring auditable instead of based on vibes.

**Where the books disagree.** Full table in `01-book-principles.md` §4. The four that matter most for the product:
1. **"Yes" vs "No".** Carnegie: get the other person saying "yes, yes" early. Voss: pushing for yes makes people defensive, so invite "no". The coach teaches Voss's version for *sales openings and asks* and Carnegie's underlying point (start from shared goals) for *framing*.
2. **Compromise.** Voss: never split the difference. Carnegie (implicitly): avoid conflict and keep goodwill. The coach teaches *firm on substance, warm on the person*. Voss himself says "never create an enemy".
3. **Praise.** Carnegie: be generous with praise. Lowndes: unskilled praise backfires, so be specific or indirect. The coach scores praise only when it is **specific and verifiable**.
4. **Statistics about body language.** Voss's "7-38-55" and the summary's "80% of a first impression is nonverbal" are **[GK] widely misapplied or uncited**. The product won't teach them as facts.

**Product thesis.** A roleplay simulator where the AI plays a realistic prospect with **hidden information and a trust state**. The prospect only reveals what a skilled communicator would earn: labels and calibrated questions unlock hidden pains, and pushing for "yes" lowers trust. After the call, a separate evaluator scores 10 dimensions using rubrics tied to quoted transcript evidence, then assigns one focused drill. The learning loop comes from Carnegie's own method: weekly review, an applications journal, and "a lively game" with accountability.

**MVP.** Text chat first (voice is phase 2). The flow is: account → pick 1 of 6 scenarios → roleplay → evaluation → retry → saved progress. That's enough to test the core question: *do people come back to practice a second and third time, and do their scores improve across attempts?*

**Biggest risks.**
- The roleplay may be too easy or too sycophantic.
- Scores may be unreliable or easy to game.
- Users may learn to manipulate rather than understand people.
- The market for AI sales roleplay tools is crowded [GK].

Mitigations are in `06-product-and-mvp.md` §P.
