/**
 * JobTrail Parsing Module Examples
 * 
 * Real-world usage examples for the email parsing pipeline.
 */

import {
  processSingleEmail,
  syncGmailEmails,
  parseEmail,
  detectPlatform,
  filterRecruitmentEmail,
} from "./index";
import type { GmailMessagePart } from "./mime-decoder";

/**
 * Example 1: Quick diagnosis of an email
 * 
 * Determine:
 * - Is this a recruitment email?
 * - Which platform detected?
 * - Which parsers would handle it?
 */
export async function example1_diagnoseEmail() {
  const from = "noreply@greenhouse.io";
  const subject = "Application Received at Acme Corp";
  const body = `
    Hi Jane,
    
    Thank you for your application to the Senior Software Engineer position at Acme Corp.
    
    We'll review your application and get back to you soon.
    
    Best regards,
    Greenhouse
  `;

  // Step 1: Check if recruitment email
  const filter = filterRecruitmentEmail(subject, from, body);
  console.log("Is recruitment?", filter.isRecruiting, `(${filter.reason})`);

  // Step 2: Detect platform
  const platform = detectPlatform(from, subject, body);
  console.log("Platform detected:", platform.platform, `(confidence: ${platform.confidence.toFixed(2)})`);

  // Step 3: Parse
  const parsed = parseEmail(from, subject, body);
  console.log("Parsed result:", {
    company: parsed?.company?.value,
    role: parsed?.role?.value,
    eventType: parsed?.eventType.value,
    confidence: parsed?.parserConfidence,
  });
}

/**
 * Example 2: Parse a single email from Gmail
 * 
 * Complete pipeline for one email: decode, clean, parse, validate, enrich, map, timeline
 */
export async function example2_parseSingleEmail() {
  const gmailMessage: {
    id: string;
    threadId: string;
    payload?: GmailMessagePart;
    snippet?: string;
  } = {
    id: "msg_123",
    threadId: "thread_456",
    payload: {
      headers: [
        { name: "From", value: "noreply@greenhouse.io" },
        { name: "Subject", value: "Interview Scheduled at TechCorp" },
        { name: "Date", value: "Mon, 15 Jan 2024 10:00:00 +0000" },
      ],
      mimeType: "multipart/alternative",
      parts: [
        {
          mimeType: "text/plain",
          body: {
            data: Buffer.from(
              `Hi Jane,

Your interview is scheduled for Wednesday, January 17, 2024 at 2:00 PM EST.

Your interviewer will be John Smith from our engineering team.

Join the video call here: https://meet.google.com/abc-xyz

Best regards,
TechCorp Recruiting`
            ).toString("base64"),
          },
        },
      ],
    },
    snippet:
      "Your interview is scheduled for Wednesday, January 17, 2024 at 2:00 PM EST.",
  };

  const result = await processSingleEmail(gmailMessage, {
    userId: "user_123",
    gmailThreadId: gmailMessage.threadId,
    existingApplications: [
      // Sample existing application for mapping
      {
        id: "app_789",
        gmailThreadId: "thread_456", // Same thread = match
        company: "TechCorp",
        role: "Senior Engineer",
        createdAt: new Date("2024-01-10"),
      },
    ],
  });

  if (result.success && result.application) {
    console.log("✓ Parsed successfully");
    console.log("  Event Type:", result.application.eventType);
    console.log("  Interview Date:", result.application.timelineEvents[0]?.date);
    console.log(
      "  Mapping Decision:",
      result.application.mapTo.action,
      result.application.mapTo.reason
    );
    console.log("  Confidence:", result.application.validation.overallConfidence);
  } else {
    console.log("✗ Parse failed:", result.error);
  }
}

/**
 * Example 3: Batch sync multiple emails from Gmail
 * 
 * Process multiple emails and return array of ParsedApplication objects.
 * Caller decides where to persist (database, cache, etc).
 */
