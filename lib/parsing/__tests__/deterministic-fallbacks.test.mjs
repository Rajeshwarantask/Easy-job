import assert from "node:assert/strict";
import { classifyRecruitmentEvent, dedupeByGmailMessageId, extractDeterministicFallbacks, extractExplicitDate, normalizeExtractedValue } from "../deterministic-fallbacks.ts";

assert.equal(normalizeExtractedValue("Untitled Role"), undefined);
assert.equal(normalizeExtractedValue("  Senior Engineer  "), "Senior Engineer");
assert.equal(normalizeExtractedValue("N/A"), undefined);
assert.equal(classifyRecruitmentEvent("Unfortunately, an update", "talent@acme.com", "We will not be moving forward").type, "rejection");
assert.equal(classifyRecruitmentEvent("Interview scheduled", "recruiting@acme.com", "Please join the video call").type, "interview");
assert.equal(classifyRecruitmentEvent("Application received", "jobs@acme.com", "Thank you for applying").type, "applied");
assert.equal(extractExplicitDate("Interview scheduled for Monday, January 12, 2026")?.getFullYear(), 2026);

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

console.log("Parser fallback tests passed");
