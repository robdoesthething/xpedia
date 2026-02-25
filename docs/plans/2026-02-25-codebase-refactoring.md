# Codebase Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the 11 highest-impact duplication, type-safety, and correctness issues across the Xpedia codebase with zero behavior changes.

**Architecture:** Bottom-up: shared utilities first (Tasks 1–3), then `ai-router.ts` internal cleanup (Tasks 4–6), then bug fix (Task 7), then component refactors (Tasks 8–9), then deletion (Tasks 10–11).

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase SSR (`@supabase/ssr`), Tailwind, React

---

## Task 1: Extract `createServiceClient` into a shared module

**Why:** The same 4-line function is copy-pasted in 5 files — `src/lib/ai-logger.ts`, `src/app/api/tweets/categorize/route.ts`, `src/app/api/themes/[id]/synthesise/route.ts`, `src/app/api/collections/assign-themes/route.ts`, `src/app/dashboard/admin/page.tsx`.

**Files:**
- Create: `src/lib/supabase/service.ts`
- Modify: `src/lib/ai-logger.ts`
- Modify: `src/app/api/tweets/categorize/route.ts`
- Modify: `src/app/api/themes/[id]/synthesise/route.ts`
- Modify: `src/app/api/collections/assign-themes/route.ts`
- Modify: `src/app/dashboard/admin/page.tsx`
- Modify: `src/lib/regenerate-collection.ts` (already has its own local copy)

**Step 1: Create the new module**

```typescript
// src/lib/supabase/service.ts
import { createClient } from '@supabase/supabase-js';

let _client: ReturnType<typeof createClient> | null = null;

/** Service-role Supabase client. Bypasses RLS. Singleton per serverless instance. */
export function createServiceClient() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _client;
}

export type SupabaseServiceClient = ReturnType<typeof createServiceClient>;
```

**Step 2: Update `src/lib/ai-logger.ts`**

Remove the local `getServiceClient` singleton and replace with the shared one:

```typescript
import { createServiceClient } from '@/lib/supabase/service';

export function logAiCall(params: { ... }) {
  const supabase = createServiceClient();
  supabase.from('ai_calls').insert({ ... } as never) // as never stays for now — fixed in Task 3
  ...
}
```

Remove the `let serviceClient` variable and the `getServiceClient()` function entirely.

**Step 3: Update `src/app/api/tweets/categorize/route.ts`**

Remove the local `createServiceClient` function (lines 70-75). Add import at top:
```typescript
import { createServiceClient } from '@/lib/supabase/service';
```

**Step 4: Update `src/app/api/themes/[id]/synthesise/route.ts`**

Remove the local `createServiceClient` function (lines 10-15). Add import at top:
```typescript
import { createServiceClient } from '@/lib/supabase/service';
```

**Step 5: Update `src/app/api/collections/assign-themes/route.ts`**

Remove the local `createServiceClient` function (lines 7-12). Add import at top:
```typescript
import { createServiceClient } from '@/lib/supabase/service';
```

Update `resolveTheme` signature to use the shared type:
```typescript
import { createServiceClient, type SupabaseServiceClient } from '@/lib/supabase/service';

async function resolveTheme(
  supabase: SupabaseServiceClient,
  ...
```

**Step 6: Update `src/app/dashboard/admin/page.tsx`**

Remove the local `createServiceClient` function (lines 6-11). Add import at top:
```typescript
import { createServiceClient } from '@/lib/supabase/service';
```

**Step 7: Update `src/lib/regenerate-collection.ts`**

Remove the local `createServiceClient` function (lines 6-11) and the local `SupabaseServiceClient` type alias (line 13). Add import at top:
```typescript
import { createServiceClient, type SupabaseServiceClient } from '@/lib/supabase/service';
```

**Step 8: Run type check**

```bash
npm run type-check
```
Expected: no errors.

**Step 9: Commit**

```bash
git add src/lib/supabase/service.ts src/lib/ai-logger.ts src/lib/regenerate-collection.ts \
  src/app/api/tweets/categorize/route.ts src/app/api/themes/[id]/synthesise/route.ts \
  src/app/api/collections/assign-themes/route.ts src/app/dashboard/admin/page.tsx
git commit -m "refactor(supabase): extract createServiceClient to shared module"
```

---

## Task 2: Add `rateLimitResponse()` helper

