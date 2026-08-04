/**
 * State Rules - Data-Driven State Machine
 * Rules define valid transitions, not code.
 * Much easier to extend without touching engine logic.
 */

export type ApplicationState =
  | "applied"
  | "assessment"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export interface StateTransitionRule {
  from: ApplicationState;
  to: ApplicationState;
  signalKeywords?: string[];
  confidence?: number;
}

export interface StateRule {
  documentType: string;
  suggestedState: ApplicationState;
  confidence: number;
  reasoning: string;
}

/**
 * Rules that map document types to application state
 */
export const DOCUMENT_TO_STATE_RULES: StateRule[] = [
  {
    documentType: "application_confirmation",
    suggestedState: "applied",
    confidence: 0.99,
    reasoning: "Explicit confirmation of application",
  },
  {
    documentType: "assessment",
    suggestedState: "assessment",
    confidence: 0.95,
    reasoning: "Assessment/coding test request",
  },
  {
    documentType: "interview_scheduling",
    suggestedState: "interview",
    confidence: 0.98,
    reasoning: "Interview scheduled",
  },
  {
    documentType: "interview_reminder",
    suggestedState: "interview",
    confidence: 0.97,
    reasoning: "Interview reminder confirms scheduled",
  },
  {
    documentType: "offer",
    suggestedState: "offer",
    confidence: 0.99,
    reasoning: "Job offer received",
  },
  {
    documentType: "rejection",
    suggestedState: "rejected",
    confidence: 0.99,
    reasoning: "Explicit rejection",
  },
  {
    documentType: "recruiter_message",
    suggestedState: "applied",
    confidence: 0.6,
    reasoning: "Recruiter outreach, likely applied",
  },
  {
    documentType: "job_recommendation",
    suggestedState: "applied",
    confidence: 0.5,
    reasoning: "Job recommendation, state unclear",
  },
  {
    documentType: "status_update",
    suggestedState: "interview",
    confidence: 0.7,
    reasoning: "Status update likely means progressed",
  },
];

/**
 * Valid state transitions
 * If transition not in list, it's invalid
 */
export const VALID_TRANSITIONS: StateTransitionRule[] = [
  // Applied can go to assessment or interview
  { from: "applied", to: "assessment" },
  { from: "applied", to: "interview" },
  { from: "applied", to: "offer" },
  { from: "applied", to: "rejected" },
  { from: "applied", to: "withdrawn" },

  // Assessment can go to interview, offer, or rejection
  { from: "assessment", to: "interview" },
  { from: "assessment", to: "offer" },
  { from: "assessment", to: "rejected" },
  { from: "assessment", to: "withdrawn" },

  // Interview can go to offer, rejection, or another interview
  { from: "interview", to: "interview" },
  { from: "interview", to: "offer" },
  { from: "interview", to: "rejected" },
  { from: "interview", to: "withdrawn" },

  // Offer can be accepted (withdrawn = no) or rejected
  { from: "offer", to: "rejected" },
  { from: "offer", to: "withdrawn" },

  // Rejected is terminal
  // Withdrawn is terminal
];

export function isValidTransition(from: ApplicationState, to: ApplicationState): boolean {
  return VALID_TRANSITIONS.some((rule) => rule.from === from && rule.to === to);
}

export function getStateRule(documentType: string): StateRule | undefined {
  return DOCUMENT_TO_STATE_RULES.find((rule) => rule.documentType === documentType);
}

export function getSuggestedState(documentType: string): ApplicationState {
  const rule = getStateRule(documentType);
  return rule?.suggestedState || "applied";
}
