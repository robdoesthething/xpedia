import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

/** One-time payment price ID — create in Stripe Dashboard and set in .env.local */
export const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID!;
