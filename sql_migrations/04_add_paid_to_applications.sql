-- ============================================================
-- Migration: Add paid status tracking to applications table
-- ============================================================

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS paid_at timestamptz;

COMMENT ON COLUMN public.applications.paid IS 'True when the employer has executed payout for this job application.';
COMMENT ON COLUMN public.applications.paid_at IS 'Timestamp of when the payout transaction was executed.';
