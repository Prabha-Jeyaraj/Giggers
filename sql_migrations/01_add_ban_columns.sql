-- ============================================================
-- SQL Migration: Add User Ban Support to Profiles Table
-- Run this script in your Supabase SQL Editor
-- ============================================================

-- 1. Add is_banned and ban_reason columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason text;

-- 2. Optional: Make phone number optional if not already done
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
