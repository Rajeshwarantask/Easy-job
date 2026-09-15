import { classifyRecruitmentEvent, normalizeExtractedValue, isValidCompanyCandidate, isValidRoleCandidate } from "./deterministic-fallbacks.ts";
import type { CandidateEvidence, CandidateField, CandidateSource } from "./candidate-engine.ts";

export interface ContextualFallbackInput {
  subject: string;
  body: string;
  sender?: string;
  headers?: Array<{ name?: string; value?: string }>;
  structuralBlocks?: Array<{ text: string; tag: string; noise?: number }>;
  existingCandidates?: CandidateEvidence[];
}

export interface ContextualFallbackResult {
  candidates: CandidateEvidence[];
  eventType?: string;
  eventConfidence: number;
  activated: boolean;
  reasons: string[];
}

const ROLE_WORDS = /\b(?:developer|engineer|designer|analyst|manager|intern|scientist|specialist|lead|architect|consultant|administrator|associate|director|researcher|recruiter|coordinator|tester|accountant)\b/i;
const LOCATION_WORDS = /\b(?:remote|hybrid|onsite|on-site|bengaluru|bangalore|chennai|hyderabad|mumbai|delhi|pune|kolkata|gurugram|noida|india|united states|new york|california)\b/i;
const ORG_WORDS = /\b(?:inc\.?|llc|ltd\.?|limited|corp\.?|corporation|technologies|solutions|systems|labs|health|group|company|university|institute)\b/i;
const NOISE = /\b(?:unsubscribe|privacy policy|view job|apply now|apply with resume|learn more|click here|manage preferences|do not reply|regards|best wishes|thank you for applying|your message|this email)\b/i;
const TECHNOLOGY_LIST = /^(?:[a-z][a-z0-9+#.\-]*)(?:\s*[,|/]\s*[a-z][a-z0-9+#.\-]*){2,}$/i;
const PERSON_LIKE = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/;

function clean(value?: string) {
  return normalizeExtractedValue(value)?.replace(/[,:;]+$/, "").trim();
}

function evidence(field: CandidateField, value: string, source: CandidateSource | "contextual", pattern: string, text: string, score: number, negativeScore = 0): CandidateEvidence {
  const cleaned = clean(value) || value.trim();
  const valid = field === "company" ? isValidCompanyCandidate(cleaned) : field === "role" ? isValidRoleCandidate(cleaned) : field === "location" ? cleaned.length <= 80 && !/[.!?]/.test(cleaned) : true;
  return {
    field,
    value: cleaned,
    source,
    pattern,
    evidence: text,
    positiveScore: score,
    negativeScore,
    confidence: Math.max(0, Math.min(0.98, score - negativeScore)),
    rejected: !valid || negativeScore >= score,
  };
}

function addRelationCandidates(input: ContextualFallbackInput, candidates: CandidateEvidence[]) {
  const text = `${input.subject}\n${input.body}`;
  const relationPatterns: Array<{ field: CandidateField; pattern: RegExp; name: string; score: number }> = [
    { field: "role", pattern: /(?:application|applying|applied|interview|position|role|job)\s+(?:for|to|as)\s+(?:the\s+)?([^\n,.]+?)(?=\s+(?:at|with|in)\b|[,.\n]|$)/gi, name: "role-context", score: 0.76 },
    { field: "company", pattern: /(?:application|position|role|job|interview)\s+(?:at|with)\s+([A-Z][^\n,.]+?)(?=\s+(?:for|as|in)\b|[,.\n]|$)/g, name: "company-context", score: 0.74 },
    { field: "company", pattern: /(?:application|message|email)\s+(?:from|received from)\s+([A-Z][^\n,.]+?)(?=[,.\n]|$)/gi, name: "company-sender-context", score: 0.7 },
    { field: "location", pattern: /(?:location|based|office|workplace|position)\s*[:\-]?\s*([^,.\n]{2,60})/gi, name: "location-context", score: 0.66 },
  ];
  for (const rule of relationPatterns) {
    for (const match of text.matchAll(rule.pattern)) {
      const value = clean(match[1]);
      if (!value) continue;
      const context = match[0];
      let negative = 0;
      if (NOISE.test(value) || TECHNOLOGY_LIST.test(value) || (rule.field === "company" && PERSON_LIKE.test(value))) negative += 0.9;
      if (rule.field === "role" && !ROLE_WORDS.test(value)) negative += 0.32;
      if (rule.field === "location" && !LOCATION_WORDS.test(value)) negative += 0.28;
      candidates.push(evidence(rule.field, value, "contextual", rule.name, context, rule.score, negative));
    }
  }
}

function addStructuredCandidates(input: ContextualFallbackInput, candidates: CandidateEvidence[]) {
  for (const block of input.structuralBlocks || []) {
    const value = clean(block.text);
    if (!value || (block.noise || 0) >= 0.8 || NOISE.test(value)) continue;
    if (ROLE_WORDS.test(value)) candidates.push(evidence("role", value, "contextual", `structure-${block.tag}`, value, block.tag === "heading" ? 0.76 : 0.58));
    if (ORG_WORDS.test(value) && !ROLE_WORDS.test(value)) candidates.push(evidence("company", value, "contextual", `structure-${block.tag}`, value, block.tag === "heading" ? 0.72 : 0.56));
    if (LOCATION_WORDS.test(value) && value.split(/\s+/).length <= 6) candidates.push(evidence("location", value, "contextual", `structure-${block.tag}`, value, 0.62));
  }
}

function addHeaderCandidates(input: ContextualFallbackInput, candidates: CandidateEvidence[]) {
  for (const header of input.headers || []) {
    const name = header.name?.toLowerCase() || "";
    const value = clean(header.value);
    if (!value) continue;
    if (/^x-(?:company|employer)|^company$/.test(name)) candidates.push(evidence("company", value, "contextual", "header-company", `${header.name}: ${header.value}`, 0.82));
    if (/^x-(?:job|role)|^job-title$|^position$/.test(name)) candidates.push(evidence("role", value, "contextual", "header-role", `${header.name}: ${header.value}`, 0.82));
  }
}

function addSemanticCandidates(input: ContextualFallbackInput, candidates: CandidateEvidence[]) {
  for (const candidate of input.existingCandidates || []) {
    if (candidate.source !== "semantic-nlp" || candidate.rejected || candidate.confidence < 0.45) continue;
    const value = clean(candidate.value);
    if (!value || NOISE.test(value) || TECHNOLOGY_LIST.test(value)) continue;
    const negative = PERSON_LIKE.test(value) && candidate.field === "company" ? 0.85 : 0;
    candidates.push(evidence(candidate.field, value, "contextual", `semantic-${candidate.semanticType || "entity"}`, candidate.evidence, candidate.confidence + 0.08, negative));
  }
}

function eventFallback(subject: string, body: string) {
  const text = `${subject}\n${body}`.toLowerCase();
  const rules: Array<{ type: string; pattern: RegExp; score: number }> = [
    { type: "INTERVIEW", pattern: /\b(?:interview|phone screen|technical round|schedule a call|meet with)\b/, score: 0.74 },
    { type: "OFFER", pattern: /\b(?:offer|pleased to offer|congratulations|welcome aboard)\b/, score: 0.8 },
    { type: "REJECTION", pattern: /\b(?:not moving forward|decided not to proceed|regret to inform)\b/, score: 0.72 },
    { type: "APPLICATION_RECEIVED", pattern: /\b(?:application received|thanks for applying|successfully applied|application submitted|application was received|your application .* was received)\b/, score: 0.7 },
  ];
  const matches = rules.filter((rule) => rule.pattern.test(text));
  if (matches.length !== 1) return { type: undefined, confidence: 0 };
  const selected = matches[0];
  if (selected.type === "REJECTION" && !/application|candidate|position|role|interview|hiring/i.test(text)) return { type: undefined, confidence: 0 };
  return { type: selected.type, confidence: selected.score };
}

export function runContextualFallback(input: ContextualFallbackInput, currentConfidence = 1): ContextualFallbackResult {
  const activated = currentConfidence < 0.6 || !(input.existingCandidates || []).some((candidate) => !candidate.rejected && candidate.confidence >= 0.6);
  if (!activated) return { candidates: [], eventConfidence: 0, activated: false, reasons: [] };
  const candidates: CandidateEvidence[] = [];
  addRelationCandidates(input, candidates);
  addStructuredCandidates(input, candidates);
  addHeaderCandidates(input, candidates);
  addSemanticCandidates(input, candidates);
  const event = eventFallback(input.subject, input.body);
  return { candidates, eventType: event.type, eventConfidence: event.confidence, activated: true, reasons: ["low-confidence extraction", "contextual multi-signal fallback"] };
}

export { classifyRecruitmentEvent };
