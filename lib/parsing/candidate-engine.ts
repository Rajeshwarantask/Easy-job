import nlp from "compromise";
import { isValidCompanyCandidate, isValidRoleCandidate, normalizeExtractedValue } from "./deterministic-fallbacks.ts";

export type CandidateField = "company" | "role" | "location" | "person";
export type CandidateSource = "subject" | "heading" | "table" | "paragraph" | "link" | "sender" | "platform-template" | "pattern" | "semantic-nlp" | "generic";
export type SemanticEntity = "JOB_TITLE" | "COMPANY" | "LOCATION" | "PERSON" | "ORGANIZATION" | "TECHNOLOGY";

export interface CandidateEvidence {
  field: CandidateField;
  value: string;
  source: CandidateSource;
  pattern: string;
  evidence: string;
  positiveScore: number;
  negativeScore: number;
  confidence: number;
  semanticType?: SemanticEntity;
  rejected?: boolean;
}

const PLATFORM_NAMES = /^(?:linkedin|indeed|gmail|kekamail|ziprecruiter|eightfold|workday|greenhouse|lever|smartrecruiters|pinpoint|joveo|oracle|successfactors)$/i;
const CTA = /\b(?:view job|apply(?: now| with resume)?|view profile|learn more|click here)\b/i;
const FOOTER = /\b(?:unsubscribe|privacy policy|manage preferences|terms|view in browser)\b/i;
const SENTENCE = /(?:\b(?:was sent to|will review your information|through our career portal|we have received|thank you for applying)\b|[.!?]$)/i;
const ROLE_WORDS = /\b(?:developer|engineer|designer|analyst|manager|intern|scientist|specialist|lead|architect|consultant|administrator|associate|director)\b/i;

function clean(value?: string) {
  return normalizeExtractedValue(value)?.replace(/\s+(?:view job|apply with resume|apply now|learn more)\b.*$/i, "").trim();
}

function add(list: CandidateEvidence[], field: CandidateField, value: string | undefined, source: CandidateSource, pattern: string, evidence: string, positiveScore: number, semanticType?: SemanticEntity) {
  const cleaned = clean(value)?.replace(/^(?:application(?: submitted| received)?|your application)\s+(?:to|from)\s+/i, "").replace(/\s+\.$/, "").trim();
  if (!cleaned) return;
  const negativeScore = (PLATFORM_NAMES.test(cleaned) ? 0.95 : 0) + (CTA.test(cleaned) ? 0.95 : 0) + (FOOTER.test(cleaned) ? 0.95 : 0) + (SENTENCE.test(cleaned) ? 0.75 : 0) + (/^\p{Lu}[\p{Ll}]+,\s+\p{Lu}/u.test(cleaned) ? 0.9 : 0) + (field === "role" && !ROLE_WORDS.test(cleaned) && cleaned.split(/\s+/).length > 5 ? 0.45 : 0);
  const valid = field === "company" ? isValidCompanyCandidate(cleaned) : field === "role" ? isValidRoleCandidate(cleaned) : cleaned.length <= 70 && !FOOTER.test(cleaned);
  list.push({ field, value: cleaned, source, pattern, evidence, positiveScore, negativeScore, confidence: Math.max(0, Math.min(0.98, positiveScore - negativeScore)), semanticType, rejected: !valid || negativeScore >= positiveScore });
}

function generateSemanticCandidates(text: string, candidates: CandidateEvidence[]) {
  const document = nlp(text);
  const entities: Array<{ field: CandidateField; type: SemanticEntity; values: string[]; score: number }> = [
    { field: "company", type: "ORGANIZATION", values: document.organizations().out("array") as string[], score: 0.72 },
    { field: "company", type: "COMPANY", values: document.match("#Organization").out("array") as string[], score: 0.68 },
    { field: "location", type: "LOCATION", values: document.places().out("array") as string[], score: 0.68 },
    { field: "role", type: "JOB_TITLE", values: document.nouns().out("array") as string[], score: 0.48 },
    { field: "person", type: "PERSON", values: document.people().out("array") as string[], score: 0.72 },
  ];
  for (const entity of entities) {
    for (const value of entity.values) {
      const normalized = normalizeExtractedValue(value)?.replace(/[,:;]+$/, "").trim();
      if (!normalized || normalized.length > 100) continue;
      if (entity.type === "PERSON") add(candidates, entity.field, normalized, "semantic-nlp", "compromise-person", normalized, entity.score, entity.type);
      else if (entity.field === "role" ? ROLE_WORDS.test(normalized) : true) add(candidates, entity.field, normalized, "semantic-nlp", `compromise-${entity.type.toLowerCase()}`, normalized, entity.score, entity.type);
    }
  }
}

