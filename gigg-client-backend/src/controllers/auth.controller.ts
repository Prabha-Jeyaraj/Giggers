import { Request, Response } from 'express';
import { z } from 'zod';
import { sendOtp, verifyOtp } from '../services/otp.service';
import { signToken } from '../utils/jwt';
import { supabase } from '../utils/supabase';
import { AuthenticatedRequest } from '../types';

const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number');

function serializeProfile(profile: Record<string, any>) {
  return {
    id: profile.id,
    name: profile.name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    role: profile.role || 'worker',
    avatar: profile.avatar || undefined,
    selfie: profile.selfie_url || undefined,
    isApproved: Boolean(profile.is_approved),
    isVerified: Boolean(profile.is_verified),
    aadhaarVerified: Boolean(profile.aadhaar_verified),
    selfieVerified: Boolean(profile.selfie_verified),
    aadhaarNumber: profile.aadhaar_number || undefined,
    aadhaarFront: profile.aadhaar_front_url || undefined,
    aadhaarBack: profile.aadhaar_back_url || undefined,
    panNumber: profile.pan_number || undefined,
    panFront: profile.pan_front_url || undefined,
    panBack: profile.pan_back_url || undefined,
    city: profile.city || '',
    area: profile.area || '',
    createdAt: profile.created_at,
    completedJobs: profile.completed_jobs ?? 0,
    totalJobsPosted: profile.total_jobs_posted ?? 0,
    rating: Number(profile.rating) || 0,
    reviewCount: profile.review_count ?? 0,
    totalEarnings: Number(profile.total_earnings) || 0,
    attendanceRate: Number(profile.attendance_rate) || 100,
    companyName: profile.company_name || undefined,
    isVerifiedEmployer: Boolean(profile.is_verified_employer),
    bio: profile.bio || undefined,
    skills: profile.skills || [],
    languages: profile.languages || [],
    categories: profile.categories || [],
    gender: profile.gender || undefined,
    age: profile.age || undefined,
    kycStatus: profile.kyc_status || 'not_started',
    kycSubmittedAt: profile.kyc_submitted_at || undefined,
    kycReviewedAt: profile.kyc_reviewed_at || undefined,
    kycRejectionReason: profile.kyc_rejection_reason || undefined,
    creditPoint: profile.credit_point ?? 100,
    isOnboarded: Boolean(profile.is_onboarded),
    oneLiner: profile.one_liner || undefined,
    upiId: profile.upi_id || undefined,
    bankAccount: profile.bank_account || undefined,
  };
}

export async function sendOtpHandler(req: Request, res: Response): Promise<void> {
  const result = z.object({ phone: phoneSchema }).safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }
  try {
    await sendOtp(result.data.phone);
    res.json({ message: 'OTP sent successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send OTP' });
  }
}

export async function verifyOtpHandler(req: Request, res: Response): Promise<void> {
  const result = z.object({
    phone: phoneSchema,
    otp: z.string().min(4).max(6),
    name: z.string().min(2).optional(),
    role: z.enum(['worker', 'employer']).optional(),
    city: z.string().optional(),
    area: z.string().optional(),
    companyName: z.string().optional(),
  }).safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const { phone, otp, name, role, city, area, companyName } = result.data;

  if (!verifyOtp(phone, otp)) {
    res.status(401).json({ error: 'Invalid or expired OTP' });
    return;
  }

  let profile: Record<string, any> | null = null;
  const phoneClean = phone.replace(/\s/g, '');
  const phoneAlt = phoneClean.startsWith('+91') ? phoneClean.slice(3) : `+91${phoneClean}`;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`phone.eq.${phoneClean},phone.eq.${phoneAlt}`)
      .limit(1);

    if (error && error.code !== 'PGRST116') throw error;
    profile = (data && data.length > 0) ? data[0] : null;
  } catch (err: any) {
    console.error('Database error fetching profile:', err);
    res.status(500).json({ error: 'Database error fetching profile' });
    return;
  }

  if (profile && profile.is_banned) {
    res.status(403).json({ error: profile.ban_reason ? `Your account has been banned: ${profile.ban_reason}` : 'Your account has been banned by administration.' });
    return;
  }

  if (!profile) {
    if (!name || !role) {
      res.status(400).json({ error: 'New user requires name and role', isNewUser: true });
      return;
    }
    try {
      const { data: newProfile, error } = await supabase
        .from('profiles')
        .insert({
          phone,
          name,
          role,
          city: city || '',
          area: area || '',
          company_name: role === 'employer' ? (companyName || '') : undefined,
          is_approved: false,
          is_verified: false,
          aadhaar_verified: false,
          selfie_verified: false,
        })
        .select('*')
        .single();

      if (error || !newProfile) throw error ?? new Error('No profile returned');
      profile = newProfile;
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create profile: ' + (err.message || 'Unknown error') });
      return;
    }
  } else {
    // If user already exists, update role to the selected role if provided!
    if (role) {
      const updates: Record<string, any> = { role };
      if (role === 'employer' && companyName) {
        updates.company_name = companyName;
      }
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)
        .select()
        .single();

      if (!updateError && updatedProfile) {
        profile = updatedProfile;
      } else {
        // Fallback in memory
        profile.role = role;
        if (role === 'employer' && companyName) {
          profile.company_name = companyName;
        }
      }
    }
  }

  const finalProfile = profile!;
  if (role && finalProfile.role !== role) {
    finalProfile.role = role;
  }

  const token = signToken({
    id: finalProfile.id,
    phone,
    role: finalProfile.role,
    name: finalProfile.name,
  });

  res.json({ token, user: serializeProfile(finalProfile) });
}

export async function meHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user!.id)
      .single();

    if (error || !profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json({ user: serializeProfile(profile as Record<string, any>) });
  } catch (err: any) {
    console.warn('Supabase DB error in /me, using mock profile:', err.message);
    res.json({
      user: {
        id: req.user!.id,
        phone: req.user!.phone,
        name: req.user!.name || 'Demo User',
        role: req.user!.role || 'worker',
        city: 'Mumbai',
        area: 'Andheri',
        isApproved: true,
        isVerified: true,
        kycStatus: 'approved'
      }
    });
  }
}

export async function refreshHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, phone, role')
    .eq('id', req.user!.id)
    .single();

  if (!profile) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const token = signToken({
    id: profile.id,
    phone: profile.phone,
    role: profile.role,
    name: profile.name,
  });

  res.json({ token });
}

