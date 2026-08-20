-- ============================================================
-- SQL Migration: Group Chat & Workers Hired Support
-- Run this script in your Supabase SQL Editor
-- ============================================================

-- 1. Create job_group_messages table (for per-job group chat)
CREATE TABLE IF NOT EXISTS public.job_group_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     text NOT NULL DEFAULT '',
  type        text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'file')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by job
CREATE INDEX IF NOT EXISTS idx_job_group_messages_job_id
  ON public.job_group_messages(job_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.job_group_messages ENABLE ROW LEVEL SECURITY;

-- Policy: employer of the job OR hired/confirmed worker can read/insert
CREATE POLICY "group_msg_access" ON public.job_group_messages
  FOR ALL
  USING (
    -- employer who owns the job
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_group_messages.job_id
        AND j.employer_id = auth.uid()
    )
    OR
    -- worker with hired/confirmed/completed application for the job
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.job_id = job_group_messages.job_id
        AND a.worker_id = auth.uid()
        AND a.status IN ('hired', 'confirmed', 'completed')
    )
  );

-- 2. Add group chat control columns to jobs table (safe if columns already exist)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS is_group_closed   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_closed_at   timestamptz;

-- 3. Create/replace the increment_workers_hired RPC function
CREATE OR REPLACE FUNCTION public.increment_workers_hired(job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.jobs
  SET workers_hired = workers_hired + 1
  WHERE id = job_id;
END;
$$;

-- 4. Enable realtime for group messages (for Supabase Realtime subscriptions)
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_group_messages;
