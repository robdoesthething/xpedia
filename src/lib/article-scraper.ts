/**
 * Server-side article body extractor.
 * Fetches a URL, extracts readable text from the HTML, and returns a truncated
 * plain-text version suitable for AI processing.
 */

const MAX_BODY_CHARS = 2000;
const FETCH_TIMEOUT_MS = 8000;

/**
 * Validate that a URL is safe to fetch from the server side.
 *
 * Blocks:
 *  - Malformed URLs
 *  - Non-HTTP(S) protocols
 *  - Private / loopback / link-local IP ranges (SSRF prevention)
 */
export function isUrlSafe(url: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // IPv6 loopback
    if (hostname === '::1' || hostname === '[::1]') return false;

    // Exact string matches
    if (hostname === 'localhost' || hostname === '0.0.0.0') return false;

    // Parse dotted-decimal IPv4 for range checks
    const ipv4Match = hostname.match(
        /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
    );
    if (ipv4Match) {
        const [, a, b] = ipv4Match.map(Number);

        if (a === 127) return false;                          // 127.x.x.x  loopback
        if (a === 10) return false;                           // 10.x.x.x   private
        if (a === 172 && b >= 16 && b <= 31) return false;   // 172.16-31.x.x private
        if (a === 192 && b === 168) return false;             // 192.168.x.x private
        if (a === 169 && b === 254) return false;             // 169.254.x.x link-local / metadata
        if (a === 0) return false;                            // 0.x.x.x    "this" network
    }

    return true;
}

/**
 * Scrape the body text from an article URL.
 * Returns null on any failure (timeout, paywall, 404, etc.).
 */
export async function scrapeArticleBody(url: string): Promise<string | null> {
    if (!url || !isUrlSafe(url)) return null;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Xpedia/1.0; +https://xpedia.app)',
                Accept: 'text/html,application/xhtml+xml',
            },
            redirect: 'follow',
        });

        clearTimeout(timeout);

        if (!res.ok) return null;

        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
            return null;
        }

        const html = await res.text();
        return extractTextFromHTML(html);
    } catch (err) {
        // AbortError (timeout), network errors, etc.
        const message = err instanceof Error ? err.message : 'unknown';
        console.warn(`[Scraper] Failed to scrape ${url}: ${message}`);
        return null;
    }
}

/**
 * Extract readable text from raw HTML using tag-based heuristics.
 * Priority order: <article> → <main> → largest <div> block → <p> tags.
 */
function extractTextFromHTML(html: string): string | null {
    // Strip scripts, styles, and comments first
    const cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '');

    // Try to find the main content container
    let contentHTML = extractTagContent(cleaned, 'article')
        ?? extractTagContent(cleaned, 'main')
        ?? extractTagContent(cleaned, 'div', /class="[^"]*(?:post|article|entry|content|body|story)[^"]*"/i);

    // Fallback: collect all <p> tags
    if (!contentHTML) {
        const paragraphs = collectTagContents(cleaned, 'p');
        if (paragraphs.length > 0) {
            contentHTML = paragraphs.join('\n');
        }
    }

    if (!contentHTML) return null;

    // Strip all remaining HTML tags and normalize whitespace
    const text = contentHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/(?:h[1-6]|li|div|blockquote)>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&[a-zA-Z]+;/g, ' ') // other HTML entities
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (text.length < 50) return null; // Too short to be useful

    return text.length > MAX_BODY_CHARS
        ? text.slice(0, MAX_BODY_CHARS) + '…'
        : text;
}

/**
 * Extract the inner HTML of the first matching tag, optionally filtered by an attribute regex.
 */
function extractTagContent(html: string, tag: string, attrPattern?: RegExp): string | null {
    // Build regex: <tag ...attrs...>...content...</tag>
    const openPattern = attrPattern
        ? new RegExp(`<${tag}\\b[^>]*${attrPattern.source}[^>]*>`, 'i')
        : new RegExp(`<${tag}\\b[^>]*>`, 'i');

    const openMatch = openPattern.exec(html);
    if (!openMatch) return null;

    const startIndex = openMatch.index + openMatch[0].length;

    // Simple approach: find first closing tag after open
    // This works for most article structures where the first <article> is the main one
    const closePattern = new RegExp(`</${tag}>`, 'i');
    const closeMatch = closePattern.exec(html.slice(startIndex));
    if (!closeMatch) return null;

    // For simplicity, take content up to the first closing tag
    // This works for most article structures where the first <article> is the main one
    return html.slice(startIndex, startIndex + closeMatch.index);
}

/**
 * Collect inner text of all matching tags.
 */
function collectTagContents(html: string, tag: string): string[] {
    const pattern = new RegExp(`<${tag}\\b[^>]*>(.*?)</${tag}>`, 'gis');
    const results: string[] = [];
    let match;
    while ((match = pattern.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]+>/g, '').trim();
        if (text.length > 20) results.push(text); // Skip very short paragraphs (nav items, etc.)
    }
    return results;
}
