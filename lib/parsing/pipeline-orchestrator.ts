import type { Stage, StageOutput } from "./pipeline";

/**
 * Pipeline Orchestrator
 * Composable pipeline where each stage only knows input/output
 * No stage knows the whole system.
 * Stages are run in sequence, outputs become next input.
 */

export interface PipelineConfig {
  stages: Stage<any, any>[];
}

export interface PipelineResult<T> {
  output: T;
  stageResults: Array<{
    stage: string;
    output: StageOutput<any>;
  }>;
  totalTimeMs: number;
  allWarnings: string[];
}

export class Pipeline<I, O> {
  private stages: Stage<any, any>[];

  constructor(config: PipelineConfig) {
    this.stages = config.stages;
  }

  async execute(input: I): Promise<PipelineResult<O>> {
    const startTime = Date.now();
    let currentInput = input;
    const stageResults: Array<{ stage: string; output: StageOutput<any> }> = [];
    const allWarnings: string[] = [];

    for (const stage of this.stages) {
      try {
        const stageOutput = await stage.run(currentInput);

        stageResults.push({
          stage: stage.name,
          output: stageOutput,
        });

        allWarnings.push(...stageOutput.warnings);

        // Output becomes next stage's input
        currentInput = stageOutput.data as any;
      } catch (error) {
        // Pipeline stops on stage failure
        throw new Error(`Stage ${stage.name} failed: ${error}`);
      }
    }

    return {
      output: currentInput as unknown as O,
      stageResults,
      totalTimeMs: Date.now() - startTime,
      allWarnings,
    };
  }

  /**
   * For debugging: get what each stage did
   */
  getStageMetrics(result: PipelineResult<any>) {
    return result.stageResults.map((r) => ({
      stage: r.stage,
      confidence: r.output.confidence,
      reason: r.output.reason,
      source: r.output.source,
      warnings: r.output.warnings,
      timeMs: r.output.processingTimeMs,
    }));
  }
}
