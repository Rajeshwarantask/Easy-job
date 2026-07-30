/**
 * Feature Flags for the Deterministic Parser System
 * 
 * These control the parsing strategy and help with gradual migration
 * from the AI-first system to the deterministic-first system.
 */

export const FEATURE_FLAGS = {
  // ─────────────────────────────────────────────────────────────────
  // PARSING STRATEGY
  // ─────────────────────────────────────────────────────────────────

  /**
   * Use deterministic parser as the PRIMARY system
   * When true: deterministic first, AI optional fallback
   * When false: AI first, deterministic fallback (legacy)
   * 
   * RECOMMENDATION: Set to TRUE for all new deployments
   */
  USE_DETERMINISTIC_PRIMARY: process.env.USE_DETERMINISTIC_PRIMARY !== "false",

  /**
   * Enable optional AI fallback for emails with low confidence
   * When true: emails with confidence < 0.5 can be sent to AI
   * When false: all emails use deterministic only
   * 
   * RECOMMENDATION: Keep FALSE for production (cost/speed/privacy)
   * Set TRUE only for testing or edge case debugging
   */
  ENABLE_AI_FALLBACK: process.env.ENABLE_AI_FALLBACK === "true",

  /**
   * Require manual review for all medium-confidence results
   * When true: emails with 0.6-0.85 confidence go to manual review queue
   * When false: all emails above 0.6 are auto-saved
   * 
   * RECOMMENDATION: Set TRUE if building web UI with review interface
   */
  REQUIRE_MANUAL_REVIEW_FOR_MEDIUM_CONFIDENCE: process.env.REQUIRE_MANUAL_REVIEW_FOR_MEDIUM_CONFIDENCE === "true",

  // ─────────────────────────────────────────────────────────────────
  // DEBUGGING & DIAGNOSTICS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Log all parser decisions (verbose output)
   * Useful for understanding why emails were classified a certain way
   */
  DEBUG_PARSER_DECISIONS: process.env.DEBUG_PARSER_DECISIONS === "true",

  /**
   * Store raw parsing traces in database for later analysis
   * Helps identify parser improvements needed
   */
  STORE_PARSING_TRACES: process.env.STORE_PARSING_TRACES === "true",

  /**
   * Compare deterministic vs AI results (when both run)
   * Tracks accuracy improvements over time
   */
  COMPARE_RESULTS: process.env.COMPARE_RESULTS === "true",

  // ─────────────────────────────────────────────────────────────────
  // PERFORMANCE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Disable email parsing entirely (for testing/debugging)
   * When true: all emails marked as "unknown"
   */
  DISABLE_PARSING: process.env.DISABLE_PARSING === "true",

  /**
   * Cache parser results per email hash
   * Prevents reprocessing identical bulk emails
   */
  ENABLE_PARSE_CACHE: process.env.ENABLE_PARSE_CACHE !== "false",
};

/**
 * Validate and report on feature flags
 */
export function reportFeatureFlags(): string {
  return `
Feature Flags Configuration
────────────────────────────────────────────────────────────

Parsing Strategy:
  • USE_DETERMINISTIC_PRIMARY: ${FEATURE_FLAGS.USE_DETERMINISTIC_PRIMARY ? "YES (recommended)" : "NO (legacy mode)"}
  • ENABLE_AI_FALLBACK: ${FEATURE_FLAGS.ENABLE_AI_FALLBACK ? "YES (development)" : "NO (production)"}
  • REQUIRE_MANUAL_REVIEW: ${FEATURE_FLAGS.REQUIRE_MANUAL_REVIEW_FOR_MEDIUM_CONFIDENCE ? "YES" : "NO"}

Debugging:
  • DEBUG_PARSER_DECISIONS: ${FEATURE_FLAGS.DEBUG_PARSER_DECISIONS ? "YES (verbose)" : "NO (quiet)"}
  • STORE_PARSING_TRACES: ${FEATURE_FLAGS.STORE_PARSING_TRACES ? "YES" : "NO"}
  • COMPARE_RESULTS: ${FEATURE_FLAGS.COMPARE_RESULTS ? "YES" : "NO"}

Performance:
  • DISABLE_PARSING: ${FEATURE_FLAGS.DISABLE_PARSING ? "YES (disabled)" : "NO (enabled)"}
  • ENABLE_PARSE_CACHE: ${FEATURE_FLAGS.ENABLE_PARSE_CACHE ? "YES" : "NO"}

Recommendation for Production:
  USE_DETERMINISTIC_PRIMARY=true
  ENABLE_AI_FALLBACK=false
  DISABLE_PARSING=false
  ENABLE_PARSE_CACHE=true
`;
}
