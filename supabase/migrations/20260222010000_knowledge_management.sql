-- collections: key people output
ALTER TABLE collections ADD COLUMN IF NOT EXISTS ai_key_people jsonb;

-- themes: synthesis fields
ALTER TABLE themes ADD COLUMN IF NOT EXISTS ai_insights text[];
ALTER TABLE themes ADD COLUMN IF NOT EXISTS ai_key_people jsonb;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS synthesis_updated_at timestamptz;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS last_tweet_count int;

-- theme_digests: rolling digest entries per theme
CREATE TABLE IF NOT EXISTS theme_digests (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id    uuid         NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  user_id     uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tweet_count int          NOT NULL,
  kta         text[]       NOT NULL,
  new_voices  jsonb        NOT NULL DEFAULT '[]',
  created_at  timestamptz  NOT NULL DEFAULT now()
);
ALTER TABLE theme_digests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own digests" ON theme_digests;
CREATE POLICY "Users manage own digests" ON theme_digests
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
