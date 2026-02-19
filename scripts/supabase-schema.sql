-- ============================================================
-- Tweet Corpus Builder (Xpedia) — Supabase Schema
-- Run this in the Supabase SQL Editor for your project.
-- ============================================================

-- 1. Users table (mirrors auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own row"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own row"
  on public.users for update
  using (auth.uid() = id);

-- 2. Collections table
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  type text not null default 'topic' check (type in ('topic', 'project')),
  description text,
  ai_summary text,
  ai_conclusions jsonb,
  summary_updated_at timestamptz,
  tweet_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.collections enable row level security;

create policy "Users can read own collections"
  on public.collections for select
  using (auth.uid() = user_id);

create policy "Users can insert own collections"
  on public.collections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own collections"
  on public.collections for update
  using (auth.uid() = user_id);

create policy "Users can delete own collections"
  on public.collections for delete
  using (auth.uid() = user_id);

create index idx_collections_user_id on public.collections(user_id);
create index idx_collections_updated_at on public.collections(updated_at desc);

-- 3. Tweets table
create table public.tweets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete set null,
  tweet_url text not null,
  author_handle text not null,
  author_name text,
  content text not null,
  thread_content jsonb,
  ai_summary text,
  tweet_date timestamptz,
  captured_at timestamptz not null default now(),
  unique(user_id, tweet_url)
);

alter table public.tweets enable row level security;

create policy "Users can read own tweets"
  on public.tweets for select
  using (auth.uid() = user_id);

create policy "Users can insert own tweets"
  on public.tweets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tweets"
  on public.tweets for update
  using (auth.uid() = user_id);

create policy "Users can delete own tweets"
  on public.tweets for delete
  using (auth.uid() = user_id);

create index idx_tweets_user_id on public.tweets(user_id);
create index idx_tweets_collection_id on public.tweets(collection_id);
create index idx_tweets_captured_at on public.tweets(captured_at desc);

-- ============================================================
-- Triggers
-- ============================================================

-- Auto-create public.users row on auth signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at on collections
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger collections_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

-- Auto-maintain tweet_count on collections
create or replace function public.update_tweet_count()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Decrement old collection count
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.collection_id is distinct from new.collection_id) then
    if old.collection_id is not null then
      update public.collections
        set tweet_count = greatest(tweet_count - 1, 0)
        where id = old.collection_id;
    end if;
  end if;

  -- Increment new collection count
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.collection_id is distinct from new.collection_id) then
    if new.collection_id is not null then
      update public.collections
        set tweet_count = tweet_count + 1
        where id = new.collection_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger tweets_count_trigger
  after insert or update of collection_id or delete on public.tweets
  for each row execute function public.update_tweet_count();