**Why:** A 5-line 429 response block is copy-pasted in 7 route handlers. The message and headers are slightly inconsistent across callers.

**Files:**
- Modify: `src/lib/rate-limit.ts`
- Modify: `src/app/api/tweets/route.ts` (GET has no rate limit — only POST does, via the bearer-token path)
- Modify: `src/app/api/tweets/categorize/route.ts`
- Modify: `src/app/api/collections/route.ts`
- Modify: `src/app/api/collections/[id]/regenerate/route.ts`
- Modify: `src/app/api/themes/route.ts`
- Modify: `src/app/api/themes/[id]/synthesise/route.ts`
- Modify: `src/app/api/collections/assign-themes/route.ts`

**Step 1: Add helper to `src/lib/rate-limit.ts`**

Append to the end of the file:

```typescript
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
```

**Step 2: Update each route**

In every route that has the 5-line `if (!rl.allowed) { return Response.json(...) }` block, replace with a one-liner. Add the import to each file:

```typescript
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
```

Replace the block pattern:
```typescript
// BEFORE
if (!rl.allowed) {
  return Response.json(
    { error: 'Too many requests. Please wait before categorizing again.' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
  );
}

// AFTER
if (!rl.allowed) return rateLimitResponse(rl, 'Too many requests. Please wait before categorizing again.');
```

The `tweets/route.ts` POST has CORS headers alongside the 429 — pass them as third arg:
```typescript
if (!rl.allowed) return rateLimitResponse(rl, 'Too many requests. Please wait before sending more tweets.', cors);
```

**Step 3: Run type check**

```bash
npm run type-check
```
Expected: no errors.

**Step 4: Commit**

```bash
git add src/lib/rate-limit.ts src/app/api/tweets/route.ts src/app/api/tweets/categorize/route.ts \
  src/app/api/collections/route.ts src/app/api/collections/[id]/regenerate/route.ts \
  src/app/api/themes/route.ts src/app/api/themes/[id]/synthesise/route.ts \
  src/app/api/collections/assign-themes/route.ts
git commit -m "refactor(rate-limit): extract rateLimitResponse helper, apply to all routes"
```

---

## Task 3: Fix `as never` in `ai-logger.ts`

**Why:** `as never` on line 34 of `src/lib/ai-logger.ts` completely bypasses TypeScript type checking on the DB insert payload. A misspelled column name would be silently ignored.

**Files:**
- Modify: `src/lib/ai-logger.ts`

**Step 1: Define the insert type inline**

The `ai_calls` table has columns: `user_id`, `provider`, `operation`, `tokens_in`, `tokens_out`. Add a local interface and remove the cast:

```typescript
interface AiCallInsert {
  user_id: string | null;
  provider: string;
  operation: string;
  tokens_in: number;
  tokens_out: number;
}

export function logAiCall(params: {
  userId?: string;
  provider: string;
  operation: string;
  tokensIn: number;
  tokensOut: number;
}) {
  const supabase = createServiceClient();

  const payload: AiCallInsert = {
    user_id: params.userId ?? null,
    provider: params.provider,
    operation: params.operation,
    tokens_in: params.tokensIn,
    tokens_out: params.tokensOut,
  };

  supabase
    .from('ai_calls')
    .insert(payload)  // no cast needed
    .then(({ error }) => {
      if (error) console.error('[AI Logger] Failed to log call:', error.message);
    });
}
```

Note: If Supabase's generated types still complain (because `ai_calls` isn't in the typed schema), use `supabase.from('ai_calls' as string)` rather than `as never` — this is a narrower escape hatch. But try without first.

**Step 2: Run type check**

```bash
npm run type-check
```
If Supabase complains about the unknown table name, use the narrower cast:
```typescript
supabase.from('ai_calls' as string).insert(payload)
```

**Step 3: Commit**

```bash
git add src/lib/ai-logger.ts
git commit -m "fix(ai-logger): replace 'as never' cast with typed AiCallInsert interface"
```

---

## Task 4: Extract `formatTweetBlock` helper in `ai-router.ts`

**Why:** The same `.map((t, i) => ...)` tweet-formatting expression is copy-pasted in 5 methods inside `src/lib/ai-router.ts`: `generateSummary` (line 278), `generateConclusions` (line 335), `generateKeyPeople` (line 391), `generateInsights` (line 436), `generateDigest` (line 485).

