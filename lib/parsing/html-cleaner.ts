/**
 * HTML Cleaner
 * 
 * Converts raw HTML email bodies into clean plaintext while preserving:
 * - Links (URL extraction)
 * - Structure (paragraph breaks, sections)
 * - Important formatting (bold text indicators)
 * 
 * Removes:
 * - Scripts and styles
 * - HTML comments
 * - Tracking pixels
 * - Excessive whitespace
 */

/**
 * Extract all links from HTML.
 */
export interface ExtractedLink {
  url: string;
  text: string;
  title?: string;
}

/**
 * Cleaned HTML output.
 */
export interface CleanedHtml {
  plaintext: string;
  links: ExtractedLink[];
  cleanHtml: string;
}

/**
 * Remove script and style tags and their content.
 */
function removeScriptsAndStyles(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
}

/**
 * Extract all anchor links.
 */
function extractLinks(html: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2]?.trim() || url;

    // Avoid duplicates
    if (!links.some((l) => l.url === url)) {
      links.push({
        url: decodeHtmlEntity(url),
        text: decodeHtmlEntity(text),
      });
    }
  }

  return links;
}

/**
 * Decode HTML entities.
 */
function decodeHtmlEntity(text: string): string {
  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
  };

  return text.replace(/&[\w#]+;/g, (match) => entities[match] || match);
}

/**
 * Convert HTML to plaintext while preserving structure.
 */
function htmlToPlaintext(html: string): string {
  let text = html;

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Replace line breaks with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/tr>/gi, "\n");

  // Remove table markup but preserve content
  text = text.replace(/<table[^>]*>/gi, "\n");
  text = text.replace(/<\/table>/gi, "\n");
  text = text.replace(/<tr[^>]*>/gi, "");
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<td[^>]*>/gi, " ");
  text = text.replace(/<\/td>/gi, " ");
  text = text.replace(/<th[^>]*>/gi, " ");
  text = text.replace(/<\/th>/gi, " ");

  // Remove all other HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = decodeHtmlEntity(text);

  // Clean up excessive whitespace
  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ +/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n");

  return text.trim();
}

/**
 * Remove tracking pixels and invisible images.
 */
function removeTrackingPixels(html: string): string {
  // Remove single-pixel images
  html = html.replace(
    /<img\s+[^>]*(?:width|height)=["']1["'][^>]*>/gi,
    ""
  );

  // Remove images with no alt text or source starting with "cid:" (embedded)
  html = html.replace(
    /<img\s+[^>]*(?:style=["'][^"']*(?:width|height):\s*(?:1|0)[^"']*["']|width=["'](?:1|0)["']|height=["'](?:1|0)["'])[^>]*>/gi,
    ""
  );

  return html;
}

/**
 * Clean HTML email body.
 * 
 * Removes scripts, styles, tracking pixels, and extracts links.
 * Converts to plaintext while preserving structure.
 * 
 * @param html - Raw HTML email body
 * @returns Cleaned plaintext, extracted links, and sanitized HTML
 */
export function cleanHtml(html: string): CleanedHtml {
  if (!html) {
    return {
      plaintext: "",
      links: [],
      cleanHtml: "",
    };
  }

  // Step 1: Extract links before any manipulation
  const links = extractLinks(html);

  // Step 2: Remove dangerous content
  let cleaned = removeScriptsAndStyles(html);
  cleaned = removeTrackingPixels(cleaned);

  // Step 3: Convert to plaintext
  const plaintext = htmlToPlaintext(cleaned);

  // Step 4: Create a safe HTML version (no scripts/styles/tracking)
  const cleanHtml = cleaned
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "") // Remove event handlers
    .replace(/javascript:/gi, ""); // Remove javascript: protocol

  return {
    plaintext,
    links,
    cleanHtml,
  };
}

/**
 * Extract plaintext from both HTML and plaintext email bodies.
 * Prefers plaintext if available, falls back to cleaning HTML.
 */
export function extractBodyText(
  plaintextBody: string | undefined,
  htmlBody: string | undefined
): string {
  if (plaintextBody?.trim()) {
    return plaintextBody.trim();
  }

  if (htmlBody?.trim()) {
    return cleanHtml(htmlBody).plaintext;
  }

  return "";
}

/**
 * Extract all actionable links from email (both plaintext URLs and HTML anchor tags).
 */
export function extractAllLinks(
  bodyText: string,
  htmlBody: string | undefined
): ExtractedLink[] {
  const links: ExtractedLink[] = [];

  // Extract from HTML anchors
  if (htmlBody) {
    links.push(...extractLinks(htmlBody));
  }

  // Extract bare URLs from plaintext
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]*[^\s<>"{}|\\^`\[\].,;:!?)]/gi;
  let match;
  while ((match = urlRegex.exec(bodyText)) !== null) {
    const url = match[0];
    // Avoid duplicates
    if (!links.some((l) => l.url === url)) {
      links.push({
        url,
        text: url,
      });
    }
  }

  return links;
}
