/**
 * Email Pipeline Tracer
 * Comprehensive logging at every stage of email parsing and processing
 */

export class EmailTracer {
  private emailId: string;
  private startTime: number;
  private stageStartTime: number;
  private stages: Map<string, { duration: number; status: string }> = new Map();

  constructor(emailId: string) {
    this.emailId = emailId;
    this.startTime = performance.now();
    this.stageStartTime = this.startTime;
  }

  private formatTime(ms: number): string {
    return `${ms.toFixed(1)}ms`;
  }

  header(subject: string, from: string, date: string) {
    console.group(
      `%c[EMAIL ${this.emailId}] ${subject.substring(0, 60)}`,
      "color: #2563eb; font-weight: bold;"
    );
    console.log(
      `%cGmail ID: %c${this.emailId}`,
      "color: #666; font-weight: bold;",
      "color: #333;"
    );
    console.log(
      `%cFrom: %c${from}`,
      "color: #666; font-weight: bold;",
      "color: #333;"
    );
    console.log(
      `%cDate: %c${date}`,
      "color: #666; font-weight: bold;",
      "color: #333;"
    );
    console.log("---");
  }

  step(label: string, status: "start" | "ok" | "skip" | "error" = "start") {
    const now = performance.now();
    const duration = now - this.stageStartTime;

    if (status === "start") {
      console.log(`%c[${label}]`, "color: #0891b2; font-weight: bold;");
      this.stageStartTime = now;
    } else {
      const statusColor = {
        ok: "#059669",
        skip: "#d97706",
        error: "#dc2626",
      }[status];
      const statusSymbol = { ok: "✓", skip: "⊘", error: "✗" }[status];
      console.log(
        `%c${statusSymbol} ${label} (${this.formatTime(duration)})`,
        `color: ${statusColor}; font-weight: bold;`
      );
      this.stages.set(label, { duration, status });
    }
  }

  log(key: string, value: any) {
    if (value === undefined || value === null) {
      console.log(`  ${key}: ${value}`);
    } else if (typeof value === "object") {
      console.log(`  ${key}:`, value);
    } else if (typeof value === "string" && value.length > 200) {
      console.log(`  ${key}: ${value.substring(0, 200)}...`);
    } else {
      console.log(`  ${key}: ${value}`);
    }
  }

  section(title: string) {
    console.log(`%c${title}`, "color: #7c3aed; font-weight: bold; margin-top: 8px;");
  }

  regex(pattern: string, matches: any) {
    this.section("Regex Detection");
    this.log("Pattern", pattern);
    this.log("Matches", matches);
  }

  ai(prompt: string, response: any) {
    this.section("AI Processing");
    this.log("Prompt (first 300 chars)", prompt.substring(0, 300));
    this.log("Raw Response", response);
  }

  merge(regexValue: any, aiValue: any, finalValue: any, reason: string) {
    this.section("Merge Decision");
    this.log("Regex", regexValue);
    this.log("AI", aiValue);
    this.log("Final", finalValue);
    this.log("Reason", reason);
  }

  confidence(company: number, job: number, status: number) {
    this.section("Confidence Scores");
    console.log(
      `%cCompany: ${(company * 100).toFixed(0)}%  |  Job: ${(job * 100).toFixed(0)}%  |  Status: ${(status * 100).toFixed(0)}%`,
      "color: #1e40af; font-weight: bold; font-size: 12px;"
    );
  }

  parsedObject(obj: any) {
    this.section("Final Parsed Object");
    console.log(obj);
  }

  db(action: string, result: any) {
    this.section("Database");
    console.log(`%c${action}`, "color: #059669; font-weight: bold;");
    console.log(result);
  }

  error(stage: string, reason: string, error?: Error) {
    this.section("Error");
    console.log(`%cStage: %c${stage}`, "color: #666;", "color: #dc2626; font-weight: bold;");
    console.log(`%cReason: %c${reason}`, "color: #666;", "color: #dc2626;");
    if (error) {
      console.log(`%cStack: %c${error.stack}`, "color: #666;", "color: #991b1b; font-family: monospace;");
    }
  }

  warning(message: string) {
    console.log(`%c⚠️ ${message}`, "color: #d97706; font-weight: bold;");
  }

  close() {
    const totalTime = performance.now() - this.startTime;
    console.log("---");
    console.log(
      `%cTotal: ${this.formatTime(totalTime)}`,
      "color: #0891b2; font-weight: bold;"
    );
    console.groupEnd();
  }

  summary() {
    const entries = Array.from(this.stages.entries());
    console.log("\nStage Summary:");
    entries.forEach(([stage, data]) => {
      console.log(`  ${stage}: ${this.formatTime(data.duration)} [${data.status}]`);
    });
  }
}

export class PipelineTracer {
  static fetchStart(count: number) {
    console.log("\n");
    console.log("%c╔════════════════════════════════════════╗", "color: #2563eb;");
    console.log("%c║  EMAIL SYNC STARTED                   ║", "color: #2563eb; font-weight: bold;");
    console.log("%c╚════════════════════════════════════════╝", "color: #2563eb;");
    console.log(`%c[FETCH] Retrieved ${count} messages from Gmail`, "color: #0891b2; font-weight: bold;");
  }

  static parseComplete(total: number, applied: number, interview: number, assessment: number, offer: number, rejected: number) {
    console.log("\n%c[PARSING COMPLETE]", "color: #059669; font-weight: bold;");
    console.log(`  Total: ${total}`);
    console.log(`  Applied: ${applied}`);
    console.log(`  Interview: ${interview}`);
    console.log(`  Assessment: ${assessment}`);
    console.log(`  Offer: ${offer}`);
    console.log(`  Rejected: ${rejected}`);
  }

  static jobsCreated(count: number, newCount: number) {
    console.log("\n%c[JOB CREATION]", "color: #059669; font-weight: bold;");
    console.log(`  Total: ${count}`);
    console.log(`  New: ${newCount}`);
  }

  static syncComplete(newJobs: number, newEvents: number, errors: number, durationMs: number) {
    console.log("\n%c╔════════════════════════════════════════╗", "color: #2563eb;");
    console.log("%c║  EMAIL SYNC COMPLETE                  ║", "color: #2563eb; font-weight: bold;");
    console.log("%c╚════════════════════════════════════════╝", "color: #2563eb;");
    console.log(`%c[RESULT] New Jobs: ${newJobs} | New Events: ${newEvents} | Errors: ${errors} | ${(durationMs / 1000).toFixed(2)}s`, "color: #059669; font-weight: bold;");
    console.log("\n");
  }
}
