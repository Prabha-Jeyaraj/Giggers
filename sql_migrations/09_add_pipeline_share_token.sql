-- Add pipeline share token to jobs table for public shareable pipeline links
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pipeline_share_token text UNIQUE DEFAULT gen_random_uuid()::text;

-- Backfill existing jobs that have null tokens
UPDATE jobs SET pipeline_share_token = gen_random_uuid()::text WHERE pipeline_share_token IS NULL;

-- Disable RLS for this column (inherits from jobs table RLS settings)
-- No separate RLS needed since this is on the existing jobs table
