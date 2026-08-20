import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAdmin);

router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string | undefined;
  const role = req.query.role as string | undefined;
  const approved = req.query.approved as string | undefined;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }
  if (role) {
    query = query.eq('role', role);
  }
  if (approved === 'false') {
    query = query.eq('is_approved', false);
  } else if (approved === 'true') {
    query = query.eq('is_approved', true);
  }

  const { data, error, count } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ data, total: count, page, limit });
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const [profileResult, jobsResult, transactionsResult, kycResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', id).single(),
    supabaseAdmin.from('jobs').select('*').eq('employer_id', id).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('transactions').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('kyc_documents').select('*').eq('user_id', id).maybeSingle(),
  ]);

  if (profileResult.error) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    profile: profileResult.data,
    recentJobs: jobsResult.data || [],
    recentTransactions: transactionsResult.data || [],
    kycSubmission: kycResult.data || null,
  });
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const updates = req.body;

  const allowedFields = ['name', 'is_verified', 'is_verified_employer', 'role', 'city', 'area', 'kyc_status'];
  const filteredUpdates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in updates) filteredUpdates[key] = updates[key];
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(filteredUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

router.patch('/:id/approve', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { approved } = req.body;

  if (typeof approved !== 'boolean') {
    res.status(400).json({ error: '"approved" (boolean) is required' });
    return;
  }

  // If approved: is_approved = true, unban
  // If rejected: is_approved = false, is_banned = true
  const updatePayload: Record<string, any> = {
    is_approved: approved,
    is_banned: !approved,
  };

  let updateResult = await supabaseAdmin
    .from('profiles')
    .update({
      ...updatePayload,
      banned_reason: approved ? null : 'Account rejected by admin',
    })
    .eq('id', id)
    .select('id, name, role, is_approved, is_banned')
    .single();

  if (updateResult.error) {
    // Fallback if banned_reason column is not present
    updateResult = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', id)
      .select('id, name, role, is_approved, is_banned')
      .single();
  }

  if (updateResult.error) {
    res.status(500).json({ error: updateResult.error.message });
    return;
  }

  const notificationType = approved ? 'account_approved' : 'account_rejected';
  const notificationTitle = approved ? 'Account Approved' : 'Account Rejected';
  const notificationMessage = approved
    ? 'Your Gigg account has been approved. You can now access all features.'
    : 'Your account registration was not approved. Please contact support for more information.';

  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: id,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
      is_read: false,
    });
  } catch {
    // Best-effort notification creation
  }

  res.json({ message: approved ? 'User approved' : 'User rejected', user: updateResult.data });
});

router.patch('/:id/ban', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { banned, reason } = req.body;

  if (typeof banned !== 'boolean') {
    res.status(400).json({ error: '"banned" (boolean) is required' });
    return;
  }

  // Try updating Supabase Auth ban status if auth account exists (best effort)
  try {
    await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: banned ? '87600h' : 'none',
    });
  } catch (err) {
    console.log('[Ban] Supabase Auth update notice:', err);
  }

  // Support both banned_reason and ban_reason column names gracefully
  let updateResult = await supabaseAdmin
    .from('profiles')
    .update({ is_banned: banned, banned_reason: reason || (banned ? 'Banned by admin' : null) })
    .eq('id', id)
    .select()
    .single();

  if (updateResult.error) {
    updateResult = await supabaseAdmin
      .from('profiles')
      .update({ is_banned: banned })
      .eq('id', id)
      .select()
      .single();
  }

  if (updateResult.error) {
    console.error('[Ban] Profile update error:', updateResult.error);
    res.status(500).json({ error: updateResult.error.message });
    return;
  }

  res.json({ message: banned ? 'User banned' : 'User unbanned', user: updateResult.data });
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: 'User deleted successfully' });
});

export default router;
