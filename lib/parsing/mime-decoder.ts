/**
 * MIME Email Decoder
 * 
 * Extracts structured data from Gmail's MIME message payload.
 * Handles multipart messages, base64 encoding, and nested structures.
 * Returns: headers (from, to, subject, date), plaintext body, HTML body, attachments.
 */

/**
 * Mirrors googleapis' Schema$MessagePart shape.
 * All fields are optional to match the Gmail API payload structure.
 */
export interface GmailMessagePart {
  mimeType?: string | null;
  headers?: Array<{ name?: string; value?: string }> | null;
  body?: { data?: string | null; size?: number } | null;
  parts?: GmailMessagePart[] | null;
  filename?: string | null;
}

/**
 * Decoded MIME email structure with all components.
 */
export interface DecodedMimeEmail {
  headers: {
    from: string;
    to: string;
    subject: string;
    date: Date;
    messageId?: string;
    threadId?: string;
    references?: string[];
    inReplyTo?: string;
  };
  body: {
    plaintext: string;
    html: string;
  };
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

/**
 * Extract header value from Gmail headers array.
 */
function getHeader(
  headers: Array<{ name?: string; value?: string }> | undefined | null,
  name: string
): string | undefined {
  if (!headers) return undefined;
  const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value;
}

/**
 * Decode base64 payload, handling both standard and URL-safe base64.
 */
function decodeBase64(data: string): string {
  try {
    // Handle both standard and URL-safe base64
    const normalized = data
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf-8");
  } catch (error) {
    console.error("[v0] Failed to decode base64 payload:", error);
    return "";
  }
}

/**
 * Recursively extract plaintext from a message part (prefers text/plain).
 */
function extractPlaintextBody(part: GmailMessagePart | undefined): string {
  if (!part) return "";

  // Direct body on this part
  if (part.body?.data) {
    const decoded = decodeBase64(part.body.data);
    if (part.mimeType === "text/plain") {
      return decoded;
    }
    // Skip non-text types
    if (!part.mimeType?.startsWith("text/")) {
      return "";
    }
  }

  // Multipart — recurse into parts
  if (part.parts) {
    // Prefer text/plain
    for (const subpart of part.parts) {
      if (subpart.mimeType === "text/plain") {
        const text = extractPlaintextBody(subpart);
        if (text) return text;
      }
    }
    // Fall back to text/html stripped
    for (const subpart of part.parts) {
      if (subpart.mimeType === "text/html") {
        const text = extractPlaintextBody(subpart);
        if (text) return text;
      }
    }
    // Recurse into nested multiparts
    for (const subpart of part.parts) {
      if (subpart.mimeType?.startsWith("multipart/")) {
        const text = extractPlaintextBody(subpart);
        if (text) return text;
      }
    }
  }

  return "";
}

/**
 * Recursively extract HTML from a message part.
 */
function extractHtmlBody(part: GmailMessagePart | undefined): string {
  if (!part) return "";

  // Direct body on this part
  if (part.body?.data) {
    const decoded = decodeBase64(part.body.data);
    if (part.mimeType === "text/html") {
      return decoded;
    }
  }

  // Multipart — recurse into parts
  if (part.parts) {
    for (const subpart of part.parts) {
      if (subpart.mimeType === "text/html") {
        const text = extractHtmlBody(subpart);
        if (text) return text;
      }
    }
    // Recurse into nested multiparts
    for (const subpart of part.parts) {
      if (subpart.mimeType?.startsWith("multipart/")) {
        const text = extractHtmlBody(subpart);
        if (text) return text;
      }
    }
  }

  return "";
}

/**
 * Recursively collect attachments.
 */
function collectAttachments(part: GmailMessagePart | undefined): Array<{
  filename: string;
  mimeType: string;
  size: number;
}> {
  const attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
  }> = [];

  if (!part) return attachments;

  // This part is an attachment
  if (part.filename) {
    attachments.push({
      filename: part.filename,
      mimeType: part.mimeType || "application/octet-stream",
      size: part.body?.size || 0,
    });
  }

  // Recurse into nested parts
  if (part.parts) {
    for (const subpart of part.parts) {
      attachments.push(...collectAttachments(subpart));
    }
  }

  return attachments;
}

/**
 * Parse RFC2822 date string to JavaScript Date.
 * Falls back to current date on parse error.
 */
function parseEmailDate(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();

  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (error) {
    // Fall through to default
  }

  return new Date();
}

/**
 * Decode a Gmail message payload into structured DecodedMimeEmail.
 * 
 * @param payload - Gmail message payload from the API
 * @param gmailMessageId - Gmail message ID (for correlation)
 * @param gmailThreadId - Gmail thread ID (for correlation)
 * @returns Fully decoded email structure
 */
export function decodeMimePayload(
  payload: GmailMessagePart | undefined,
  gmailMessageId?: string,
  gmailThreadId?: string
): DecodedMimeEmail {
  const headers = payload?.headers;

  const from = getHeader(headers, "from") || "";
  const to = getHeader(headers, "to") || "";
  const subject = getHeader(headers, "subject") || "";
  const date = parseEmailDate(getHeader(headers, "date"));
  const messageId = getHeader(headers, "message-id");
  const references = getHeader(headers, "references")?.split(" ").filter(Boolean);
  const inReplyTo = getHeader(headers, "in-reply-to");

  const plaintext = extractPlaintextBody(payload);
  const html = extractHtmlBody(payload);
  const attachments = collectAttachments(payload);

  return {
    headers: {
      from,
      to,
      subject,
      date,
      messageId,
      threadId: gmailThreadId,
      references,
      inReplyTo,
    },
    body: {
      plaintext,
      html,
    },
    attachments,
  };
}
