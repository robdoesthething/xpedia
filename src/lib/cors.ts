/**
 * CORS helpers for the Chrome extension API endpoint.
 *
 * The extension sends requests from a chrome-extension:// origin, so we allow
 * those through explicitly. All other origins are checked against NEXT_PUBLIC_APP_URL.
 * In development (no APP_URL set) we fall back to localhost:3000.
 */

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed =
    origin.startsWith('chrome-extension://') || origin === APP_ORIGIN
      ? origin
      : APP_ORIGIN;

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

export function corsOptions(request: Request) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}
