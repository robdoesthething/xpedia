import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { isAllowedOrigin } from '@/lib/cors';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS preflight requests for extension-facing API routes here in
  // middleware so they're answered before any redirect (auth or otherwise)
  // can interfere — which causes "Redirect is not allowed for a preflight".
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    const origin = request.headers.get('Origin') ?? '';

    if (isAllowedOrigin(origin)) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      });
    }
  }

  // API routes handle their own auth via Bearer tokens — skip session refresh.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  // Removed api/ exclusion — api routes now enter middleware so the CORS
  // preflight handler above can intercept OPTIONS requests.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
