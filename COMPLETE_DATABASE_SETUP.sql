-- ==============================================================================
-- GIGGERS: COMPLETE MASTER DATABASE INITIALIZATION SCRIPT
-- ==============================================================================
-- Run this ONCE in your new Supabase project's SQL Editor.
-- It creates all tables, columns, relations, constraints, RLS policies, 
-- triggers, RPC functions, Realtime publications, and Storage buckets.
-- ==============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. PROFILES TABLE (Core User Accounts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE,
  email text,
  name text NOT NULL DEFAULT '',
  role text NOT NULL CHECK (role IN ('worker', 'employer', 'admin')) DEFAULT 'worker',
  avatar text,
  selfie_url text,
  bio text,
  city text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  gender text CHECK (gender IN ('male', 'female', 'other')),
  age integer,
  skills text[] DEFAULT '{}',
  languages text[] DEFAULT '{}',
  categories text[] DEFAULT '{}',
  company_name text,
  
  -- Verification & Badges
  is_verified boolean NOT NULL DEFAULT false,
  is_approved boolean NOT NULL DEFAULT false,
  is_verified_employer boolean NOT NULL DEFAULT false,
  is_banned boolean NOT NULL DEFAULT false,
  banned_reason text,
  aadhaar_verified boolean NOT NULL DEFAULT false,
  selfie_verified boolean NOT NULL DEFAULT false,
  
  -- Stats & Ratings
  completed_jobs integer NOT NULL DEFAULT 0,
  total_jobs_posted integer NOT NULL DEFAULT 0,
  rating numeric(3,2) NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  total_earnings numeric(12,2) NOT NULL DEFAULT 0,
  attendance_rate numeric(5,2) NOT NULL DEFAULT 100,
  credit_point integer NOT NULL DEFAULT 100,
  
  -- KYC Fields
  aadhaar_number text,
  aadhaar_front_url text,
  aadhaar_back_url text,
  pan_number text,
  pan_front_url text,
  pan_back_url text,
  kyc_status text NOT NULL DEFAULT 'not_started' CHECK (kyc_status IN ('not_started', 'submitted', 'approved', 'rejected')),
  kyc_submitted_at timestamptz,
  kyc_reviewed_at timestamptz,
  kyc_rejection_reason text,
  is_onboarded boolean NOT NULL DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 2. JOBS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  category_emoji text DEFAULT '💼',
  description text DEFAULT '',
  date text NOT NULL DEFAULT '',
  reporting_time text DEFAULT '',
  end_time text DEFAULT '',
  location text DEFAULT '',
  address text DEFAULT '',
  lat double precision DEFAULT 19.076,
  lng double precision DEFAULT 72.877,
  location_lat double precision,
  location_lng double precision,
  workers_needed integer NOT NULL DEFAULT 1,
  workers_hired integer NOT NULL DEFAULT 0,
  pay_per_worker numeric(10,2) NOT NULL DEFAULT 0,
  food_provided boolean NOT NULL DEFAULT false,
  transport_provided boolean NOT NULL DEFAULT false,
  dress_code text DEFAULT 'Casual',
  languages_required text[] DEFAULT '{}',
  gender_preference text DEFAULT 'any' CHECK (gender_preference IN ('any', 'male', 'female')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  is_featured boolean NOT NULL DEFAULT false,
  is_urgent boolean NOT NULL DEFAULT false,
  applicants_count integer NOT NULL DEFAULT 0,
  is_group_closed boolean NOT NULL DEFAULT false,
  group_closed_at timestamptz,
  pipeline_share_token uuid DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read jobs" ON public.jobs;
DROP POLICY IF EXISTS "Employers insert jobs" ON public.jobs;
DROP POLICY IF EXISTS "Employers update jobs" ON public.jobs;
DROP POLICY IF EXISTS "Employers delete jobs" ON public.jobs;
CREATE POLICY "Public read jobs" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Employers insert jobs" ON public.jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Employers update jobs" ON public.jobs FOR UPDATE USING (true);
CREATE POLICY "Employers delete jobs" ON public.jobs FOR DELETE USING (true);

-- ==============================================================================
-- 3. APPLICATIONS TABLE (Including Negotiated Pay & Pipeline fields)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'shortlisted', 'hired', 'confirmed', 'rejected', 'completed', 'no_show')),
  negotiated_pay numeric(10,2) DEFAULT NULL,
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  pipeline_share_token uuid DEFAULT gen_random_uuid() UNIQUE,
  reporting_completed boolean NOT NULL DEFAULT false,
  selfie_completed boolean NOT NULL DEFAULT false,
  tshirt_completed boolean NOT NULL DEFAULT false,
  shoes_completed boolean NOT NULL DEFAULT false,
  applied_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(job_id, worker_id)
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read applications" ON public.applications;
DROP POLICY IF EXISTS "Workers apply" ON public.applications;
DROP POLICY IF EXISTS "Applications update" ON public.applications;
DROP POLICY IF EXISTS "Applications delete" ON public.applications;
CREATE POLICY "Public read applications" ON public.applications FOR SELECT USING (true);
CREATE POLICY "Workers apply" ON public.applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Applications update" ON public.applications FOR UPDATE USING (true);
CREATE POLICY "Applications delete" ON public.applications FOR DELETE USING (true);

