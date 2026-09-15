import nlp from "compromise";
import { isValidCompanyCandidate, isValidRoleCandidate, normalizeExtractedValue } from "./deterministic-fallbacks.ts";

export type CandidateField = "company" | "role" | "location" | "person";
export type CandidateSource = "subject" | "heading" | "table" | "paragraph" | "link" | "sender" | "platform-template" | "pattern" | "semantic-nlp" | "contextual" | "generic";
export type SemanticEntity = "JOB_TITLE" | "COMPANY" | "LOCATION" | "PERSON" | "ORGANIZATION" | "TECHNOLOGY";

export type EvidenceType = "SUBJECT" | "BODY_RELATIONSHIP" | "STRUCTURAL_HTML" | "SENDER" | "DOMAIN" | "LINK" | "SEMANTIC" | "KEYWORD_CONTEXT" | "GRAMMATICAL_RELATION" | "POSITIONAL" | "REPETITION" | "THREAD_CONTEXT" | "TIMELINE_CONTEXT" | "NEGATIVE" | "SECONDARY_CONTENT";

export interface Evidence {
  type: EvidenceType;
  signal: string;
  strength: number;
  reliability: number;
  source: string;
  location?: string;
  polarity: "support" | "contradict";
  independentGroup: string;
}

export interface ExtractionSignals {
  applicationIds: string[];
  urls: string[];
  workModes: string[];
  compensation: string[];
  dateContext: string[];
}

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
  evidenceItems?: Evidence[];
  independentGroups?: string[];
  rejected?: boolean;
}

