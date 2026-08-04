/**
 * Data-Driven Pipeline Configuration
 *
 * Define which stages run, in what order, with what configuration.
 * The pipeline executor just runs through this config.
 * To reorder stages, disable stages, or add new stages:
 * Edit this file, no changes to orchestrator needed.
 */

import { Stage } from "./stage";

export interface StageConfig {
  stage: Stage;
  enabled: boolean;
  required: boolean; // If true, pipeline fails if this stage fails
  retryOnFailure: boolean;
  maxRetries: number;
  timeout: number; // milliseconds
}

export interface PipelineConfig {
  name: string;
  version: string;
  description: string;
  stages: StageConfig[];
}

/**
 * Example pipeline configuration.
 * In production, this could be loaded from a database or config file.
 * This makes the pipeline completely data-driven.
 */

// Placeholder stages - will be replaced with actual implementations
const placeholderStage = (name: string): Stage => ({
  name,
  version: "1.0.0",
  execute: async (ctx) => ({
    success: true,
    data: ctx,
    confidence: 1.0,
    warnings: [],
    metrics: { processingTimeMs: 0, rulesApplied: [] },
  }),
});

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  name: "recruitment-email-parser",
  version: "3.0.0",
  description: "Production pipeline for parsing recruitment emails",
  stages: [
    // Layer 1: Input Normalization
    {
      stage: placeholderStage("mime-decoder"),
      enabled: true,
      required: true,
      retryOnFailure: false,
      maxRetries: 0,
      timeout: 5000,
    },

    // Layer 2: Metadata Extraction
    {
      stage: placeholderStage("metadata-extractor"),
      enabled: true,
      required: true,
      retryOnFailure: false,
      maxRetries: 0,
      timeout: 3000,
    },

    // Layer 3: Recruitment Classification
    {
      stage: placeholderStage("recruitment-filter"),
      enabled: true,
      required: true,
      retryOnFailure: false,
      maxRetries: 0,
      timeout: 3000,
    },

    // Layer 4: Document Type Classification
    {
      stage: placeholderStage("document-classifier"),
      enabled: true,
      required: false,
      retryOnFailure: true,
      maxRetries: 2,
      timeout: 3000,
    },

    // Layer 5: Information Extraction (via Strategy pattern)
    {
      stage: placeholderStage("information-extractor"),
      enabled: true,
      required: true,
      retryOnFailure: false,
      maxRetries: 0,
      timeout: 5000,
    },

    // Layer 6: Validation
    {
      stage: placeholderStage("validator"),
      enabled: true,
      required: true,
      retryOnFailure: false,
      maxRetries: 0,
      timeout: 3000,
    },

    // Layer 7: Field Resolution
    {
      stage: placeholderStage("field-resolver"),
      enabled: true,
      required: true,
      retryOnFailure: false,
      maxRetries: 0,
      timeout: 3000,
    },

    // Layer 8: Identity Resolution
    {
      stage: placeholderStage("identity-resolver"),
      enabled: true,
      required: false,
      retryOnFailure: true,
      maxRetries: 1,
      timeout: 5000,
    },

    // Layer 9: State Analysis
    {
      stage: placeholderStage("state-engine"),
      enabled: true,
      required: false,
      retryOnFailure: true,
      maxRetries: 1,
      timeout: 3000,
    },

    // Layer 10: Timeline Generation
    {
      stage: placeholderStage("timeline-builder"),
      enabled: true,
      required: false,
      retryOnFailure: false,
      maxRetries: 0,
      timeout: 3000,
    },

    // Layer 11: Application Builder
    {
      stage: placeholderStage("application-builder"),
      enabled: true,
      required: true,
      retryOnFailure: false,
      maxRetries: 0,
      timeout: 3000,
    },
  ],
};

/**
 * Get only enabled stages from config.
 * This allows dynamic enabling/disabling without code changes.
 */
export function getEnabledStages(config: PipelineConfig): StageConfig[] {
  return config.stages.filter((s) => s.enabled);
}

/**
 * Get only required stages (those that cause failure if they fail).
 */
export function getRequiredStages(config: PipelineConfig): StageConfig[] {
  return config.stages.filter((s) => s.required);
}

/**
 * Validate pipeline config for consistency.
 */
export function validatePipelineConfig(config: PipelineConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.name) errors.push("Pipeline config missing name");
  if (!config.stages || config.stages.length === 0)
    errors.push("Pipeline config has no stages");

  // Check for duplicate stage names
  const names = config.stages.map((s) => s.stage.name);
  const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
  if (duplicates.length > 0) {
    errors.push(`Duplicate stage names: ${duplicates.join(", ")}`);
  }

  // Check that at least one stage is enabled
  const enabledCount = config.stages.filter((s) => s.enabled).length;
  if (enabledCount === 0) {
    errors.push("No stages enabled in pipeline config");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