export function extractCandidates(subject: string, body: string, sender?: string): CandidateEvidence[] {
  const candidates: CandidateEvidence[] = [];
  const text = `${subject}\n${body}`;
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const explicitCompany = /(?:company|employer|organization|hiring company)\s*[:\-]?\s*([^\n]+?)(?=\s+(?:for|as|on|and|through)\b|[\n]|$)/gi;
  for (const match of text.matchAll(explicitCompany)) add(candidates, "company", match[1], "pattern", "explicit-company", match[0], 0.88);
  const explicitRole = /(?:job title|position applied|position|role|job)\s*[:\-]\s*([^\n|;,]+)/gi;
  for (const match of text.matchAll(explicitRole)) add(candidates, "role", match[1], "pattern", "explicit-role", match[0], 0.9);
  const applicationRole = /(?:application|applying|applied)\s+(?:for|to)\s+(?:the\s+)?(.+?)(?=\s+(?:at|with|through)\b|[,.;\n]|$)/gi;
  for (const match of text.matchAll(applicationRole)) add(candidates, "role", match[1], "pattern", "application-role", match[0], 0.82);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    if (ROLE_WORDS.test(line) && line.length <= 100) add(candidates, "role", line, i === 0 ? "subject" : "heading", "role-shaped-line", line, i === 0 ? 0.84 : 0.78);
    if (next && ROLE_WORDS.test(line) && !ROLE_WORDS.test(next) && next.length <= 90) add(candidates, "company", next, "paragraph", "adjacent-role-company", `${line}\n${next}`, 0.86);
    if (next && /^(?:at|with)\s+/i.test(next) && ROLE_WORDS.test(line)) add(candidates, "company", next.replace(/^(?:at|with)\s+/i, ""), "paragraph", "role-at-company", `${line}\n${next}`, 0.9);
    const location = line.match(/\b(?:Bengaluru|Bangalore|Chennai|Hyderabad|Mumbai|Delhi|Pune|Kolkata|Gurugram|Noida|Remote|Hybrid|Onsite)(?:\s+[A-Z][a-z]+)?\b/);
    if (location) add(candidates, "location", location[0], "paragraph", "location-shaped-line", line, 0.72);
  }
  generateSemanticCandidates(text, candidates);
  const domain = sender?.match(/@([a-z0-9-]+)\./i)?.[1];
  if (domain && !PLATFORM_NAMES.test(domain)) add(candidates, "company", domain.replace(/[-_]+/g, " "), "sender", "sender-domain", sender || domain, 0.42);
  return candidates;
}

export function selectCandidates(candidates: CandidateEvidence[]) {
  const selected = {} as Partial<Record<CandidateField, CandidateEvidence>>;
  for (const field of ["company", "role", "location", "person"] as CandidateField[]) {
    const ranked = candidates.filter((candidate) => candidate.field === field && !candidate.rejected).sort((a, b) => b.confidence - a.confidence || b.positiveScore - a.positiveScore);
    if (ranked.length && (ranked.length === 1 || ranked[0].value.toLowerCase() === ranked[1].value.toLowerCase() || ranked[0].confidence - ranked[1].confidence >= 0.08)) selected[field] = ranked[0];
  }
  return selected;
}

export function resolveCandidates(subject: string, body: string, sender?: string) {
  const candidates = extractCandidates(subject, body, sender);
  return { candidates, selected: selectCandidates(candidates) };
}
