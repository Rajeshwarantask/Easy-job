import assert from "node:assert/strict";
import { dedupeByGmailMessageId, extractDeterministicFallbacks, normalizeExtractedValue } from "../deterministic-fallbacks.ts";

assert.equal(normalizeExtractedValue("Untitled Role"), undefined);
assert.equal(normalizeExtractedValue("  Senior Engineer  "), "Senior Engineer");

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
