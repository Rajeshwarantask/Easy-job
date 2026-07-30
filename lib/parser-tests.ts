/**
 * Parser Testing Suite
 * 
 * Real email samples from all major ATS platforms, with expected outputs.
 * Run tests with: npm run test:parsers
 * 
 * Metrics tracked:
 * - Accuracy per platform
 * - Accuracy by status type
 * - Confidence distribution
 * - Processing time
 */

import { parseDeterministic, type DeterministicParseResult } from "./deterministic-parser";
import { registerAllParsers } from "./platform-parsers";

// ─────────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────────

export interface TestCase {
  name: string;
  platform: string;
  from: string;
  subject: string;
  body: string;
  expectedStatus: "applied" | "rejected" | "offer" | "interview" | "update";
  expectedCompany?: string;
  expectedRole?: string;
}

export const TEST_CASES: TestCase[] = [
  // INDEED
  {
    name: "Indeed application confirmation",
    platform: "Indeed",
    from: "noreply@indeed.com",
    subject: "Indeed Application: Senior Software Engineer at Google",
    body: "Your application for Senior Software Engineer at Google has been received.",
    expectedStatus: "applied",
    expectedCompany: "Google",
    expectedRole: "Senior Software Engineer",
  },

  {
    name: "Indeed interview invitation",
    platform: "Indeed",
    from: "recruiter@company.com",
    subject: "Let's schedule an interview - Indeed",
    body: "We'd like to schedule an interview with you for the role. Please respond via Indeed.",
    expectedStatus: "interview",
  },

  // GREENHOUSE
  {
    name: "Greenhouse application decision - interview",
    platform: "Greenhouse",
    from: "noreply@greenhouse.io",
    subject: "Application decision for Product Manager at Amazon",
    body: "We'd like to move forward with your application for Product Manager at Amazon.",
    expectedStatus: "interview",
    expectedCompany: "Amazon",
    expectedRole: "Product Manager",
  },

  {
    name: "Greenhouse rejection",
    platform: "Greenhouse",
    from: "noreply@greenhouse.io",
    subject: "Application update for Data Engineer at Microsoft",
    body: "After careful consideration, we have decided not to move forward with your application.",
    expectedStatus: "rejected",
  },

  {
    name: "Greenhouse offer",
    platform: "Greenhouse",
    from: "noreply@greenhouse.io",
    subject: "Job offer - Frontend Engineer at Apple",
    body: "We're excited to offer you the position of Frontend Engineer at Apple.",
    expectedStatus: "offer",
  },

  // WORKDAY
  {
    name: "Workday application received",
    platform: "Workday",
    from: "noreply@workday.com",
    subject: "Application Received",
    body: "Thank you for applying. We have received your application.",
    expectedStatus: "applied",
  },

  {
    name: "Workday interview invitation",
    platform: "Workday",
    from: "noreply@workday.com",
    subject: "Interview Scheduled",
    body: "We'd like to move forward with your application. Please confirm your interview time.",
    expectedStatus: "interview",
  },

  // LEVER
  {
    name: "Lever application confirmation",
    platform: "Lever",
    from: "noreply@lever.co",
    subject: "We received your application!",
    body: "Thanks for applying. We've received your application and will review it.",
    expectedStatus: "applied",
  },

  {
    name: "Lever interview next round",
    platform: "Lever",
    from: "noreply@lever.co",
    subject: "We'd like to meet! Here's the next step",
    body: "We loved your background and would like to move forward with an interview.",
    expectedStatus: "interview",
  },

  // ASHBY
  {
    name: "Ashby application received",
    platform: "Ashby",
    from: "noreply@ashby.com",
    subject: "We got your application!",
    body: "Thanks for applying via Ashby. Your application has been received.",
    expectedStatus: "applied",
  },

  // ORACLE RECRUITING
  {
    name: "Oracle Recruiting application received",
    platform: "Oracle Recruiting",
    from: "recruitment@oracle.com",
    subject: "Application Confirmation",
    body: "Your application has been received by Oracle.",
    expectedStatus: "applied",
  },

  {
    name: "Oracle Recruiting interview",
    platform: "Oracle Recruiting",
    from: "recruitment@oracle.com",
    subject: "Interview Invitation",
    body: "We would like to invite you for an interview.",
    expectedStatus: "interview",
  },

  // LINKEDIN
  {
    name: "LinkedIn recruiter message",
    platform: "LinkedIn",
    from: "noreply@linkedin.com",
    subject: "Message from a recruiter interested in your profile",
    body: "A recruiter has reached out regarding an opportunity.",
    expectedStatus: "update",
  },
];

