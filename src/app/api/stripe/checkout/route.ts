import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';
import { stripe, PRO_PRICE_ID } from '@/lib/stripe';

/**
 * POST /api/stripe/checkout
 * Creates a one-time Stripe Checkout session for the Pro plan.
 * Returns { url } — redirect the user to this URL to complete payment.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user } = auth;

  if (!validateOrigin(request)) return csrfForbidden();

  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/dashboard?upgraded=true`,
    cancel_url: `${origin}/dashboard`,
    customer_email: user.email,
    metadata: { user_id: user.id },
  });

  return Response.json({ url: session.url });
}
