/**
 * Application Mapper
 * 
 * Determines if a parsed email belongs to an existing application (deduplication).
 * Uses priority-based matching: Thread ID → App ID → Candidate ID → Req ID → Similarity
 */

import type { MappingDecision } from "./types";

/**
 * Context for mapping decisions (simulated in this phase).
 * In real implementation, these would come from database queries.
 */
export interface MappingContext {
  userId: string;
  gmailThreadId?: string;
  existingApplications?: Array<{
    id: string;
    gmailThreadId?: string;
    applicationId?: string;
    candidateId?: string;
    requisitionId?: string;
    company: string;
    role: string;
    createdAt: Date;
  }>;
}

/**
 * Calculate similarity between two strings (simple Levenshtein-like distance).
 */
function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 1;

  // Simple substring matching
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    return 0.8;
  }

  // Check if they contain common words
  const aWords = new Set(aLower.split(/\s+/));
  const bWords = new Set(bLower.split(/\s+/));

  const commonWords = [...aWords].filter((w) => bWords.has(w));
  const totalWords = Math.max(aWords.size, bWords.size);

  return commonWords.length / totalWords;
}

/**
 * Map a parsed email to an existing application.
 * 
 * Strategy:
 * 1. Thread ID match → update existing application (high confidence)
 * 2. Application ID match → update existing application
 * 3. Candidate ID match → update existing application
 * 4. Requisition ID match → update existing application
 * 5. Company + Role similarity → possible update (lower confidence)
 * 6. No match → create new application
 * 
 * @param parsed - Parsed application with ATS fields
 * @param context - Mapping context (userId, existing apps, thread ID)
 * @returns Mapping decision
 */
export function mapApplicationToExisting(
  parsed: {
    company?: string;
    role?: string;
    atsFields: {
      applicationId?: string;
      requisitionId?: string;
      candidateId?: string;
    };
  },
  context: MappingContext
): MappingDecision {
  const { userId, gmailThreadId, existingApplications = [] } = context;

  // Step 1: Thread ID match (highest confidence)
  if (gmailThreadId) {
    const threadMatch = existingApplications.find(
      (app) => app.gmailThreadId === gmailThreadId
    );
    if (threadMatch) {
      return {
        action: "update",
        applicationId: threadMatch.id,
        confidence: 0.95,
        reason: "Matched via Gmail thread ID (same conversation thread)",
        deduplicationMethod: "thread_id",
      };
    }
  }

  // Step 2: Application ID match
  if (parsed.atsFields.applicationId) {
    const appIdMatch = existingApplications.find(
      (app) => app.applicationId === parsed.atsFields.applicationId
    );
    if (appIdMatch) {
      return {
        action: "update",
        applicationId: appIdMatch.id,
        confidence: 0.9,
        reason: `Matched via ATS application ID: ${parsed.atsFields.applicationId}`,
        deduplicationMethod: "app_id",
      };
    }
  }

  // Step 3: Candidate ID match
  if (parsed.atsFields.candidateId) {
    const candIdMatch = existingApplications.find(
      (app) => app.candidateId === parsed.atsFields.candidateId
    );
    if (candIdMatch) {
      return {
        action: "update",
        applicationId: candIdMatch.id,
        confidence: 0.85,
        reason: `Matched via ATS candidate ID: ${parsed.atsFields.candidateId}`,
        deduplicationMethod: "candidate_id",
      };
    }
  }

  // Step 4: Requisition ID match (with company check)
  if (parsed.atsFields.requisitionId && parsed.company) {
    const reqMatch = existingApplications.find(
      (app) =>
        app.requisitionId === parsed.atsFields.requisitionId &&
        stringSimilarity(app.company, parsed.company) > 0.7
    );
    if (reqMatch) {
      return {
        action: "update",
        applicationId: reqMatch.id,
        confidence: 0.8,
        reason: `Matched via requisition ID: ${parsed.atsFields.requisitionId}`,
        deduplicationMethod: "requisition_id",
      };
    }
  }

  // Step 5: Company + Role Similarity (lowest confidence)
  if (parsed.company && parsed.role) {
    let bestMatch:
      | (typeof existingApplications)[0]
      | undefined = undefined;
    let bestScore = 0;

    for (const app of existingApplications) {
      const companySim = stringSimilarity(app.company, parsed.company);
      const roleSim = stringSimilarity(app.role, parsed.role);

      // Average similarity
      const avgSim = (companySim + roleSim) / 2;

      // Only consider if similarity is high AND recent (within 7 days)
      const daysSinceCreated =
        (Date.now() - app.createdAt.getTime()) / (1000 * 60 * 60 * 24);

      if (avgSim > 0.75 && daysSinceCreated < 7 && avgSim > bestScore) {
        bestScore = avgSim;
        bestMatch = app;
      }
    }

    if (bestMatch && bestScore > 0.75) {
      return {
        action: "update",
        applicationId: bestMatch.id,
        confidence: Math.min(0.7, bestScore),
        reason: `Similar to existing: ${bestMatch.company} - ${bestMatch.role} (similarity: ${(bestScore * 100).toFixed(0)}%)`,
        deduplicationMethod: "similarity",
      };
    }
  }

  // Step 6: No match → create new
  return {
    action: "create",
    confidence: 1,
    reason: "No matching application found — creating new",
  };
}

/**
 * Find similar applications (for UI display/confirmation).
 */
export function findSimilarApplications(
  parsed: {
    company?: string;
    role?: string;
  },
  context: MappingContext
): Array<{
  applicationId: string;
  company: string;
  role: string;
  similarity: number;
}> {
  const { existingApplications = [] } = context;
  const similar: Array<{
    applicationId: string;
    company: string;
    role: string;
    similarity: number;
  }> = [];

  if (!parsed.company || !parsed.role) {
    return similar;
  }

  for (const app of existingApplications) {
    const companySim = stringSimilarity(app.company, parsed.company);
    const roleSim = stringSimilarity(app.role, parsed.role);
    const avgSim = (companySim + roleSim) / 2;

    if (avgSim > 0.6) {
      similar.push({
        applicationId: app.id,
        company: app.company,
        role: app.role,
        similarity: avgSim,
      });
    }
  }

  // Sort by similarity (highest first)
  similar.sort((a, b) => b.similarity - a.similarity);

  return similar;
}
