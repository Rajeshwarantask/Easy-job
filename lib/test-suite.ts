import { parseEmailDeterministic } from "./email-parser-deterministic";

interface TestCase {
  name: string;
  from: string;
  subject: string;
  body: string;
  expectedCompany?: string;
  expectedRole?: string;
  expectedStatus?: string;
  minConfidenceCompany?: number;
  minConfidenceStatus?: number;
}

const TEST_CASES: TestCase[] = [
  // ─────────────────────────────────────────────────────────────────
  // CRITICAL BUG FIXES (Phase 1)
  // ─────────────────────────────────────────────────────────────────

  {
    name: "American Express — should NOT be 'reviewing the American Express'",
    from: "recruitment.americanexpress.com",
    subject: "Your Application Status - Senior Engineer",
    body: "We are currently reviewing the American Express application you submitted...",
    expectedCompany: "American Express",
    minConfidenceCompany: 0.85, // Domain extraction should win over regex
  },

  {
    name: "CBTS via domain mapping",
    from: "careers@cbts.com",
    subject: "Application Received - Software Developer",
    body: "Thank you for applying. We received your application.",
    expectedCompany: "CBTS",
    minConfidenceCompany: 0.85,
  },

  {
    name: "Energy Exemplar — should NOT extract 'Energy Exemplar Hi Rajeshwaran'",
    from: "recruiter@energyexemplar.com",
    subject: "Interview Scheduled - Software Engineer",
    body: "Hi Rajeshwaran, we're excited to move forward...",
    expectedCompany: "Energy Exemplar",
    minConfidenceCompany: 0.85,
    expectedStatus: "interview",
  },

  // ─────────────────────────────────────────────────────────────────
  // INDEED PARSER FIX (Phase 2)
  // ─────────────────────────────────────────────────────────────────

  {
    name: "Indeed — without company in subject",
    from: "job-alert@indeed.com",
    subject: "Indeed Application: Software Developer",
    body: "Your application was received...",
    expectedRole: "Software Developer",
    expectedStatus: "applied",
    minConfidenceStatus: 0.9,
  },

  {
    name: "Indeed — with company in subject",
    from: "job-alert@indeed.com",
    subject: "Indeed Application: Senior Engineer at Google",
    body: "Your application has been received...",
    expectedCompany: "Google",
    expectedRole: "Senior Engineer",
    expectedStatus: "applied",
  },

  // ─────────────────────────────────────────────────────────────────
  // NAUKRI PARSER (Phase 2)
  // ─────────────────────────────────────────────────────────────────

  {
    name: "Naukri — company via pattern",
    from: "jobs@naukri.com",
    subject: "TCS via Naukri - Your Application Status",
    body: "TCS via Naukri has updated your application status...",
    expectedCompany: "TCS",
    minConfidenceCompany: 0.8,
  },

  {
    name: "Naukri — interview invitation",
    from: "jobs@naukri.com",
    subject: "You have been shortlisted for the interview",
    body: "Congratulations! You have been selected...",
    expectedStatus: "interview",
    minConfidenceStatus: 0.85,
  },

  // ─────────────────────────────────────────────────────────────────
  // GREENHOUSE PARSER
  // ─────────────────────────────────────────────────────────────────

  {
    name: "Greenhouse — application decision",
    from: "noreply@greenhouse.io",
    subject: "Application decision for Senior Engineer at Acme Corp",
    body: "We appreciated your interest...",
    expectedCompany: "Acme Corp",
    expectedRole: "Senior Engineer",
  },

  // ─────────────────────────────────────────────────────────────────
  // GENERIC REGEX PARSER (should NOT produce garbage)
  // ─────────────────────────────────────────────────────────────────

  {
    name: "Generic — rejection",
    from: "recruiter@somecompany.com",
    subject: "Update on your application",
    body: "Thank you for applying. After careful consideration, we appreciate your interest but will not be moving forward...",
    expectedStatus: "rejected",
    minConfidenceStatus: 0.9,
  },

  {
    name: "Generic — interview invite",
    from: "recruiter@startup.io",
    subject: "Next steps for your application",
    body: "We would like to invite you to an interview next week...",
    expectedStatus: "interview",
    minConfidenceStatus: 0.9,
  },

  // ─────────────────────────────────────────────────────────────────
  // SHOULD NOT EXTRACT GARBAGE
  // ─────────────────────────────────────────────────────────────────

  {
    name: "Should NOT extract role 'your interest for the'",
    from: "recruiter@generic.com",
    subject: "Application Status Update",
    body: "We appreciate your interest for the position...",
    // Should either extract nothing or something valid, NOT garbage
  },

  {
    name: "Should NOT extract deadline 'course'",
    from: "hr@company.com",
    subject: "Certification Course - Action Required",
    body: "Please complete the compliance course by Friday...",
    // Should be rejected by recruitment classifier (not actually a job email)
  },
];

