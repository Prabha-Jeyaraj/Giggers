-- FIX KYC DOCUMENTS TYPE CHECK CONSTRAINT
-- Run this in Supabase SQL Editor if your kyc_documents table has an outdated check constraint.

ALTER TABLE kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_type_check;

ALTER TABLE kyc_documents ADD CONSTRAINT kyc_documents_type_check 
  CHECK (type IN ('identity', 'aadhaar', 'pan', 'other'));