**Files:**
- Modify: `src/lib/ai-router.ts`

**Step 1: Add the helper function**

Place this immediately after the `cleanJson` function (around line 42), before `callProvider`:

```typescript
/** Format an array of tweets as a numbered list for AI prompts. */
function formatTweetBlock(tweets: { author_handle: string; content: string }[]): string {
  return tweets
    .map((t, i) => `${i + 1}. @${sanitizeForPrompt(t.author_handle, 100)}: ${sanitizeForPrompt(t.content)}`)
    .join('\n');
}
```

**Step 2: Replace all 5 usages**

In each of the 5 methods, find the `.map((t, i) => ...)` expression and replace the entire multi-line map call with `formatTweetBlock(tweets)`.

Each looks like:
```typescript
// BEFORE
const tweetBlock = tweets
  .map((t, i) => `${i + 1}. @${sanitizeForPrompt(t.author_handle, 100)}: ${sanitizeForPrompt(t.content)}`)
  .join('\n');

// AFTER
const tweetBlock = formatTweetBlock(tweets);
```

Note: `generateKeyPeople` also has a `handles` line above the `tweetBlock` — leave that unchanged.

**Step 3: Run type check**

```bash
npm run type-check
```

**Step 4: Commit**

```bash
git add src/lib/ai-router.ts
git commit -m "refactor(ai-router): extract formatTweetBlock helper, remove 5 duplicates"
```

---

## Task 5: Extract `parseAiJson<T>` helper in `ai-router.ts`

**Why:** The same try/catch JSON parse block appears in 5 methods in `src/lib/ai-router.ts`: `categorize`, `generateConclusions`, `generateKeyPeople`, `generateInsights`, `generateDigest`.

**Files:**
- Modify: `src/lib/ai-router.ts`

**Step 1: Add the helper function**

Place immediately after `formatTweetBlock` (after Task 4):

```typescript
/**
 * Parse and clean JSON from an AI response.
 * Returns null (and logs) if parsing fails.
 */
function parseAiJson<T>(raw: string, operationName: string): T | null {
  try {
    return JSON.parse(cleanJson(raw)) as T;
  } catch {
    console.error(`[AI] Failed to parse ${operationName} JSON:`, raw);
    return null;
  }
}
```

**Step 2: Update each method**

`categorize` — replace:
```typescript
// BEFORE
try {
  const parsed = JSON.parse(cleanJson(result.content));
  if (!parsed.theme_name || !parsed.collection_name || !parsed.summary) {
    console.error('[AI] Invalid categorization response:', result.content);
    return null;
  }
  return { ... };
} catch {
  console.error('[AI] Failed to parse categorization JSON:', result.content);
  return null;
}

// AFTER
const parsed = parseAiJson<{ theme_name: string; collection_name: string; summary: string }>(
  result.content, 'categorization'
);
if (!parsed?.theme_name || !parsed.collection_name || !parsed.summary) {
  console.error('[AI] Invalid categorization response:', result.content);
  return null;
}
return { ... };
```

`generateConclusions` — replace:
```typescript
// BEFORE
try {
  const parsed = JSON.parse(cleanJson(result.content));
  if (!Array.isArray(parsed) || parsed.length === 0) { ... return null; }
  return parsed.map(String);
} catch { ... return null; }

// AFTER
const parsed = parseAiJson<unknown[]>(result.content, 'conclusions');
if (!Array.isArray(parsed) || parsed.length === 0) {
  console.error('[AI] Invalid conclusions response:', result.content);
  return null;
}
return parsed.map(String);
```

`generateKeyPeople` — replace:
```typescript
// BEFORE
try {
  const parsed = JSON.parse(cleanJson(result.content));
  if (!Array.isArray(parsed)) return null;
  return parsed.filter(...).map(...);
} catch { ... return null; }

// AFTER
const parsed = parseAiJson<unknown[]>(result.content, 'key_people');
if (!Array.isArray(parsed)) return null;
return parsed.filter(...).map(...);
```

`generateInsights` — same pattern as `generateConclusions`.

