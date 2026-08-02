/**
 * Advanced Event Detection & Classification Module
 * 
 * Improves event type detection using multiple signals and scoring.
 * Returns event type with confidence based on comprehensive analysis.
 */

import type { TimelineEventType } from "./types";

export interface EventDetectionResult {
  eventType: TimelineEventType;
  confidence: number; // 0-1
  signals: string[]; // Which patterns matched
  reasoning: string; // Why this event type was chosen
}

/**
 * Comprehensive event detection that combines multiple signals.
 * Prioritizes signal strength and consistency.
 */
export function detectEventType(
  subject: string,
  body: string
): EventDetectionResult {
  const fullText = `${subject}\n${body}`;
  const lowerFullText = fullText.toLowerCase();
  const signals: string[] = [];
  
  // Score each event type
  const scores = {
    applied: scoreApplied(fullText, signals),
    assessment: scoreAssessment(fullText, signals),
    interview: scoreInterview(fullText, signals),
    offer: scoreOffer(fullText, signals),
    rejection: scoreRejection(fullText, signals),
    update: scoreUpdate(fullText, signals),
  };

  // Find the highest scoring event type
  let bestEventType: TimelineEventType = "update";
  let bestScore = scores.update;
  let reasoning = "No strong event indicators found";

  for (const [eventType, score] of Object.entries(scores) as [TimelineEventType, number][]) {
    if (score > bestScore) {
      bestScore = score;
      bestEventType = eventType;
    }
  }

  // Determine reasoning
  if (bestEventType === "applied") {
    reasoning = "Email confirms application was received and submitted";
  } else if (bestEventType === "assessment") {
    reasoning = "Email requests completion of assessment, test, or screening";
  } else if (bestEventType === "interview") {
    reasoning = "Email schedules or confirms upcoming interview";
  } else if (bestEventType === "offer") {
    reasoning = "Email extends job offer or makes hiring decision";
  } else if (bestEventType === "rejection") {
    reasoning = "Email indicates application was rejected or not selected";
  } else {
    reasoning = "Email contains status update but no clear event type";
  }

  return {
    eventType: bestEventType,
    confidence: Math.min(1, bestScore / 3), // Normalize to 0-1
    signals,
    reasoning,
  };
}

/**
 * Score likelihood of "applied" event type.
 */
function scoreApplied(fullText: string, signals: string[]): number {
  let score = 0;

  // Direct acknowledgments
  if (/(?:application|we).{0,10}(?:received|received your|got your)/i.test(fullText)) {
    score += 2;
    signals.push("received_acknowledgment");
  }

  if (/(?:thank.*for.*applying|thanks for applying|thank you for your application)/i.test(fullText)) {
    score += 1.5;
    signals.push("thank_you_pattern");
  }

  if (/(?:we|your).{0,10}(?:received|got).{0,10}application/i.test(fullText)) {
    score += 1.5;
    signals.push("application_received_explicit");
  }

  if (/application.*(?:submitted|confirmed|sent)/i.test(fullText)) {
    score += 1.5;
    signals.push("application_submitted");
  }

  // Next steps after application
  if (/next steps|what's next|here's what happens next/i.test(fullText)) {
    score += 0.5;
    signals.push("next_steps_mention");
  }

  // Reference to application ID or number
  if (/application\s+(?:id|#|number)/i.test(fullText)) {
    score += 0.3;
    signals.push("application_id_present");
  }

  return score;
}

/**
 * Score likelihood of "assessment" event type.
 */
function scoreAssessment(fullText: string, signals: string[]): number {
  let score = 0;

  // Assessment-specific keywords
  if (/(?:take|complete|pass).*(?:assessment|test|challenge|screening|evaluation)/i.test(fullText)) {
    score += 2;
    signals.push("take_assessment");
  }

  if (/coding.*challenge|technical.*test|online.*test|skills.*test/i.test(fullText)) {
    score += 1.5;
    signals.push("technical_test");
  }

  if (/questionnaire|survey|screening|initial screening/i.test(fullText)) {
    score += 1.5;
    signals.push("questionnaire");
  }

  // Links to assessment platforms
  if (/codility|hackerrank|codechef|testdome|triplebyte/i.test(fullText)) {
    score += 2;
    signals.push("assessment_platform_link");
  }

  if (/deadline|submit.*by|due.*by|expires/i.test(fullText)) {
    score += 0.5;
    signals.push("deadline_present");
  }

  return score;
}

/**
 * Score likelihood of "interview" event type.
 */
function scoreInterview(fullText: string, signals: string[]): number {
  let score = 0;

  // Interview scheduling
  if (/(?:schedule|scheduled).*interview/i.test(fullText)) {
    score += 2;
    signals.push("scheduled_interview");
  }

  if (/interview.*(?:confirmation|confirmed|scheduled)/i.test(fullText)) {
    score += 1.5;
    signals.push("interview_confirmed");
  }

  if (/(?:join|meeting).*link|zoom|google meet|teams|calendly/i.test(fullText)) {
    score += 1.5;
    signals.push("interview_link");
  }

  if (/(?:interview|call|meeting).*(?:on|at|scheduled\s+for).*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march)/i.test(fullText)) {
    score += 1.5;
    signals.push("interview_date_time");
  }

  if (/next.*round|interview.*round|stage/i.test(fullText)) {
    score += 0.8;
    signals.push("interview_round");
  }

  if (/interviewer|meet.*|speak with|call with/i.test(fullText)) {
    score += 0.5;
    signals.push("interviewer_mentioned");
  }

  // Multiple signals increase confidence
  if (signals.filter(s => s.startsWith("interview_")).length >= 2) {
    score += 0.5;
  }

  return score;
}

