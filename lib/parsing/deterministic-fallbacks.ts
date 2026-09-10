const PLACEHOLDERS = /^(?:unknown|n\/a|na|none|null|undefined|untitled(?: role| job)?|company|employer|the company|your company|job|position|role|opportunity|opening)$/i;
const ATS_DOMAINS = /(?:indeed|linkedin|greenhouse|lever|workday|ashby|smartrecruiters|icims|jobvite|oracle|successfactors|mail|noreply)/i;
const GENERIC_COMPANY_NAMES = /^(?:careers?|career portal|hr|recruit(?:ing|ment)?|talent|people|jobs?|job alerts?|messages?|notifications?|noreply|no[- ]?reply|linkedin|indeed|eightfold|workday|greenhouse|lever|ashby|smartrecruiters|icims|jobvite|oracle|successfactors|hiring team|recruitment team|the team|company|employer)$/i;
const GENERIC_ROLE_TEXT = /^(?:more success|your update|update|view job|apply(?: with resume| now)?|emails?|notification emails?|your application(?:\s+to)?|application(?: received)?|status of your|remote role|job|position|role|opportunity|opening|applying to(?: the)?|with the|at linkedin)$/i;
const ACTION_ROLE_TEXT = /^(?:applying|apply|applied|applying to|your|the|with|at|for|to|from|on|received|submitted|notification|update|status)\b/i;

export function isValidCompanyCandidate(value?: string | null): boolean {
  const normalized = normalizeExtractedValue(value);
  return Boolean(normalized && normalized.length <= 80 && !GENERIC_COMPANY_NAMES.test(normalized) && !/[.!?]$/.test(normalized) && normalized.split(/\s+/).length <= 8 && !/\b(?:thank you|we have|your application|this email|please|would like|has been|was received|with the|applying to)\b/i.test(normalized));
}

export function isValidRoleCandidate(value?: string | null): boolean {
  const normalized = normalizeExtractedValue(value);
  return Boolean(normalized && normalized.length >= 3 && normalized.length <= 100 && !GENERIC_ROLE_TEXT.test(normalized) && !ACTION_ROLE_TEXT.test(normalized) && !/[.!?]$/.test(normalized) && normalized.split(/\s+/).length <= 9 && !/\b(?:view job|apply with resume|more success|your update|notification emails?|application received|thank you|we have)\b/i.test(normalized));
}

