/**
 * Layer 3: Document Understanding
 * 
 * Determines the type of recruitment document without extracting data.
 * 
 * Questions answered:
 * - Is this an application confirmation?
 * - Is this an interview scheduling email?
 * - Is this a rejection?
 * - Is this an offer?
 * - Is this a recruiter message?
 * - Is this a marketing email we should ignore?
 * 
 * This layer runs BEFORE information extraction.
 * The document type drives which extractors run and how to interpret results.
 */

export type DocumentType =
  | "application_confirmation"
  | "application_received"
  | "assessment"
  | "interview_scheduling"
  | "interview_reminder"
  | "interview_feedback"
  | "offer"
  | "rejection"
  | "recruiter_message"
  | "job_recommendation"
  | "status_update"
  | "deadline_reminder"
  | "marketing"
  | "unknown";

export interface DocumentClassification {
  type: DocumentType;
  confidence: number;
  signals: string[];
  reasoning: string;
}

/**
 * Classify email type based on subject, headers, and body patterns.
 * No extraction. Pure classification.
 */
export function classifyDocument(
  subject: string,
  from: string,
  body: string,
  headers: Record<string, string>
): DocumentClassification {
  const signals: string[] = [];
  let confidence = 0;

  // Normalize inputs
  const subjectLower = subject.toLowerCase();
  const fromLower = from.toLowerCase();
  const bodyLower = body.toLowerCase();

  // Application confirmation signals
  if (
    subjectLower.includes("application") &&
    (subjectLower.includes("received") ||
      subjectLower.includes("submitted") ||
      subjectLower.includes("confirmed"))
  ) {
    signals.push("subject_has_application_received");
    confidence += 0.4;
  }
  if (
    bodyLower.includes("thank you for applying") ||
    bodyLower.includes("we received your application") ||
    bodyLower.includes("your application has been received")
  ) {
    signals.push("body_confirms_application_received");
    confidence += 0.35;
  }

  // Assessment/Test signals
  if (
    subjectLower.includes("assessment") ||
    subjectLower.includes("coding challenge") ||
    subjectLower.includes("technical test") ||
    subjectLower.includes("evaluation")
  ) {
    signals.push("subject_mentions_assessment");
    confidence += 0.4;
  }
  if (
    bodyLower.includes("complete the assessment") ||
    bodyLower.includes("take the test") ||
    bodyLower.includes("coding challenge")
  ) {
    signals.push("body_has_assessment_link");
    confidence += 0.35;
  }

  // Interview scheduling signals
  if (
    subjectLower.includes("interview") &&
    (subjectLower.includes("schedule") ||
      subjectLower.includes("time") ||
      subjectLower.includes("calendar"))
  ) {
    signals.push("subject_interview_scheduling");
    confidence += 0.45;
  }
  if (
    bodyLower.includes("available for") ||
    bodyLower.includes("schedule an interview") ||
    bodyLower.includes("interview slots")
  ) {
    signals.push("body_interview_availability");
    confidence += 0.35;
  }
  if (
    bodyLower.includes("zoom") ||
    bodyLower.includes("google meet") ||
    bodyLower.includes("teams meeting")
  ) {
    signals.push("body_has_meeting_link");
    confidence += 0.25;
  }

  // Interview reminder signals
  if (
    (subjectLower.includes("reminder") || subjectLower.includes("upcoming")) &&
    subjectLower.includes("interview")
  ) {
    signals.push("subject_interview_reminder");
    confidence += 0.4;
  }

  // Offer signals
  if (
    subjectLower.includes("offer") ||
    subjectLower.includes("we would like to offer")
  ) {
    signals.push("subject_has_offer");
    confidence += 0.5;
  }
  if (
    bodyLower.includes("pleased to offer") ||
    bodyLower.includes("we are happy to offer") ||
    bodyLower.includes("congratulations, we would like to offer")
  ) {
    signals.push("body_offer_language");
    confidence += 0.45;
  }

  // Rejection signals
  if (
    subjectLower.includes("reject") ||
    subjectLower.includes("unsuccessful") ||
    subjectLower.includes("not moving forward")
  ) {
    signals.push("subject_has_rejection");
    confidence += 0.45;
  }
  if (
    bodyLower.includes("we decided to move forward with") ||
    bodyLower.includes("your candidacy does not match") ||
    bodyLower.includes("we regret to inform you")
  ) {
    signals.push("body_rejection_language");
    confidence += 0.4;
  }

  // Recruiter message signals
  if (
    fromLower.includes("recruiter") ||
    fromLower.includes("recruiting") ||
    fromLower.includes("talent")
  ) {
    signals.push("from_has_recruiter_title");
    confidence += 0.2;
  }
  if (
    bodyLower.includes("interested in speaking with you") ||
    bodyLower.includes("great opportunity") ||
    bodyLower.includes("i came across your profile")
  ) {
    signals.push("body_recruiter_outreach");
    confidence += 0.3;
  }

  // Job recommendation signals
  if (
    subjectLower.includes("job recommendation") ||
    subjectLower.includes("recommended for you")
  ) {
    signals.push("subject_job_recommendation");
    confidence += 0.4;
  }

  // Status update signals
  if (
    subjectLower.includes("update") ||
    (subjectLower.includes("your") && subjectLower.includes("application"))
  ) {
    signals.push("subject_status_update");
    confidence += 0.2;
  }

  // Deadline reminder signals
  if (
    (subjectLower.includes("deadline") ||
      subjectLower.includes("expires") ||
      subjectLower.includes("closing")) &&
    (subjectLower.includes("soon") || subjectLower.includes("today"))
  ) {
    signals.push("subject_deadline_reminder");
    confidence += 0.35;
  }

  // Determine final type based on signals and confidence
  let type: DocumentType = "unknown";
  let finalConfidence = confidence;

  if (signals.some((s) => s.includes("offer"))) {
    type = "offer";
    finalConfidence = Math.min(0.95, confidence);
  } else if (signals.some((s) => s.includes("rejection"))) {
    type = "rejection";
    finalConfidence = Math.min(0.9, confidence);
  } else if (signals.some((s) => s.includes("interview_scheduling"))) {
    type = "interview_scheduling";
    finalConfidence = Math.min(0.85, confidence);
  } else if (signals.some((s) => s.includes("interview_reminder"))) {
    type = "interview_reminder";
    finalConfidence = Math.min(0.8, confidence);
  } else if (signals.some((s) => s.includes("assessment"))) {
    type = "assessment";
    finalConfidence = Math.min(0.8, confidence);
  } else if (signals.some((s) => s.includes("application_received"))) {
    type = "application_confirmation";
    finalConfidence = Math.min(0.85, confidence);
  } else if (signals.some((s) => s.includes("recruiter_outreach"))) {
    type = "recruiter_message";
    finalConfidence = Math.min(0.75, confidence);
  } else if (signals.some((s) => s.includes("job_recommendation"))) {
    type = "job_recommendation";
    finalConfidence = Math.min(0.8, confidence);
  } else if (signals.some((s) => s.includes("deadline_reminder"))) {
    type = "deadline_reminder";
    finalConfidence = Math.min(0.75, confidence);
  }

  return {
    type,
    confidence: Math.max(0, Math.min(1, finalConfidence)),
    signals,
    reasoning:
      signals.length > 0
        ? `Detected: ${signals.join(", ")}`
        : "No clear signals detected",
  };
}
