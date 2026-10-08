import type { Dimension, Industry } from "@/lib/content/scenario-schema";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  clarity: "Clarity",
  listening: "Listening",
  questions: "Questions",
  empathy: "Empathy",
  confidence: "Confidence",
  value: "Value communication",
  objections: "Objection handling",
  persuasion: "Persuasion",
  negotiation: "Negotiation",
  closing: "Closing",
};

export const OUTCOME_LABELS: Record<string, { label: string; tone: string }> = {
  won: { label: "Won", tone: "bg-emerald-100 text-emerald-800" },
  advanced: { label: "Advanced", tone: "bg-sky-100 text-sky-800" },
  correct_no_deal: { label: "Correct no-deal", tone: "bg-violet-100 text-violet-800" },
  stalled: { label: "Stalled", tone: "bg-amber-100 text-amber-800" },
  lost: { label: "Lost", tone: "bg-rose-100 text-rose-800" },
};

export const CHALLENGES = [
  { value: "cold_calls", label: "Cold calls" },
  { value: "price_talks", label: "Price talks" },
  { value: "objections", label: "Handling objections" },
  { value: "closing", label: "Asking for the sale" },
] as const;

export const EXPERIENCE = [
  { value: "new", label: "I'm new to selling" },
  { value: "some", label: "1–3 years" },
  { value: "experienced", label: "3+ years" },
] as const;

export const INDUSTRY_OPTIONS: { value: Industry; label: string }[] = [
  { value: "web_dev", label: "Web development" },
  { value: "saas", label: "SaaS" },
  { value: "agency", label: "Agency services" },
  { value: "freelance", label: "Freelance services" },
  { value: "real_estate", label: "Real estate" },
  { value: "restaurants", label: "Restaurant / hospitality" },
  { value: "b2b_services", label: "B2B services" },
];

export const CHANNEL_LABELS: Record<string, string> = {
  phone: "Phone call",
  video: "Video call",
  in_person: "In person",
  email: "Email",
};

/** Display names for skill-tree IDs (knowledge-system/02-skill-tree-and-competencies.md). */
export const SKILL_LABELS: Record<string, string> = {
  "SELF.REGULATE": "Staying calm under pressure",
  "SELF.NONEEDY": "Walk-away mindset",
  "SELF.PREP": "Preparation",
  "SELF.CONFID": "Confident presence",
  "COM.CLARITY": "Clear, benefit-led statements",
  "COM.CONCISE": "Conciseness",
  "COM.TONE": "Tone & mood match",
  "COM.OPENING": "Openings",
  "LIS.ATTEND": "Attentive listening",
  "LIS.MIRROR": "Mirroring",
  "LIS.PAUSE": "Using silence",
  "LIS.SUMMARY": "Summarizing to “that's right”",
  "LIS.SIGNALS": "Reading hesitation",
  "EMP.LABEL": "Labeling emotions",
  "EMP.AUDIT": "Accusation audit",
  "EMP.PERSPECT": "Seeing their point of view",
  "RAP.INTEREST": "Genuine interest",
  "RAP.SIMILAR": "Speaking their language",
  "RAP.APPRECIATE": "Specific appreciation",
  "RAP.CREDIBLE": "Credibility",
  "RAP.STYLE": "Adapting to their style",
  "DIS.CALIBRATED": "Calibrated questions",
  "DIS.PAIN": "Uncovering pain & cost of inaction",
  "DIS.GOALS": "Understanding goals",
  "DIS.DECISION": "Mapping the decision process",
  "DIS.URGENCY": "Real timing drivers",
  "DIS.QUALIFY": "Qualifying",
  "DIS.BLACKSWAN": "Finding hidden information",
  "INF.VALUE": "Value in their terms",
  "INF.FRAME": "Framing",
  "INF.STORY": "Storytelling",
  "INF.OWNERSHIP": "Letting the idea be theirs",
  "INF.MOTIVES": "Appealing to their values",
  "INF.PROOF": "Evidence & proof",
  "INF.RECOMMEND": "Making a clear recommendation",
  "OBJ.ACKNOWLEDGE": "Acknowledging resistance",
  "OBJ.NOARGUE": "Disagreeing without arguing",
  "OBJ.PRICE": "Price objections",
  "OBJ.STALL": "Stalls (“I'll think about it”)",
  "OBJ.TRUST": "Trust objections",
  "OBJ.INCUMBENT": "Competitor objections",
  "OBJ.FAIR": "Handling “that's not fair”",
  "NEG.ANCHOR": "Anchoring",
  "NEG.REFUSE": "Saying no gracefully",
  "NEG.CONCEDE": "Concession discipline",
  "NEG.NONCASH": "Non-monetary terms",
  "NEG.PUNCH": "Withstanding pressure",
  "CLO.CHECK": "Checking readiness",
  "CLO.ASK": "Asking for commitment",
  "CLO.EXECUTE": "Locking in next steps",
  "CLO.FOLLOWUP": "Follow-up",
  "DIF.ANGER": "Angry customers",
  "DIF.BADNEWS": "Delivering bad news",
  "DIF.BOUNDARY": "Holding boundaries",
  "DIF.FEEDBACK": "Giving feedback",
  "DIF.OWNERROR": "Owning mistakes",
};

export const skillLabel = (id: string | null | undefined) => (id ? SKILL_LABELS[id] ?? id : "");

export function scoreTone(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-slate-400";
  if (score >= 81) return "text-emerald-600";
  if (score >= 61) return "text-sky-600";
  if (score >= 41) return "text-amber-600";
  return "text-rose-600";
}

export function barTone(score: number | null | undefined): string {
  if (score === null || score === undefined) return "bg-slate-200";
  if (score >= 81) return "bg-emerald-500";
  if (score >= 61) return "bg-sky-500";
  if (score >= 41) return "bg-amber-500";
  return "bg-rose-500";
}
