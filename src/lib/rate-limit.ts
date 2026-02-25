/**
 * Simple in-memory rate limiter.
 *
 * Note: This is per-serverless-instance. For distributed rate limiting,
 * use a shared store (e.g. Upstash Redis) when scaling beyond a single instance.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Returns a 429 Response with Retry-After header.
 * Pass extra headers (e.g. CORS) via the third argument.
 */
export function rateLimitResponse(
  result: { retryAfterMs: number },
  message = 'Too many requests. Please wait.',
  extraHeaders?: Record<string, string>
): Response {
  return Response.json(
    { error: message },
    {
      status: 429,
      headers: {
        ...extraHeaders,
        'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
      },
    }
  );
}
