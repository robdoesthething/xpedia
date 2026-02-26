-- Migration: 20260226_onboarding_and_ai_slot
-- Adds onboarding tracking and free-tier AI synthesis slot to profiles
--
-- onboarding_completed: tracks whether the user has dismissed/completed
--   the onboarding flow. Defaults to false so all existing users see it.
--
-- ai_collection_id: the single collection that a free-tier user has
--   designated to receive AI synthesis. NULL means no slot assigned yet.
--   Set to NULL automatically if the referenced collection is deleted
--   (ON DELETE SET NULL) so we never hold a dangling reference.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_collection_id uuid REFERENCES collections(id) ON DELETE SET NULL;
