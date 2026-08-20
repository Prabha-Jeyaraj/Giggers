-- Add kyc_notification_seen flag to profiles table for one-time dismissible KYC notification
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_notification_seen boolean DEFAULT false;
