-- Create job_ratings table for worker rating system (1 to 10 stars)
CREATE TABLE IF NOT EXISTS job_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 10),
  review text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(job_id, worker_id)
);

ALTER TABLE job_ratings DISABLE ROW LEVEL SECURITY;
