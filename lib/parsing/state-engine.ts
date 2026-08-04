/**
 * Layer 8: State Engine
 * 
 * Don't store individual email events as application state.
 * Store the current state + the progression history.
 * 
 * Example:
 * 
 * WRONG:
 * Applied: Aug 1
 * Interview: Aug 5
 * Offer: Aug 10
 * 
 * RIGHT:
 * Current State: Offer
 * History: [Applied -> Interview -> Offer]
 * 
 * The state engine receives events and computes:
 * 1. Current state
 * 2. State history (progression)
 * 3. Days in current state
 * 4. Time between states
 */

export type ApplicationState =
  | "applied"
  | "assessment"
  | "interview"
  | "offer"
  | "rejected";

export interface StateTransition {
  fromState: ApplicationState;
  toState: ApplicationState;
  date: Date;
  daysInPreviousState: number;
}

export interface ApplicationStateInfo {
  currentState: ApplicationState;
  stateEnteredDate: Date;
  history: StateTransition[];
  isRejected: boolean;
  isOfferActive: boolean;
}

/**
 * Map event types to application states.
 */
function eventTypeToState(eventType: string): ApplicationState {
  const normalized = eventType.toLowerCase().trim();

  if (normalized.includes("offer")) return "offer";
  if (normalized.includes("reject")) return "rejected";
  if (normalized.includes("interview")) return "interview";
  if (normalized.includes("assessment") || normalized.includes("test"))
    return "assessment";
  return "applied";
}

/**
 * Compute application state based on event sequence.
 * Events should be sorted by date (oldest first).
 */
export function computeApplicationState(
  events: Array<{
    type: string;
    date: Date;
  }>
): ApplicationStateInfo {
  if (events.length === 0) {
    return {
      currentState: "applied",
      stateEnteredDate: new Date(),
      history: [],
      isRejected: false,
      isOfferActive: false,
    };
  }

  // Convert events to states
  const stateSequence = events.map((e) => ({
    state: eventTypeToState(e.type),
    date: e.date,
  }));

  // Remove duplicates (same state in sequence)
  const uniqueSequence = [stateSequence[0]];
  for (let i = 1; i < stateSequence.length; i++) {
    if (stateSequence[i].state !== uniqueSequence[uniqueSequence.length - 1].state) {
      uniqueSequence.push(stateSequence[i]);
    }
  }

  // Build history
  const history: StateTransition[] = [];
  for (let i = 1; i < uniqueSequence.length; i++) {
    const prev = uniqueSequence[i - 1];
    const curr = uniqueSequence[i];
    const daysInPrevious = Math.floor(
      (curr.date.getTime() - prev.date.getTime()) / (1000 * 60 * 60 * 24)
    );

    history.push({
      fromState: prev.state,
      toState: curr.state,
      date: curr.date,
      daysInPreviousState: daysInPrevious,
    });
  }

  const currentSequenceState = uniqueSequence[uniqueSequence.length - 1];
  const isRejected = currentSequenceState.state === "rejected";
  const isOfferActive = currentSequenceState.state === "offer";

  return {
    currentState: currentSequenceState.state,
    stateEnteredDate: currentSequenceState.date,
    history,
    isRejected,
    isOfferActive,
  };
}

/**
 * Check if a new event is valid given the current state.
 * 
 * Examples of invalid transitions:
 * - Offer -> Applied (can't go backwards)
 * - Rejected -> Interview (can't proceed after rejection)
 * - Offer -> Offer (duplicate)
 */
export function isValidStateTransition(
  currentState: ApplicationState,
  newEventType: string
): {
  valid: boolean;
  reasoning: string;
} {
  const newState = eventTypeToState(newEventType);

  // Can't go backwards
  const stateRank: Record<ApplicationState, number> = {
    applied: 1,
    assessment: 2,
    interview: 3,
    offer: 4,
    rejected: 5,
  };

  if (stateRank[newState] < stateRank[currentState]) {
    return {
      valid: false,
      reasoning: `Cannot transition from ${currentState} back to ${newState}`,
    };
  }

  // Can't proceed after rejection
  if (currentState === "rejected" && newState !== "rejected") {
    return {
      valid: false,
      reasoning: "Cannot proceed after rejection",
    };
  }

  // Duplicate state is ok but unusual
  if (currentState === newState) {
    return {
      valid: true,
      reasoning: "Same state again (likely duplicate email or update)",
    };
  }

  return {
    valid: true,
    reasoning: `Valid transition from ${currentState} to ${newState}`,
  };
}

/**
 * Estimate next likely state based on current state and days elapsed.
 */
export function estimateNextState(
  currentState: ApplicationState,
  daysSinceLastEvent: number
): {
  expectedState: ApplicationState | null;
  daysSinceExpected: number | null;
  reasoning: string;
} {
  // After different periods without contact, expect next state
  const expectations: Record<ApplicationState, { days: number; nextState: ApplicationState }> = {
    applied: { days: 14, nextState: "assessment" },
    assessment: { days: 7, nextState: "interview" },
    interview: { days: 10, nextState: "offer" },
    offer: { days: 30, nextState: "offer" }, // Offer usually closes
    rejected: { days: 0, nextState: "rejected" },
  };

  const exp = expectations[currentState];
  if (!exp) {
    return {
      expectedState: null,
      daysSinceExpected: null,
      reasoning: "No expectations for this state",
    };
  }

  if (daysSinceLastEvent > exp.days) {
    return {
      expectedState: exp.nextState,
      daysSinceExpected: daysSinceLastEvent - exp.days,
      reasoning: `Expected update to ${exp.nextState} after ${exp.days} days. It's been ${daysSinceLastEvent} days.`,
    };
  }

  return {
    expectedState: null,
    daysSinceExpected: null,
    reasoning: `On track. ${exp.days - daysSinceLastEvent} days until expected next state.`,
  };
}
