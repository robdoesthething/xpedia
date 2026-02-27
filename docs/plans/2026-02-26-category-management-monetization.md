# Category Management, Monetization & Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add user-controlled taxonomy management, hybrid AI classification, a 4-step onboarding flow, and a Stripe one-time payment gate for Pro features.

**Architecture:** Users define their theme taxonomy during onboarding; AI classifies tweets into the user's structure instead of inventing its own. A free tier allows limited AI usage (1 collection, ≤5 tweets); a one-time Stripe payment unlocks all AI features. Enforcement lives at the API layer.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS), Stripe Node.js SDK, React, Tailwind CSS, Vitest for tests.

**Design doc:** `docs/plans/2026-02-26-category-management-monetization-design.md`

---

## Task 1: DB Migration — Onboarding State & Free AI Slot

**Files:**
- Create: `supabase/migrations/20260226_onboarding_and_ai_slot.sql`

**Step 1: Write the migration**

```sql
-- supabase/migrations/20260226_onboarding_and_ai_slot.sql

-- Track whether a user has completed onboarding
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Free tier: track which collection gets AI synthesis
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_collection_id uuid REFERENCES collections(id) ON DELETE SET NULL;
```

> Note: If your users table is `auth.users` extended by a `profiles` table, apply to `profiles`. If it's a custom `users` table, apply there. Check your existing schema to confirm.

**Step 2: Apply migration locally**

```bash
npx supabase db push
# or: npx supabase migration up
```

Expected: migration applies cleanly, no errors.

**Step 3: Verify columns exist**

```bash
npx supabase db diff --schema public
```

Expected: `onboarding_completed` and `ai_collection_id` columns visible on `profiles`.

**Step 4: Commit**

```bash
git add supabase/migrations/20260226_onboarding_and_ai_slot.sql
git commit -m "feat(db): add onboarding_completed and ai_collection_id to profiles"
```

---

## Task 2: Delete Theme API

**Files:**
- Create: `src/app/api/themes/[id]/route.ts`
- Test: `src/app/api/themes/__tests__/delete.test.ts`

**Step 1: Write the failing test**

```typescript
// src/app/api/themes/__tests__/delete.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock requireUser and supabase before importing the route
vi.mock('@/lib/supabase/server', () => ({
  requireUser: vi.fn(),
}));

describe('DELETE /api/themes/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireUser } = await import('@/lib/supabase/server');
    vi.mocked(requireUser).mockResolvedValue(null);

    const { DELETE } = await import('../[id]/route');
    const req = new Request('http://localhost/api/themes/123', { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: '123' } });

    expect(res.status).toBe(401);
  });

  it('returns 400 when orphan_action is missing', async () => {
    const { requireUser } = await import('@/lib/supabase/server');
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: { from: vi.fn() },
    } as any);

    const { DELETE } = await import('../[id]/route');
    const req = new Request('http://localhost/api/themes/123?orphan_action=invalid');
    const res = await DELETE(req, { params: { id: '123' } });

    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/app/api/themes/__tests__/delete.test.ts
```

Expected: FAIL — route file does not exist yet.

**Step 3: Implement the route**

```typescript
// src/app/api/themes/[id]/route.ts
import { requireUser } from '@/lib/supabase/server';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';

/**
 * DELETE /api/themes/[id]
 * Query params:
 *   orphan_action: 'uncategorize' | 'delete_collections'
 *   move_to_theme_id?: string  (only when orphan_action is 'move')
 * Auth: Cookie-based.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  if (!validateOrigin(request)) return csrfForbidden();

  const url = new URL(request.url);
  const orphanAction = url.searchParams.get('orphan_action');

  if (orphanAction !== 'uncategorize' && orphanAction !== 'delete_collections') {
    return Response.json(
      { error: 'orphan_action must be "uncategorize" or "delete_collections"' },
      { status: 400 }
    );
  }

  // Verify theme belongs to user
  const { data: theme, error: fetchError } = await supabase
    .from('themes')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !theme) {
    return Response.json({ error: 'Theme not found' }, { status: 404 });
  }

  if (orphanAction === 'uncategorize') {
    // Null out theme_id on all collections in this theme
    await supabase
      .from('collections')
      .update({ theme_id: null })
      .eq('theme_id', params.id)
      .eq('user_id', user.id);
  } else {
    // delete_collections: delete all collections (tweets → uncategorized via cascade/trigger)
    // First uncategorize tweets in those collections
    const { data: collections } = await supabase
      .from('collections')
      .select('id')
      .eq('theme_id', params.id)
      .eq('user_id', user.id);

    if (collections && collections.length > 0) {
      const ids = collections.map((c) => c.id);
      await supabase
        .from('tweets')
        .update({ collection_id: null })
        .in('collection_id', ids)
        .eq('user_id', user.id);

      await supabase
        .from('collections')
        .delete()
        .in('id', ids)
        .eq('user_id', user.id);
    }
  }

  const { error: deleteError } = await supabase
    .from('themes')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (deleteError) {
    console.error('[DB] Failed to delete theme:', deleteError.message);
    return Response.json({ error: 'Failed to delete theme' }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- src/app/api/themes/__tests__/delete.test.ts
```