/**
 * Score likelihood of "offer" event type.
 */
function scoreOffer(fullText: string, signals: string[]): number {
  let score = 0;

  // Direct offer language
  if (/(?:offer|we|we're|we are).{0,10}(?:offering|pleased|excited|happy).*(?:you|position)/i.test(fullText)) {
    score += 2;
    signals.push("offer_language");
  }

  if (/job.*offer|offer.*letter|extended.*offer|offering.*position/i.test(fullText)) {
    score += 2;
    signals.push("explicit_offer");
  }

  if (/congratulations|congratulate/i.test(fullText)) {
    score += 1.5;
    signals.push("congratulations");
  }

  if (/salary|compensation|benefits|start.*date/i.test(fullText)) {
    score += 1;
    signals.push("compensation_details");
  }

  if (/accept.*offer|respond.*by|deadline|decision.*by/i.test(fullText)) {
    score += 1;
    signals.push("offer_acceptance");
  }

  // Phrases indicating acceptance needed
  if (/(?:let us|let me|please).{0,10}know.*(?:accept|decline|decision)/i.test(fullText)) {
    score += 0.8;
    signals.push("acceptance_request");
  }

  return score;
}

/**
 * Score likelihood of "rejection" event type.
 */
function scoreRejection(fullText: string, signals: string[]): number {
  let score = 0;

  // Direct rejection
  if (/(?:unfortunately|regret|sad to say|sorry).{0,10}(?:not|cannot|can't|won't)/i.test(fullText)) {
    score += 2;
    signals.push("rejection_apology");
  }

  if (/not.*(?:selected|chosen|moving|advancing|proceeding|right|fit)/i.test(fullText)) {
    score += 1.5;
    signals.push("not_selected");
  }

  if (/reject|rejection|declined/i.test(fullText)) {
    score += 1.5;
    signals.push("explicit_rejection");
  }

  if (/not moving forward|application.*closed|position.*filled/i.test(fullText)) {
    score += 1.5;
    signals.push("not_moving_forward");
  }

  if (/(?:we will|we'll).*notify.*candidates|not contact/i.test(fullText)) {
    score += 0.8;
    signals.push("mass_rejection");
  }

  return score;
}

/**
 * Score likelihood of generic "update" event type.
 * Used as fallback when no other type matches strongly.
 */
function scoreUpdate(fullText: string, signals: string[]): number {
  let score = 1; // Always has some baseline score

  // Updates about process
  if (/update.*application|application.*update|status.*update|application.*status/i.test(fullText)) {
    score += 1.5;
    signals.push("explicit_update");
  }

  // General communication
  if (/inform|notify|want.*tell|update/i.test(fullText)) {
    score += 0.5;
    signals.push("general_communication");
  }

  return score;
}

/**
 * Get detailed event type explanation for debugging.
 */
export function explainEventDetection(result: EventDetectionResult): string {
  const parts = [
    `Event Type: ${result.eventType}`,
    `Confidence: ${(result.confidence * 100).toFixed(1)}%`,
    `Reasoning: ${result.reasoning}`,
  ];

  if (result.signals.length > 0) {
    parts.push(`Signals: ${result.signals.join(", ")}`);
  }

  return parts.join("\n");
}
