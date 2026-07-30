/**
 * Pipeline Debugging & Metrics
 * 
 * Tracks how many emails are lost at each stage of the pipeline.
 * This helps identify where emails are being filtered out incorrectly.
 */

export interface PipelineMetrics {
  stage: string;
  input: number;
  output: number;
  filtered: number;
  filterReason?: Record<string, number>;
}

export class PipelineDebugger {
  private stages: PipelineMetrics[] = [];
  private emailLog: Array<{
    gmailId: string;
    stage: string;
    status: "pass" | "fail";
    reason?: string;
  }> = [];

  recordStage(
    stageName: string,
    inputCount: number,
    outputCount: number,
    filterReasons?: Record<string, number>
  ) {
    this.stages.push({
      stage: stageName,
      input: inputCount,
      output: outputCount,
      filtered: inputCount - outputCount,
      filterReason: filterReasons,
    });
  }

  recordEmail(gmailId: string, stage: string, status: "pass" | "fail", reason?: string) {
    this.emailLog.push({ gmailId, stage, status, reason });
  }

  getSummary() {
    return {
      stages: this.stages,
      totalInputEmails: this.stages[0]?.input ?? 0,
      totalOutputApplications: this.stages[this.stages.length - 1]?.output ?? 0,
      lossPercentage:
        this.stages[0] && this.stages[this.stages.length - 1]
          ? (
              ((this.stages[0].input - this.stages[this.stages.length - 1].output) /
                this.stages[0].input) *
              100
            ).toFixed(1) + "%"
          : "N/A",
      emailLog: this.emailLog,
    };
  }

  logSummary() {
    const summary = this.getSummary();
    console.log("[Pipeline Debug] Sync Summary:");
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }
}
