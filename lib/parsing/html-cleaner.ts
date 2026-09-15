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
export interface StructuralBlock {
  text: string;
  tag: "heading" | "table-cell" | "link" | "paragraph" | "list-item" | "footer";
  noise: number;
}

export interface CleanedHtml {
  plaintext: string;
  links: ExtractedLink[];
  cleanHtml: string;
  blocks: StructuralBlock[];
  structuredText: string;
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
function extractStructuralBlocks(html: string): StructuralBlock[] {
  const blocks: StructuralBlock[] = [];
  const pattern = /<(h[1-6]|td|th|p|li|a|footer|header)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const text = decodeHtmlEntity(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (!text || text.length < 2) continue;
    const tag = match[1].toLowerCase();
    const isNoise = /^(?:apply(?: now)?|view job(?: posting)?|learn more|see details|sign in|get started|unsubscribe|privacy policy|more success|your update)$/i.test(text);
    blocks.push({
      text,
      tag: tag.startsWith("h") ? "heading" : tag === "td" || tag === "th" ? "table-cell" : tag === "a" ? "link" : tag === "li" ? "list-item" : tag === "footer" ? "footer" : "paragraph",
      noise: isNoise || /unsubscribe|privacy|tracking|receiving this email/i.test(text) ? 1 : tag === "a" ? 0.65 : tag.startsWith("h") ? 0.05 : 0.2,
    });
  }
  return blocks;
}

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
      blocks: [],
      structuredText: "",
    };
  }

  // Step 1: Extract links before any manipulation
  const links = extractLinks(html);

  // Step 2: Remove dangerous content
  let cleaned = removeScriptsAndStyles(html);
  cleaned = removeTrackingPixels(cleaned);

  // Step 3: Convert to plaintext
  const plaintext = htmlToPlaintext(cleaned);
  const blocks = extractStructuralBlocks(cleaned);
  const structuredText = blocks
    .filter((block) => block.noise < 0.8)
    .map((block) => block.text)
    .filter((text, index, values) => values.indexOf(text) === index)
    .join("\n");

  // Step 4: Create a safe HTML version (no scripts/styles/tracking)
  const cleanHtml = cleaned
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "") // Remove event handlers
    .replace(/javascript:/gi, ""); // Remove javascript: protocol

  return {
    plaintext,
    links,
    cleanHtml,
    blocks,
    structuredText,
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
