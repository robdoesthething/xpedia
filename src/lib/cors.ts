/**
 * CORS helpers for the Chrome extension API endpoint.
 *
 * The extension sends requests from a chrome-extension:// origin, so we allow
 * those through explicitly. When CHROME_EXTENSION_ID is set, only that
 * specific extension is allowed. Otherwise any chrome-extension:// origin is
 * accepted as a fallback (with a warning).
 *
 * All other origins are checked against NEXT_PUBLIC_APP_URL.
 * In development (no APP_URL set) we fall back to localhost:3000.
 */

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const EXTENSION_ID = process.env.CHROME_EXTENSION_ID;

function isAllowedOrigin(origin: string): boolean {
  if (origin === APP_ORIGIN) return true;

  if (origin.startsWith('chrome-extension://')) {
    if (EXTENSION_ID) {
      return origin === `chrome-extension://${EXTENSION_ID}`;
    }
    // Fallback: allow any extension but warn in logs
    console.warn(
      '[CORS] Allowing unverified chrome-extension origin. Set CHROME_EXTENSION_ID env var to restrict.'
    );
    return true;
  }

  return false;
}

export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = isAllowedOrigin(origin) ? origin : APP_ORIGIN;

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

export function corsOptions(request: Request) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}

/** Exported for use in middleware CORS preflight handler. */
export { isAllowedOrigin };
