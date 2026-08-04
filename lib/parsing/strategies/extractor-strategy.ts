/**
 * Extractor Strategy Pattern
 *
 * Instead of one monolithic extractor, have pluggable strategies for each ATS.
 * Adding new ATS support = new strategy, no changes to core logic.
 *
 * Each strategy knows how to extract fields from THAT platform's emails.
 */

import { ExtractedFields, PipelineContext } from "../pipeline-context";

export interface ExtractionStrategy {
  name: string;
  version: string;
  platformId: string; // "indeed", "greenhouse", "workday", "lever", "generic"

  /**
   * Try to extract fields from this email.
   * Returns null if this strategy can't handle this email.
   * Confidence should reflect how sure we are about this extraction.
   */
  extract(context: PipelineContext): ExtractedFields | null;

  /**
   * Test if this strategy can handle this email.
   * Used to determine which strategy to use.
   */
  canHandle(context: PipelineContext): boolean;

  /**
   * Priority for strategy selection (higher = preferred).
   * If thread ID matches platform, increase priority.
   */
  getPriority(context: PipelineContext): number;
}

export abstract class BaseExtractionStrategy implements ExtractionStrategy {
  abstract name: string;
  abstract version: string;
  abstract platformId: string;

  abstract canHandle(context: PipelineContext): boolean;
  abstract extract(context: PipelineContext): ExtractedFields | null;

  getPriority(context: PipelineContext): number {
    return 50; // Default priority
  }

  protected createExtractedField<T>(
    value: T,
    confidence: number,
    source: string,
    reasoning: string,
    alternatives?: Array<{ value: T; confidence: number }>
  ) {
    return {
      value,
      confidence,
      source,
      reasoning,
      alternatives,
    };
  }
}

/**
 * Generic extractor using rules and regexes.
 * Fallback when no platform-specific strategy matches.
 */
export class GenericExtractionStrategy extends BaseExtractionStrategy {
  name = "Generic Email Extractor";
  version = "1.0.0";
  platformId = "generic";

  canHandle(context: PipelineContext): boolean {
    return true; // Generic always handles it
  }

  extract(context: PipelineContext): ExtractedFields | null {
    // Placeholder - will use RuleRegistry to extract fields
    return {
      company: this.createExtractedField("", 0.5, "generic", "Generic extraction"),
      role: this.createExtractedField("", 0.5, "generic", "Generic extraction"),
    };
  }

  getPriority(context: PipelineContext): number {
    return 10; // Low priority - last resort
  }
}

/**
 * Indeed-specific extractor.
 * Knows Indeed's email templates, button structures, etc.
 */
export class IndeedExtractionStrategy extends BaseExtractionStrategy {
  name = "Indeed Email Extractor";
  version = "1.0.0";
  platformId = "indeed";

  canHandle(context: PipelineContext): boolean {
    const from = context.normalizedEmail?.from || "";
    const subject = context.normalizedEmail?.subject || "";
    const body = context.normalizedEmail?.body || "";

    // Check for Indeed signals
    const isIndeed =
      from.includes("indeed.com") ||
      subject.includes("Indeed") ||
      body.includes("indeed.com");

    return isIndeed;
  }

  extract(context: PipelineContext): ExtractedFields | null {
    // Placeholder - will implement Indeed-specific extraction
    return {
      company: this.createExtractedField(
        "",
        0.85,
        "indeed",
        "Indeed template extraction"
      ),
      role: this.createExtractedField(
        "",
        0.85,
        "indeed",
        "Indeed template extraction"
      ),
    };
  }

  getPriority(context: PipelineContext): number {
    return 80; // High priority if detected
  }
}

/**
 * Greenhouse-specific extractor.
 */
export class GreenhouseExtractionStrategy extends BaseExtractionStrategy {
  name = "Greenhouse Email Extractor";
  version = "1.0.0";
  platformId = "greenhouse";

  canHandle(context: PipelineContext): boolean {
    const from = context.normalizedEmail?.from || "";
    const body = context.normalizedEmail?.body || "";

    return from.includes("greenhouse") || body.includes("greenhouse");
  }

  extract(context: PipelineContext): ExtractedFields | null {
    // Placeholder - will implement Greenhouse-specific extraction
    return {
      company: this.createExtractedField(
        "",
        0.88,
        "greenhouse",
        "Greenhouse template extraction"
      ),
      role: this.createExtractedField(
        "",
        0.88,
        "greenhouse",
        "Greenhouse template extraction"
      ),
    };
  }

  getPriority(context: PipelineContext): number {
    return 85;
  }
}

/**
 * Strategy registry for managing all extractors.
 */
export class ExtractionStrategyRegistry {
  private strategies: ExtractionStrategy[] = [];

  register(strategy: ExtractionStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Find best strategy for this email.
   * Returns strategies sorted by priority.
   */
  getStrategies(context: PipelineContext): ExtractionStrategy[] {
    return this.strategies
      .filter((s) => s.canHandle(context))
      .sort((a, b) => b.getPriority(context) - a.getPriority(context));
  }

  /**
   * Get best strategy for this email.
   */
  getBestStrategy(context: PipelineContext): ExtractionStrategy {
    const strategies = this.getStrategies(context);
    return strategies.length > 0 ? strategies[0] : new GenericExtractionStrategy();
  }
}

/**
 * Create default registry with all strategies.
 */
export function createDefaultStrategyRegistry(): ExtractionStrategyRegistry {
  const registry = new ExtractionStrategyRegistry();
  registry.register(new IndeedExtractionStrategy());
  registry.register(new GreenhouseExtractionStrategy());
  registry.register(new GenericExtractionStrategy());
  return registry;
}
