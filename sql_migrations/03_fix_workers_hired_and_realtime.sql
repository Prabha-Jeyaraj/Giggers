-- ============================================================
-- SQL Patch: Fix workers_hired counter + Group Chat Realtime
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Fix workers_hired counter for all existing jobs
--    (recalculates from actual hired/confirmed/completed applications)
UPDATE public.jobs j
SET workers_hired = (
  SELECT COUNT(*)
  FROM public.applications a
  WHERE a.job_id = j.id
    AND a.status IN ('hired', 'confirmed', 'completed')
);

-- 2. Enable Realtime on job_group_messages with FULL replica identity
--    (required for Supabase Realtime filters to work correctly)
ALTER TABLE public.job_group_messages REPLICA IDENTITY FULL;

-- 3. Ensure publication includes job_group_messages
--    (safe to run even if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'job_group_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_group_messages;
  END IF;
END $$;

-- Done! Verify results:
SELECT id, title, workers_needed, workers_hired FROM public.jobs ORDER BY created_at DESC LIMIT 10;