export async function example3_syncMultipleEmails() {
  const gmailMessages = [
    {
      id: "msg_1",
      threadId: "thread_1",
      snippet: "Thank you for applying",
      payload: {} as GmailMessagePart, // Would be real Gmail payload
    },
    {
      id: "msg_2",
      threadId: "thread_2",
      snippet: "Interview scheduled",
      payload: {} as GmailMessagePart,
    },
    {
      id: "msg_3",
      threadId: "thread_3",
      snippet: "Congratulations on your offer",
      payload: {} as GmailMessagePart,
    },
  ];

  const result = await syncGmailEmails(gmailMessages, {
    userId: "user_123",
    existingApplications: [], // In real app, fetch from database
  });

  console.log(`Sync complete: ${result.processed} emails processed`);
  console.log(
    `  Successful: ${result.results.filter((r) => r.success).length}`
  );
  console.log(
    `  Failed: ${result.results.filter((r) => !r.success).length}`
  );
  console.log(`  Duration: ${result.syncDurationMs}ms`);

  // Each result contains a ParsedApplication ready to persist
  const applications = result.results
    .filter((r) => r.success && r.application)
    .map((r) => r.application!);

  console.log(`Extracted ${applications.length} applications for persistence`);

  // Example: How the caller would persist these
  for (const app of applications) {
    // In real app:
    // - Check if app.mapTo.action === 'update' → update existing DB record
    // - Check if app.mapTo.action === 'create' → insert new DB record
    // - Check app.validation.overallConfidence → decide if needs manual review
    // - Use app.timelineEvents to build timeline UI
    // - Use app.enrichmentApplied to track data quality

    console.log(`  ${app.mapTo.action.toUpperCase()}: ${app.company} - ${app.role}`);
  }
}

/**
 * Example 4: Handle parsing errors
 * 
 * Show how to handle different error types and decide on action
 */
export async function example4_errorHandling() {
  const badMessage = {
    id: "msg_bad",
    threadId: "thread_bad",
    payload: {} as GmailMessagePart,
  };

  const result = await processSingleEmail(badMessage, {
    userId: "user_123",
  });

  if (!result.success) {
    switch (result.errorType) {
      case "filter":
        console.log("Not a recruitment email — skipped:", result.error);
        break;

      case "parse":
        console.log("Failed to parse — manual review needed:", result.error);
        break;

      case "validation":
        console.log("Validation failed — incomplete data:", result.error);
        break;

      case "decode":
        console.log("MIME decode error — corrupted email:", result.error);
        break;

      default:
        console.log("Unknown error:", result.error);
    }

    // Show processing steps that were attempted
    console.log("Processing steps:");
    for (const step of result.processingSteps) {
      const status = step.status === "success" ? "✓" : "✗";
      console.log(`  ${status} ${step.step} (${step.durationMs}ms)`);
    }
  }
}

/**
 * Example 5: Manual persistence after parsing
 * 
 * Show how the caller would handle persistence (since parser is decoupled).
 */
export async function example5_persistAfterParsing() {
  // Assume syncGmailEmails returned results
  const syncResult = await syncGmailEmails([], {
    userId: "user_123",
  });

  // For each successful parse result
  for (const parseResult of syncResult.results) {
    if (!parseResult.success || !parseResult.application) {
      console.log("Failed:", parseResult.error);
      continue;
    }

    const app = parseResult.application;

    // Example: Persist to database
    // In real app, would call: await db.applications.upsert(...)

    if (app.mapTo.action === "create") {
      console.log("Creating new application:", {
        userId: app.originalEmail.from,
        company: app.company,
        role: app.role,
        eventType: app.eventType,
        confidence: app.validation.overallConfidence,
        gmailThreadId: app.originalEmail.gmailThreadId,
        timelineEvents: app.timelineEvents,
      });
    } else if (app.mapTo.action === "update") {
      console.log("Updating existing application:", app.mapTo.applicationId, {
        company: app.company,
        eventType: app.eventType,
        gmailThreadId: app.originalEmail.gmailThreadId,
        timelineEvents: app.timelineEvents,
      });
    }

    // Check if needs manual review
    if (!app.validation.valid || app.validation.overallConfidence < 0.6) {
      console.log("⚠ Requires manual review:");
      console.log("  Issues:", app.validation.criticalIssues);
      console.log("  Confidence:", app.validation.overallConfidence);
    }
  }
}
