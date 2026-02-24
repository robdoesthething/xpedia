/**
 * CSRF protection via Origin header validation.
 *
 * Cookie-based mutation endpoints (POST/PATCH/DELETE) should call this to
 * verify the request originates from the expected application origin.
 */

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Validates that the request's Origin header matches the app origin.
 * Returns true if the origin is valid or absent (same-origin requests
 * may omit it). Returns false if the origin is present but doesn't match.
 */
export function validateOrigin(request: Request): boolean {
    const origin = request.headers.get('Origin');

    // Same-origin requests (e.g. server-side, or same-origin fetch without
    // mode: 'cors') may omit Origin entirely — allow those through.
    if (!origin) return true;

    return origin === APP_ORIGIN;
}

/** Returns a 403 Response for failed CSRF checks. */
export function csrfForbidden(): Response {
    return Response.json(
        { error: 'Forbidden: invalid origin' },
        { status: 403 }
    );
}
