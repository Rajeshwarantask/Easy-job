/**
 * Parser Registry & Router
 * 
 * Manages all platform parsers and routes emails to the appropriate parser.
 */

import type { PlatformParser, ParserResult } from "../parser-interface";
import { mergeParserResults } from "../parser-interface";
import { indeedParser } from "./indeed-parser";
import { greenhouseParser } from "./greenhouse-parser";
import { workdayParser } from "./workday-parser";
import { leverParser } from "./lever-parser";
import { ashbyParser } from "./ashby-parser";
import { genericParser } from "./generic-parser";

class ParserRegistry {
  private parsers: PlatformParser[] = [];

  constructor() {
    // Register all parsers in priority order (highest priority first)
    this.register(indeedParser);
    this.register(greenhouseParser);
    this.register(workdayParser);
    this.register(leverParser);
    this.register(ashbyParser);
    // Generic parser is lowest priority — registered last
    this.register(genericParser);
  }

  private register(parser: PlatformParser): void {
    this.parsers.push(parser);
  }

  /**
   * Get parsers that can handle this email (in priority order).
   */
  getApplicableParsers(from: string, subject: string): PlatformParser[] {
    return this.parsers.filter((p) => p.canHandle(from, subject));
  }

  /**
   * Parse email using applicable parsers and merge results.
   * 
   * @param from - Sender email
   * @param subject - Email subject
   * @param body - Email body (plaintext)
   * @param html - Email body (HTML, optional)
   * @returns Merged parser result
   */
  parse(
    from: string,
    subject: string,
    body: string,
    html?: string
  ): ParserResult | null {
    const applicable = this.getApplicableParsers(from, subject);

    if (applicable.length === 0) {
      // No parsers — should not happen since generic parser handles everything
      return null;
    }

    // Try each applicable parser
    const results: (ParserResult | null)[] = [];
    for (const parser of applicable) {
      const result = parser.parse(from, subject, body, html);
      if (result) {
        results.push(result);
      }
    }

    if (results.length === 0) {
      return null;
    }

    // Merge results from all applicable parsers
    return mergeParserResults(results);
  }

  /**
   * List all registered parsers with their details.
   */
  listParsers(): Array<{ platformId: string; platformName: string }> {
    return this.parsers.map((p) => ({
      platformId: p.platformId,
      platformName: p.platformName,
    }));
  }
}

export const parserRegistry = new ParserRegistry();

/**
 * Parse an email using the registry.
 * 
 * @param from - Sender email
 * @param subject - Email subject
 * @param body - Email body (plaintext)
 * @param html - Email body (HTML, optional)
 * @returns Parser result with merged data from applicable parsers
 */
export function parseEmail(
  from: string,
  subject: string,
  body: string,
  html?: string
): ParserResult | null {
  return parserRegistry.parse(from, subject, body, html);
}

/**
 * Get diagnostic info about which parsers would handle this email.
 */
export function diagnoseEmail(
  from: string,
  subject: string
): Array<{ platformId: string; platformName: string }> {
  const applicable = parserRegistry.getApplicableParsers(from, subject);
  return applicable.map((p) => ({
    platformId: p.platformId,
    platformName: p.platformName,
  }));
}

// Export individual parsers for testing/debugging
export {
  indeedParser,
  greenhouseParser,
  workdayParser,
  leverParser,
  ashbyParser,
  genericParser,
};
