-- Create themes table
CREATE TABLE themes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique theme name per user (case-insensitive)
CREATE UNIQUE INDEX themes_user_id_name_idx ON themes (user_id, lower(name));

-- RLS
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own themes" ON themes;
CREATE POLICY "Users manage own themes"
  ON themes FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add theme_id FK to collections (nullable — existing rows stay as-is)
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES themes(id) ON DELETE SET NULL;
