/**
 * Security & Sanitization Utilities (T-35)
 * Protects NextMsg against Stored XSS, Injection Attacks, and Malicious URIs.
 */

// Regular expressions to match dangerous HTML blocks and script injection vectors
const DANGEROUS_BLOCK_TAGS_REGEX =
  /<\s*(script|style|iframe|object|embed|applet|form|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DANGEROUS_SINGLE_TAGS_REGEX =
  /<\s*\/?\s*(script|iframe|object|embed|applet|style|meta|link|base|form|input|button|svg|math)[^>]*>/gi;
const INLINE_EVENT_HANDLERS_REGEX = /\s*(on\w+)\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi;
const DANGEROUS_PROTOCOLS_REGEX = /^\s*(javascript|data|vbscript|file):/i;

/**
 * Strips script tags and contents, iframes, and dangerous DOM attributes from text input.
 */
export function sanitizeText(input?: string | null): string {
  if (!input) return '';

  let sanitized = String(input);

  // 1. Remove complete block executable tags with their inner text (e.g. <script>alert(1)</script>)
  sanitized = sanitized.replace(DANGEROUS_BLOCK_TAGS_REGEX, '');

  // 2. Remove standalone / self-closing dangerous executable tags
  sanitized = sanitized.replace(DANGEROUS_SINGLE_TAGS_REGEX, '');

  // 3. Remove inline event handlers (onerror=, onload=, onclick=, etc.)
  sanitized = sanitized.replace(INLINE_EVENT_HANDLERS_REGEX, '');

  return sanitized.trim();
}

/**
 * Sanitizes message content while preserving legitimate markdown / plain text.
 */
export function sanitizeMessageContent(content?: string | null): string {
  if (!content) return '';
  return sanitizeText(content);
}

/**
 * Validates whether a URL is safe to open (prevents javascript: pseudo-protocol).
 */
export function isSafeUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();

  // Block dangerous URI schemes
  if (DANGEROUS_PROTOCOLS_REGEX.test(trimmed)) {
    return false;
  }

  // Must start with http://, https://, mailto:, tel:, or relative slash /
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#')
  );
}

/**
 * Mask sensitive data like tokens or emails in audit logs.
 */
export function maskSensitiveData(value?: string | null): string {
  if (!value) return '';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