-- ==============================================================================
-- 4. WALLETS & TRANSACTIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  escrow_balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Service manages wallets" ON public.wallets;
CREATE POLICY "Users read own wallet" ON public.wallets FOR SELECT USING (true);
CREATE POLICY "Service manages wallets" ON public.wallets FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  amount numeric(12,2) NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  razorpay_order_id text,
  razorpay_payment_id text,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Transactions read" ON public.transactions;
DROP POLICY IF EXISTS "Transactions insert" ON public.transactions;
DROP POLICY IF EXISTS "Transactions update" ON public.transactions;
CREATE POLICY "Transactions read" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Transactions insert" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Transactions update" ON public.transactions FOR UPDATE USING (true);

-- Auto-create wallet on new profile
CREATE OR REPLACE FUNCTION public.create_wallet_for_new_user()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_wallet_for_new_user();

-- ==============================================================================
-- 5. CHAT THREADS & MESSAGES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_group boolean NOT NULL DEFAULT false,
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  employer_last_read_at timestamptz,
  worker_last_read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique index for 1-on-1 chats
CREATE UNIQUE INDEX IF NOT EXISTS idx_1on1_chat_unique 
  ON public.chat_threads (job_id, worker_id) 
  WHERE is_group = false;

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chat threads access" ON public.chat_threads;
CREATE POLICY "Chat threads access" ON public.chat_threads FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'system')),
  media_url text,
  media_metadata jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  is_delivered boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chat messages access" ON public.chat_messages;
CREATE POLICY "Chat messages access" ON public.chat_messages FOR ALL USING (true);

-- ==============================================================================
-- 6. RATINGS & REVIEWS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.job_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 10),
  feedback text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(job_id, worker_id)
);

ALTER TABLE public.job_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ratings access" ON public.job_ratings;
CREATE POLICY "Ratings access" ON public.job_ratings FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.employer_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 10),
  feedback text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(job_id, worker_id)
);

ALTER TABLE public.employer_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Employer ratings access" ON public.employer_ratings;
CREATE POLICY "Employer ratings access" ON public.employer_ratings FOR ALL USING (true);

-- ==============================================================================
-- 7. PIPELINE TASKS & COMPLETIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.job_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  task_type text NOT NULL DEFAULT 'manual' CHECK (task_type IN ('manual', 'photo', 'form', 'clock_in', 'clock_out')),
  sort_order integer NOT NULL DEFAULT 0,
  requires_photo boolean NOT NULL DEFAULT false,
  requires_geotag boolean NOT NULL DEFAULT false,
  requires_form boolean NOT NULL DEFAULT false,
  form_fields jsonb DEFAULT '[]',
  clock_anchor text,
  clock_offset_minutes integer DEFAULT 0,
  clock_window_before_minutes integer DEFAULT 30,
  clock_window_after_minutes integer DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.job_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Job tasks access" ON public.job_tasks;
