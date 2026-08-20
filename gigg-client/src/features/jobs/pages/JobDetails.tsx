import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Utensils, Shield, Bookmark, AlertCircle, Edit, Users, CheckCircle, Star, MessageCircle, Coins } from 'lucide-react';
import { AppHeader } from '../../../components/layout/Navigation';
import { Button, Badge, MapPlaceholder, Modal, Chip, Avatar } from '../../../components/ui';
import { useJobStore } from '../../../store/jobStore';
import type { Application } from '../../../types';
import { useAuthStore } from '../../../store/authStore';
import { useWalletStore } from '../../../store/walletStore';
import { useUIStore } from '../../../store/uiStore';
import { useChatStore } from '../../../store/chatStore';
import { parseDosAndDonts } from '../constants';
import { supabase } from '../../../lib/supabase';
import { getPersonalizedJobBadge } from '../../../components/shared/Cards';
import { NegotiatedPayModal } from '../components/NegotiatedPayModal';
import { formatTimeString12h } from '../../../lib/time';
import { clsx } from 'clsx';

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { jobs, myJobs, applications, savedJobIds, saveJob, unsaveJob, applyToJob, isLoading, completeJob, jobCandidates, fetchJobCandidates, hireWorker, fetchChatThreadId } = useJobStore();
  const { getOrCreateThread } = useChatStore();
  const { wallet, fetchWallet, releaseEscrow } = useWalletStore();
  const { addToast } = useUIStore();
  const [applying, setApplying] = useState(false);
  const [navigatingChat, setNavigatingChat] = useState(false);
  const [showCandidatesModal, setShowCandidatesModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Application | null>(null);

  // New state for Job Completion & Worker Payouts
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [hiredWorkersList, setHiredWorkersList] = useState<any[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [payingWorkerId, setPayingWorkerId] = useState<string | null>(null);
  const [payModalApp, setPayModalApp] = useState<{ id: string; workerName: string; negotiatedPay?: number | null; } | null>(null);

  // Worker Rating State (Item 5)
  const [workerRatings, setWorkerRatings] = useState<Record<string, number>>({});
  const [ratingModalWorker, setRatingModalWorker] = useState<{ workerId: string; workerName: string } | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(10);
  const [submittingRating, setSubmittingRating] = useState(false);

  const fetchRatings = async () => {
    if (!job?.id) return;
    try {
      const { data } = await supabase
        .from('job_ratings')
        .select('worker_id, rating')
        .eq('job_id', job.id);

      if (data) {
        const map: Record<string, number> = {};
        data.forEach((r: any) => { map[r.worker_id] = r.rating; });
        setWorkerRatings(map);
      }
    } catch {}
  };

  const handleSaveRating = async () => {
    if (!ratingModalWorker || !user || !job) return;
    setSubmittingRating(true);
    try {
      const { error } = await supabase.from('job_ratings').upsert({
        job_id: job.id,
        worker_id: ratingModalWorker.workerId,
        employer_id: user.id,
        rating: selectedRating,
      }, { onConflict: 'job_id,worker_id' });

      if (error) throw error;

      const { data: allRatings } = await supabase
        .from('job_ratings')
        .select('rating')
        .eq('worker_id', ratingModalWorker.workerId);

      if (allRatings && allRatings.length > 0) {
        const avg = allRatings.reduce((sum: number, r: any) => sum + r.rating, 0) / allRatings.length;
        await supabase
          .from('profiles')
          .update({ rating: Number(avg.toFixed(1)), review_count: allRatings.length })
          .eq('id', ratingModalWorker.workerId);
      }

      addToast(`Rated ${ratingModalWorker.workerName} ${selectedRating}/10 ⭐!`, 'success');
      setWorkerRatings(prev => ({ ...prev, [ratingModalWorker.workerId]: selectedRating }));
      setRatingModalWorker(null);
    } catch (err) {
      console.error('Error saving rating:', err);
      addToast('Failed to save rating', 'error');
    } finally {
      setSubmittingRating(false);
    }
  };

  const job = jobs.find(j => j.id === id);
  const isSaved = job ? savedJobIds.includes(job.id) : false;

  const handleChatWithEmployer = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!job) return;
    setNavigatingChat(true);
    try {
      const threadId = await getOrCreateThread(job.id, user.id, job.employerId);
      if (threadId) {
        navigate(`/chat/${threadId}`);
      } else {
        addToast('Could not open chat. Please try again.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error starting chat', 'error');
    } finally {
      setNavigatingChat(false);
    }
  };

  if (!job) return <div className="p-5 text-center">Job not found</div>;

  // A job is the employer's job if it matches my user ID
  const isEmployerForThisJob = user && job.employerId === user.id;
  // Stricter than isEmployerForThisJob: also requires the account's CURRENT
  // role to be employer. A phone number's role can be switched on login
  // (worker <-> employer), so job.employerId === user.id alone isn't enough —
  // without this, someone who posted a job as an employer and later logs back
  // in as a worker would still see employer-only action controls (paying
  // workers, marking the job complete) on their old job postings. Used only
  // to gate actions/money, not read-only info like Team Chat visibility.
  const canManageAsEmployer = Boolean(isEmployerForThisJob && user?.role === 'employer');
  const jobApplication = user?.role === 'worker'
    ? applications.find((a) => a.jobId === job.id)
    : undefined;
  const hasApplied = jobApplication !== undefined;
  const isConfirmed = jobApplication?.status === 'confirmed';
  const isPendingConfirmation = jobApplication?.status === 'hired';
  // Job is full when all worker slots are filled
  const isFull = job.workersHired >= job.workersNeeded;

  const handleApply = async () => {
    if (!user) return;
    setApplying(true);
    await applyToJob(job.id, user.id);
    setApplying(false);
    addToast('Successfully applied to job!', 'success');
    navigate('/jobs?tab=applications');
  };

  // Fetch hired workers for payment handling
  const fetchHiredWorkersForPayment = async () => {
    if (!job?.id) return;
    setLoadingWorkers(true);
    try {
      const { data: appsData } = await supabase
        .from('applications')
        .select('id, status, applied_at, worker_id, paid, paid_at, negotiated_pay')
        .eq('job_id', job.id)
        .in('status', ['hired', 'confirmed', 'completed']);

      if (!appsData || appsData.length === 0) {
        setHiredWorkersList([]);
        return;
      }

      const workerIds = appsData.map(a => a.worker_id).filter(Boolean);
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, avatar, selfie_url, rating, city, area')
        .in('id', workerIds);

      const profileMap: Record<string, any> = {};
      if (profs) profs.forEach(p => { profileMap[p.id] = p; });

      const mapped = appsData.map(a => ({
        id: a.id,
        workerId: a.worker_id,
        status: a.status,
        negotiatedPay: a.negotiated_pay != null ? Number(a.negotiated_pay) : null,
        paid: Boolean(a.paid),
        paidAt: a.paid_at,
        profile: profileMap[a.worker_id] || { name: 'Worker' }
      }));

      setHiredWorkersList(mapped);
    } catch (err) {
      console.error('Error fetching hired workers:', err);
    } finally {
      setLoadingWorkers(false);
    }
  };

  useEffect(() => {
    if (job?.id && user) {
      fetchWallet();
      fetchHiredWorkersForPayment();
      fetchRatings();
    }
  }, [job?.id, user?.id]);

  const handleMarkJobComplete = async () => {
    if (!job) return;
    setCompleting(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', job.id);

      if (error) throw error;

      completeJob(job.id);
      addToast('Job marked as Completed! You can now pay the hired workers.', 'success');
      setShowCompleteModal(false);
      fetchHiredWorkersForPayment();
    } catch (err: any) {
      console.error('Error marking job completed:', err);
      addToast('Failed to mark job as complete', 'error');
    } finally {
      setCompleting(false);
    }
  };

  const handlePayWorker = async (applicationId: string, workerId: string, workerName: string) => {
    if (!user || !job) return;

    const workerApp = hiredWorkersList.find(a => a.id === applicationId);
    const amountToPay = workerApp?.negotiatedPay != null ? workerApp.negotiatedPay : job.payPerWorker;

    const { data: empWallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();

    const empBalance = Number(empWallet?.balance) || 0;
    if (empBalance < amountToPay) {
      addToast(`Insufficient wallet balance (Current: ₹${empBalance}, Required: ₹${amountToPay}). Please add money to your wallet first.`, 'error');
      return;
    }

    setPayingWorkerId(applicationId);
    try {
      // 1. Deduct from employer wallet
      const newEmpBalance = empBalance - amountToPay;
      await supabase
        .from('wallets')
        .update({ balance: newEmpBalance, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      // 2. Credit worker wallet
      const { data: wWallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', workerId)
        .maybeSingle();

      const workerBalance = Number(wWallet?.balance) || 0;
      const newWorkerBalance = workerBalance + amountToPay;

      await supabase
        .from('wallets')
        .upsert(
          { user_id: workerId, balance: newWorkerBalance, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );

      // 3. Transactions
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'debit',
        amount: amountToPay,
        status: 'success',
        description: `Worker Payout for ${job.title} to ${workerName}`,
        job_id: job.id,
      });

      await supabase.from('transactions').insert({
        user_id: workerId,
        type: 'credit',
        amount: amountToPay,
        status: 'success',
        description: `Gig Payment for ${job.title}`,
        job_id: job.id,
      });

      // 4. Mark application as paid
      await supabase
        .from('applications')
        .update({ paid: true, paid_at: new Date().toISOString() })
        .eq('id', applicationId);

      addToast(`Successfully paid ₹${amountToPay} to ${workerName}!`, 'success');
      fetchWallet();
      fetchHiredWorkersForPayment();
    } catch (err: any) {
      console.error('Error paying worker:', err);
      addToast('Failed to process payment', 'error');
    } finally {
      setPayingWorkerId(null);
    }
  };

  const handleHire = (applicationId: string) => {
    if (job.workersHired >= job.workersNeeded) {
      addToast(`You can only hire up to ${job.workersNeeded} workers.`, 'error');
      return;
    }
    hireWorker(job.id, applicationId);
    addToast('Worker hired successfully!', 'success');
  };

  return (
    <div className="pb-32 font-sans bg-slate-50 dark:bg-dark-900 min-h-screen">
      <AppHeader
        title="Job Details"
        showBack
        onBack={() => navigate(-1)}
        rightAction={
          !isEmployerForThisJob ? (
            user?.role !== 'employer' ? (
              <button onClick={() => isSaved ? unsaveJob(job.id) : saveJob(job.id)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-primary-500">
                <Bookmark size={22} fill={isSaved ? 'currentColor' : 'none'} className={isSaved ? 'text-primary-500' : ''} />
              </button>
            ) : null
          ) : (
            <button onClick={() => navigate(`/edit-job/${job.id}`)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-primary-500">
              <Edit size={22} />
            </button>
          )
        }
      />

      <div className="bg-white dark:bg-dark-800 px-5 pt-6 pb-6 shadow-sm mb-2">
        <div className="flex items-start justify-between mb-4">
          <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center text-3xl">
            {job.categoryEmoji}
          </div>
          {job.isUrgent && <Badge variant="danger" className="animate-pulse">🚨 URGENT</Badge>}
        </div>

        <h1 className="text-xl font-black text-slate-900 dark:text-white leading-tight mb-2">{job.title}</h1>

        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 mb-6">
          {job.isVerifiedEmployer && <Shield size={14} className="text-primary-500" />}
          <span>{job.employerName}</span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="text-amber-500 flex items-center gap-1">★ {job.employerRating}</span>
        </div>

        <div className="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/10 rounded-2xl border border-primary-100 dark:border-primary-800/30">
          <div>
            <p className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-1">
              {jobApplication?.negotiatedPay != null ? 'Agreed Pay' : 'Total Pay'}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black text-slate-900 dark:text-white">
                ₹{jobApplication?.negotiatedPay != null ? jobApplication.negotiatedPay : job.payPerWorker}
              </p>
              {jobApplication?.negotiatedPay != null && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  (Base: ₹{job.payPerWorker})
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            {(() => {
              const personalizedBadge = getPersonalizedJobBadge(job.status, job.workersHired, job.workersNeeded, jobApplication?.status);
              return (
                <span className={`inline-block text-[10px] font-black uppercase px-3 py-1.5 rounded-full tracking-wide ${
                  personalizedBadge.variant === 'primary' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                  personalizedBadge.variant === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                  personalizedBadge.variant === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                  personalizedBadge.variant === 'danger' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                  'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                  {personalizedBadge.label}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="px-5 py-6 bg-white dark:bg-dark-800 shadow-sm mb-2">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4">Time & Location</h3>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-dark-600 flex items-center justify-center text-slate-500 flex-shrink-0"><Calendar size={18} /></div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{job.date}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Report at {formatTimeString12h(job.reportingTime)}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-dark-600 flex items-center justify-center text-slate-500 flex-shrink-0"><MapPin size={18} /></div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{job.location}</p>
            </div>
          </div>
        </div>

        {job.address && (
          <div className="mt-6 rounded-2xl overflow-hidden border border-slate-100 dark:border-dark-600">
            <MapPlaceholder height="h-32" />
            <a
              href={job.address}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-slate-50 dark:bg-dark-700 p-3 text-center border-t border-slate-100 dark:border-dark-600 text-xs font-bold text-primary-600 dark:text-primary-400"
            >
              Open in Maps →
            </a>
          </div>
        )}
      </div>

      <div className="px-5 py-6 bg-white dark:bg-dark-800 shadow-sm mb-2">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4">Requirements & Details</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-6 whitespace-pre-wrap">
          {job.description}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-dark-700 rounded-xl border border-slate-100 dark:border-dark-600">
            <p className="text-xs text-slate-500 font-bold mb-1">Dress Code</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{job.dressCode}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-dark-700 rounded-xl border border-slate-100 dark:border-dark-600">
            <p className="text-xs text-slate-500 font-bold mb-1">Languages</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{job.languagesRequired.join(', ') || 'Any'}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-dark-700 rounded-xl border border-slate-100 dark:border-dark-600">
            <p className="text-xs text-slate-500 font-bold mb-1">Gender</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">{job.genderPreference}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-dark-700 rounded-xl border border-slate-100 dark:border-dark-600">
            <p className="text-xs text-slate-500 font-bold mb-1">Payment</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">{job.modeOfPayment}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-dark-700 rounded-xl border border-slate-100 dark:border-dark-600">
            <p className="text-xs text-slate-500 font-bold mb-1">Facilities</p>
            <p className="text-sm font-bold text-emerald-600 flex items-center gap-1">
              {job.foodProvided ? <><Utensils size={14} /> Food</> : 'None'}
            </p>
          </div>
        </div>

        {job.dosAndDonts && (() => {
          const { dos, donts } = parseDosAndDonts(job.dosAndDonts);
          return (
            <>
              {dos && (
                <div className="mt-4">
                  <p className="text-xs text-slate-500 font-bold mb-1">Do's</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">{dos}</p>
                </div>
              )}
              {donts && (
                <div className="mt-4">
                  <p className="text-xs text-slate-500 font-bold mb-1">Don'ts</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">{donts}</p>
                </div>
              )}
            </>
          );
        })()}

        {job.clientName && (
          <div className="mt-4">
            <p className="text-xs text-slate-500 font-bold mb-1">Client Name</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{job.clientName}</p>
          </div>
        )}
      </div>

      {!isEmployerForThisJob && user?.role !== 'employer' && (
        <div className="px-5 py-6 bg-white dark:bg-dark-800 shadow-sm">
          <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/30">
            <AlertCircle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs font-medium text-amber-800 dark:text-amber-400 leading-relaxed">
              By applying, you commit to arriving on time. Cancellations within 12 hours of reporting time may negatively impact your rating.
            </p>
          </div>
        </div>
      )}

      {/* Team Chat Section */}
      {(isEmployerForThisJob || isConfirmed || isPendingConfirmation || jobApplication?.status === 'completed') && (
        <div className="px-5 py-6 bg-white dark:bg-dark-800 shadow-sm mb-2 border-t border-slate-100 dark:border-dark-700">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-3">Team Chat</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">
            Coordination and progress updates for this gig. Access is restricted to hired team members and the employer.
          </p>
          <div className="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-950/20 rounded-2xl border border-primary-100 dark:border-primary-900/10 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                <Users size={20} />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">Job Group Chat</p>
                {job.isGroupClosed ? (
                  <span className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-0.5">⚠️ Closed / Read-Only</span>
                ) : (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">● Active group</span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => navigate(`/group-chat/${job.id}`)}
            >
              Open Chat
            </Button>
          </div>
        </div>
      )}

      {/* Pay Hired Workers Section (Visible to Employer when job status is completed or active) */}
      {canManageAsEmployer && (job.status === 'completed' || hiredWorkersList.length > 0) && (
        <div className="px-5 py-6 bg-white dark:bg-dark-800 shadow-sm mb-2 border-t border-slate-100 dark:border-dark-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Pay Hired Workers</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Job base rate: <strong className="text-emerald-600">₹{job.payPerWorker}</strong> • Wallet Balance: <strong>₹{wallet?.currentBalance ?? 0}</strong>
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/wallet')}>
              + Add Money
            </Button>
          </div>

          {loadingWorkers ? (
            <div className="py-4 text-center text-slate-400 text-xs font-semibold">Loading hired workers...</div>
          ) : hiredWorkersList.length === 0 ? (
            <div className="p-4 bg-slate-50 dark:bg-dark-700 rounded-2xl text-center text-xs text-slate-500 font-medium">
              No workers hired for this job yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {hiredWorkersList.map((app) => {
                const workerEffectivePay = app.negotiatedPay != null ? app.negotiatedPay : job.payPerWorker;
                return (
                  <div key={app.id} className="p-4 bg-slate-50 dark:bg-dark-700/60 rounded-2xl border border-slate-100 dark:border-dark-600 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={app.profile?.selfie_url || app.profile?.avatar} name={app.profile?.name || 'Worker'} size="md" />
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{app.profile?.name || 'Worker'}</h4>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            Pay: ₹{workerEffectivePay}
                          </span>
                          {app.negotiatedPay != null ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                              Negotiated
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold">
                              (Standard)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {app.paid ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle size={14} /> Paid
                          </span>
                          {workerRatings[app.workerId] ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-extrabold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200">
                              <Star size={12} fill="currentColor" className="text-amber-500" />
                              {workerRatings[app.workerId]}/10
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRating(10);
                                setRatingModalWorker({ workerId: app.workerId, workerName: app.profile?.name || 'Worker' });
                              }}
                              className="border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 text-xs font-extrabold"
                            >
                              ★ Rate
                            </Button>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setPayModalApp({
                              id: app.id,
                              workerName: app.profile?.name || 'Worker',
                              negotiatedPay: app.negotiatedPay,
                            })}
                            title="Edit negotiated pay"
                            className="p-2 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border border-slate-200 dark:border-dark-600 transition-colors"
                          >
                            <Coins size={15} />
                          </button>
                          <Button
                            size="sm"
                            variant="primary"
                            loading={payingWorkerId === app.id}
                            onClick={() => handlePayWorker(app.id, app.workerId, app.profile?.name || 'Worker')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold"
                          >
                            Pay ₹{workerEffectivePay}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-dark-800/90 backdrop-blur-md border-t border-slate-100 dark:border-dark-600 z-40 max-w-lg mx-auto">
        {canManageAsEmployer ? (
          <div className="flex gap-3">
            <Button className="flex-1" variant="outline" onClick={() => setShowCandidatesModal(true)} rightIcon={<Users size={18} />}>
              Candidates ({jobCandidates.length || job.applicantsCount})
            </Button>
            {job.status !== 'completed' ? (
              <Button className="flex-1" variant="primary" onClick={() => setShowCompleteModal(true)} rightIcon={<CheckCircle size={18} />}>
                Mark Job as Complete
              </Button>
            ) : (
              <Button className="flex-1 bg-emerald-500 text-white" disabled>
                Completed
              </Button>
            )}
          </div>
        ) : user?.role === 'employer' || isEmployerForThisJob ? (
          <div className="text-center py-2 text-sm font-bold text-slate-500 dark:text-slate-400">
            {isEmployerForThisJob ? 'Switch to your Employer account to manage this job.' : 'Employers cannot apply for gigs.'}
          </div>
        ) : isConfirmed ? (
          <div className="flex flex-col gap-3">
            <Button
              fullWidth
              size="lg"
              variant="primary"
              onClick={() => navigate(`/worker-pipeline/${job.id}`)}
              className="bg-emerald-500 hover:bg-emerald-600 border-emerald-500 text-white"
            >
              <CheckCircle size={18} className="mr-2" /> Go to Job Pipeline
            </Button>
            <Button
              fullWidth
              variant="outline"
              onClick={handleChatWithEmployer}
              loading={navigatingChat}
            >
              <MessageCircle size={18} className="mr-2" /> Chat with Employer
            </Button>
          </div>
        ) : isPendingConfirmation ? (
          <div className="flex flex-col gap-3">
            <Button fullWidth size="lg" disabled className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200">
              <CheckCircle size={18} className="mr-2" /> Offer Received — Confirm in Ongoing tab
            </Button>
            <div className="flex gap-2">
              <Button fullWidth variant="outline" onClick={() => navigate('/jobs?tab=ongoing')}>
                Go to Ongoing
              </Button>
              <Button fullWidth variant="outline" onClick={handleChatWithEmployer} loading={navigatingChat}>
                <MessageCircle size={18} className="mr-2" /> Chat
              </Button>
            </div>
          </div>
        ) : hasApplied ? (
          <div className="flex flex-col gap-3">
            <Button fullWidth size="lg" disabled className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-200">
              <CheckCircle size={18} className="mr-2" /> Waiting for Approval
            </Button>
            <Button fullWidth variant="outline" onClick={handleChatWithEmployer} loading={navigatingChat}>
              <MessageCircle size={18} className="mr-2" /> Chat with Employer
            </Button>
          </div>
        ) : isFull ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
              <span className="text-lg">🔒</span>
              <div>
                <p className="text-sm font-extrabold text-red-700 dark:text-red-400">Applications Closed</p>
                <p className="text-[10px] font-medium text-red-500 dark:text-red-500">All {job.workersNeeded} positions have been filled.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!user?.isApproved && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 p-3 rounded-xl flex items-center gap-2">
                <Shield size={16} className="text-amber-600 flex-shrink-0" />
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Your account is pending admin approval before you can apply.</p>
              </div>
            )}
            {user?.isApproved && !user?.isVerified && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 p-3 rounded-xl flex items-center gap-2">
                <Shield size={16} className="text-amber-600 flex-shrink-0" />
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">KYC Verification required to apply for jobs. Go to Profile to verify.</p>
              </div>
            )}
            <Button
              fullWidth
              size="lg"
              loading={applying || isLoading}
              onClick={handleApply}
              disabled={!user?.isApproved || !user?.isVerified}
            >
              {!user?.isApproved ? 'Pending Approval' : !user?.isVerified ? 'Verify Identity' : `Apply for ₹${job.payPerWorker}`}
            </Button>
          </div>
        )}
      </div>

      {/* Candidates Modal */}
      <Modal open={showCandidatesModal} onClose={() => setShowCandidatesModal(false)} title="Job Candidates">
        <div className="flex flex-col gap-4 py-2">
          <div className="bg-primary-50 dark:bg-primary-900/10 rounded-xl p-3 flex justify-between items-center border border-primary-100 dark:border-primary-800/30">
            <span className="text-sm font-bold text-primary-700 dark:text-primary-400">Hiring Progress</span>
            <span className="text-sm font-black text-primary-600">{job.workersHired} / {job.workersNeeded} Hired</span>
          </div>

          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto no-scrollbar">
            {jobCandidates.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No candidates have applied yet.</p>
            ) : (
              jobCandidates.map(c => (
                <div key={c.id} className="bg-white dark:bg-dark-800 p-3 rounded-2xl border border-slate-100 dark:border-dark-600 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedCandidate(c)}>
                      <Avatar src={c.workerProfile?.selfie} name={c.workerName} size="md" />
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-1">
                          {c.workerName}
                        </h4>
                        <div className="flex items-center gap-1 text-xs font-bold text-amber-500 mt-1">
                          <Star size={12} fill="currentColor" /> {c.workerRating}
                          {c.workerProfile && <span className="text-slate-400 font-medium ml-1">• {c.workerProfile.completedJobs} jobs</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {c.status === 'hired' || c.status === 'confirmed' ? (
                        <>
                          <Badge variant="success">{c.status === 'confirmed' ? 'Confirmed' : 'Hired (Pending)'}</Badge>
                          <button
                            onClick={async () => {
                              if (!user) return;
                              const threadId = await getOrCreateThread(job.id, c.workerId, user.id);
                              if (threadId) { setShowCandidatesModal(false); navigate(`/chat/${threadId}`); }
                            }}
                            className="text-[10px] font-bold text-primary-600 flex items-center gap-1"
                          >
                            <MessageCircle size={12} /> Chat
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              if (!user) return;
                              const threadId = await getOrCreateThread(job.id, c.workerId, user.id);
                              if (threadId) { setShowCandidatesModal(false); navigate(`/chat/${threadId}`); }
                            }}
                            className="text-xs font-bold text-primary-600 flex items-center gap-1 p-1 bg-primary-50 dark:bg-primary-900/20 rounded-lg"
                          >
                            <MessageCircle size={14} />
                          </button>
                          <Button size="sm" onClick={() => handleHire(c.id)} disabled={job.workersHired >= job.workersNeeded}>
                            Hire
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Worker Profile Modal */}
      {selectedCandidate && selectedCandidate.workerProfile && (
        <Modal open={!!selectedCandidate} onClose={() => setSelectedCandidate(null)} title="Worker Profile">
          <div className="flex flex-col gap-5 py-2">
            <div className="flex items-center gap-4">
              <Avatar src={selectedCandidate.workerProfile?.selfie} name={selectedCandidate.workerName} size="xl" />
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{selectedCandidate.workerName}</h3>
                <p className="text-sm font-semibold text-slate-500 flex items-center gap-1">
                  <MapPin size={14} /> {selectedCandidate.workerProfile.city}
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="warning" className="flex gap-1 items-center">
                    <Star size={12} fill="currentColor" /> {selectedCandidate.workerRating}
                  </Badge>
                  <Badge variant="success">{selectedCandidate.workerProfile.attendanceRate}% Attendance</Badge>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-dark-800 p-4 rounded-2xl border border-slate-100 dark:border-dark-600">
              <p className="text-xs font-bold text-slate-500 mb-2">About</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                {selectedCandidate.workerProfile.bio}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 mb-2">Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-dark-800 p-3 rounded-xl border border-slate-100 dark:border-dark-600">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Age / Gender</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">{selectedCandidate.workerProfile.age} • {selectedCandidate.workerProfile.gender}</p>
                </div>
                <div className="bg-slate-50 dark:bg-dark-800 p-3 rounded-xl border border-slate-100 dark:border-dark-600">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Languages</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedCandidate.workerProfile.languages?.join(', ')}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 mb-2">Top Skills</p>
              <div className="flex flex-wrap gap-2">
                {selectedCandidate.workerProfile.skills?.map(skill => (
                  <Chip key={skill} active={false}>{skill}</Chip>
                ))}
              </div>
            </div>

            <Button fullWidth size="lg" onClick={() => { handleHire(selectedCandidate.id); setSelectedCandidate(null); }} disabled={selectedCandidate.status === 'hired' || selectedCandidate.status === 'confirmed' || job.workersHired >= job.workersNeeded}>
              {selectedCandidate.status === 'hired' || selectedCandidate.status === 'confirmed' ? 'Already Hired' : 'Hire this Worker'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Complete Job Confirmation Modal */}
      <Modal open={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="Mark Job as Complete">
        <div className="flex flex-col gap-4 py-2">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-2xl flex items-start gap-3">
            <CheckCircle className="text-emerald-500 mt-0.5 flex-shrink-0" size={20} />
            <div>
              <h4 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-300 mb-1">Confirm Job Completion</h4>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 leading-relaxed">
                Are you sure you want to mark <strong>{job.title}</strong> as Completed? This will finish the gig and unlock worker payouts.
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowCompleteModal(false)} disabled={completing}>
              Cancel
            </Button>
            <Button variant="primary" className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-bold text-white" onClick={handleMarkJobComplete} loading={completing}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rate Worker Modal (1 to 10 stars) */}
      <Modal open={Boolean(ratingModalWorker)} onClose={() => setRatingModalWorker(null)} title={`Rate ${ratingModalWorker?.workerName}`}>
        <div className="flex flex-col items-center gap-4 py-3 text-center">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            How would you rate {ratingModalWorker?.workerName}'s performance for this gig?
          </p>

          <div className="flex flex-col items-center gap-2 my-2">
            <div className="text-4xl font-black text-amber-500 flex items-center justify-center gap-1">
              <span>{selectedRating}</span>
              <span className="text-xl font-bold text-slate-400">/ 10</span>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-xs mt-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
                <button
                  key={star}
                  onClick={() => setSelectedRating(star)}
                  className={clsx(
                    'w-9 h-9 rounded-xl font-black text-xs transition-all flex items-center justify-center',
                    selectedRating >= star
                      ? 'bg-amber-400 text-amber-950 shadow-sm scale-105'
                      : 'bg-slate-100 dark:bg-dark-700 text-slate-400 hover:bg-slate-200'
                  )}
                >
                  {star}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 w-full mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setRatingModalWorker(null)} disabled={submittingRating}>
              Cancel
            </Button>
            <Button variant="primary" className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold" onClick={handleSaveRating} loading={submittingRating}>
              Submit Rating
            </Button>
          </div>
        </div>
      </Modal>

      {/* Negotiated Pay Override Modal */}
      {payModalApp && (
        <NegotiatedPayModal
          open={!!payModalApp}
          onClose={() => setPayModalApp(null)}
          applicationId={payModalApp.id}
          workerName={payModalApp.workerName}
          defaultPay={job.payPerWorker}
          currentNegotiatedPay={payModalApp.negotiatedPay}
          onSuccess={() => {
            fetchHiredWorkersForPayment();
            if (job?.id) fetchJobCandidates(job.id);
          }}
        />
      )}
    </div>
  );
}
