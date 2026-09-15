import { decodeMimePayload, type GmailMessagePart } from "./mime-decoder";
import { cleanHtml, extractAllLinks, extractBodyText } from "./html-cleaner";
import { classifyDocument } from "./document-classifier";
import { detectPlatform } from "./platform-detector";
import { processSingleEmail } from "./sync-orchestrator";
import type { MappingContext } from "./application-mapper";
import type { ParseResult } from "./types";

type RawGmailMessage = { id: string; threadId: string; payload?: GmailMessagePart; snippet?: string; internalDate?: string };

export type ValidationFinding = "correct" | "safely_unknown" | "role_contamination" | "company_contamination" | "person_name_contamination" | "technology_contamination" | "CTA/footer_contamination" | "HTML_artifact_contamination" | "sender/domain_ambiguity" | "date_failure" | "email_type_classification_failure" | "other";

export interface ValidationRecord {
  input: {
    messageId: string;
    threadId: string;
    subject: string;
    sender: string;
    date?: string;
    platform: string;
    documentType: string;
    bodyText: string;
    plaintext: string;
    html: string;
    structuredText: string;
    links: string[];
    headers: Array<{ name?: string; value?: string }>;
    mime: { rootMimeType?: string | null; partCount: number; attachments: Array<{ filename: string; mimeType: string; size: number }> };
    blockCount: number;
    htmlPresent: boolean;
  };
  output: { success: boolean; role?: string; company?: string; location?: string; status?: string; eventDate?: string; timelineEvents?: unknown[]; confidence?: number; provenance?: unknown; processingSteps?: unknown[]; error?: string };
  findings: ValidationFinding[];
}

function findingsFor(application: ParseResult["application"]): ValidationFinding[] {
  if (!application) return ["safely_unknown"];
  const findings: ValidationFinding[] = [];
  const values = [application.company, application.role, application.location].filter(Boolean).join(" ");
  if (!application.company && !application.role) findings.push("safely_unknown");
  if (/\b(?:apply|view job|learn more|unsubscribe|privacy policy)\b/i.test(values)) findings.push("CTA/footer_contamination");
  if (/<|>|&(?:nbsp|amp);|https?:\/\//i.test(values)) findings.push("HTML_artifact_contamination");
  if (/\b(?:react|typescript|javascript|html|css|python|java|sql)\b/i.test(application.role || "")) findings.push("technology_contamination");
  if (/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(application.role || "")) findings.push("person_name_contamination");
  if (!findings.length) findings.push(application.company || application.role ? "correct" : "safely_unknown");
  return findings;
}

function summarizeMime(part: GmailMessagePart | undefined) {
  let partCount = 0;
  const attachments: Array<{ filename: string; mimeType: string; size: number }> = [];
  const visit = (current?: GmailMessagePart) => {
    if (!current) return;
    partCount += 1;
    if (current.filename) attachments.push({ filename: current.filename, mimeType: current.mimeType || "application/octet-stream", size: current.body?.size || 0 });
    current.parts?.forEach(visit);
  };
  visit(part);
  return { rootMimeType: part?.mimeType, partCount, attachments };
}

export async function validateRawGmailCorpus(messages: RawGmailMessage[], mappingContext: MappingContext): Promise<ValidationRecord[]> {
  const records: ValidationRecord[] = [];
  for (const message of messages) {
    const decoded = decodeMimePayload(message.payload, message.id, message.threadId);
    const cleaned = cleanHtml(decoded.body.html);
    const bodyText = [cleaned.structuredText, extractBodyText(decoded.body.plaintext, decoded.body.html)].filter(Boolean).join("\n\n");
    const links = extractAllLinks(bodyText, decoded.body.html);
    const document = classifyDocument(decoded.headers.subject, decoded.headers.from, bodyText, decoded.headers);
    const platform = detectPlatform(decoded.headers.from, decoded.headers.subject, bodyText);
    let result: ParseResult;
    try { result = await processSingleEmail(message, mappingContext, { skipFiltering: true }); } catch (error) { result = { success: false, error: error instanceof Error ? error.message : String(error), errorType: "parse" }; }
    const app = result.application;
    const date = app?.timelineEvents?.find((event) => event.date)?.date || app?.originalEmail.date;
    records.push({
      input: { messageId: message.id, threadId: message.threadId, subject: decoded.headers.subject, sender: decoded.headers.from, date: message.internalDate, platform: platform.platform || "unknown", documentType: document.type || "unknown", bodyText, plaintext: decoded.body.plaintext, html: decoded.body.html, structuredText: cleaned.structuredText, links: links.map((link) => link.url), headers: message.payload?.headers || [], mime: summarizeMime(message.payload), blockCount: cleaned.blocks.length, htmlPresent: Boolean(decoded.body.html) },
      output: { success: result.success, role: app?.role, company: app?.company, location: app?.location, status: app?.eventType, eventDate: date instanceof Date ? date.toISOString() : undefined, timelineEvents: app?.timelineEvents, confidence: app?.parserConfidence, provenance: (app as any)?.candidateEvidence, processingSteps: result.processingSteps, error: result.error },
      findings: findingsFor(app),
    });
  }
  return records;
}

export function summarizeValidation(records: ValidationRecord[]) {
  const counts = records.flatMap((record) => record.findings).reduce<Record<string, number>>((acc, finding) => { acc[finding] = (acc[finding] || 0) + 1; return acc; }, {});
  return { evaluated: records.length, counts, measurablePrecision: "Unavailable without human ground-truth labels", note: "This harness reports candidates and heuristic contamination signals. It does not invent expected answers or claim accuracy." };
}