Expected: PASS.

**Step 5: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 6: Commit**

```bash
git add src/app/api/themes/[id]/route.ts src/app/api/themes/__tests__/delete.test.ts
git commit -m "feat(api): add DELETE /api/themes/[id] with orphan_action handling"
```

---

## Task 3: Delete Collection API

**Files:**
- Create: `src/app/api/collections/[id]/route.ts` (add DELETE to existing file if it exists, else create)
- Test: `src/app/api/collections/__tests__/delete.test.ts`

**Step 1: Check if [id]/route.ts already exists**

```bash
ls src/app/api/collections/
```

If `[id]/route.ts` exists, add a `DELETE` export to it. If not, create it.

**Step 2: Write the failing test**

```typescript
// src/app/api/collections/__tests__/delete.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  requireUser: vi.fn(),
}));

describe('DELETE /api/collections/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireUser } = await import('@/lib/supabase/server');
    vi.mocked(requireUser).mockResolvedValue(null);

    const { DELETE } = await import('../[id]/route');
    const req = new Request('http://localhost/api/collections/abc');
    const res = await DELETE(req, { params: { id: 'abc' } });

    expect(res.status).toBe(401);
  });

  it('returns 204 and uncategorizes tweets on success', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      data: null,
      error: null,
    });
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'abc' }, error: null }),
    });

    const { requireUser } = await import('@/lib/supabase/server');
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: { from: vi.fn((table: string) => ({ select: mockSelect, update: mockUpdate, delete: mockDelete })) },
    } as any);

    const { DELETE } = await import('../[id]/route');
    const req = new Request('http://localhost/api/collections/abc');
    const res = await DELETE(req, { params: { id: 'abc' } });

    expect(res.status).toBe(204);
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npm test -- src/app/api/collections/__tests__/delete.test.ts
```

**Step 4: Implement DELETE in [id]/route.ts**

```typescript
// Add to src/app/api/collections/[id]/route.ts
import { requireUser } from '@/lib/supabase/server';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  if (!validateOrigin(request)) return csrfForbidden();

  // Verify collection belongs to user
  const { data: collection, error: fetchError } = await supabase
    .from('collections')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !collection) {
    return Response.json({ error: 'Collection not found' }, { status: 404 });
  }

  // Uncategorize tweets in this collection
  await supabase
    .from('tweets')
    .update({ collection_id: null })
    .eq('collection_id', params.id)
    .eq('user_id', user.id);

  // Clear free AI slot if this was it
  await supabase
    .from('profiles')
    .update({ ai_collection_id: null })
    .eq('ai_collection_id', params.id)
    .eq('id', user.id);

  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[DB] Failed to delete collection:', error.message);
    return Response.json({ error: 'Failed to delete collection' }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
```

**Step 5: Run tests + type-check**

```bash
npm test -- src/app/api/collections/__tests__/delete.test.ts
npm run type-check
```

**Step 6: Commit**

```bash
git add src/app/api/collections/[id]/route.ts src/app/api/collections/__tests__/delete.test.ts
git commit -m "feat(api): add DELETE /api/collections/[id]"
```

---

## Task 4: Reset Corpus API

**Files:**
- Create: `src/app/api/corpus/reset/route.ts`
- Test: `src/app/api/corpus/__tests__/reset.test.ts`

**Step 1: Write the failing test**

