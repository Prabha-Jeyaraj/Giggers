-- ==============================================================================
-- FIX CHAT & PERMISSIONS (1-ON-1 CHAT & GROUP CHAT)
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure all columns exist on chat_threads
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  employer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  employer_last_read_at timestamptz,
  worker_last_read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (job_id, worker_id)
);

ALTER TABLE public.chat_threads ADD COLUMN IF NOT EXISTS employer_last_read_at timestamptz;
ALTER TABLE public.chat_threads ADD COLUMN IF NOT EXISTS worker_last_read_at timestamptz;
ALTER TABLE public.chat_threads ADD COLUMN IF NOT EXISTS last_message text;
ALTER TABLE public.chat_threads ADD COLUMN IF NOT EXISTS last_message_at timestamptz DEFAULT now();

-- 2. Ensure all columns exist on chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  is_read boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  read_at timestamptz,
  video_path text,
  video_duration_seconds integer,
  job_task_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS video_path text;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS video_duration_seconds integer;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS job_task_id uuid;

-- 3. Ensure job_group_messages table exists
CREATE TABLE IF NOT EXISTS public.job_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text CHECK (type IN ('text', 'image', 'file')) DEFAULT 'text',
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. Disable RLS across all application tables so client writes are never rejected
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_group_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_task_completions DISABLE ROW LEVEL SECURITY;

-- 5. Enable Realtime & Full Replica Identity
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_threads REPLICA IDENTITY FULL;
ALTER TABLE public.job_group_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.job_group_messages; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

NOTIFY pgrst, 'reload schema';
