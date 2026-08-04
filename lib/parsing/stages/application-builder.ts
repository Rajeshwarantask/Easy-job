import type {
  Stage,
  StageOutput,
  ResolvedFields,
  ClassifiedEmail,
  ApplicationState,
  TimelineEvent,
  ParsedApplication,
  IdentityMatch,
} from "../pipeline";

export interface ApplicationBuilderInput {
  email: {
    threadId: string;
    messageId: string;
    date: Date;
    from: string;
  };
  documentType: string;
  confidence: number;
  resolvedFields: ResolvedFields;
  state: ApplicationState;
  identity: IdentityMatch;
  timeline: TimelineEvent[];
  stageMetrics: Array<{ name: string; timeMs: number; warnings: string[] }>;
  totalConfidence: number;
}

/**
 * Application Builder Stage
 * Final layer that assembles ParsedApplication from all resolved data
 * Everything flows here. Responsibility is clear: assemble and return.
 */
export class ApplicationBuilderStage
  implements Stage<ApplicationBuilderInput, ParsedApplication>
{
  name = "application-builder";

  async run(input: ApplicationBuilderInput): Promise<StageOutput<ParsedApplication>> {
    const start = Date.now();
    const warnings: string[] = [];

    try {
      // Build confidence map for individual fields
      const confidenceByField: Record<string, number> = {
        company: input.resolvedFields.confidence || 0.8,
        role: input.resolvedFields.confidence || 0.8,
        salary: 0.7,
        location: input.resolvedFields.location ? 0.75 : 0,
        workMode: input.resolvedFields.workMode ? 0.7 : 0,
        recruiter: input.resolvedFields.recruiter.name ? 0.8 : 0.5,
        interviewDate: input.resolvedFields.interviewDate ? 0.85 : 0,
        documentType: input.confidence,
      };

      // Calculate overall confidence
      const overallConfidence = calculateOverallConfidence(confidenceByField);

      // Validate required fields
      if (!input.resolvedFields.company || !input.resolvedFields.role) {
        warnings.push("Missing required fields: company or role");
      }

      const application: ParsedApplication = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        originalEmail: input.email,
        documentType: input.documentType,
        company: input.resolvedFields.company,
        role: input.resolvedFields.role,
        salary: input.resolvedFields.salary,
        location: input.resolvedFields.location || null,
        workMode: input.resolvedFields.workMode || null,
        recruiter: input.resolvedFields.recruiter,
        interviewDate: input.resolvedFields.interviewDate || null,
        interviewLink: input.resolvedFields.interviewLink || null,
        applicationUrl: input.resolvedFields.applicationUrl || null,
        deadline: input.resolvedFields.deadline || null,
        currentState: input.state.currentState,
        timeline: input.timeline,
        confidence: {
          overall: overallConfidence,
          byField: confidenceByField,
        },
        identity: input.identity,
        metadata: {
          processingTimeMs: Date.now() - start,
          stages: input.stageMetrics,
        },
      };

      return {
        data: application,
        confidence: 1.0, // Builder itself is deterministic
        reason: "Successfully assembled application from resolved fields",
        source: "application-builder",
        warnings,
        processingTimeMs: Date.now() - start,
      };
    } catch (error) {
      return {
        data: {} as ParsedApplication,
        confidence: 0,
        reason: `Failed to build application: ${error}`,
        source: "application-builder",
        warnings: ["Application build failed"],
        processingTimeMs: Date.now() - start,
      };
    }
  }
}

function calculateOverallConfidence(confidenceByField: Record<string, number>): number {
  const values = Object.values(confidenceByField).filter((v) => v > 0);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b) / values.length;
}
