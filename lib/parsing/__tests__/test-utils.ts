/**
 * Test Utilities for Pipeline Stages
 *
 * Each stage should be independently testable with JSON input/output.
 * No Gmail API, no databases, no side effects.
 * Just pure function testing.
 */

import { PipelineContext, createPipelineContext } from "../pipeline-context";

/**
 * Sample recruitment emails for testing.
 * These are representative of real emails from different platforms.
 */
export const TEST_EMAILS = {
  // Indeed confirmation email
  indeedConfirmation: {
    subject: "You applied for Software Engineer at Google",
    from: "noreply@indeed.com",
    body: `
      Thank you for applying!
      
      Your application has been received for the position of Software Engineer at Google.
      
      Job details:
      Location: Mountain View, CA
      Salary: $200,000 - $250,000 per year
      
      The employer may contact you soon.
      
      View your application: [link]
    `,
    headers: {
      "message-id": "test-1@indeed.com",
      "thread-id": "test-thread-1",
    },
  },

  // Greenhouse interview scheduling
  greenhouseInterview: {
    subject: "Interview Invitation - Software Engineer",
    from: "hiring@company.greenhouse.io",
    body: `
      Hi there!
      
      We would like to invite you to interview for the Software Engineer position at our company.
      
      Can you interview next Tuesday, August 6, 2024 at 2:00 PM?
      
      [Schedule Interview Button]
      
      Interview Link: https://zoom.us/meeting/123
    `,
    headers: {
      "message-id": "test-2@greenhouse.io",
      "thread-id": "test-thread-2",
    },
  },

  // Offer email
  offer: {
    subject: "Offer - Senior Engineer Role",
    from: "hr@company.com",
    body: `
      We are pleased to offer you the position of Senior Engineer at Company Inc.
      
      Offer Details:
      - Base Salary: $250,000 per year
      - Sign-on Bonus: $50,000
      - Equity: 0.5% over 4 years
      
      Location: Remote
      
      Please respond by August 10, 2024.
      
      [View Full Offer]
    `,
    headers: {
      "message-id": "test-3@company.com",
      "thread-id": "test-thread-3",
    },
  },

  // Rejection email
  rejection: {
    subject: "Update on Your Application",
    from: "careers@company.com",
    body: `
      Thank you for your interest in the Product Manager position.
      
      We had a very difficult time deciding, but we've decided to move forward with other candidates.
      
      We will keep your profile in our system for future opportunities.
    `,
    headers: {
      "message-id": "test-4@company.com",
      "thread-id": "test-thread-4",
    },
  },

  // Assessment email
  assessment: {
    subject: "Complete your coding assessment",
    from: "assessments@company.com",
    body: `
      Your assessment is ready!
      
      Please complete the coding challenge within 7 days.
      
      [Start Assessment]
      
      Time limit: 2 hours
    `,
    headers: {
      "message-id": "test-5@company.com",
      "thread-id": "test-thread-5",
    },
  },
};

/**
 * Create a test context from a sample email.
 */
export function createTestContext(email: {
  subject: string;
  from: string;
  body: string;
  headers: Record<string, string>;
}): PipelineContext {
  return createPipelineContext({
    subject: email.subject,
    from: email.from,
    body: email.body,
    htmlBody: email.body,
    headers: email.headers,
    threadId: email.headers["thread-id"],
    messageId: email.headers["message-id"],
  });
}

/**
 * Assertion helper for testing confidence scores.
 */
export function assertConfidence(
  actual: number,
  expected: number,
  tolerance: number = 0.1
): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

/**
 * Test snapshot comparison.
 * For regression testing - ensures extraction stays consistent.
 */
export interface ExtractionSnapshot {
  email: string;
  company: { value: string; confidence: number };
  role: { value: string; confidence: number };
  location?: { value: string; confidence: number };
  salary?: { value: any; confidence: number };
  state: string;
}

/**
 * Generate snapshot from extraction result.
 * Use this to create golden tests.
 */
export function generateSnapshot(
  emailName: string,
  context: PipelineContext
): ExtractionSnapshot {
  const resolved = context.resolvedFields;
  const classification = context.classification;

  return {
    email: emailName,
    company: {
      value: resolved?.company || "",
      confidence: 0.8,
    },
    role: {
      value: resolved?.role || "",
      confidence: 0.8,
    },
    location: resolved?.location
      ? { value: resolved.location, confidence: 0.75 }
      : undefined,
    salary: resolved?.salary
      ? { value: resolved.salary, confidence: 0.7 }
      : undefined,
    state: classification?.documentType || "unknown",
  };
}

/**
 * Helper to run a single stage in isolation.
 * Usage: await testStage(stage, testContext)
 */
export async function testStage(
  stage: any,
  context: PipelineContext
): Promise<{
  success: boolean;
  context: PipelineContext;
  errors: string[];
}> {
  try {
    const startTime = Date.now();
    const result = await stage.execute(context);

    if (result.success) {
      return {
        success: true,
        context: result.data,
        errors: result.warnings,
      };
    } else {
      return {
        success: false,
        context,
        errors: result.warnings,
      };
    }
  } catch (error) {
    return {
      success: false,
      context,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Run entire pipeline stages sequentially.
 * For integration testing.
 */
export async function testPipeline(
  stages: any[],
  context: PipelineContext
): Promise<{
  success: boolean;
  context: PipelineContext;
  stageResults: Array<{ stage: string; success: boolean; warnings: string[] }>;
}> {
  let currentContext = context;
  const stageResults = [];

  for (const stage of stages) {
    const result = await testStage(stage, currentContext);
    stageResults.push({
      stage: stage.name,
      success: result.success,
      warnings: result.errors,
    });

    if (!result.success) {
      return {
        success: false,
        context: currentContext,
        stageResults,
      };
    }

    currentContext = result.context;
  }

  return {
    success: true,
    context: currentContext,
    stageResults,
  };
}