`generateDigest` — replace:
```typescript
// BEFORE
try {
  const parsed = JSON.parse(cleanJson(result.content));
  if (!parsed.kta || !parsed.new_voices) return null;
  return { kta: ..., new_voices: ... };
} catch { ... return null; }

// AFTER
const parsed = parseAiJson<{ kta: unknown[]; new_voices: unknown[] }>(result.content, 'digest');
if (!parsed?.kta || !parsed.new_voices) return null;
return { kta: ..., new_voices: ... };
```

**Step 3: Run type check**

```bash
npm run type-check
```

**Step 4: Commit**

```bash
git add src/lib/ai-router.ts
git commit -m "refactor(ai-router): extract parseAiJson helper, remove 5 duplicate try/catch blocks"
```

---

## Task 6: Extract `buildRichTweetText` in `ai-router.ts`

**Why:** The thread/article content enrichment logic is copy-pasted between `categorize()` (lines ~163-173) and `extractContent()` (lines ~228-238) in `src/lib/ai-router.ts`.

**Files:**
- Modify: `src/lib/ai-router.ts`

**Step 1: Add the helper function**

Place after `parseAiJson`:

```typescript
/** Build enriched text for a tweet, preferring thread/article content over raw tweet text. */
function buildRichTweetText(tweet: {
  content: string;
  author_handle: string;
  content_type?: string;
  article_title?: string | null;
  article_description?: string | null;
  article_body?: string | null;
  thread_content?: { content: string }[] | null;
}): string {
  let text: string;

  if (tweet.content_type === 'thread' && tweet.thread_content?.length) {
    text = tweet.thread_content.map((t) => sanitizeForPrompt(t.content)).join('\n---\n');
  } else {
    text = sanitizeForPrompt(tweet.content);
  }

  if (tweet.content_type === 'article') {
    if (tweet.article_title) text = `[Article: ${sanitizeForPrompt(tweet.article_title, 200)}]\n` + text;
    if (tweet.article_description) text += `\n${sanitizeForPrompt(tweet.article_description, 500)}`;
    if (tweet.article_body) text += `\n\n--- Article body ---\n${sanitizeForPrompt(tweet.article_body, 1500)}`;
  }

  return text;
}
```

**Step 2: Update `categorize()`**

Replace the inline thread/article enrichment block that builds `textContent` (lines ~163-173) with a call to `buildRichTweetText`. The result is appended after the `@handle: ` prefix:

```typescript
// BEFORE
let textContent = `@${handle}: `;
if (tweet.content_type === 'thread' && tweet.thread_content?.length) {
  textContent += tweet.thread_content.map((t) => sanitizeForPrompt(t.content)).join('\n---\n');
} else {
  textContent += sanitizeForPrompt(tweet.content);
}
if (tweet.content_type === 'article') {
  if (tweet.article_title) textContent = `[Article: ${sanitizeForPrompt(tweet.article_title, 200)}]\n` + textContent;
  if (tweet.article_description) textContent += `\n${sanitizeForPrompt(tweet.article_description, 500)}`;
  if (tweet.article_body) textContent += `\n\n--- Article body ---\n${sanitizeForPrompt(tweet.article_body, 1500)}`;
}

// AFTER
const handle = sanitizeForPrompt(tweet.author_handle, 100);
const textContent = `@${handle}: ${buildRichTweetText(tweet)}`;
```

Wait — for the article type, the original code prepends the article title BEFORE the `@handle:` prefix. Look carefully:
```
textContent = `[Article: ...]` + textContent   // prepends before "@handle: ..."
```
So the current logic puts article title before the handle. Keep this behavior. Adjust `buildRichTweetText` or adjust the call site so the article title prepend still happens before the handle. The simplest fix: just build the body (without the `@handle`) in the helper, and for `categorize()` the caller wraps it. Check the original logic carefully before making changes — the key invariant is that the final `textContent` passed to the message must match what was there before.

Actually the exact BEFORE produces: `[Article: title]\n@handle: content\ndescription\n\n--- Article body ---\nbody`

This is a bit unusual (title before handle). Preserve it exactly. The helper as written produces the body correctly — the caller in `categorize()` should not prepend `@handle:` if it's an article. Keep the original code in `categorize()` for the article-prefix special case, and only use `buildRichTweetText` for the non-article thread/text part.

Simpler approach: only extract the thread detection part (which IS identical in both):