function cleanRoleCandidate(value?: string): string | undefined {
  const cleaned = normalizeExtractedValue(value
    ?.replace(/^at\s+/i, "")
    ?.replace(/\b(?:view job|apply with resume|view now|learn more)\b.*$/i, "")
    .replace(/\s+[-–—|]\s+\w{3,40}\s+(?:Bengaluru|Bangalore|Chennai|Hyderabad|Mumbai|Delhi|Pune|India|Remote).*$/i, "")
    .replace(/\s+(?:Bengaluru|Bangalore|Chennai|Hyderabad|Mumbai|Delhi|Pune|India|Remote)$/i, "")
    .replace(/\s+(?:role|position|job|opening)$/i, "")
    .replace(/^application\s+update\s*:?\s*/i, "")
    .replace(/\s+-\s+\d{3,}$/i, "")
    .replace(/\s+\(?(?:req|job|requisition|id)\s*[:#-]?\s*[A-Z0-9-]+\)?$/i, ""));
  return isValidRoleCandidate(cleaned) ? cleaned : undefined;
}

function cleanCompanyCandidate(value?: string): string | undefined {
  const normalized = normalizeExtractedValue(value);
  return isValidCompanyCandidate(normalized) ? normalized : undefined;
}

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
    .replace(/^\s*(?:,|on|for)\s+/i, "")
    .replace(/[|:[\](){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalizeExtractedValue(cleaned);
}

function companyFromDomain(domain?: string): string | undefined {
  if (!domain) return undefined;
  const host = domain.toLowerCase().replace(/^mail\./, "");
  const knownPlatform = /(?:^|\.)(?:indeed|linkedin|greenhouse|lever|workday|ashbyhq|smartrecruiters|icims|jobvite|oraclecloud|successfactors)\.(?:com|io|co|net)$/i.test(host);
  if (knownPlatform || /(?:noreply|notifications?|jobalerts?)/i.test(host.split(".")[0])) return undefined;
  const label = host.split(".")[0].replace(/[-_]+/g, " ");
  const company = normalizeExtractedValue(label.replace(/\b\w/g, (c) => c.toUpperCase()));
  return cleanCompanyCandidate(company);
}

export interface DeterministicFallbacks {
  company?: string;
  parentCompany?: string;
  role?: string;
  requisitionId?: string;
  location?: string;
  jobUrl?: string;
  careerPortalUrl?: string;
  source?: string;
  companySource?: string;
  roleSource?: string;
}

export function extractPlatformFields(from: string, subject: string, body: string): DeterministicFallbacks {
  const text = `${subject}\n${body}`;
  const requisitionId = text.match(/\b((?:R-?\d{5,}|RQ\d{5,}|\d{7,}))\b/i)?.[1];
  const isLinkedIn = /linkedin/i.test(from) || /linkedin/i.test(text);
  const isIndeed = /indeed/i.test(from) || /indeed/i.test(text);
  const links = [...text.matchAll(/https?:\/\/[^\s<>"')]+/gi)].map((match) => match[0].replace(/[.,;]+$/, ""));
  if (isLinkedIn) {
    const sourceLine = body.split(/\n+/).map((line) => line.replace(/\s+(?:view job|apply with resume)\b.*$/i, "").trim()).find((line) => /\s/.test(line)) || text.match(/(?:job alert|new job|job notification|successfully applied|view job)\s*[:|-]?\s*([^\n]+)/i)?.[1]?.replace(/\s+(?:view job|apply with resume)\b.*$/i, "") || text.match(/\b([A-Z][A-Za-z+.#/& -]{2,80})\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4})\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}|Remote)\b/i)?.[0] || text.match(/\b([A-Z][A-Za-z+.#/& -]{2,80})\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4})\s+(?:View job|Apply with resume)\b/i)?.[0];
    const match = sourceLine?.match(/^(.+\b(?:developer|engineer|designer|analyst|manager|intern|scientist|specialist|lead|architect))\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4})\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}|Remote|View job|Apply with resume)\b/i) || sourceLine?.match(/^(.+?)\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4})\s+(?:View job|Apply with resume)\b/i);
    if (match) return { role: cleanRoleCandidate(match[1]), company: cleanCompanyCandidate(match[2]), location: match[3] && !/^(?:View job|Apply with resume)$/i.test(match[3]) ? match[3] : undefined, jobUrl: links.find((link) => /linkedin\.com\/jobs/i.test(link)), source: "linkedin-template", roleSource: "linkedin-notification", companySource: "linkedin-notification" };
    const explicit = text.match(/(?:position|role|job title)\s*[:\-]\s*([^\n|]+)/i)?.[1];
    return { role: cleanRoleCandidate(explicit), jobUrl: links.find((link) => /linkedin\.com\/jobs/i.test(link)), source: "linkedin-template", roleSource: explicit ? "linkedin-body" : undefined };
  }
  if (isIndeed) {
    const role = text.match(/(?:job title|job|position|role)\s*[:\-]\s*([^\n|]+)/i)?.[1]
      || text.match(/(?:applying to|application for|applied for|your application for)\s+(?:the\s+)?(.+?)\s+role\s+at\b/i)?.[1]
      || subject.match(/(?:application|applied|your application)\s+(?:for|to)\s+(.+)/i)?.[1];
    const company = text.match(/(?:company|employer|hiring company)\s*[:\-]\s*([^\n|]+)/i)?.[1]
      || text.match(/\b(?:role|position|job)\s+at\s+([A-Z][A-Za-z0-9&.' -]{2,60})(?=\s+(?:was|is|has|for|as|in)\b|[.,\n]|$)/i)?.[1]
      || text.match(/(?:at|with)\s+([A-Z][A-Za-z0-9&.' -]{2,60})(?=\s+(?:for|as|in)\b|[.,\n]|$)/i)?.[1];
    return { role: cleanRoleCandidate(role), company: cleanCompanyCandidate(company), jobUrl: links.find((link) => /indeed\./i.test(link)), source: "indeed-template", roleSource: role ? "indeed-body-or-subject" : undefined, companySource: company ? "indeed-body" : undefined };
  }
  return { requisitionId };
}

export function extractDeterministicFallbacks(from: string, subject: string, body: string): DeterministicFallbacks {
  const text = `${subject}\n${body}`;
  const domain = senderDomain(from);
  const links = [...text.matchAll(/https?:\/\/[^\s<>"')]+/gi)].map((match) => match[0].replace(/[.,;]+$/, ""));
  const atsLink = links.find((link) => /(?:job|career|careers|apply|requisition|greenhouse|lever|workday|ashby|smartrecruiters|icims|jobvite)/i.test(link));

  const labeledRole = text.match(/(?:job title|position|role|job|opening)\s*[:\-]?\s*([^\n|,]{4,100}?)(?=\s+(?:at|with|for|was|is|has)\b|[.,\n|]|$)/i)?.[1]
    || text.match(/application\s+for\s+(?:the\s+)?(.+?)\s+role\s+at\b/i)?.[1]
    || text.match(/(?:application\s+(?:update|received)|application)\s*[:\-]?\s*(?:for\s+)?(.+?)(?=\s+was\s+received|\s+role\s+at\s+|\s+at\s+|$)/i)?.[1];
  const labeledCompany = text.match(/(?:company|employer|organization)\s*[:\-]\s*([^\n|,]{2,80})/i)?.[1];
  const atCompany = text.match(/\b(?:at|with|from)\s+([A-Z][A-Za-z0-9&.'-]{1,50}(?:\s+[A-Z][A-Za-z0-9&.'-]{1,50}){0,4}?)(?=\s+(?:was|is|has|for|on|and|received|position|role)\b|[.,\n]|$)/i)?.[1];
  const forRole = text.match(/\bfor\s+(?:the\s+)?(?:position|role|job)?\s*(?:of\s+)?([A-Z][^\n,|.]{3,80})/i)?.[1];

  const company = cleanCompanyCandidate(labeledCompany) || companyFromDomain(domain) || cleanCompanyCandidate(atCompany);
  const subjectRole = cleanRoleCandidate(titleFromSubject(subject));
  const explicitRole = cleanRoleCandidate(text.match(/application\s+for\s+(?:the\s+)?(.+?)\s+role\s+at\b/i)?.[1]) || cleanRoleCandidate(labeledRole) || cleanRoleCandidate(forRole);
  const applicationRole = cleanRoleCandidate(text.match(/application\s+update:\s*(.+?)(?=\s+was\s+received|\s+role\s+at\s+|\s+at\s+|$)/i)?.[1]);
  const role = explicitRole || applicationRole || (subjectRole && !/^(?:an on|an update|your application|application|status of your)$/i.test(subjectRole) ? subjectRole : undefined);

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
  const currentRejection = /(?:will not be (?:moving forward|pursuing)|decided not to (?:progress|move forward)|proceed with other candidates|move forward with other candidates|wasn['’]?t selected|did not select you|position (?:has been|is) filled|role is no longer available|application (?:has been )?rejected|not selected for (?:the )?(?:next|further) round)/i;
  const conditionalRejection = /(?:if you (?:do not|don't) receive|may not be selected|in the event that you do not|should you not be selected|candidates shortlisted based on)/i;
  if (/(?:withdrawn|withdrawal|application closed)/i.test(text)) return { type: "rejection", confidence: 0.98 };
  if (currentRejection.test(text) && !conditionalRejection.test(text)) return { type: "rejection", confidence: 0.98 };
  if (/(?:offer|pleased to offer|compensation package|offer letter)/i.test(text) && !/offer.*(?:information|update|not available)/i.test(text)) return { type: "offer", confidence: 0.96 };
  if (/(?:microsoft teams|zoom|google meet|meeting id|calendar event|schedule a discussion|next step in the selection process|interview scheduled|interview invitation)/i.test(text)) return { type: "interview", confidence: 0.97 };
  if (/(?:assessment date|assessment window|assessment duration|coding (?:test|assessment)|aptitude|hackerearth|hackerrank|codility|test center|assessment guidelines|eligible to take part)/i.test(text)) return { type: "assessment", confidence: 0.96 };
  if (/(?:shortlisted|selected for the next round|selected to proceed|eligible to (?:participate|continue|take part))/i.test(text)) return { type: "update", confidence: 0.9 };
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
