import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAdmin);

router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const status = (req.query.status as string) || 'pending';
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('kyc_documents')
    .select('*, profiles!kyc_documents_user_id_fkey(name, email, avatar, phone, role, city, area, company_name, kyc_status)', { count: 'exact' })
    .eq('status', status)
    .range(offset, offset + limit - 1)
    .order('submitted_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ data, total: count, page, limit });
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from('kyc_documents')
    .select('*, profiles!kyc_documents_user_id_fkey(*)')
    .eq('id', id)
    .single();

  if (error) {
    res.status(404).json({ error: 'KYC document not found' });
    return;
  }

  res.json(data);
});

router.patch('/:id/approve', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const reviewedAt = new Date().toISOString();

  const { data: kyc, error: kycError } = await supabaseAdmin
    .from('kyc_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (kycError || !kyc) {
    res.status(404).json({ error: 'KYC document not found' });
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from('kyc_documents')
    .update({ status: 'approved', reviewed_at: reviewedAt, rejection_reason: null })
    .eq('id', id);

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      name: kyc.full_name,
      city: kyc.city || '',
      area: kyc.area || '',
      company_name: kyc.company_name || null,
      aadhaar_number: kyc.aadhaar_number,
      aadhaar_front_url: kyc.front_url,
      aadhaar_back_url: kyc.back_url,
      pan_number: kyc.pan_number,
      pan_front_url: kyc.pan_front_url,
      pan_back_url: kyc.pan_back_url,
      selfie_url: kyc.selfie_url,
      aadhaar_verified: true,
      selfie_verified: true,
      is_verified: true,
      is_approved: true,
      kyc_status: 'approved',
      kyc_reviewed_at: reviewedAt,
      kyc_rejection_reason: null,
    })
    .eq('id', kyc.user_id);

  if (profileError) {
    res.status(500).json({ error: profileError.message });
    return;
  }

  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: kyc.user_id,
      type: 'kyc_approved',
      title: 'KYC Approved',
      message: 'Your KYC is approved. You can now apply for jobs or post jobs.',
      is_read: false,
    });
  } catch {}

  res.json({ message: 'KYC approved and user activated' });
});

router.patch('/:id/reject', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { reason } = req.body;
  const reviewedAt = new Date().toISOString();

  const { data: kyc, error: kycError } = await supabaseAdmin
    .from('kyc_documents')
    .select('user_id')
    .eq('id', id)
    .single();

  if (kycError || !kyc) {
    res.status(404).json({ error: 'KYC document not found' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('kyc_documents')
    .update({
      status: 'rejected',
      rejection_reason: reason || 'Does not meet requirements',
      reviewed_at: reviewedAt,
    })
    .eq('id', id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await supabaseAdmin
    .from('profiles')
    .update({
      is_approved: false,
      is_verified: false,
      aadhaar_verified: false,
      selfie_verified: false,
      kyc_status: 'rejected',
      kyc_reviewed_at: reviewedAt,
      kyc_rejection_reason: reason || 'Does not meet requirements',
    })
    .eq('id', kyc.user_id);

  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: kyc.user_id,
      type: 'kyc_rejected',
      title: 'KYC Needs Attention',
      message: reason || 'Your KYC was rejected. Please review and resubmit your documents.',
      is_read: false,
    });
  } catch {}

  res.json({ message: 'KYC rejected' });
});

export default router;