```typescript
function buildRichTweetText(tweet: {
  content: string;
  content_type?: string;
  thread_content?: { content: string }[] | null;
}): string {
  if (tweet.content_type === 'thread' && tweet.thread_content?.length) {
    return tweet.thread_content.map((t) => sanitizeForPrompt(t.content)).join('\n---\n');
  }
  return sanitizeForPrompt(tweet.content);
}
```

Then in both `categorize()` and `extractContent()`, replace:
```typescript
// BEFORE
if (tweet.content_type === 'thread' && tweet.thread_content?.length) {
  textContent += tweet.thread_content.map((t) => sanitizeForPrompt(t.content)).join('\n---\n');
} else {
  textContent += sanitizeForPrompt(tweet.content);
}
// OR in extractContent:
if (tweet.content_type === 'thread' && tweet.thread_content?.length) {
  rawText = tweet.thread_content.map((t) => sanitizeForPrompt(t.content)).join('\n---\n');
}

// AFTER
textContent += buildRichTweetText(tweet);
// OR:
const rawText = buildRichTweetText(tweet);
```

The article enrichment (title/description/body appending) stays inline in each method since they differ in variable names.

**Step 3: Run type check**

```bash
npm run type-check
```

**Step 4: Commit**

```bash
git add src/lib/ai-router.ts
git commit -m "refactor(ai-router): extract buildRichTweetText helper, remove thread detection duplication"
```

---

## Task 7: Fix `currentCollectionId={null}` bug in `TweetListWithMove.tsx`

**Why:** This is an actual correctness bug. `MoveTweetButton` uses `currentCollectionId` to filter the current collection out of the "move to" options. Hardcoding `null` means tweets that ARE already in a collection still show that collection as a move target. Since `TweetListWithMove` is only rendered with uncategorized tweets (collection_id is null for everything in this list), the bug is latent but should be fixed before the component is reused.

**Files:**
- Modify: `src/components/TweetListWithMove.tsx`

**Step 1: Verify the context**

Check that `TweetListWithMove` is only rendered for the uncategorized/inbox view (all tweets will have `collection_id === null`). If so, the fix is still correct — `tweet.collection_id` will be null for all tweets here, which is the same as the current hardcoded value. The fix makes it resilient for future reuse.

**Step 2: Apply the fix**

In `src/components/TweetListWithMove.tsx`, line 102, change:
```tsx
// BEFORE
currentCollectionId={null}

// AFTER
currentCollectionId={tweet.collection_id}
```

**Step 3: Run type check**

```bash
npm run type-check
```

**Step 4: Commit**

```bash
git add src/components/TweetListWithMove.tsx
git commit -m "fix(tweets): pass tweet.collection_id to MoveTweetButton instead of hardcoded null"
```

---

## Task 8: Refactor `CollectionActions.tsx` with `useReducer`

**Why:** 8 separate `useState` calls govern what is effectively a 3-mode finite state machine. This makes cancel/reset logic error-prone (forgetting to reset one of the 8 values). `useReducer` with a discriminated union makes the valid states explicit and the transitions atomic.

**Files:**
- Modify: `src/components/CollectionActions.tsx`

**Step 1: Design the state shape**

```typescript
type Mode = 'idle' | 'editing' | 'confirming-delete';

type State = {
  mode: Mode;
  name: string;
  type: 'topic' | 'project';
  themeId: string | null;
  themes: { id: string; name: string }[];
  saving: boolean;
  deleting: boolean;
  regenerating: boolean;
};

type Action =
  | { type: 'START_EDIT' }
  | { type: 'CANCEL_EDIT'; initialName: string; initialType: 'topic' | 'project'; initialThemeId: string | null }
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_TYPE'; collectionType: 'topic' | 'project' }
  | { type: 'SET_THEME_ID'; themeId: string | null }
  | { type: 'SET_THEMES'; themes: { id: string; name: string }[] }
  | { type: 'SAVING'; value: boolean }
  | { type: 'SAVE_DONE' }
  | { type: 'START_CONFIRM_DELETE' }
  | { type: 'CANCEL_DELETE' }
  | { type: 'DELETING'; value: boolean }
  | { type: 'REGENERATING'; value: boolean };
```

**Step 2: Write the reducer**

