import assert from "node:assert/strict";
import { classifyRecruitmentEvent, dedupeByGmailMessageId, extractDeterministicFallbacks, extractExplicitDate, extractPlatformFields, isValidCompanyCandidate, isValidRoleCandidate, normalizeExtractedValue } from "../deterministic-fallbacks.ts";
import { decodeMimePayload } from "../mime-decoder.ts";

assert.equal(normalizeExtractedValue("Untitled Role"), undefined);
assert.equal(normalizeExtractedValue("  Senior Engineer  "), "Senior Engineer");
assert.equal(normalizeExtractedValue("N/A"), undefined);
assert.equal(classifyRecruitmentEvent("Unfortunately, an update", "talent@acme.com", "We will not be moving forward").type, "rejection");
assert.equal(classifyRecruitmentEvent("Interview scheduled", "recruiting@acme.com", "Please join the video call").type, "interview");
assert.equal(classifyRecruitmentEvent("Application received", "jobs@acme.com", "Thank you for applying").type, "applied");
assert.equal(extractExplicitDate("Interview scheduled for Monday, January 12, 2026")?.getFullYear(), 2026);
const htmlPayload = {
  headers: [{ name: "From", value: "jobs@acme.example" }, { name: "Subject", value: "Application update" }, { name: "Date", value: "Mon, 12 Jan 2026 10:00:00 +0000" }],
  mimeType: "text/html",
  body: { data: Buffer.from("<p>Job title: Senior Engineer</p><p>Company: Acme</p>").toString("base64") },
};
assert.match(decodeMimePayload(htmlPayload, "msg-1", "thread-1").body.plaintext, /Job title: Senior Engineer/);

const fallback = extractDeterministicFallbacks(
  "hiring@acme.example",
  "Application update: Senior Platform Engineer",
  "Your application for the Senior Platform Engineer role at Acme was received. Apply: https://acme.example/careers/123"
);
assert.equal(fallback.company, "Acme");
assert.equal(fallback.role, "Senior Platform Engineer");
assert.equal(fallback.jobUrl, "https://acme.example/careers/123");

const rejection = extractDeterministicFallbacks(
  "talent@north-star.example",
  "Unfortunately, an update on your application",
  "We decided to move forward with another candidate for the Data Analyst position."
);
assert.equal(rejection.company, "North Star");
assert.equal(rejection.role, "Data Analyst");

const deduped = dedupeByGmailMessageId([{ id: "a" }, { id: "a" }, { id: "b" }]);
assert.equal(deduped.messages.length, 2);
assert.equal(deduped.deduplicated, 1);

const linkedIn = extractPlatformFields(
  "jobalerts-noreply@linkedin.com",
  "Your application update",
  "Full Stack Developer Rempact Bengaluru View job Apply with resume"
);
assert.equal(linkedIn.role, "Full Stack Developer");
assert.equal(linkedIn.company, "Rempact");
assert.equal(linkedIn.location, "Bengaluru");

const indeed = extractPlatformFields(
  "jobalerts@indeed.com",
  "Application for Frontend Developer",
  "Job: Frontend Developer\nCompany: Trianz\nView job"
);
assert.equal(indeed.role, "Frontend Developer");
assert.equal(indeed.company, "Trianz");

const bodyFields = extractDeterministicFallbacks(
  '"Recruiting Team" <recruiting@company.example>',
  "Application received",
  "Position: Backend Engineer\nCompany: Acme Systems\nThank you for applying."
);
assert.equal(bodyFields.role, "Backend Engineer");
assert.equal(bodyFields.company, "Acme Systems");
assert.equal(isValidCompanyCandidate("people"), false);
assert.equal(isValidCompanyCandidate("Thank you for applying to Acme"), false);
assert.equal(isValidRoleCandidate("more success"), false);
assert.equal(isValidRoleCandidate("Full Stack Developer"), true);

const observedLinkedIn = extractPlatformFields("notifications@linkedin.com", "More success with LinkedIn", "Full Stack Developer Rempact Bengaluru View job");
assert.equal(observedLinkedIn.company, "Rempact");
assert.equal(observedLinkedIn.role, "Full Stack Developer");
assert.equal(observedLinkedIn.location, "Bengaluru");
const observedIndeed = extractPlatformFields("jobalerts@indeed.com", "Your application", "Applying to the Software Engineer role at ABC Technologies");
assert.equal(observedIndeed.role, "Software Engineer");
assert.equal(observedIndeed.company, "ABC Technologies");
assert.equal(isValidRoleCandidate("applying to the"), false);
assert.equal(isValidRoleCandidate("more success"), false);
assert.equal(isValidCompanyCandidate("Eightfold"), false);
assert.equal(isValidCompanyCandidate("people"), false);
assert.equal(isValidCompanyCandidate("Rajeshwaran"), true);
const ctaLinkedIn = extractPlatformFields("jobalerts@linkedin.com", "Job alert", "Junior Full Stack Developer Made by Fire Chennai Apply with resume");
assert.equal(ctaLinkedIn.role, "Junior Full Stack Developer");
assert.equal(ctaLinkedIn.company, "Made by Fire");
assert.equal(ctaLinkedIn.location, "Chennai");
const atsCompany = extractDeterministicFallbacks("recruiting@horizon-oracle.example", "Application received", "Position: Full-Stack Developer\nCompany: Horizon Oracle");
assert.equal(atsCompany.company, "Horizon Oracle");
assert.equal(atsCompany.role, "Full-Stack Developer");

const rejectionCases = [
  ["Your IQVIA Application for R1560783 Software Development Engineer", "iqvia@myworkday.com", "the role is no longer available for hiring, and we will not be moving forward with your application"],
  ["Your Application to RQ114614 - Software Engineer", "donotreply@bp.com", "we have decided not to progress your application further"],
  ["Information about your application to DigiCert - Software Engineer", "no-reply@digicert.com", "we have made the decision to proceed with other candidates"],
  ["Application Status", "workday@viavisolutions.com", "we have made the decision to move forward with other candidates"],
];
for (const [subject, from, body] of rejectionCases) assert.equal(classifyRecruitmentEvent(subject, from, body).type, "rejection");
assert.equal(classifyRecruitmentEvent("Application Received", "workday@valeo.com", "if you do not receive additional communication, you were not selected for an initial interview").type, "applied");
assert.equal(classifyRecruitmentEvent("Client Interview - Graduate Engineer", "sidharth@example.com", "schedule a discussion as the next step in the selection process. Microsoft Teams meeting").type, "interview");
assert.equal(classifyRecruitmentEvent("Online Assessment - mthree Graduate Recruitment", "charupriya@mthree.com", "eligible to take part. Assessment Date: 6th Sep 2026. Assessment Duration: 100 minutes. Aptitude Coding").type, "assessment");
assert.equal(extractPlatformFields("iqvia@myworkday.com", "Your IQVIA Application for R1560783 Software Development Engineer", "we will not be moving forward").requisitionId, "R1560783");

console.log("Parser fallback tests passed");
