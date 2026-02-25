-- tweets: MECE topic label assigned by AI
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS ai_topic text;

-- collections: ordered list of MECE topic names
ALTER TABLE collections ADD COLUMN IF NOT EXISTS ai_topics text[];