```typescript
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_EDIT':
      return { ...state, mode: 'editing' };
    case 'CANCEL_EDIT':
      return { ...state, mode: 'idle', name: action.initialName, type: action.initialType, themeId: action.initialThemeId };
    case 'SET_NAME':
      return { ...state, name: action.name };
    case 'SET_TYPE':
      return { ...state, type: action.collectionType };
    case 'SET_THEME_ID':
      return { ...state, themeId: action.themeId };
    case 'SET_THEMES':
      return { ...state, themes: action.themes };
    case 'SAVING':
      return { ...state, saving: action.value };
    case 'SAVE_DONE':
      return { ...state, mode: 'idle', saving: false };
    case 'START_CONFIRM_DELETE':
      return { ...state, mode: 'confirming-delete' };
    case 'CANCEL_DELETE':
      return { ...state, mode: 'idle' };
    case 'DELETING':
      return { ...state, deleting: action.value };
    case 'REGENERATING':
      return { ...state, regenerating: action.value };
    default:
      return state;
  }
}
```

**Step 3: Rewrite the component**

Replace the 8 `useState` calls with a single `useReducer`. Keep all handler functions and JSX identical in behavior — only the state access and update calls change.

```typescript
import { useReducer, useEffect } from 'react';

export default function CollectionActions({ collectionId, initialName, initialType, initialThemeId }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, {
    mode: 'idle',
    name: initialName,
    type: initialType,
    themeId: initialThemeId,
    themes: [],
    saving: false,
    deleting: false,
    regenerating: false,
  });

  useEffect(() => {
    if (state.mode !== 'editing') return;
    fetch('/api/themes')
      .then((r) => r.json())
      .then((data) => dispatch({ type: 'SET_THEMES', themes: data.themes ?? [] }))
      .catch(() => {});
  }, [state.mode]);

  // ... handlers use dispatch instead of individual setters
}
```

**Step 4: Run type check and verify UI behavior**

```bash
npm run type-check
```

Manually verify in the browser that: Edit opens with correct initial values, Cancel resets all fields, Delete confirm shows/hides correctly.

**Step 5: Commit**

```bash
git add src/components/CollectionActions.tsx
git commit -m "refactor(collection-actions): replace 8 useState with useReducer FSM"
```

---

## Task 9: Extract `ConfirmDeleteBar` component

**Why:** The confirm-delete UI (warning text + Confirm button + Cancel button) is duplicated between `CollectionActions.tsx` and `ThemeActions.tsx`. Both support an error string below the bar.

**Files:**
- Create: `src/components/ConfirmDeleteBar.tsx`
- Modify: `src/components/CollectionActions.tsx`
- Modify: `src/components/ThemeActions.tsx`

**Step 1: Create the component**

```tsx
// src/components/ConfirmDeleteBar.tsx
'use client';

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error?: string | null;
}

export default function ConfirmDeleteBar({ message, onConfirm, onCancel, loading, error }: Props) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-red-400">{message}</span>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="border border-red-700 bg-red-900/50 font-mono text-xs tracking-widest text-red-300 uppercase px-3 py-1.5 hover:bg-red-900 transition-colors disabled:opacity-50"
        >
          {loading ? 'Deleting...' : 'Confirm'}
        </button>
        <button
          onClick={onCancel}
          className="font-mono text-xs tracking-widest text-shadow uppercase hover:text-mist transition-colors px-2 py-1.5"
        >
          Cancel
        </button>
      </div>
      {error && <span className="font-mono text-xs text-red-400">{error}</span>}
    </div>
  );
}
```

**Step 2: Update `CollectionActions.tsx`**

Replace the `if (confirmDelete)` block (lines 112-131) with:

```tsx
import ConfirmDeleteBar from '@/components/ConfirmDeleteBar';

// In render:
if (state.mode === 'confirming-delete') {
  return (
    <ConfirmDeleteBar
      message="Delete? Items will become uncategorized."
      onConfirm={handleDelete}
      onCancel={() => dispatch({ type: 'CANCEL_DELETE' })}
      loading={state.deleting}
    />
  );
}
```

**Step 3: Update `ThemeActions.tsx`**

Replace the `if (confirmDelete)` block (lines 83-105) with:

```tsx
import ConfirmDeleteBar from '@/components/ConfirmDeleteBar';

// In render:
if (confirmDelete) {
  return (
    <ConfirmDeleteBar
      message="Delete theme? Collections become uncategorized."
      onConfirm={handleDelete}
      onCancel={() => { setConfirmDelete(false); setDeleteError(null); }}
      loading={deleting}
      error={deleteError}
    />
  );
}
```

