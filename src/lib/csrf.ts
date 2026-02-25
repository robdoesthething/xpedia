/**
 * CSRF protection via Origin header validation.
 *
 * Cookie-based mutation endpoints (POST/PATCH/DELETE) should call this to
 * verify the request originates from the expected application origin.
 */

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const isDev = process.env.NODE_ENV === 'development';

/**
 * Validates that the request's Origin header matches the app origin or the
 * request's own Host header (handles custom domains & preview deployments).
 * Returns true if the origin is valid or absent (same-origin requests
 * may omit it). Returns false if the origin is present but doesn't match.
 */
export function validateOrigin(request: Request): boolean {
    const origin = request.headers.get('Origin');

    // Same-origin requests (e.g. server-side, or same-origin fetch without
    // mode: 'cors') may omit Origin entirely — allow those through.
    if (!origin) return true;

    // In development, allow any localhost origin (any port).
    if (isDev && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;

    // Strip trailing slash for comparison.
    const normalised = origin.replace(/\/+$/, '');

    // Match against the configured app origin.
    if (normalised === APP_ORIGIN) return true;

    // Match against the request's own Host header — this handles preview
    // deployments and custom domains where APP_ORIGIN may not match.
    const host = request.headers.get('Host') ?? request.headers.get('X-Forwarded-Host');
    if (host) {
        try {
            const hostOrigin = new URL(origin).host;
            if (hostOrigin === host) return true;
        } catch {
            // Malformed origin — fall through to deny.
        }
    }

    return false;
}

/** Returns a 403 Response for failed CSRF checks. */
export function csrfForbidden(): Response {
    return Response.json(
        { error: 'Forbidden: invalid origin' },
        { status: 403 }
    );
}
