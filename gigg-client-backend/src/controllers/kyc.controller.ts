import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { supabase } from '../utils/supabase';

const imageSchema = z.string().min(32, 'Image is required');

const submitKycSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  area: z.string().min(2),
  companyName: z.string().optional(),
  aadhaarNumber: z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits'),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must be valid').transform((value) => value.toUpperCase()),
  aadhaarFront: imageSchema,
  aadhaarBack: imageSchema,
  panFront: imageSchema,
  panBack: imageSchema,
  selfie: imageSchema,
});

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
    completedJobs: profile.completed_jobs || 0,
    totalJobsPosted: profile.total_jobs_posted || 0,
    rating: Number(profile.rating) || 0,
    reviewCount: profile.review_count || 0,
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
    oneLiner: profile.one_liner || undefined,
    upiId: profile.upi_id || undefined,
    bankAccount: profile.bank_account || undefined,
  };
}

export async function submitKycHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parsed = submitKycSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const {
    name,
    city,
    area,
    companyName,
    aadhaarNumber,
    panNumber,
    aadhaarFront,
    aadhaarBack,
    panFront,
    panBack,
    selfie,
  } = parsed.data;

  const submittedAt = new Date().toISOString();

  const { data: currentProfile, error: profileFetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileFetchError || !currentProfile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const profileUpdates: Record<string, unknown> = {
    name,
    city,
    area,
    aadhaar_number: aadhaarNumber,
    aadhaar_front_url: aadhaarFront,
    aadhaar_back_url: aadhaarBack,
    pan_number: panNumber,
    pan_front_url: panFront,
    pan_back_url: panBack,
    selfie_url: selfie,
    kyc_status: 'submitted',
    kyc_submitted_at: submittedAt,
    kyc_reviewed_at: null,
    kyc_rejection_reason: null,
  };

  if (currentProfile.role === 'employer') {
    profileUpdates.company_name = companyName || currentProfile.company_name || null;
  }

  const { error: updateProfileError } = await supabase
    .from('profiles')
    .update(profileUpdates)
    .eq('id', userId);

  if (updateProfileError) {
    console.error('[KYC] profile update error:', updateProfileError);
    res.status(500).json({ error: updateProfileError.message });
    return;
  }

  const kycPayload = {
    user_id: userId,
    type: 'identity',
    status: 'pending',
    full_name: name,
    city,
    area,
    company_name: currentProfile.role === 'employer' ? companyName || currentProfile.company_name || null : null,
    aadhaar_number: aadhaarNumber,
    front_url: aadhaarFront,
    back_url: aadhaarBack,
    pan_number: panNumber,
    pan_front_url: panFront,
    pan_back_url: panBack,
    selfie_url: selfie,
    rejection_reason: null,
    submitted_at: submittedAt,
    reviewed_at: null,
  };

  const { data: existingKyc } = await supabase
    .from('kyc_documents')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  const kycQuery = existingKyc
    ? supabase.from('kyc_documents').update(kycPayload).eq('id', existingKyc.id).select('*').single()
    : supabase.from('kyc_documents').insert(kycPayload).select('*').single();

  const { error: kycError } = await kycQuery;

  if (kycError) {
    console.error('[KYC] kyc_documents error:', kycError);
    res.status(500).json({ error: kycError.message });
    return;
  }

  const { data: updatedProfile, error: refreshedProfileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (refreshedProfileError || !updatedProfile) {
    res.status(500).json({ error: 'KYC saved but failed to refresh profile' });
    return;
  }

  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'kyc_submitted',
      title: 'KYC Submitted',
      message: 'Your KYC has been submitted and is waiting for admin approval.',
      is_read: false,
    });
  } catch {
    // Notification creation is best-effort for this flow.
  }

  res.json({
    message: 'KYC submitted successfully',
    user: serializeProfile(updatedProfile as Record<string, any>),
  });
}

