-- Migration: Add is_onboarded boolean to profiles table
-- This flag tracks whether a user has completed the one-time onboarding
-- questionnaire (Student/Professional, Full-time/Part-time, Category selection).
-- It defaults to false for all existing users.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional: also store the onboarding question answers for future reference
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS work_status TEXT CHECK (work_status IN ('Student', 'Working Professional')),
  ADD COLUMN IF NOT EXISTS commitment TEXT CHECK (commitment IN ('Full-time', 'Part-time'));

COMMENT ON COLUMN profiles.is_onboarded IS 'True once the user has completed the 3-question onboarding flow after account creation.';
COMMENT ON COLUMN profiles.work_status IS 'Onboarding answer: Student or Working Professional.';
COMMENT ON COLUMN profiles.commitment IS 'Onboarding answer: Full-time or Part-time availability.';
