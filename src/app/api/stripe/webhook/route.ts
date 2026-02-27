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

    if (!userId) {
      // A completed checkout without a user_id in metadata indicates a
      // misconfigured Stripe session. Log and reject rather than silently
      // dropping the event so the problem is visible in Stripe's dashboard.
      console.warn(`[Stripe] checkout.session.completed missing user_id in metadata (event: ${event.id})`);
      return Response.json({ error: 'Missing user_id in session metadata' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // IDEMPOTENCY: Setting plan='pro' is inherently idempotent — running this
    // UPDATE multiple times for the same user produces the same result. Stripe
    // may deliver the same webhook event more than once (retries, network
    // issues), so this handler must remain safe to re-execute.
    //
    // IMPORTANT for future contributors: if you add any non-idempotent logic
    // here (e.g. sending a welcome email, incrementing counters, creating
    // records), you MUST guard it with a processed-event check first. A safe
    // pattern is to record event.id in a processed_stripe_events column and
    // skip re-processing if it already exists.
    const { error } = await supabase
      .from('users')
      .update({ plan: 'pro' })
      .eq('id', userId);

    if (error) {
      console.error(`[Stripe] Failed to upgrade user ${userId} to Pro:`, error);
      // Return 500 so Stripe retries the event.
      return Response.json({ error: 'Database update failed' }, { status: 500 });
    }

    console.log(`[Stripe] Upgraded user ${userId} to Pro (event: ${event.id})`);
  }

  return Response.json({ received: true });
}