```typescript
// src/app/api/corpus/__tests__/reset.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ requireUser: vi.fn() }));
vi.mock('@/lib/csrf', () => ({ validateOrigin: vi.fn(() => true), csrfForbidden: vi.fn() }));

describe('POST /api/corpus/reset', () => {
  it('returns 401 when unauthenticated', async () => {
    const { requireUser } = await import('@/lib/supabase/server');
    vi.mocked(requireUser).mockResolvedValue(null);

    const { POST } = await import('../reset/route');
    const req = new Request('http://localhost/api/corpus/reset', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    const mockChain = { eq: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), error: null };
    const { requireUser } = await import('@/lib/supabase/server');
    vi.mocked(requireUser).mockResolvedValue({
      user: { id: 'user-1' },
      supabase: { from: vi.fn(() => mockChain) },
    } as any);

    const { POST } = await import('../reset/route');
    const req = new Request('http://localhost/api/corpus/reset', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/app/api/corpus/__tests__/reset.test.ts
```

**Step 3: Implement the route**

```typescript
// src/app/api/corpus/reset/route.ts
import { requireUser } from '@/lib/supabase/server';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';

/**
 * POST /api/corpus/reset
 * Wipes all themes and collections. Tweets are kept but uncategorized.
 * Resets onboarding_completed so the picker shows again.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  if (!validateOrigin(request)) return csrfForbidden();

  // 1. Uncategorize all tweets
  await supabase
    .from('tweets')
    .update({ collection_id: null })
    .eq('user_id', user.id);

  // 2. Delete all collections (theme_id FK will be satisfied after themes delete)
  await supabase
    .from('collections')
    .delete()
    .eq('user_id', user.id);

  // 3. Delete all themes
  await supabase
    .from('themes')
    .delete()
    .eq('user_id', user.id);

  // 4. Reset onboarding state and free AI slot
  await supabase
    .from('profiles')
    .update({ onboarding_completed: false, ai_collection_id: null })
    .eq('id', user.id);

  return Response.json({ ok: true });
}
```

**Step 4: Run tests + type-check**

```bash
npm test -- src/app/api/corpus/__tests__/reset.test.ts
npm run type-check
```

**Step 5: Commit**

```bash
git add src/app/api/corpus/reset/route.ts src/app/api/corpus/__tests__/reset.test.ts
git commit -m "feat(api): add POST /api/corpus/reset"
```

---

## Task 5: Stripe One-Time Checkout

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`
- Create: `src/app/api/stripe/webhook/route.ts`
- Modify: `src/lib/stripe.ts` (create if missing)

**Step 1: Install Stripe SDK (if not already installed)**

```bash
npm install stripe
```

Check `package.json` first — if `stripe` is already listed, skip this.

**Step 2: Create Stripe client helper**

```typescript
// src/lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID!;
// Create a one-time price in Stripe Dashboard (e.g. $24 USD), copy the price ID to .env.local
```

Add to `.env.local` and `.env.template`:
```
STRIPE_PRO_PRICE_ID=price_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

**Step 3: Write checkout route**

```typescript
// src/app/api/stripe/checkout/route.ts
import { requireUser } from '@/lib/supabase/server';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';
import { stripe, PRO_PRICE_ID } from '@/lib/stripe';

export async function POST(request: Request) {
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
```

**Step 4: Write webhook route**

```typescript
// src/app/api/stripe/webhook/route.ts
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(
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
      const supabase = createAdminClient();
      await supabase
        .from('profiles')
        .update({ plan: 'pro' })
        .eq('id', userId);
    }
  }

  return Response.json({ received: true });
}
```

> Note: `createAdminClient` uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS. Check `src/lib/supabase/` for an existing admin client helper — use that pattern instead of creating a new one.

**Step 5: Add webhook config to next.config.ts**

Stripe webhooks need the raw body. Add to `next.config.ts`:

```typescript
// In your Next.js config, ensure /api/stripe/webhook is not parsed by body parser
// Next.js App Router handles this automatically — no config needed.
```

**Step 6: Type-check**

```bash
npm run type-check
```

**Step 7: Commit**

```bash
git add src/lib/stripe.ts src/app/api/stripe/checkout/route.ts src/app/api/stripe/webhook/route.ts
git commit -m "feat(stripe): add one-time checkout and webhook to upgrade plan"
```

---

## Task 6: Update AI Categorizer to Use User's Taxonomy

**Goal:** Instead of inventing a theme, AI receives the user's theme list and must classify into one of them.

**Files:**
- Modify: wherever `aiRouter.categorize()` is called (likely `src/app/api/tweets/route.ts` or a background job)
- Modify: `src/lib/ai-router.ts` — update the `categorize` method signature and prompt

**Step 1: Find where categorization is called**

