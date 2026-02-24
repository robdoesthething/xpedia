/**
 * Input sanitization for AI prompts.
 *
 * Strips control characters and enforces length limits to mitigate
 * prompt injection risks when user-generated content is embedded in prompts.
 */

const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Sanitize user-generated text before embedding in an AI prompt.
 * - Strips ASCII control characters (preserving newlines, tabs, carriage returns)
 * - Trims leading/trailing whitespace
 * - Enforces a maximum character length
 *
 * @param text - Raw user text
 * @param maxLength - Maximum allowed characters (default 5000)
 */
export function sanitizeForPrompt(text: string, maxLength = 5000): string {
    return text
        .replace(CONTROL_CHARS_RE, '')
        .trim()
        .slice(0, maxLength);
}
