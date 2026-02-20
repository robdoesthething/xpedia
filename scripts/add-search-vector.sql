-- ============================================================
-- Full-text search on tweets — run in Supabase SQL Editor
-- ============================================================

-- 1. Add tsvector column
alter table public.tweets
  add column if not exists search_vector tsvector;

-- 2. GIN index for fast lookups
create index if not exists idx_tweets_search_vector
  on public.tweets using gin(search_vector);

-- 3. Trigger function: weight A for author, weight B for content
create or replace function public.tweets_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.author_handle, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.content, '')), 'B');
  return new;
end;
$$;

create trigger tweets_search_vector_trigger
  before insert or update of author_handle, content on public.tweets
  for each row execute function public.tweets_search_vector_update();

-- 4. Backfill existing rows
update public.tweets
  set search_vector =
    setweight(to_tsvector('english', coalesce(author_handle, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B');