```bash
grep -r "categorize\|aiRouter\|ai-router" src/ --include="*.ts" -l
```

Read those files to understand the current prompt structure.

**Step 2: Update the categorize method signature**

In `src/lib/ai-router.ts`, find the `categorize` method and update its signature to accept `userThemes`:

```typescript
// Before:
async categorize(content: string, existingCollections: string[])

// After:
async categorize(
  content: string,
  existingCollections: string[],
  userThemes: string[]   // the user's theme names — AI must pick one
)
```

**Step 3: Update the prompt**

In the prompt string, change the theme instruction from:

```
// Old: "Suggest a broad 2-4 word theme"
```

To:

```typescript
const themeInstruction = userThemes.length > 0
  ? `You MUST assign one of these exact themes: ${userThemes.join(', ')}. Do not invent a new theme.`
  : `Assign a broad 2-4 word theme (e.g. "AI & Machine Learning", "Finance").`;
```

If `userThemes` is empty (user hasn't done onboarding yet), fall back to the old behavior.

**Step 4: Fetch user themes before calling categorize**

In the tweet processing route, before calling `categorize`:

```typescript
// Fetch user's themes
const { data: themesData } = await supabase
  .from('themes')
  .select('name')
  .eq('user_id', user.id)
  .order('name');

const userThemes = (themesData ?? []).map((t) => t.name);

// Pass to categorize
const result = await aiRouter.categorize(tweetContent, existingCollections, userThemes);
```

**Step 5: Handle "no good match" → uncategorized**

In the prompt, add instruction:

```
If the content does not clearly match any of the provided themes, respond with theme_name: "__uncategorized__".
```

In the processing code:

```typescript
if (result.theme_name === '__uncategorized__') {
  // Save tweet with collection_id = null (uncategorized inbox)
  tweet.collection_id = null;
} else {
  // Normal flow: resolve theme + collection
}
```

**Step 6: Type-check**

```bash
npm run type-check
```

**Step 7: Commit**

```bash
git add src/lib/ai-router.ts src/app/api/tweets/route.ts
git commit -m "feat(ai): update categorizer to classify into user-defined taxonomy"
```

---

## Task 7: AI Category Suggestions API (Pro)

**Files:**
- Create: `src/app/api/ai/suggest-categories/route.ts`

**Step 1: Implement the route**

```typescript
// src/app/api/ai/suggest-categories/route.ts
import { requireUser } from '@/lib/supabase/server';
import { aiRouter } from '@/lib/ai-router';

/**
 * GET /api/ai/suggest-categories
 * Pro only. Returns 10-15 suggested theme names based on the user's captured tweets.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  // Check plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profile?.plan !== 'pro') {
    return Response.json({ error: 'Pro plan required' }, { status: 403 });
  }

  // Sample up to 50 recent tweets for context
  const { data: tweets } = await supabase
    .from('tweets')
    .select('content')
    .eq('user_id', user.id)
    .order('captured_at', { ascending: false })
    .limit(50);

  const sampleContent = (tweets ?? []).map((t) => t.content).join('\n---\n');

  const suggestions = await aiRouter.suggestCategories(sampleContent);

  return Response.json({ suggestions });
}
```

**Step 2: Add `suggestCategories` to AIRouter**

In `src/lib/ai-router.ts`, add:

```typescript
async suggestCategories(sampleContent: string): Promise<string[]> {
  const prompt = `Based on these tweet samples, suggest 12-15 broad knowledge categories (2-4 words each) the user cares about.
Return as a JSON array of strings only.
Samples:
${sampleContent}`;

  const response = await this.callProvider(prompt);
  try {
    return JSON.parse(response);
  } catch {
    return [];
  }
}
```

**Step 3: Type-check**

```bash
npm run type-check
```

**Step 4: Commit**

```bash
git add src/app/api/ai/suggest-categories/route.ts src/lib/ai-router.ts
git commit -m "feat(api): add GET /api/ai/suggest-categories for Pro users"
```

---

## Task 8: AI Sort Inbox API (Pro)

**Files:**
- Create: `src/app/api/ai/sort-inbox/route.ts`

**Step 1: Implement the route**

```typescript
// src/app/api/ai/sort-inbox/route.ts
import { requireUser } from '@/lib/supabase/server';
import { aiRouter } from '@/lib/ai-router';

/**
 * POST /api/ai/sort-inbox
 * Pro only. Batch-classifies all uncategorized tweets into the user's taxonomy.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  // Check plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profile?.plan !== 'pro') {
    return Response.json({ error: 'Pro plan required' }, { status: 403 });
  }

  // Fetch user's themes
  const { data: themesData } = await supabase
    .from('themes')
    .select('id, name')
    .eq('user_id', user.id);

  // Fetch uncategorized tweets (up to 50 at a time)
  const { data: tweets } = await supabase
    .from('tweets')
    .select('id, content')
    .eq('user_id', user.id)
    .is('collection_id', null)
    .limit(50);

  if (!tweets || tweets.length === 0) {
    return Response.json({ sorted: 0 });
  }

  const userThemes = (themesData ?? []).map((t) => t.name);
  let sorted = 0;

  for (const tweet of tweets) {
    const result = await aiRouter.categorize(tweet.content, [], userThemes);
    if (result.theme_name === '__uncategorized__') continue;

    // Resolve/create theme and collection, then assign tweet
    // Use the same resolveTheme + resolveCollection helpers used in tweet capture
    // (reference src/app/api/tweets/route.ts for the pattern)
    sorted++;
  }

  return Response.json({ sorted });
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

**Step 3: Commit**

```bash
git add src/app/api/ai/sort-inbox/route.ts
git commit -m "feat(api): add POST /api/ai/sort-inbox for Pro users"
```

---

## Task 9: Free Tier AI Synthesis Enforcement

**Goal:** Free users can only get AI synthesis on 1 collection with ≤5 tweets. Enforce at the synthesis API.

**Files:**
- Modify: wherever AI summary/conclusions generation is triggered (likely `src/app/api/collections/[id]/summarize/route.ts` or similar)

**Step 1: Find the synthesis endpoint**

```bash
grep -r "ai_summary\|ai_conclusions\|summarize\|conclusions" src/app/api/ --include="*.ts" -l
```

Read that file to understand the current flow.

**Step 2: Add plan enforcement**

At the top of the synthesis handler, after auth:

```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('plan, ai_collection_id')
  .eq('id', user.id)
  .single();

const isFree = profile?.plan !== 'pro';

if (isFree) {
  const requestedCollectionId = params.id; // or however collection ID is passed

  // Check if user already has a different AI collection
  if (
    profile?.ai_collection_id &&
    profile.ai_collection_id !== requestedCollectionId
  ) {
    return Response.json(
      { error: 'upgrade_required', reason: 'ai_collection_limit' },
      { status: 403 }
    );
  }

  // Check tweet count in this collection
  const { count } = await supabase
    .from('tweets')
    .select('id', { count: 'exact', head: true })
    .eq('collection_id', requestedCollectionId)
    .eq('user_id', user.id);

  if ((count ?? 0) > 5) {
    return Response.json(
      { error: 'upgrade_required', reason: 'tweet_count_limit' },
      { status: 403 }
    );
  }

  // If first time, set this as their AI collection
  if (!profile?.ai_collection_id) {
    await supabase
      .from('profiles')
      .update({ ai_collection_id: requestedCollectionId })
      .eq('id', user.id);
  }
}
```

**Step 3: Type-check**

```bash
npm run type-check
```

**Step 4: Commit**

```bash
git add src/app/api/collections/[id]/summarize/route.ts  # adjust path as needed
git commit -m "feat(api): enforce free tier AI synthesis limits (1 collection, 5 tweets)"
```

---

## Task 10: Onboarding UI — 4-Step Flow

**Files:**
- Create: `src/components/onboarding/OnboardingModal.tsx`
- Create: `src/components/onboarding/steps/WelcomeStep.tsx`
- Create: `src/components/onboarding/steps/ExtensionStep.tsx`
- Create: `src/components/onboarding/steps/TaxonomyStep.tsx`
- Create: `src/components/onboarding/steps/AiSlotStep.tsx`
- Modify: `src/app/dashboard/page.tsx` (or layout) — show modal when `onboarding_completed` is false

**Step 1: Create the taxonomy step (most complex)**

```typescript
// src/components/onboarding/steps/TaxonomyStep.tsx
'use client';

import { useState } from 'react';

const DEFAULT_CHIPS = [
  'AI & Machine Learning',
  'Startups & Business',
  'Design & Creativity',
  'Programming & Dev Tools',
  'Finance & Investing',
  'Science & Research',
  'Health & Longevity',
  'Productivity & Focus',
  'Marketing & Growth',
  'Writing & Communication',
  'Philosophy & Ideas',
  'Current Events',
];

interface Props {
  isPro: boolean;
  onConfirm: (themes: string[]) => void;
}

export default function TaxonomyStep({ isPro, onConfirm }: Props) {
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState('');

  function toggle(chip: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(chip) ? next.delete(chip) : next.add(chip);
      return next;
    });
  }

  function addCustom() {
    const name = custom.trim();
    if (!name || chips.includes(name)) return;
    setChips((prev) => [...prev, name]);
    setSelected((prev) => new Set([...prev, name]));
    setCustom('');
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">What do you learn about?</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select the topics you bookmark. AI will classify your tweets into these areas.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip}
            onClick={() => toggle(chip)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              selected.has(chip)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
            }`}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          placeholder="Add your own..."
          className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
        />
        <button
          onClick={addCustom}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          Add
        </button>
        {isPro && (
          <button className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700">
            ✦ AI Suggest
          </button>
        )}
      </div>

      <button
        disabled={selected.size === 0}
        onClick={() => onConfirm(Array.from(selected))}
        className="w-full py-2 bg-blue-600 text-white rounded-lg disabled:opacity-40"
      >
        Continue with {selected.size} topic{selected.size !== 1 ? 's' : ''}
      </button>
    </div>
  );
}
```

**Step 2: Create the orchestrating OnboardingModal**

```typescript
// src/components/onboarding/OnboardingModal.tsx
'use client';

import { useState } from 'react';
import WelcomeStep from './steps/WelcomeStep';
import ExtensionStep from './steps/ExtensionStep';
import TaxonomyStep from './steps/TaxonomyStep';
import AiSlotStep from './steps/AiSlotStep';

interface Props {
  isPro: boolean;
  onComplete: () => void;
}

export default function OnboardingModal({ isPro, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);

  async function handleTaxonomyConfirm(themes: string[]) {
    setSelectedThemes(themes);
    // Create themes via API
    await Promise.all(
      themes.map((name) =>
        fetch('/api/themes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
      )
    );
    isPro ? handleComplete() : setStep(4);
  }

  async function handleComplete() {
    await fetch('/api/onboarding/complete', { method: 'POST' });
    onComplete();
  }

  const totalSteps = isPro ? 3 : 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i + 1 <= step ? 'bg-blue-600' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {step === 1 && <WelcomeStep onNext={() => setStep(2)} />}
        {step === 2 && <ExtensionStep onNext={() => setStep(3)} />}
        {step === 3 && (
          <TaxonomyStep isPro={isPro} onConfirm={handleTaxonomyConfirm} />
        )}
        {step === 4 && !isPro && (
          <AiSlotStep themes={selectedThemes} onComplete={handleComplete} />
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create simple step components**

```typescript
// src/components/onboarding/steps/WelcomeStep.tsx
export default function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col gap-6 text-center">
      <h1 className="text-2xl font-bold">Turn bookmarks into knowledge</h1>
      <p className="text-gray-500">
        Xpedia organizes your X bookmarks into a structured corpus — by topic, automatically.
      </p>
      <button onClick={onNext} className="w-full py-2 bg-blue-600 text-white rounded-lg">
        Get started
      </button>
    </div>
  );
}
```

```typescript
// src/components/onboarding/steps/ExtensionStep.tsx
export default function ExtensionStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Install the Chrome extension</h2>
      <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
        <li>Install the Xpedia Chrome extension</li>
        <li>Pin it to your toolbar</li>
        <li>Open x.com/i/bookmarks and click the extension</li>
      </ol>
      <div className="flex gap-3">
        <button onClick={onNext} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">
          Skip for now
        </button>
        <button onClick={onNext} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm">
          I've installed it
        </button>
      </div>
    </div>
  );
}
```

```typescript
// src/components/onboarding/steps/AiSlotStep.tsx
import { useState } from 'react';

