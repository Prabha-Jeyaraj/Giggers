-- ============================================================
-- Run this in Supabase SQL editor (project: npvumnhdswjuymqgqzoi)
-- ============================================================

-- 0. Profiles table (MUST run first — everything else references it)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  role text NOT NULL CHECK (role IN ('worker', 'employer', 'admin')) DEFAULT 'worker',
  avatar text,
  bio text,
  city text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  gender text CHECK (gender IN ('male', 'female', 'other')),
  age integer,
  skills text[] DEFAULT '{}',
  languages text[] DEFAULT '{}',
  categories text[] DEFAULT '{}',
  company_name text,
  is_verified boolean NOT NULL DEFAULT false,
  is_approved boolean NOT NULL DEFAULT false,
  is_verified_employer boolean NOT NULL DEFAULT false,
  aadhaar_verified boolean NOT NULL DEFAULT false,
  selfie_verified boolean NOT NULL DEFAULT false,
  completed_jobs integer NOT NULL DEFAULT 0,
  total_jobs_posted integer NOT NULL DEFAULT 0,
  rating numeric(3,2) NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  total_earnings numeric(12,2) NOT NULL DEFAULT 0,
  attendance_rate numeric(5,2) NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- Service role bypasses RLS; these policies cover client-side access
CREATE POLICY "users can read own profile" ON profiles FOR SELECT USING (true);
CREATE POLICY "users can update own profile" ON profiles FOR UPDATE USING (true);

-- 1. Jobs table (needed before transactions/worker_locations)
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
  location_lat double precision,
  location_lng double precision,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can view active jobs" ON jobs FOR SELECT USING (true);
CREATE POLICY "employers can insert own jobs" ON jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "employers can update own jobs" ON jobs FOR UPDATE USING (true);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'shortlisted', 'hired', 'rejected', 'completed', 'no_show')),
  applied_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(job_id, worker_id)
);
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workers see own applications" ON applications FOR SELECT USING (true);
CREATE POLICY "workers can apply" ON applications FOR INSERT WITH CHECK (true);
CREATE POLICY "employers can update applications" ON applications FOR UPDATE USING (true);

-- 2. Wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  escrow_balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own wallet" ON wallets FOR SELECT USING (auth.uid() = user_id);

-- Auto-create wallet on new profile
CREATE OR REPLACE FUNCTION create_wallet_for_new_user()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_wallet_for_new_user();

-- 2. Transactions table (already partially exists — extend if needed)
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  amount numeric(12,2) NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  razorpay_order_id text,
  razorpay_payment_id text,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service can insert transactions" ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "service can update transactions" ON transactions FOR UPDATE USING (true);

-- 3. Worker locations table (for real-time GPS tracking)
CREATE TABLE IF NOT EXISTS worker_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(worker_id, job_id)
);
ALTER TABLE worker_locations ENABLE ROW LEVEL SECURITY;
-- Workers can update their own location; employers who own the job can read
CREATE POLICY "workers update own location" ON worker_locations
  FOR ALL USING (auth.uid() = worker_id);
CREATE POLICY "employers view job locations" ON worker_locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM jobs j WHERE j.id = job_id AND j.employer_id = auth.uid()
    )
  );

-- 4. Increment wallet balance RPC (called after payment verification)
CREATE OR REPLACE FUNCTION increment_wallet_balance(p_user_id uuid, p_amount numeric)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE wallets
  SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- 5. (location columns are included in the jobs table definition above)

-- 6. KYC fields on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aadhaar_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aadhaar_front_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aadhaar_back_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pan_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pan_front_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pan_back_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selfie_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'not_started';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_reviewed_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_rejection_reason text;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_kyc_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_kyc_status_check CHECK (kyc_status IN ('not_started', 'submitted', 'approved', 'rejected'));

-- 7. Combined KYC submissions table
CREATE TABLE IF NOT EXISTS kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
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
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service reads kyc docs" ON kyc_documents FOR SELECT USING (true);
CREATE POLICY "service inserts kyc docs" ON kyc_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "service updates kyc docs" ON kyc_documents FOR UPDATE USING (true);

-- ============================================================
-- 8. Pipeline feature migrations
-- ============================================================

-- 8a. Add pipeline_share_token to jobs (unique public share token per job)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pipeline_share_token uuid DEFAULT gen_random_uuid() UNIQUE;
-- Backfill any existing rows that still have NULL
UPDATE jobs SET pipeline_share_token = gen_random_uuid() WHERE pipeline_share_token IS NULL;

-- 8b. Add pipeline_share_token to applications (unique share token per worker-job pairing)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS pipeline_share_token uuid DEFAULT gen_random_uuid() UNIQUE;
UPDATE applications SET pipeline_share_token = gen_random_uuid() WHERE pipeline_share_token IS NULL;

-- 8c. Extend applications status to include 'confirmed'
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check
  CHECK (status IN ('applied', 'shortlisted', 'hired', 'confirmed', 'rejected', 'completed', 'no_show'));

-- 8d. Job tasks table
CREATE TABLE IF NOT EXISTS job_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
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
ALTER TABLE job_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_tasks select" ON job_tasks FOR SELECT USING (true);
CREATE POLICY "job_tasks insert" ON job_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "job_tasks update" ON job_tasks FOR UPDATE USING (true);
CREATE POLICY "job_tasks delete" ON job_tasks FOR DELETE USING (true);

-- 8e. Application task completions table
CREATE TABLE IF NOT EXISTS application_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  job_task_id uuid NOT NULL REFERENCES job_tasks(id) ON DELETE CASCADE,
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
ALTER TABLE application_task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "completions select" ON application_task_completions FOR SELECT USING (true);
CREATE POLICY "completions insert" ON application_task_completions FOR INSERT WITH CHECK (true);
CREATE POLICY "completions update" ON application_task_completions FOR UPDATE USING (true);
CREATE POLICY "completions delete" ON application_task_completions FOR DELETE USING (true);

