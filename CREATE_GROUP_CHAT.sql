-- Migration to add Job Group Chat features
-- Safe to re-run: every statement is IF NOT EXISTS / idempotent.

-- 1. Add is_group_closed and group_closed_at to the jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_group_closed BOOLEAN DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS group_closed_at TIMESTAMPTZ;

-- 2. Create job_group_messages table
CREATE TABLE IF NOT EXISTS public.job_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('text', 'image', 'file')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Disable Row Level Security since Giggers uses custom Express JWT auth and RLS is disabled on other tables
ALTER TABLE public.job_group_messages DISABLE ROW LEVEL SECURITY;

-- 4. Create a public storage bucket for group chat progress photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-chat-attachments', 'group-chat-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Add storage policy to allow select access on the bucket if RLS is enabled for storage.objects
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    DROP POLICY IF EXISTS "Allow public read of group chat attachments" ON storage.objects;
    CREATE POLICY "Allow public read of group chat attachments"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'group-chat-attachments');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