**Step 4: Run type check**

```bash
npm run type-check
```

**Step 5: Commit**

```bash
git add src/components/ConfirmDeleteBar.tsx src/components/CollectionActions.tsx src/components/ThemeActions.tsx
git commit -m "refactor(components): extract ConfirmDeleteBar, remove duplicate delete UI"
```

---

## Task 10: Delete the unused `/api/admin/usage` route

**Why:** The `/api/admin/usage` route has been confirmed to have zero callers (`grep -r "admin/usage" src` returns nothing). The admin page (`src/app/dashboard/admin/page.tsx`) is a server component that fetches from Supabase directly — the API route is dead code.

**Files:**
- Delete: `src/app/api/admin/usage/route.ts`

**Step 1: Confirm no callers**

```bash
grep -r "admin/usage" src --include="*.ts" --include="*.tsx"
```
Expected: no output.

**Step 2: Delete the file**

```bash
rm src/app/api/admin/usage/route.ts
```

Check if the `src/app/api/admin/` directory still has other files before removing:
```bash
ls src/app/api/admin/
```
If it's empty after deletion, remove the directory too:
```bash
rmdir src/app/api/admin/
```

**Step 3: Run type check**

```bash
npm run type-check
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete unused /api/admin/usage route (superseded by server component)"
```

---

## Task 11: Add `requireUser` auth helper

**Why:** The cookie-based auth check pattern (`createClient()` → `getUser()` → 401) appears verbatim in 11 route handlers. Centralizing it makes the auth check consistent and easier to change (e.g., adding session refresh logic or audit logging).

**Files:**
- Modify: `src/lib/supabase/server.ts`
- Modify: `src/app/api/collections/route.ts`
- Modify: `src/app/api/collections/[id]/route.ts`
- Modify: `src/app/api/collections/[id]/regenerate/route.ts`
- Modify: `src/app/api/collections/assign-themes/route.ts`
- Modify: `src/app/api/themes/route.ts`
- Modify: `src/app/api/themes/[id]/route.ts`
- Modify: `src/app/api/themes/[id]/synthesise/route.ts`
- Modify: `src/app/api/tweets/categorize/route.ts`
- Modify: `src/app/api/search/route.ts`

**Step 1: Add `requireUser` to `src/lib/supabase/server.ts`**

Append after the existing `createClient` export:

```typescript
import type { User } from '@supabase/supabase-js';

/**
 * Validates the cookie-based session and returns the authenticated user
 * along with the supabase client. Returns null if unauthenticated.
 *
 * Usage in route handlers:
 *   const auth = await requireUser();
 *   if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
 *   const { user, supabase } = auth;
 */
export async function requireUser(): Promise<{ user: User; supabase: Awaited<ReturnType<typeof createClient>> } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { user, supabase } : null;
}
```

**Step 2: Update each route handler**

In each cookie-auth route, replace the 4-line pattern with:

```typescript
import { requireUser } from '@/lib/supabase/server';

// BEFORE
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

// AFTER
const auth = await requireUser();
if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
const { user, supabase } = auth;
```

Do this for all 9 routes listed above.

Note: `src/app/api/tweets/route.ts` uses bearer-token auth (different pattern — **do NOT update that one**).

**Step 3: Run type check**

```bash
npm run type-check
```

**Step 4: Commit**

```bash
git add src/lib/supabase/server.ts \
  src/app/api/collections/route.ts src/app/api/collections/[id]/route.ts \
  src/app/api/collections/[id]/regenerate/route.ts src/app/api/collections/assign-themes/route.ts \
  src/app/api/themes/route.ts src/app/api/themes/[id]/route.ts \
  src/app/api/themes/[id]/synthesise/route.ts src/app/api/tweets/categorize/route.ts \
  src/app/api/search/route.ts
git commit -m "refactor(auth): extract requireUser helper, apply to 9 cookie-auth routes"
```

---

## Final Verification

After all tasks are complete:

```bash
npm run type-check
npm run lint
npm run build
```

All three must pass clean. Then do a final review of the git log:

```bash
git log --oneline -12
```

Expected: 11 commits (one per task) with clean, descriptive messages.
