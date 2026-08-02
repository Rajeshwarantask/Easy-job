/**
 * Interview Link Extraction Module
 * 
 * Handles extraction of video call/meeting links from emails.
 * Recognizes Zoom, Google Meet, Microsoft Teams, Calendly, etc.
 */

export interface InterviewLink {
  url: string;
  platform?: "zoom" | "google-meet" | "teams" | "calendly" | "whereby" | "jitsi" | "unknown";
  type?: "meeting" | "scheduling" | "calendar";
  confidence: number; // 0-1
}

// Platform detection patterns
const PLATFORM_PATTERNS: Record<string, RegExp> = {
  zoom: /zoom\.us|zoom\.com|join\.zoom\.us/i,
  "google-meet": /meet\.google|hangouts\.google/i,
  teams: /teams\.microsoft\.com|teams\.live/i,
  calendly: /calendly\.com/i,
  whereby: /whereby\.com|appear\.in/i,
  jitsi: /jitsi\.org|meet\.jit\.si/i,
};

/**
 * Extract interview/meeting links from email body.
 * Looks for common patterns like:
 * - https://zoom.us/j/123456789
 * - https://meet.google.com/abc-defg-hij
 * - https://teams.microsoft.com/l/meetup-join/...
 * - https://calendly.com/username/meeting
 */
export function extractInterviewLinks(bodyText: string): InterviewLink[] {
  const links: InterviewLink[] = [];
  const text = bodyText || "";

  // Find all URLs
  const urlPattern = /https?:\/\/[^\s<>)"\]{}|\\^`]+/gi;
  const urls = text.match(urlPattern) || [];

  // Remove duplicates
  const uniqueUrls = [...new Set(urls)];

  for (const url of uniqueUrls) {
    // Skip common non-interview URLs
    if (shouldSkipUrl(url)) {
      continue;
    }

    let platform: InterviewLink["platform"] = "unknown";
    let type: InterviewLink["type"] = "meeting";
    let confidence = 0.5;

    // Check platform
    for (const [platformName, pattern] of Object.entries(PLATFORM_PATTERNS)) {
      if (pattern.test(url)) {
        platform = platformName as InterviewLink["platform"];

        // Increase confidence for well-known platforms
        if (platformName === "zoom" || platformName === "google-meet" || platformName === "teams") {
          confidence = 0.95;
        } else if (platformName === "calendly") {
          confidence = 0.9;
          type = "scheduling";
        } else {
          confidence = 0.85;
        }

        break;
      }
    }

    // Extract meeting ID if possible (helps with deduplication)
    const meetingId = extractMeetingId(url, platform);

    links.push({
      url,
      platform,
      type,
      confidence,
    });
  }

  return links;
}

/**
 * Check if a URL should be skipped (not an interview link).
 */
function shouldSkipUrl(url: string): boolean {
  // Skip tracking pixels, unsubscribe links, etc.
  const skipPatterns = [
    /tracking|beacon|pixel|track\.js/i,
    /unsubscribe/i,
    /list-manage/i, // Mailchimp unsubscribe
    /\.png$|\.gif$|\.jpg$|\.svg$/, // Images
    /twitter\.com|facebook\.com|linkedin\.com/, // Social media (unless in content)
  ];

  for (const pattern of skipPatterns) {
    if (pattern.test(url)) {
      return true;
    }
  }

  return false;
}

/**
 * Try to extract meeting/room ID from URL (for comparison/deduplication).
 */
function extractMeetingId(url: string, platform: InterviewLink["platform"]): string | undefined {
  const urlObj = new URL(url);

  switch (platform) {
    case "zoom":
      // Zoom: /j/[meeting-id]
      const zoomMatch = url.match(/\/j\/(\d+)/);
      return zoomMatch?.[1];

    case "google-meet":
      // Google Meet: /join/[meeting-code]
      const gmMatch = url.match(/\/join\/([a-z]{3}-[a-z]{4}-[a-z]{3})/);
      return gmMatch?.[1];

    case "teams":
      // Teams URLs are complex, extract thread id if available
      const teamsMatch = url.match(/threadId=([^&]+)/);
      return teamsMatch?.[1];

    case "calendly":
      // Calendly: /[username]/[meeting-type]
      const calendlyMatch = url.match(/calendly\.com\/([^/?]+)\/([^/?]+)/);
      return calendlyMatch ? `${calendlyMatch[1]}/${calendlyMatch[2]}` : undefined;

    default:
      // For unknown platforms, try to extract a path component
      return urlObj.pathname;
  }
}

/**
 * Extract the most likely interview link from a list.
 * Prioritizes: Zoom > Google Meet > Teams > Others
 */
export function selectPrimaryInterviewLink(links: InterviewLink[]): InterviewLink | undefined {
  if (links.length === 0) return undefined;

  const priority = ["zoom", "google-meet", "teams", "calendly", "whereby", "jitsi", "unknown"];

  // Sort by priority and confidence
  const sorted = [...links].sort((a, b) => {
    const aPriority = priority.indexOf(a.platform || "unknown");
    const bPriority = priority.indexOf(b.platform || "unknown");

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    return b.confidence - a.confidence;
  });

  return sorted[0];
}

/**
 * Detect if an email likely contains interview scheduling information.
 */
export function hasInterviewSchedulingContent(bodyText: string): boolean {
  const text = bodyText || "";
  const patterns = [
    /(?:join|click|open|use)[\s\w]*(?:link|url|meeting|call|video)/i,
    /(?:zoom|meet|teams|calendly|whereby|jitsi)/i,
    /https?:\/\/(?:zoom|meet\.google|teams\.microsoft|calendly|whereby|jitsi)/i,
  ];

  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}
