import { PipelineContext, StageResult } from "./pipeline-context";

/**
 * Every stage implements this interface.
 * This ensures consistent behavior across the entire pipeline.
 * Each stage is independently testable with JSON input/output.
 */
export interface Stage {
  name: string;
  version: string;

  /**
   * Main execution function.
   * Takes context, modifies only its own section, returns result.
   * Must be deterministic (same input = same output).
   */
  execute(context: PipelineContext): Promise<StageResult<PipelineContext>>;

  /**
   * Optional: Validate that required inputs are present.
   * Called before execute() to fail fast.
   */
  validate?(context: PipelineContext): { valid: boolean; reason?: string };

  /**
   * Optional: Test this stage independently.
   * Accepts JSON, returns JSON, no side effects.
   */
  test?(input: Record<string, any>): Promise<StageResult<Record<string, any>>>;
}

/**
 * Base class for all stages.
 * Provides common utilities and error handling.
 */
export abstract class BaseStage implements Stage {
  abstract name: string;
  abstract version: string;

  protected log(context: PipelineContext, level: string, message: string) {
    context.logs.push({
      stage: this.name,
      level: level as "info" | "warn" | "error",
      message,
      timestamp: new Date(),
    });
  }

  protected createSuccessResult<T>(
    data: T,
    confidence: number = 1.0,
    warnings: string[] = [],
    processingTimeMs: number = 0,
    rulesApplied: string[] = []
  ): StageResult<T> {
    return {
      success: true,
      data,
      confidence,
      warnings,
      metrics: {
        processingTimeMs,
        rulesApplied,
      },
    };
  }

  protected createFailureResult<T>(
    reason: string,
    warnings: string[] = []
  ): StageResult<T> {
    return {
      success: false,
      data: null as any,
      confidence: 0,
      warnings: [reason, ...warnings],
      metrics: {
        processingTimeMs: 0,
        rulesApplied: [],
      },
    };
  }

  abstract execute(context: PipelineContext): Promise<StageResult<PipelineContext>>;
}
