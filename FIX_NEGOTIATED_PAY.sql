-- Migration: Add negotiated_pay column to applications table
-- This allows per-worker pay overrides while preserving the job's standard pay_per_worker as default.

ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS negotiated_pay numeric(10,2) DEFAULT NULL;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