CREATE POLICY "Job tasks access" ON public.job_tasks FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.application_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  job_task_id uuid NOT NULL REFERENCES public.job_tasks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'complete', 'failed')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  image_path text,
  image_url text,
  lat double precision,
  lng double precision,
  form_data jsonb,
  employer_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(application_id, job_task_id)
);

ALTER TABLE public.application_task_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Completions access" ON public.application_task_completions;
CREATE POLICY "Completions access" ON public.application_task_completions FOR ALL USING (true);

-- ==============================================================================
-- 8. RECORDINGS & WORKER LOCATIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  job_task_id uuid REFERENCES public.job_tasks(id) ON DELETE CASCADE,
  recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recording_type text NOT NULL CHECK (recording_type IN ('video', 'audio')),
  storage_path text NOT NULL,
  duration_seconds integer,
  file_size_bytes bigint,
  thumbnail_path text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Recordings access" ON public.recordings;
CREATE POLICY "Recordings access" ON public.recordings FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.worker_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(worker_id, job_id)
);

ALTER TABLE public.worker_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Worker locations access" ON public.worker_locations;
CREATE POLICY "Worker locations access" ON public.worker_locations FOR ALL USING (true);

-- ==============================================================================
-- 9. KYC DOCUMENTS & NOTIFICATIONS & SETTINGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'identity' CHECK (type IN ('identity')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  full_name text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  company_name text,
  aadhaar_number text,
  front_url text,
  back_url text,
  pan_number text,
  pan_front_url text,
  pan_back_url text,
  selfie_url text,
  rejection_reason text,
  notification_seen boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "KYC documents access" ON public.kyc_documents;
CREATE POLICY "KYC documents access" ON public.kyc_documents FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  action_id text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notifications access" ON public.notifications;
CREATE POLICY "Notifications access" ON public.notifications FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Push subscriptions access" ON public.push_subscriptions;
CREATE POLICY "Push subscriptions access" ON public.push_subscriptions FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform settings access" ON public.platform_settings;
CREATE POLICY "Platform settings access" ON public.platform_settings FOR ALL USING (true);

-- ==============================================================================
-- 10. RPC HELPER FUNCTIONS
-- ==============================================================================

-- Increment workers hired count on job
CREATE OR REPLACE FUNCTION public.increment_workers_hired(job_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.jobs
  SET workers_hired = workers_hired + 1, updated_at = now()
  WHERE id = job_id;
END;
$$;

-- Decrement credit point on late edit / cancellation
CREATE OR REPLACE FUNCTION public.decrement_credit_point(p_user_id uuid, p_amount integer)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.profiles
  SET credit_point = GREATEST(0, credit_point - p_amount), updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Increment wallet balance
CREATE OR REPLACE FUNCTION public.increment_wallet_balance(p_user_id uuid, p_amount numeric)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.wallets
  SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Handle user creation hook from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, email, name, role)
  VALUES (
    new.id,
    COALESCE(new.phone, new.raw_user_meta_data->>'phone'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'worker')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = COALESCE(EXCLUDED.phone, profiles.phone);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 11. STORAGE BUCKETS CONFIGURATION
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('avatars', 'avatars', true),
  ('kyc-documents', 'kyc-documents', true),
  ('recordings', 'recordings', true),
  ('job-attachments', 'job-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS Policies (Allow public uploads & reads)
DROP POLICY IF EXISTS "Public bucket access" ON storage.objects;
CREATE POLICY "Public bucket access" ON storage.objects FOR ALL USING (true);

-- ==============================================================================
-- 12. REALTIME PUBLICATIONS & REPLICA IDENTITY
-- ==============================================================================
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_threads REPLICA IDENTITY FULL;
ALTER TABLE public.group_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.applications REPLICA IDENTITY FULL;
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.application_task_completions REPLICA IDENTITY FULL;

DO $$
BEGIN
  -- Add each table individually so one failure does not prevent others
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chat_messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.applications; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.application_task_completions; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- SETUP COMPLETE 🎉
-- ==============================================================================
