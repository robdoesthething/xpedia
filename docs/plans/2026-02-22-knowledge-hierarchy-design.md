# Knowledge Hierarchy Design

**Date**: 2026-02-22
**Status**: Approved

## Problem

The dashboard shows a flat grid of collections with no grouping. Users have no way to navigate from broad subject areas down to specific collections — the knowledge corpus is difficult to explore as it grows.

## Goals

- Users can navigate knowledge through a two-level hierarchy: Theme → Collection → Tweets
- Themes are assigned automatically by AI, zero user friction
- A persistent left sidebar provides the navigation tree

## Data Model

### New `themes` table

```sql
CREATE TABLE themes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique theme name per user
CREATE UNIQUE INDEX themes_user_id_name_idx ON themes (user_id, lower(name));

-- RLS
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own themes"
  ON themes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### `collections` — new column

```sql
ALTER TABLE collections
  ADD COLUMN theme_id uuid references themes(id) on delete set null;
```

Collections with `theme_id IS NULL` are shown under "Uncategorized" in the sidebar.

## AI Categorization Changes

### Extended response shape

The `aiRouter.categorize()` response expands from:

```json
{ "collection_name": "LLM Prompting Patterns", "summary": "..." }
```

to:

```json
{ "theme_name": "AI & Machine Learning", "collection_name": "LLM Prompting Patterns", "summary": "..." }
```

### Prompt instructions for theme

The system prompt adds:
- Assign a **broad 2–4 word theme** (e.g. "Programming", "Business Strategy", "AI & Machine Learning", "Design Thinking")
- Reuse existing theme names when a good match exists — same strategy used for collection names
- Theme is always more general than the collection name

### `resolveTheme()` in background categorization

Mirrors the existing `resolveCollection()`:
- Case-insensitive lookup in `themes` table for this user
- Creates the theme if it doesn't exist
- Handles race conditions: on insert conflict, re-fetches
- Returns `theme_id`, then that ID is written to `collections.theme_id`

## API Routes

### New: `/api/themes`

| Method | Auth   | Purpose |
|--------|--------|---------|
| GET    | Cookie | List user's themes, each with `collection_count` |
| POST   | Cookie | Create a theme manually |

### Updated: `/api/collections` GET

Response adds `theme_id` and `theme_name` (via join) so the sidebar can render in a single request.

## UI

### Layout change (`DashboardLayout`)

The layout changes from a single-column main area to a two-panel layout:

```
┌─ ThemeSidebar (~220px) ─────────┬─ Main area ───────────────────┐
│ ▼ AI & Machine Learning         │  [theme overview or           │
│    LLM Prompting Patterns  ●    │   collection detail]          │
│    Model Architecture           │                               │
│ ▶ Business Strategy             │                               │
│ ▶ Programming                   │                               │
│ ─────────────────────           │                               │
│ ○ Uncategorized (3)             │                               │
└─────────────────────────────────┴───────────────────────────────┘
```

### `ThemeSidebar` component

- Fetches themes + collections on mount (client component)
- Themes are collapsible (click to expand/collapse)
- Highlights the active collection based on current URL
- "Uncategorized" section at bottom for collections with no theme

### Navigation states

- **Select theme**: main area shows that theme's collections as `CollectionCard` grid
- **Select collection**: navigates to `/dashboard/collection/[id]` (page unchanged)
- **Breadcrumb**: `Dashboard / AI & Machine Learning / LLM Prompting Patterns` at top of main area

URL structure is unchanged — no new routes for navigation.

### Dashboard home (`/dashboard`)

Changes from flat collection grid to theme-grouped view (themes as section headers, collections beneath each).

## What Does Not Change

- `/dashboard/collection/[id]` page and its content
- `CollectionCard` component
- Tweet capture, deduplication, and article enrichment flows
- All other API routes

## Migration Notes

- Existing collections will have `theme_id = NULL` until the next bookmark capture triggers re-categorization
- A one-time backfill is not required for MVP — uncategorized collections appear under "Uncategorized" and theme assignments accumulate naturally
