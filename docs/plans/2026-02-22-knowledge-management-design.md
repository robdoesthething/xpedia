# Knowledge Management — Design Document

**Date:** 2026-02-22
**Status:** Approved

---

## Goal

Turn Xpedia from a passive tweet store into an active knowledge management system. Users capture bookmarks, review them in Sources, manually trigger categorisation, then synthesise insights at the collection and theme level — including a rolling digest of newly added tweets.

---

## Architecture

No new external services. All AI runs through the existing `aiRouter`. New DB columns on `themes`. New pages: `/dashboard/theme/[id]`. New API routes: `/api/themes/[id]` (PATCH/DELETE), `/api/themes/[id]/synthesise`.

---

## Section 1 — Extension Badge

**Behaviour:** The badge always reflects the current count of uncategorized tweets (Sources items). It updates after every capture and resets to 0 when Sources is empty.

**Implementation:**
- Add `GET /api/tweets/uncategorized-count` — returns `{ count: number }`, auth via Bearer token (same pattern as `/api/tweets/urls`)
- After each successful `sendTweets` call in `background.ts`, call this endpoint and set badge text to the returned count
- Badge color: green (`#22c55e`) when count > 0, cleared when 0

---

## Section 2 — Sources Page

**Behaviour:** Shows all tweets regardless of `collection_id`. Filter tabs at the top: **All · Uncategorized · [per-collection tabs]**. Each tweet shows which collection it belongs to (or "—"). The "Categorize N items" button is shown only when uncategorized tweets exist. Move/assign control on every tweet row.

**Implementation:**
- Remove the `.is('collection_id', null)` filter from `TweetsPage` query
- Add a `filter` query param to `GET /api/tweets` so the page can filter client-side or pass the param through
- Add filter tabs as a client component (`SourcesFilter`) that drives URL search params (`?filter=uncategorized|all|<collection_id>`)
- `MoveTweetButton` already exists and works — wire it to all rows, not just uncategorized ones
- "Categorize N items" count is derived from the uncategorized subset regardless of active filter

---

## Section 3 — Theme & Collection Management

**Theme CRUD:**
- `PATCH /api/themes/[id]` — rename a theme (`{ name: string }`)
- `DELETE /api/themes/[id]` — delete theme; collections become `theme_id = NULL` (DB `ON DELETE SET NULL` already set)
- Sidebar: hovering a theme name shows a `⋯` button → inline rename input or delete with confirmation modal

**Theme detail page** at `/dashboard/theme/[id]`:
- Header: theme name + edit/delete controls
- Collections grid: all collections in this theme (reuse `CollectionCard`)
- Synthesis output (Section 4)
- Digest history (Section 5)

**Collection management:** No new work needed. The existing edit form (name / type / theme picker) is sufficient.

---

## Section 4 — Synthesis (AI Content Changes)

### Collection level

Replace the existing `ai_summary` + `ai_conclusions` with:
- `ai_conclusions: string[]` — renamed conceptually to **Actionable Insights** in the UI (no DB change needed, reuse the column)
- `ai_key_people: { handle: string; reason: string }[]` — new JSONB column on `collections`

The "Regenerate" button on the collection detail page triggers `POST /api/collections/[id]/regenerate`, which now produces:
- **Actionable Insights** (3–7 bullets): concrete things to do, learn, or build, derived from tweet content
- **Key People** (up to 5): contributors from this collection's tweets, with one-line reason to follow

Remove the `ai_summary` display from the collection detail page UI (keep the DB column for backwards compat, just stop rendering it).

### Theme level

New columns on `themes`:
- `ai_insights: string[] | null`
- `ai_key_people: { handle: string; reason: string }[] | null`
- `synthesis_updated_at: timestamptz | null`
- `last_tweet_count: int | null` — snapshot of total tweet count at last synthesis, used to detect new tweets

`POST /api/themes/[id]/synthesise` — reads all tweets across all collections in the theme, calls AI, writes back insights + key people + digest entry.

AI prompt for theme synthesis:
- Input: all tweet content + author handles across the theme
- Output: `{ insights: string[], key_people: { handle, reason }[], kta: string[], new_voices: { handle, reason }[] }`

---

## Section 5 — Theme Digest

A `theme_digests` table:
```sql
CREATE TABLE theme_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tweet_count int NOT NULL,           -- tweets included in this digest
  kta text[] NOT NULL,                -- key takeaways & actions
  new_voices jsonb NOT NULL DEFAULT '[]', -- [{ handle, reason }]
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Synthesise flow (single button, two outputs):**
1. Fetch tweets added since `synthesis_updated_at` (new tweets only) → generate digest entry (KTA + new voices)
2. Fetch ALL tweets in theme → generate full synthesis (insights + key people)
3. Write both atomically: update `themes` row + insert into `theme_digests`

**Theme detail page layout:**
```
[Theme name]  [Edit]  [Delete]

Collections in this theme
├── CollectionCard  CollectionCard  CollectionCard

─────────────────────────────────
Synthesis                    [Synthesise ↻]
  Actionable Insights
  • ...
  Key People
  • @handle — reason

─────────────────────────────────
Digest                          [N new tweets since last synthesis]
  ▼ 2026-02-22  (12 new tweets)
    Key Takeaways & Actions
    • ...
    New voices
    • @handle — reason

  ▼ 2026-02-20  (8 new tweets)
    ...
```

**New tweet nudge:** Compare current tweet count across theme collections vs `last_tweet_count` on page load. If higher, show banner: *"N new tweets since last synthesis — Synthesise to update."*

---

## DB Migration

```sql
-- Collections: add key_people
ALTER TABLE collections ADD COLUMN IF NOT EXISTS ai_key_people jsonb;

-- Themes: add synthesis fields
ALTER TABLE themes ADD COLUMN IF NOT EXISTS ai_insights text[];
ALTER TABLE themes ADD COLUMN IF NOT EXISTS ai_key_people jsonb;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS synthesis_updated_at timestamptz;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS last_tweet_count int;

-- Digests table
CREATE TABLE theme_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tweet_count int NOT NULL,
  kta text[] NOT NULL,
  new_voices jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE theme_digests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own digests" ON theme_digests;
CREATE POLICY "Users manage own digests" ON theme_digests
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

---

## API Routes Summary

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/tweets/uncategorized-count` | Badge count for extension |
| PATCH | `/api/themes/[id]` | Rename theme |
| DELETE | `/api/themes/[id]` | Delete theme |
| GET | `/api/themes/[id]` | Theme detail + digests |
| POST | `/api/themes/[id]/synthesise` | Generate synthesis + digest |

---

## Out of Scope

- Email delivery of digests
- Scheduled/automatic synthesis runs
- Multi-user collaboration