interface Props {
  themes: string[];
  onComplete: (collectionName: string) => void;
}

export default function AiSlotStep({ themes, onComplete }: Props) {
  const [name, setName] = useState('');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Pick your AI-powered collection</h2>
        <p className="text-sm text-gray-500 mt-1">
          One collection gets AI summaries and conclusions for free. Choose wisely.
        </p>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. LLM Prompting, SaaS Growth..."
        className="border border-gray-300 rounded px-3 py-2 text-sm"
      />
      <button
        disabled={!name.trim()}
        onClick={() => onComplete(name.trim())}
        className="w-full py-2 bg-blue-600 text-white rounded-lg disabled:opacity-40"
      >
        Start building
      </button>
    </div>
  );
}
```

**Step 4: Create the onboarding complete API route**

```typescript
// src/app/api/onboarding/complete/route.ts
import { requireUser } from '@/lib/supabase/server';
import { validateOrigin, csrfForbidden } from '@/lib/csrf';

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { user, supabase } = auth;

  if (!validateOrigin(request)) return csrfForbidden();

  await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id);

  return Response.json({ ok: true });
}
```

**Step 5: Wire OnboardingModal into the dashboard**

In `src/app/dashboard/page.tsx` (or its layout):

```typescript
// Fetch profile to check onboarding status
const { data: profile } = await supabase.from('profiles').select('onboarding_completed, plan').eq('id', user.id).single();