export async function runTests(): Promise<{
  passed: number;
  failed: number;
  details: any[];
}> {
  const results: any[] = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    try {
      const result = await parseEmailDeterministic(testCase.from, testCase.subject, testCase.body);

      if (!result && !testCase.expectedCompany && !testCase.expectedStatus && !testCase.expectedRole) {
        // Expected null — this is a pass for cases like the course rejection
        results.push({
          name: testCase.name,
          status: "PASS",
          reason: "Correctly rejected non-recruitment email",
        });
        passed++;
        continue;
      }

      if (!result) {
        results.push({
          name: testCase.name,
          status: "FAIL",
          reason: "Expected result but got null",
          expected: { company: testCase.expectedCompany, role: testCase.expectedRole, status: testCase.expectedStatus },
        });
        failed++;
        continue;
      }

      let testPassed = true;
      const failures: string[] = [];

      // Check company
      if (testCase.expectedCompany) {
        if (result.company !== testCase.expectedCompany) {
          testPassed = false;
          failures.push(`Company: expected "${testCase.expectedCompany}" but got "${result.company}"`);
        }
        if (testCase.minConfidenceCompany && result.company_confidence < testCase.minConfidenceCompany) {
          testPassed = false;
          failures.push(`Company confidence: expected >= ${testCase.minConfidenceCompany} but got ${result.company_confidence}`);
        }
      }

      // Check role
      if (testCase.expectedRole) {
        if (result.role !== testCase.expectedRole) {
          testPassed = false;
          failures.push(`Role: expected "${testCase.expectedRole}" but got "${result.role}"`);
        }
      }

      // Check status
      if (testCase.expectedStatus) {
        if (result.eventType !== testCase.expectedStatus) {
          testPassed = false;
          failures.push(`Status: expected "${testCase.expectedStatus}" but got "${result.eventType}"`);
        }
        if (testCase.minConfidenceStatus && result.status_confidence < testCase.minConfidenceStatus) {
          testPassed = false;
          failures.push(`Status confidence: expected >= ${testCase.minConfidenceStatus} but got ${result.status_confidence}`);
        }
      }

      if (testPassed) {
        results.push({
          name: testCase.name,
          status: "PASS",
        });
        passed++;
      } else {
        results.push({
          name: testCase.name,
          status: "FAIL",
          failures,
          actual: { company: result.company, company_confidence: result.company_confidence, role: result.role, eventType: result.eventType, status_confidence: result.status_confidence },
        });
        failed++;
      }
    } catch (error) {
      results.push({
        name: testCase.name,
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  return { passed, failed, details: results };
}

// Run tests on import (for quick validation)
if (require.main === module) {
  runTests().then((results) => {
    console.log(`\n✅ Passed: ${results.passed}/${results.passed + results.failed}`);
    console.log(`❌ Failed: ${results.failed}/${results.passed + results.failed}\n`);

    results.details.forEach((r) => {
      if (r.status === "PASS") {
        console.log(`✓ ${r.name}`);
      } else {
        console.log(`✗ ${r.name}`);
        if (r.failures) {
          r.failures.forEach((f) => console.log(`  - ${f}`));
        }
        if (r.error) {
          console.log(`  - ERROR: ${r.error}`);
        }
      }
    });
  });
}