const PLATFORM_NAMES = /^(?:linkedin|indeed|gmail|kekamail|ziprecruiter|eightfold|workday|greenhouse|lever|smartrecruiters|pinpoint|joveo|oracle|successfactors)$/i;
const CTA = /\b(?:view job|apply(?: now| with resume)?|view profile|learn more|click here)\b/i;
const FOOTER = /\b(?:unsubscribe|privacy policy|manage preferences|terms|view in browser)\b/i;
const SENTENCE = /(?:\b(?:was sent to|will review your information|through our career portal|we have received|thank you for applying)\b|[.!?]$)/i;
const ROLE_WORDS = /\b(?:developer|engineer|designer|analyst|manager|intern|scientist|specialist|lead|architect|consultant|administrator|associate|director)\b/i;
const HTML_NOISE = /(?:<\/?(?:style|script|html|body|div|span|table|a)\b|\b(?:display|font-size|color|margin|padding)\s*:\s*[^;]+;|\{[^}]*\})/i;
const PERSON_LIKE = /^\p{Lu}[\p{Ll}]+(?:\s+\p{Lu}[\p{Ll}]+){1,3}$/u;
const SIGNATURE = /^(?:best|regards|thanks|thank you|sincerely|cheers|sent from|unsubscribe|privacy|view in browser)\b/i;
const GENERIC_COMPANY_NOISE = /^(?:the hiring team|hiring team|recruiting team|talent acquisition|human resources|careers?|company|employer|organization)$/i;
const LEGAL_SUFFIX = /,\s*(?:inc\.?|llc|ltd\.?|limited|corp\.?|corporation|plc)$/i;
const TECHNOLOGY_LIST = /^(?:[A-Za-z+#.]+,\s*){2,}[A-Za-z+#.]+$/;

function clean(value?: string) {
  return normalizeExtractedValue(value)?.replace(/^(?:company|employer|organization|location|role|position|job title)\s*:\s*/i, "").replace(/\s+(?:view job|apply with resume|apply now|learn more)\b.*$/i, "").replace(/\s*\|\s*(?:apply|view|learn more).*$/i, "").trim();
}

function evidenceFor(source: CandidateSource, pattern: string, signal: string, strength: number): Evidence {
  const subject = source === "subject";
  const semantic = source === "semantic-nlp";
  const sender = source === "sender";
  const type: EvidenceType = subject ? "SUBJECT" : semantic ? "SEMANTIC" : sender ? "SENDER" : source === "heading" || source === "table" ? "STRUCTURAL_HTML" : pattern.includes("relation") || pattern.includes("context") ? "BODY_RELATIONSHIP" : "KEYWORD_CONTEXT";
  const independentGroup = subject ? "document-subject" : semantic ? "semantic-model" : sender ? "message-header" : source === "heading" || source === "table" ? "document-structure" : "body-context";
  return { type, signal, strength, reliability: subject ? 0.95 : semantic ? 0.78 : sender ? 0.55 : 0.68, source, polarity: "support", independentGroup };
}

function add(list: CandidateEvidence[], field: CandidateField, value: string | undefined, source: CandidateSource, pattern: string, evidence: string, positiveScore: number, semanticType?: SemanticEntity) {
  const cleaned = clean(value)?.replace(/^(?:application(?: submitted| received)?|your application)\s+(?:to|from)\s+/i, "").replace(/\s+\.$/, "").trim();
  if (!cleaned) return;
  const negativeScore = (/(?:message was sent|delivery notice|your message)/i.test(evidence) && pattern === "sent-to-company" ? 1.2 : 0) + (PLATFORM_NAMES.test(cleaned) ? 0.95 : 0) + (CTA.test(cleaned) ? 0.95 : 0) + (FOOTER.test(cleaned) ? 0.95 : 0) + (SENTENCE.test(cleaned) ? 0.75 : 0) + (HTML_NOISE.test(cleaned) ? 1.2 : 0) + (TECHNOLOGY_LIST.test(cleaned) && field !== "role" ? 1.2 : 0) + (SIGNATURE.test(cleaned) ? 1.0 : 0) + (PERSON_LIKE.test(cleaned) && !ROLE_WORDS.test(cleaned) && field !== "person" && field !== "company" && field !== "location" ? 0.9 : 0) + (GENERIC_COMPANY_NOISE.test(cleaned) && field === "company" ? 1.0 : 0) + (field === "role" && !ROLE_WORDS.test(cleaned) && cleaned.split(/\s+/).length > 5 ? 0.45 : 0);
  const valid = !HTML_NOISE.test(cleaned) && !SIGNATURE.test(cleaned) && (field === "company" ? isValidCompanyCandidate(cleaned) : field === "role" ? isValidRoleCandidate(cleaned) : field === "location" ? cleaned.length <= 70 && !FOOTER.test(cleaned) : cleaned.length <= 70 && !FOOTER.test(cleaned));
  const item = evidenceFor(source, pattern, evidence, positiveScore);
  const confidence = Math.max(0, Math.min(0.98, positiveScore - negativeScore));
  list.push({ field, value: cleaned, source, pattern, evidence, positiveScore, negativeScore, confidence, semanticType, evidenceItems: [item], independentGroups: [item.independentGroup], rejected: !valid || negativeScore >= positiveScore });
}

export function extractContextSignals(subject: string, body: string): ExtractionSignals {
  const text = `${subject}\n${body}`;
  const urls = [...text.matchAll(/https?:\/\/[^\s<>"')]+/gi)].map((match) => match[0].replace(/[.,;:]+$/, "")).filter((url) => !/unsubscribe|privacy|manage-preferences|tracking|pixel/i.test(url));
  const applicationIds = [...text.matchAll(/\b(?:application|requisition|candidate|job|reference|req(?:uisition)?)\s*(?:id|number|no\.?|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})\b/gi)].map((match) => match[1]);
  const workModes = [...text.matchAll(/\b(remote|hybrid|on[- ]?site|onsite|work from home|in office)\b/gi)].map((match) => match[1].toLowerCase());
  const compensation = [...text.matchAll(/(?:[$€£₹]\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|lpa|lakhs?)?(?:\s?[-–]\s?[$€£₹]?\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|lpa|lakhs?)?)?|\b\d[\d,]*(?:\.\d+)?\s?(?:k|lpa|lakhs?|per annum|annually)\b)/gi)].map((match) => match[0]);
  const dateContext = [...text.matchAll(/\b(?:interview|assessment|start|joining|application|response|decision|deadline|due)\w*[^\n.!?]{0,70}\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b[^\n.!?]{0,30}/gi)].map((match) => match[0].trim());
  return { applicationIds: [...new Set(applicationIds)], urls: [...new Set(urls)], workModes: [...new Set(workModes)], compensation: [...new Set(compensation)], dateContext: [...new Set(dateContext)] };
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
  const labeledLocation = /(?:location|based in|work location|office location|job location)\s*[:\-]?\s*([^\n|;,]+)/gi;
  for (const match of text.matchAll(labeledLocation)) add(candidates, "location", match[1], "pattern", "explicit-location", match[0], 0.86);
  const atCompany = /\b(?:at|with)\s+([A-Z][A-Za-z0-9&.' -]{2,80})(?=\s+(?:as|for|on)\b|[,.;\n]|$)/g;
  for (const match of text.matchAll(atCompany)) add(candidates, "company", match[1], "pattern", "company-relation", match[0], 0.78);
  const sentToCompany = /\b(?:sent|submitted|applied)\s+to\s+([A-Z][A-Za-z0-9&.' ,-]{2,90}?)(?=\.|\n|\s+(?:for|as|through)\b|$)/g;
  for (const match of text.matchAll(sentToCompany)) if (!/(?:message was sent|delivery notice|your message)/i.test(text)) add(candidates, "company", match[1], "pattern", "sent-to-company", match[0], 0.92);
  const adjacentCompany = /\b(?:role|position|job)\s*[:\-]?\s*[^\n]+\n\s*([A-Z][A-Za-z0-9&.' -]{2,90})/g;
  for (const match of text.matchAll(adjacentCompany)) if (!HTML_NOISE.test(match[0])) add(candidates, "company", match[1], "heading", "adjacent-company", match[0], 0.84);
  const explicitRole = /(?:job title|position applied|position|role|job|opening|vacancy|opportunity)\s*[:\-]\s*([^\n|;,]+)/gi;
  for (const match of text.matchAll(explicitRole)) add(candidates, "role", match[1], "pattern", "explicit-role", match[0], 0.9);
  const roleContext = /(?:interview|assessment|application|opportunity|opening)\s+(?:for|about|regarding)\s+(?:the\s+)?([^\n,.;]{3,90}?)(?=\s+(?:role|position|job|at|with)\b|[,.;\n]|$)/gi;
  for (const match of text.matchAll(roleContext)) add(candidates, "role", match[1], "pattern", "role-context", match[0], 0.78);
  const applicationRole = /(?:application|applying|applied)\s+(?:for|to)\s+(?:the\s+)?(.+?)(?=\s+(?:at|with|through)\b|[,.;\n]|$)/gi;
  for (const match of text.matchAll(applicationRole)) add(candidates, "role", match[1], "pattern", "application-role", match[0], 0.82);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    if (ROLE_WORDS.test(line) && line.length <= 100) add(candidates, "role", line, i === 0 ? "subject" : "heading", "role-shaped-line", line, i === 0 ? 0.84 : 0.78);
    if (next && ROLE_WORDS.test(line) && !ROLE_WORDS.test(next) && next.length <= 90) add(candidates, "company", next, "paragraph", "adjacent-role-company", `${line}\n${next}`, 0.86);
    if (next && /^(?:at|with)\s+/i.test(next) && ROLE_WORDS.test(line)) add(candidates, "company", next.replace(/^(?:at|with)\s+/i, ""), "paragraph", "role-at-company", `${line}\n${next}`, 0.9);
    const location = line.match(/\b(?:Bengaluru|Bangalore|Chennai|Hyderabad|Mumbai|Delhi|Pune|Kolkata|Gurugram|Noida|Ahmedabad|Jaipur|Kochi|Singapore|London|New York|San Francisco|Remote|Hybrid|On[- ]?site|Work from home)(?:\s+[A-Z][a-z]+)?\b/i);
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
    const grouped = new Map<string, CandidateEvidence>();
    for (const candidate of candidates.filter((item) => item.field === field && !item.rejected)) {
      const key = candidate.value.toLowerCase();
      const current = grouped.get(key);
      if (!current) grouped.set(key, { ...candidate });
      else {
        current.positiveScore = Math.min(1.2, current.positiveScore + candidate.positiveScore * 0.35);
        current.negativeScore += candidate.negativeScore * 0.25;
        current.confidence = Math.max(0, Math.min(0.98, current.positiveScore - current.negativeScore));
        current.evidenceItems = [...(current.evidenceItems || []), ...(candidate.evidenceItems || [])];
        current.independentGroups = [...new Set([...(current.independentGroups || []), ...(candidate.independentGroups || [])])];
      }
    }
    const ranked = [...grouped.values()].sort((a, b) => ((b.independentGroups || []).length - (a.independentGroups || []).length) || b.confidence - a.confidence || b.positiveScore - a.positiveScore);
    if (!ranked.length) continue;
    const [winner, runnerUp] = ranked;
    const margin = winner.confidence - (runnerUp?.confidence || 0);
    const enoughIndependentEvidence = (winner.independentGroups || []).length >= 2 || winner.confidence >= 0.84;
    if (enoughIndependentEvidence && (!runnerUp || winner.value.toLowerCase() === runnerUp.value.toLowerCase() || margin >= 0.08)) selected[field] = winner;
  }
  return selected;
}

export function resolveCandidates(subject: string, body: string, sender?: string) {
  const candidates = extractCandidates(subject, body, sender);
  return { candidates, selected: selectCandidates(candidates) };
}