// Pass to a client component that conditionally renders <OnboardingModal>
```

**Step 6: Type-check**

```bash
npm run type-check
```

**Step 7: Commit**

```bash
git add src/components/onboarding/ src/app/api/onboarding/
git commit -m "feat(ui): add 4-step onboarding modal with interest picker"
```

---

## Task 11: Uncategorized Inbox in Sidebar

**Files:**
- Modify: the sidebar component (likely `src/components/ThemeSidebar.tsx` or similar)
- Modify: `src/app/api/tweets/route.ts` GET — add support for `?collection_id=null`

**Step 1: Find the sidebar component**

```bash
grep -r "ThemeSidebar\|sidebar\|Sidebar" src/components/ --include="*.tsx" -l
```

**Step 2: Add "Uncategorized" count to the themes API**

In `GET /api/themes`, add a count of uncategorized tweets to the response:

```typescript
const { count: uncategorizedCount } = await supabase
  .from('tweets')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .is('collection_id', null);

return Response.json({ themes, uncategorizedCount: uncategorizedCount ?? 0 });
```

**Step 3: Add Uncategorized item to sidebar**

At the bottom of the theme list in the sidebar component:

```tsx
{uncategorizedCount > 0 && (
  <button
    onClick={() => onSelectUncategorized()}
    className={`w-full text-left px-3 py-2 rounded text-sm text-gray-500 hover:bg-gray-100 flex justify-between ${
      selectedTheme === '__uncategorized__' ? 'bg-gray-100 font-medium' : ''
    }`}
  >
    <span>Uncategorized</span>
    <span className="text-xs bg-gray-200 rounded-full px-2 py-0.5">{uncategorizedCount}</span>
  </button>
)}
```

**Step 4: Create the uncategorized inbox view**

When `selectedTheme === '__uncategorized__'`, render a list of uncategorized tweets with a collection assignment dropdown per tweet. Pro users see "AI Sort All" button at the top.

**Step 5: Type-check**

```bash
npm run type-check
```

**Step 6: Commit**

```bash
git add src/components/
git commit -m "feat(ui): add uncategorized inbox to sidebar"
```

---

## Task 12: Pro Upgrade Modal + Lock Icons

**Files:**
- Create: `src/components/ProUpgradeModal.tsx`
- Create: `src/components/ProLock.tsx`
- Modify: any component with Pro-gated features

**Step 1: Create the upgrade modal**

```typescript
// src/components/ProUpgradeModal.tsx
'use client';

