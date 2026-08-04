import type { Stage, StageOutput, NormalizedEmail, EmailMetadata } from "../pipeline";

/**
 * Metadata Extraction Stage
 * Extracts structural information from email BEFORE classification
 * This gives the classifier full context to make better decisions
 */

const PLATFORM_PATTERNS: Record<string, RegExp[]> = {
  linkedin: [/linkedin\.com/i, /jobs\.linkedin\.com/i],
  workable: [/workable\.com/i, /apply\.workable\.com/i],
  greenhouse: [/greenhouse\.io/i, /boards\.greenhouse\.io/i],
  lever: [/lever\.co/i, /jobs\.lever\.co/i],
  ashby: [/ashby\.com/i],
  jotform: [/jotform\.com/i],
  typeform: [/typeform\.com/i],
  talentlyft: [/talentlyft\.com/i],
};

const URGENCY_KEYWORDS = [
  "urgent",
  "asap",
  "immediately",
  "deadline",
  "closes",
  "expires",
  "limited",
  "quickly",
  "hurry",
  "final",
  "last chance",
];

export class MetadataExtractorStage implements Stage<NormalizedEmail, EmailMetadata> {
  name = "metadata-extractor";

  async run(email: NormalizedEmail): Promise<StageOutput<EmailMetadata>> {
    const start = Date.now();
    const warnings: string[] = [];

    try {
      // Extract sender name from "Name <email@domain.com>" format
      const senderNameMatch = email.from.match(/^([^<]+)<[^>]+>$/);
      const senderName = senderNameMatch ? senderNameMatch[1].trim() : null;

      // Detect platform from links and domain
      let platform = "unknown";
      for (const [plat, patterns] of Object.entries(PLATFORM_PATTERNS)) {
        if (patterns.some((p) => p.test(email.bodyText))) {
          platform = plat;
          break;
        }
        if (patterns.some((p) => p.test(email.fromDomain))) {
          platform = plat;
          break;
        }
      }

      // Count buttons and links
      const hasButtons = email.buttons && email.buttons.length > 0;
      const linkCount = email.links ? email.links.length : 0;
      const wordCount = email.bodyText.split(/\s+/).length;

      // Extract urgency signals
      const bodyLower = email.bodyText.toLowerCase();
      const subjectLower = email.subject.toLowerCase();
      const urgencyKeywords = URGENCY_KEYWORDS.filter(
        (kw) => bodyLower.includes(kw) || subjectLower.includes(kw)
      );

      if (!senderName && !platform) {
        warnings.push("Could not extract sender name or platform");
      }

      return {
        data: {
          senderName,
          senderDomain: email.fromDomain,
          platform,
          hasButtons,
          linkCount,
          wordCount,
          urgencyKeywords,
        },
        confidence: 0.95, // Structural extraction is very high confidence
        reason: "Extracted from email structure and links",
        source: "metadata-extractor",
        warnings,
        processingTimeMs: Date.now() - start,
      };
    } catch (error) {
      return {
        data: {
          senderName: null,
          senderDomain: email.fromDomain,
          platform: "unknown",
          hasButtons: false,
          linkCount: 0,
          wordCount: 0,
          urgencyKeywords: [],
        },
        confidence: 0.3,
        reason: `Error during extraction: ${error}`,
        source: "metadata-extractor",
        warnings: ["Metadata extraction failed, using defaults"],
        processingTimeMs: Date.now() - start,
      };
    }
  }
}