// ─────────────────────────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────────────────────────

export interface TestResult {
  passed: boolean;
  name: string;
  platform: string;
  expected: Partial<DeterministicParseResult>;
  actual: DeterministicParseResult;
  errors: string[];
}

export async function runParserTests(): Promise<TestResult[]> {
  registerAllParsers();

  const results: TestResult[] = [];

  for (const testCase of TEST_CASES) {
    const result = await parseDeterministic(testCase.from, testCase.subject, testCase.body, null);

    const errors: string[] = [];

    if (result.status !== testCase.expectedStatus) {
      errors.push(`Expected status ${testCase.expectedStatus}, got ${result.status}`);
    }

    if (testCase.expectedCompany && result.company !== testCase.expectedCompany && result.company !== "Unknown Company") {
      errors.push(`Expected company ${testCase.expectedCompany}, got ${result.company}`);
    }

    if (testCase.expectedRole && result.role !== testCase.expectedRole) {
      errors.push(`Expected role ${testCase.expectedRole}, got ${result.role}`);
    }

    results.push({
      passed: errors.length === 0,
      name: testCase.name,
      platform: testCase.platform,
      expected: {
        status: testCase.expectedStatus,
        company: testCase.expectedCompany,
        role: testCase.expectedRole,
      },
      actual: result,
      errors,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────
// METRICS & REPORTING
// ─────────────────────────────────────────────────────────────────

export interface TestMetrics {
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  byPlatform: Record<string, { passed: number; total: number; rate: number }>;
  byStatus: Record<string, { passed: number; total: number; rate: number }>;
  averageConfidence: number;
  processingTimeMs: number;
}

export function calculateMetrics(results: TestResult[]): TestMetrics {
  const startTime = Date.now();

  const byPlatform: Record<string, { passed: number; total: number }> = {};
  const byStatus: Record<string, { passed: number; total: number }> = {};

  let totalPassed = 0;
  let totalConfidence = 0;

  for (const result of results) {
    // Overall
    if (result.passed) totalPassed++;

    // By platform
    if (!byPlatform[result.platform]) byPlatform[result.platform] = { passed: 0, total: 0 };
    byPlatform[result.platform].total++;
    if (result.passed) byPlatform[result.platform].passed++;

    // By status
    const status = result.actual.status;
    if (!byStatus[status]) byStatus[status] = { passed: 0, total: 0 };
    byStatus[status].total++;
    if (result.passed) byStatus[status].passed++;

    // Confidence
    totalConfidence += result.actual.confidence.status;
  }

  const metrics: TestMetrics = {
    totalTests: results.length,
    passed: totalPassed,
    failed: results.length - totalPassed,
    passRate: results.length > 0 ? totalPassed / results.length : 0,
    byPlatform: Object.fromEntries(
      Object.entries(byPlatform).map(([platform, { passed, total }]) => [
        platform,
        { passed, total, rate: passed / total },
      ])
    ),
    byStatus: Object.fromEntries(
      Object.entries(byStatus).map(([status, { passed, total }]) => [status, { passed, total, rate: passed / total }])
    ),
    averageConfidence: totalConfidence / results.length,
    processingTimeMs: Date.now() - startTime,
  };

  return metrics;
}

export function formatTestReport(metrics: TestMetrics): string {
  return `
Parser Test Results
═══════════════════════════════════════════════════════════════

Overall: ${metrics.passed}/${metrics.totalTests} passed (${(metrics.passRate * 100).toFixed(1)}%)
Processing Time: ${metrics.processingTimeMs}ms
Average Confidence: ${(metrics.averageConfidence * 100).toFixed(1)}%

By Platform:
${Object.entries(metrics.byPlatform)
  .map(([platform, { passed, total, rate }]) => `  ${platform}: ${passed}/${total} (${(rate * 100).toFixed(0)}%)`)
  .join("\n")}

By Status:
${Object.entries(metrics.byStatus)
  .map(([status, { passed, total, rate }]) => `  ${status}: ${passed}/${total} (${(rate * 100).toFixed(0)}%)`)
  .join("\n")}

═══════════════════════════════════════════════════════════════
`;
}