interface Props {
  onClose: () => void;
  reason?: 'ai_collection_limit' | 'tweet_count_limit' | 'feature';
}

const REASON_TEXT: Record<string, string> = {
  ai_collection_limit: 'Free plan includes AI synthesis for 1 collection. Upgrade for unlimited.',
  tweet_count_limit: 'Free plan synthesizes up to 5 tweets. Upgrade for unlimited.',
  feature: 'This feature is available on Pro.',
};

export default function ProUpgradeModal({ onClose, reason = 'feature' }: Props) {
  async function handleUpgrade() {
    const res = await fetch('/api/stripe/checkout', { method: 'POST' });
    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl text-center">
        <div className="text-3xl mb-4">✦</div>
        <h2 className="text-xl font-semibold mb-2">Upgrade to Pro</h2>
        <p className="text-sm text-gray-500 mb-6">{REASON_TEXT[reason]}</p>
        <button
          onClick={handleUpgrade}
          className="w-full py-2 bg-blue-600 text-white rounded-lg mb-3"
        >
          Upgrade — one-time payment
        </button>
        <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">
          Maybe later
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Create the ProLock wrapper**

```typescript
// src/components/ProLock.tsx
'use client';

import { useState } from 'react';
import ProUpgradeModal from './ProUpgradeModal';

interface Props {
  isPro: boolean;
  children: React.ReactNode;
  reason?: 'ai_collection_limit' | 'tweet_count_limit' | 'feature';
}

export default function ProLock({ isPro, children, reason }: Props) {
  const [showModal, setShowModal] = useState(false);

  if (isPro) return <>{children}</>;

  return (
    <>
      <div className="relative cursor-pointer" onClick={() => setShowModal(true)}>
        <div className="opacity-40 pointer-events-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs bg-gray-900 text-white px-2 py-1 rounded-full">✦ Pro</span>
        </div>
      </div>
      {showModal && (
        <ProUpgradeModal reason={reason} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
```

**Step 3: Apply ProLock to gated features**

Wrap Pro-only buttons/sections:

```tsx
<ProLock isPro={isPro} reason="feature">
  <button>AI Sort All</button>
</ProLock>

<ProLock isPro={isPro} reason="feature">
  <button>Export Markdown</button>
</ProLock>
```

**Step 4: Show upgrade banner on dashboard when `?upgraded=true`**

In the dashboard, check for the query param (set by Stripe success URL) and show a success toast.

**Step 5: Type-check**

```bash
npm run type-check
```

**Step 6: Commit**

```bash
git add src/components/ProUpgradeModal.tsx src/components/ProLock.tsx
git commit -m "feat(ui): add Pro upgrade modal and ProLock wrapper component"
```

---

## Task 13: Settings — Delete Theme & Reset Corpus UI

**Files:**
- Modify: `src/app/settings/page.tsx` (or wherever settings live)

**Step 1: Find the settings page**

```bash
grep -r "settings\|Settings" src/app/ --include="*.tsx" -l
```

**Step 2: Add Corpus section**

```tsx
{/* Corpus section in settings */}
<section className="border border-red-200 rounded-xl p-6">
  <h3 className="text-base font-semibold text-red-700 mb-1">Danger Zone</h3>
  <p className="text-sm text-gray-500 mb-4">
    These actions are permanent. Tweets are never deleted.
  </p>
  <button
    onClick={() => setShowResetConfirm(true)}
    className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
  >
    Reset corpus
  </button>
</section>
```

**Step 3: Add the confirmation dialog**

```tsx
{showResetConfirm && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-xl">
      <h3 className="text-lg font-semibold mb-2">Reset your corpus?</h3>
      <p className="text-sm text-gray-500 mb-6">
        All themes and collections will be deleted. Your tweets are kept but become uncategorized.
        You'll be taken back through onboarding.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => setShowResetConfirm(false)}
          className="flex-1 py-2 border border-gray-300 rounded-lg text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleReset}
          className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm"
        >
          Reset
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 4: Implement handleReset**

```typescript
async function handleReset() {
  await fetch('/api/corpus/reset', { method: 'POST' });
  setShowResetConfirm(false);
  router.push('/dashboard'); // onboarding modal will show automatically
}
```

**Step 5: Type-check + commit**

```bash
npm run type-check
git add src/app/settings/
git commit -m "feat(ui): add corpus reset to settings danger zone"
```

---

## Task 14: Final Verification

**Step 1: Run full type-check**

```bash
npm run type-check
```

Expected: zero errors.

**Step 2: Run linter**

```bash
npm run lint
```

Expected: zero errors.

**Step 3: Run full test suite**

```bash
npm test -- --run
```

Expected: all tests pass.

**Step 4: Build**

```bash
npm run build
```

Expected: build succeeds with no errors.

**Step 5: Manual smoke test checklist**

- [ ] New user sees 4-step onboarding
- [ ] Interest picker creates themes
- [ ] Free user: AI synthesis works on 1 collection ≤5 tweets
- [ ] Free user: 2nd collection synthesis shows upgrade modal
- [ ] Clicking any Pro lock icon opens upgrade modal
- [ ] Stripe checkout opens on upgrade click
- [ ] After payment, plan updates to Pro (test with Stripe CLI: `stripe trigger checkout.session.completed`)
- [ ] Uncategorized inbox shows tweets with no collection
- [ ] Delete theme: collections move or are deleted based on choice
- [ ] Reset corpus: all themes/collections gone, tweets uncategorized, onboarding re-shows

**Step 6: Final commit if any cleanup needed**

```bash
git add .
git commit -m "chore: final cleanup and verification"
```
