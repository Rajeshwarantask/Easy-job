import type { Stage, StageOutput, ApplicationState as ApplicationStateOutput } from "../pipeline";
import {
  isValidTransition,
  getSuggestedState,
  DOCUMENT_TO_STATE_RULES,
} from "../state-rules";

export interface StateEngineInput {
  documentType: string;
  previousState?: string;
  previousStateHistory?: Array<{ state: string; date: Date }>;
}

/**
 * State Engine V2 - Data-Driven
 * Rules are in state-rules.ts (data)
 * Engine just executes rules (code)
 * Much cleaner separation.
 */
export class StateEngineStage implements Stage<StateEngineInput, ApplicationStateOutput> {
  name = "state-engine";

  async run(input: StateEngineInput): Promise<StageOutput<ApplicationStateOutput>> {
    const start = Date.now();
    const warnings: string[] = [];

    try {
      const suggestedState = getSuggestedState(input.documentType);
      const stateRule = DOCUMENT_TO_STATE_RULES.find(
        (r) => r.suggestedState === suggestedState
      );

      // Build state history
      const stateHistory = input.previousStateHistory
        ? [...input.previousStateHistory]
        : [];

      // Check if transition is valid
      let isValidTransitionFlag = true;
      let confidence = stateRule?.confidence || 0.8;

      if (input.previousState && input.previousState !== suggestedState) {
        isValidTransitionFlag = isValidTransition(
          input.previousState as any,
          suggestedState as any
        );

        if (!isValidTransitionFlag) {
          warnings.push(
            `Invalid transition: ${input.previousState} -> ${suggestedState}`
          );
          confidence *= 0.6; // Reduce confidence for invalid transitions
        }

        stateHistory.push({
          state: suggestedState,
          date: new Date(),
        });
      }

      const output: ApplicationStateOutput = {
        currentState: suggestedState as any,
        stateHistory,
        isValidTransition: isValidTransitionFlag,
        confidence,
      };

      return {
        data: output,
        confidence: stateRule?.confidence || 0.8,
        reason: stateRule?.reasoning || "Document type mapped to state",
        source: "state-engine",
        warnings,
        processingTimeMs: Date.now() - start,
      };
    } catch (error) {
      return {
        data: {
          currentState: "applied" as any,
          stateHistory: [],
          isValidTransition: false,
          confidence: 0,
        },
        confidence: 0,
        reason: `Error computing state: ${error}`,
        source: "state-engine",
        warnings: ["State computation failed"],
        processingTimeMs: Date.now() - start,
      };
    }
  }
}
