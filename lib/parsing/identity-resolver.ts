/**
 * Layer 7: Identity Resolution
 * 
 * THE HARDEST PROBLEM.
 * 
 * Question: Does this email belong to an existing application or is it new?
 * 
 * Example:
 * Applied Aug 1
 * Interview scheduled Aug 5
 * Offer Aug 10
 * 
 * All three emails must become ONE application with state progression.
 * Not three separate rows.
 * 
 * This layer compares incoming email against existing applications
 * and determines if it's part of an existing thread or a new application.
 */

export interface ExistingApplication {
  id: string;
  company: string;
  companyNormalized: string;
  role: string;
  roleNormalized: string;
  lastEventDate: Date;
  emailThreadId?: string;
  recruiterEmail?: string;
}

export interface IdentityResolutionResult {
  isNewApplication: boolean;
  matchedApplicationId?: string;
  confidence: number;
  reasoning: string;
  signals: string[];
}

/**
 * Normalize text for comparison (handles spaces, case, special chars).
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Calculate string similarity using simple Levenshtein distance approach.
 */
function stringSimilarity(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen === 0 ? 1 : 0;
  if (bLen === 0) return 0;

  const matrix: number[][] = Array(aLen + 1)
    .fill(null)
    .map(() => Array(bLen + 1).fill(0));

  for (let i = 0; i <= aLen; i++) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j++) matrix[0][j] = j;

  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(aLen, bLen);
  return 1 - matrix[aLen][bLen] / maxLen;
}

/**
 * Resolve identity: Is this a new application or update to existing?
 */
export function resolveIdentity(
  incomingCompany: string,
  incomingRole: string,
  incomingDate: Date,
  incomingThreadId: string,
  incomingRecruiterEmail: string,
  existingApplications: ExistingApplication[]
): IdentityResolutionResult {
  const signals: string[] = [];
  let bestMatch: {
    app: ExistingApplication;
    score: number;
  } | null = null;

  const incomingCompanyNorm = normalize(incomingCompany);
  const incomingRoleNorm = normalize(incomingRole);

  // Strategy 1: Same Gmail thread ID - DEFINITIVE
  if (incomingThreadId) {
    const threadMatch = existingApplications.find(
      (app) => app.emailThreadId === incomingThreadId
    );
    if (threadMatch) {
      signals.push("same_gmail_thread_id");
      return {
        isNewApplication: false,
        matchedApplicationId: threadMatch.id,
        confidence: 0.99,
        reasoning:
          "Same Gmail thread ID. This is a continuation of existing application.",
        signals,
      };
    }
  }

  // Strategy 2: Same recruiter email - very strong signal
  if (incomingRecruiterEmail) {
    const recruiterMatches = existingApplications.filter(
      (app) =>
        app.recruiterEmail &&
        normalize(app.recruiterEmail) === normalize(incomingRecruiterEmail)
    );

    if (recruiterMatches.length === 1) {
      signals.push("same_recruiter_email");
      const match = recruiterMatches[0];

      // But also check company/role match
      const companyMatch = normalize(match.companyNormalized) === incomingCompanyNorm;
      const roleMatch = normalize(match.roleNormalized) === incomingRoleNorm;

      if (companyMatch && roleMatch) {
        return {
          isNewApplication: false,
          matchedApplicationId: match.id,
          confidence: 0.95,
          reasoning:
            "Same recruiter, company, and role. This is a follow-up on existing application.",
          signals,
        };
      }
    }
  }

  // Strategy 3: Company + Role exact match with recent timing
  for (const app of existingApplications) {
    const companyMatch =
      normalize(app.companyNormalized) === incomingCompanyNorm;
    const roleMatch = normalize(app.roleNormalized) === incomingRoleNorm;

    if (companyMatch && roleMatch) {
      // Within 90 days is considered same application
      const daysSinceLastEvent = Math.floor(
        (incomingDate.getTime() - app.lastEventDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastEvent >= 0 && daysSinceLastEvent <= 90) {
        signals.push(`exact_match_company_role_${daysSinceLastEvent}days_ago`);

        if (daysSinceLastEvent <= 7) {
          return {
            isNewApplication: false,
            matchedApplicationId: app.id,
            confidence: 0.92,
            reasoning: `Same company and role within 7 days (${daysSinceLastEvent} days). Likely same application.`,
            signals,
          };
        } else if (daysSinceLastEvent <= 30) {
          return {
            isNewApplication: false,
            matchedApplicationId: app.id,
            confidence: 0.85,
            reasoning: `Same company and role within 30 days (${daysSinceLastEvent} days). Likely same application.`,
            signals,
          };
        } else if (daysSinceLastEvent <= 90) {
          // Still could be same, but lower confidence
          bestMatch = { app, score: 0.75 };
        }
      } else if (daysSinceLastEvent > 90) {
        // Company reposting job or user reapplying
        signals.push("company_role_match_but_old");
      }
    }
  }

  // Strategy 4: Fuzzy company/role match
  for (const app of existingApplications) {
    const companySimilarity = stringSimilarity(
      incomingCompanyNorm,
      normalize(app.companyNormalized)
    );
    const roleSimilarity = stringSimilarity(
      incomingRoleNorm,
      normalize(app.roleNormalized)
    );

    const combinedScore = (companySimilarity + roleSimilarity) / 2;

    // High fuzzy match with recent timing
    if (combinedScore > 0.85) {
      const daysSinceLastEvent = Math.floor(
        (incomingDate.getTime() - app.lastEventDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastEvent >= 0 && daysSinceLastEvent <= 60) {
        signals.push(`fuzzy_match_${(combinedScore * 100).toFixed(0)}%`);

        if (!bestMatch || combinedScore > bestMatch.score) {
          bestMatch = { app, score: Math.min(0.8, 0.5 + combinedScore * 0.3) };
        }
      }
    }
  }

  // Return best fuzzy match if found
  if (bestMatch) {
    return {
      isNewApplication: false,
      matchedApplicationId: bestMatch.app.id,
      confidence: bestMatch.score,
      reasoning: `Fuzzy match on company/role with ${(bestMatch.score * 100).toFixed(0)}% confidence. Review recommended.`,
      signals,
    };
  }

  // No match found - new application
  signals.push("no_matching_application");
  return {
    isNewApplication: true,
    confidence: 0.95,
    reasoning:
      "No existing application found matching this company/role combination.",
    signals,
  };
}
