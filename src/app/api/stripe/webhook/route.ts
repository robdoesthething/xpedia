import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/stripe/webhook
 * Handles Stripe events. On checkout.session.completed, upgrades the user to Pro.
 * Stripe requires the raw body for signature verification — Next.js App Router
 * provides this via request.text() without any body-parser interference.
 */
export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id;

    if (userId) {
      const supabase = createServiceClient();
      await supabase
        .from('profiles')
        .update({ plan: 'pro' })
        .eq('id', userId);

      console.log(`[Stripe] Upgraded user ${userId} to Pro`);
    }
  }

  return Response.json({ received: true });
}
