const PLACEHOLDERS = /^(?:unknown|n\/a|na|none|null|undefined|untitled(?: role| job)?|company|employer|the company|your company|job|position|role|opportunity|opening)$/i;
const ATS_DOMAINS = /(?:indeed|linkedin|greenhouse|lever|workday|ashby|smartrecruiters|icims|jobvite|oracle|successfactors|mail|noreply)/i;

export function normalizeExtractedValue(value?: string | null): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").replace(/[|•]+/g, " ").trim();
  if (!normalized || PLACEHOLDERS.test(normalized)) return undefined;
  return normalized.replace(/^[:\-–—]+|[:\-–—]+$/g, "").trim() || undefined;
}

function senderName(from: string): string | undefined {
  const name = from.match(/^\s*["']?([^<"']+?)["']?\s*</)?.[1];
  return normalizeExtractedValue(name);
}

function senderEmail(from: string): string | undefined {
  return from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
}

function senderDomain(from: string): string | undefined {
  return senderEmail(from)?.split("@")[1];
}

function titleFromSubject(subject: string): string | undefined {
  const cleaned = subject
    .replace(/^(?:re|fw|fwd):\s*/gi, "")
    .replace(/\b(?:application|interview|assessment|offer|rejection|update|status)\b/gi, "")
    .replace(/\b(?:your|the)\b/gi, "")
    .replace(/\b(?:unfortunately|an update|update)\b/gi, "")
    .replace(/[|:[\](){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalizeExtractedValue(cleaned);
}

function companyFromDomain(domain?: string): string | undefined {
  if (!domain || ATS_DOMAINS.test(domain)) return undefined;
  const label = domain.split(".")[0].replace(/[-_]+/g, " ");
  return normalizeExtractedValue(label.replace(/\b\w/g, (c) => c.toUpperCase()));
}

export interface DeterministicFallbacks {
  company?: string;
  role?: string;
  jobUrl?: string;
  careerPortalUrl?: string;
  source?: string;
}

export function extractDeterministicFallbacks(from: string, subject: string, body: string): DeterministicFallbacks {
  const text = `${subject}\n${body}`;
  const domain = senderDomain(from);
  const links = [...text.matchAll(/https?:\/\/[^\s<>"')]+/gi)].map((match) => match[0].replace(/[.,;]+$/, ""));
  const atsLink = links.find((link) => /(?:job|career|careers|apply|requisition|greenhouse|lever|workday|ashby|smartrecruiters|icims|jobvite)/i.test(link));

  const labeledRole = text.match(/(?:job title|position|role|job|opening)\s*[:\-]?\s*([^\n|,]{4,100}?)(?=\s+(?:at|with|for|was|is|has)\b|[.,\n|]|$)/i)?.[1];
  const labeledCompany = text.match(/(?:company|employer|organization)\s*[:\-]\s*([^\n|,]{2,80})/i)?.[1];
  const atCompany = text.match(/\b(?:at|with|from)\s+([A-Z][A-Za-z0-9&.'-]{1,50}(?:\s+[A-Z][A-Za-z0-9&.'-]{1,50}){0,4}?)(?=\s+(?:was|is|has|for|on|and|received|position|role)\b|[.,\n]|$)/i)?.[1];
  const forRole = text.match(/\bfor\s+(?:the\s+)?(?:position|role|job)?\s*(?:of\s+)?([A-Z][^\n,|.]{3,80})/i)?.[1];

  const company = normalizeExtractedValue(labeledCompany) || senderName(from) || companyFromDomain(domain) || normalizeExtractedValue(atCompany);
  const cleanRole = (value?: string) => {
    if (!value || /^\s*at\s+/i.test(value)) return undefined;
    return normalizeExtractedValue(value.split(/\s+at\s+/i)[0].replace(/\s+(?:role|position|job|opening)$/i, ""));
  };
  const role = cleanRole(labeledRole) || cleanRole(forRole) || titleFromSubject(subject);

  return {
    company,
    role,
    jobUrl: atsLink || links.find((link) => /linkedin|indeed/i.test(link)),
    careerPortalUrl: atsLink,
    source: company ? "deterministic-fallback" : undefined,
  };
}

export type RecruitmentEventType = "applied" | "assessment" | "interview" | "offer" | "rejection" | "update";

export function classifyRecruitmentEvent(subject: string, from: string, body: string): { type: RecruitmentEventType; confidence: number } {
  const text = `${subject}\n${from}\n${body}`;
  const negative = /(?:not selected|not moving forward|move forward with other|regret to inform|unfortunately|withdrawn|withdrawal|application closed|position has been filled)/i;
  if (/(?:withdrawn|withdrawal|application closed)/i.test(text)) return { type: "rejection", confidence: 0.95 };
  if (negative.test(text)) return { type: "rejection", confidence: 0.92 };
  if (/(?:offer|congratulations|pleased to offer|compensation package|offer letter)/i.test(text)) return { type: "offer", confidence: 0.94 };
  if (/(?:interview|phone screen|video call|onsite|hiring manager|schedule.*call|meet with)/i.test(text)) return { type: "interview", confidence: 0.9 };
  if (/(?:assessment|coding challenge|technical test|questionnaire|take-home|hackerrank|codility)/i.test(text)) return { type: "assessment", confidence: 0.9 };
  if (/(?:application received|received your application|thank you for applying|application submitted|applied for)/i.test(text)) return { type: "applied", confidence: 0.86 };
  return { type: "update", confidence: 0.35 };
}

export function extractExplicitDate(text: string): Date | undefined {
  const match = text.match(/(?:on|for|date(?:\s+of)?|scheduled(?:\s+for)?)\s*[:\-]?\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+\w+\s+\d{1,2}(?:,\s*\d{4})?|\w+\s+\d{1,2},?\s+\d{4})/i);
  if (!match) return undefined;
  const date = new Date(match[1]);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function isRecruitmentLike(subject: string, from: string, body: string): boolean {
  return /(?:application|applied|candidate|interview|assessment|offer|recruit|hiring|position|opportunity|job|role|shortlist|selected|rejected|unfortunately|moving forward|careers|talent|thank you for your interest)/i.test(`${subject} ${from} ${body}`);
}

export function dedupeByGmailMessageId<T extends { id: string }>(messages: T[]): { messages: T[]; deduplicated: number } {
  const seen = new Set<string>();
  const unique = messages.filter((message) => {
    if (!message.id || seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
  return { messages: unique, deduplicated: messages.length - unique.length };
}
