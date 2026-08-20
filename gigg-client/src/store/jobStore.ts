import { create } from 'zustand';
import type { Job, Application, Work, FilterState } from '../types';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

interface JobState {
  jobs: Job[];
  featuredJobs: Job[];
  myJobs: Job[];
  applications: Application[];
  jobCandidates: Application[];
  works: Work[];
  selectedJob: Job | null;
  isLoading: boolean;
  filters: FilterState;
  savedJobIds: string[];
  fetchJobs: () => Promise<void>;
  fetchJobById: (jobId: string) => Promise<Job | null>;
  fetchPostedJobs: (userId: string) => Promise<void>;
  fetchAppliedJobs: (userId: string) => Promise<void>;
  selectJob: (job: Job | null) => void;
  applyToJob: (jobId: string, workerId: string) => Promise<void>;
  saveJob: (jobId: string) => void;
  unsaveJob: (jobId: string) => void;
  setFilters: (f: Partial<FilterState>) => void;
  postJob: (data: Partial<Job>, employerId: string) => Promise<string>;
  updateJob: (jobId: string, updates: Partial<Job>, employerId: string) => Promise<{ creditPenaltyApplied: boolean }>;
  completeJob: (jobId: string) => Promise<void>;
  fetchJobCandidates: (jobId: string) => Promise<void>;
  hireWorker: (jobId: string, applicationId: string) => Promise<void>;
  rejectWorker: (applicationId: string) => Promise<void>;
  confirmHire: (applicationId: string) => Promise<void>;
  declineHire: (applicationId: string) => Promise<void>;
  fetchChatThreadId: (jobId: string, workerId: string) => Promise<string | null>;
  updatePipelineStep: (applicationId: string, stepId: string) => Promise<void>;
  updateNegotiatedPay: (applicationId: string, pay: number | null) => Promise<void>;
}

/** Flat credit-point deduction for editing a job within the last hour before it starts.
 * Placeholder default — the wireframe spec names the mechanism but not a magnitude. */
const LATE_EDIT_CREDIT_PENALTY = 5;

const defaultFilters: FilterState = {
  category: '', location: '', date: 'any', sort: 'nearby',
  verifiedOnly: false, fullDay: false, halfDay: false, viewMode: 'list',
};

/** Map snake_case DB row → camelCase Job type */
function mapJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    title: (row.title as string) || '',
    category: (row.category as string) || '',
    categoryEmoji: (row.category_emoji as string) || '💼',
    description: (row.description as string) || '',
    date: (row.date as string) || '',
    reportingTime: (row.reporting_time as string) || '',
    endTime: (row.end_time as string) || '',
    location: (row.location as string) || '',
    address: (row.address as string) || '',
    lat: Number(row.lat) || 19.076,
    lng: Number(row.lng) || 72.877,
    workersNeeded: Number(row.workers_needed) || 1,
    workersHired: Number(row.workers_hired) || 0,
    payPerWorker: Number(row.pay_per_worker) || 0,
    foodProvided: Boolean(row.food_provided),
    transportProvided: Boolean(row.transport_provided),
    dressCode: (row.dress_code as string) || 'Casual',
    languagesRequired: (row.languages_required as string[]) || [],
    genderPreference: (row.gender_preference as 'any' | 'male' | 'female') || 'any',
    status: (row.status as 'draft' | 'active' | 'completed' | 'cancelled') || 'active',
    employerId: (row.employer_id as string) || '',
    employerName: (row.profiles as Record<string, unknown>)?.name as string || 'Employer',
    employerLogo: (row.profiles as Record<string, unknown>)?.avatar as string | undefined,
    employerRating: 4.5,
    isVerifiedEmployer: Boolean((row.profiles as Record<string, unknown>)?.is_verified_employer),
    isFeatured: Boolean(row.is_featured),
    isUrgent: Boolean(row.is_urgent),
    createdAt: (row.created_at as string) || new Date().toISOString(),
    applicantsCount: Number(row.applicants_count) || 0,
    needLocationBasedWorkers: Boolean(row.need_location_based_workers),
    natureOfWork: (row.nature_of_work as string) || '',
    clientName: (row.client_name as string) || '',
    clientId: (row.client_id as string) || '',
    modeOfPayment: (row.mode_of_payment as 'Online' | 'Cash' | 'Wallet') || 'Wallet',
    paymentDate: (row.payment_date as string) || '',
    dosAndDonts: (row.dos_and_donts as string) || '',
    isGroupClosed: Boolean(row.is_group_closed),
    groupClosedAt: row.group_closed_at as string | undefined,
    pipelineShareToken: (row.pipeline_share_token as string) || (row.pipelineShareToken as string) || (row.id as string),
  };
}

/** Map camelCase Job partial → snake_case DB row for insert/update. Only includes
 * fields present in `data`, except for the always-required insert defaults handled
 * separately by callers. */
function toDbJobRow(data: Partial<Job>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (data.title !== undefined) row.title = data.title;
  if (data.category !== undefined) row.category = data.category;
  if (data.categoryEmoji !== undefined) row.category_emoji = data.categoryEmoji;
  if (data.description !== undefined) row.description = data.description;
  if (data.date !== undefined) row.date = data.date;
  if (data.reportingTime !== undefined) row.reporting_time = data.reportingTime;
  if (data.endTime !== undefined) row.end_time = data.endTime;
  if (data.location !== undefined) row.location = data.location;
  if (data.address !== undefined) row.address = data.address;
  if (data.lat !== undefined) row.lat = data.lat;
  if (data.lng !== undefined) row.lng = data.lng;
  if (data.workersNeeded !== undefined) row.workers_needed = data.workersNeeded;
  if (data.payPerWorker !== undefined) row.pay_per_worker = data.payPerWorker;
  if (data.foodProvided !== undefined) row.food_provided = data.foodProvided;
  if (data.transportProvided !== undefined) row.transport_provided = data.transportProvided;
  if (data.dressCode !== undefined) row.dress_code = data.dressCode;
  if (data.languagesRequired !== undefined) row.languages_required = data.languagesRequired;
  if (data.genderPreference !== undefined) row.gender_preference = data.genderPreference;
  if (data.isUrgent !== undefined) row.is_urgent = data.isUrgent;
  if (data.needLocationBasedWorkers !== undefined) row.need_location_based_workers = data.needLocationBasedWorkers;
  if (data.natureOfWork !== undefined) row.nature_of_work = data.natureOfWork;
  if (data.clientName !== undefined) row.client_name = data.clientName;
  if (data.clientId !== undefined) row.client_id = data.clientId;
  if (data.modeOfPayment !== undefined) row.mode_of_payment = data.modeOfPayment;
  if (data.paymentDate !== undefined) row.payment_date = data.paymentDate;
  if (data.dosAndDonts !== undefined) row.dos_and_donts = data.dosAndDonts;
  return row;
}

/** Map snake_case DB row → Application type */
function mapApplication(row: Record<string, unknown>): Application {
  const profilesData = row.profiles as Record<string, unknown> | undefined;
  const jobData = row.jobs as Record<string, unknown> | undefined;

  const workerProfile = profilesData
    ? {
      id: profilesData.id as string || '',
      name: (profilesData.name as string) || '',
      email: (profilesData.email as string) || '',
      phone: (profilesData.phone as string) || '',
      role: 'worker' as const,
      avatar: profilesData.avatar as string | undefined,
      isVerified: Boolean(profilesData.is_verified),
      isApproved: Boolean(profilesData.is_approved),
      aadhaarVerified: Boolean(profilesData.aadhaar_verified),
      selfieVerified: Boolean(profilesData.selfie_verified),
      city: (profilesData.city as string) || '',
      area: (profilesData.area as string) || '',
      createdAt: (profilesData.created_at as string) || new Date().toISOString(),
      completedJobs: Number(profilesData.completed_jobs) || 0,
      totalJobsPosted: 0,
      rating: Number(profilesData.rating) || 0,
      reviewCount: Number(profilesData.review_count) || 0,
      totalEarnings: Number(profilesData.total_earnings) || 0,
      attendanceRate: Number(profilesData.attendance_rate) || 100,
      creditPoint: Number(profilesData.credit_point) || 0,
      bio: profilesData.bio as string | undefined,
      skills: profilesData.skills as string[] | undefined,
      languages: profilesData.languages as string[] | undefined,
      categories: profilesData.categories as string[] | undefined,
      gender: profilesData.gender as 'male' | 'female' | 'other' | undefined,
      age: profilesData.age as number | undefined,
      kycStatus: ((profilesData.kyc_status as string) || 'not_started') as 'not_started' | 'submitted' | 'approved' | 'rejected',
      isOnboarded: Boolean(profilesData.is_onboarded),
    }
    : undefined;

  return {
    id: row.id as string,
    jobId: (row.job_id as string) || '',
    job: jobData ? mapJob(jobData) : {} as Job,
    workerId: (row.worker_id as string) || '',
    workerName: (profilesData?.name as string) || 'Worker',
    workerAvatar: profilesData?.avatar as string | undefined,
    workerRating: Number(profilesData?.rating) || 0,
    workerProfile,
    status: (row.status as Application['status']) || 'applied',
    reportingCompleted: Boolean(row.reporting_completed),
    selfieCompleted: Boolean(row.selfie_completed),
    tshirtCompleted: Boolean(row.tshirt_completed),
    shoesCompleted: Boolean(row.shoes_completed),
    negotiatedPay: row.negotiated_pay != null ? Number(row.negotiated_pay) : null,
    paid: Boolean(row.paid),
    paidAt: row.paid_at as string | undefined,
    appliedAt: (row.applied_at as string) || new Date().toISOString(),
    updatedAt: (row.updated_at as string) || new Date().toISOString(),
  };
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  featuredJobs: [],
  myJobs: [],
  applications: [],
  jobCandidates: [],
  works: [],
  selectedJob: null,
  isLoading: false,
  filters: defaultFilters,
  savedJobIds: [],

  /** Fetch all active jobs for worker feed */
  fetchJobs: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('jobs')
      .select('*, profiles!jobs_employer_id_fkey(name, avatar, is_verified_employer)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      const jobs = data.map((row) => mapJob(row as unknown as Record<string, unknown>));
      set({ jobs, featuredJobs: jobs.filter(j => j.isFeatured) });
    }
    set({ isLoading: false });
  },

  /** Fetch a single job by its ID */
  fetchJobById: async (jobId: string) => {
    const { jobs, myJobs } = get();
    const existing = jobs.find(j => j.id === jobId && j.payPerWorker > 0) || myJobs.find(j => j.id === jobId && j.payPerWorker > 0);
    if (existing) return existing;

    const { data, error } = await supabase
      .from('jobs')
      .select('*, profiles!jobs_employer_id_fkey(name, avatar, is_verified_employer)')
      .eq('id', jobId)
      .maybeSingle();

    if (!error && data) {
      const job = mapJob(data as unknown as Record<string, unknown>);
      set((s) => ({
        jobs: s.jobs.some((j) => j.id === job.id) ? s.jobs.map((j) => (j.id === job.id ? job : j)) : [...s.jobs, job],
      }));
      return job;
    }
    return null;
  },

  /** Fetch jobs posted by a specific employer */
  fetchPostedJobs: async (userId: string) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        profiles!jobs_employer_id_fkey(id, name, avatar, is_verified_employer),
        applications(count)
      `)
      .eq('employer_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const myJobs = data.map((row) => {
        const base = mapJob(row as unknown as Record<string, unknown>);
        // Override applicantsCount with the real count from the join
        const countArr = (row as any).applications;
        if (Array.isArray(countArr) && countArr.length > 0 && countArr[0].count !== undefined) {
          base.applicantsCount = Number(countArr[0].count) || 0;
        }
        return base;
      });
      set({ myJobs });
    }
    set({ isLoading: false });
  },


  /** Fetch applications made by a worker */
  fetchAppliedJobs: async (userId: string) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('applications')
      .select('*, jobs(*)')
      .eq('worker_id', userId)
      .order('applied_at', { ascending: false });

    if (!error && data) {
      const applications = data.map((row) => mapApplication(row as unknown as Record<string, unknown>));
      set({ applications });
    }
    set({ isLoading: false });
  },

  selectJob: (job) => set({ selectedJob: job }),

  /** Worker applies for a job */
  applyToJob: async (jobId: string, workerId: string) => {
    set({ isLoading: true });
    // Prevent duplicate applications
    const { data: existing } = await supabase
      .from('applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_id', workerId)
      .maybeSingle();

    if (!existing) {
      const { data: insertedApp, error: appError } = await supabase
        .from('applications')
        .insert({
          job_id: jobId,
          worker_id: workerId,
          status: 'applied',
        })
        .select('*, jobs(*)')
        .single();

      if (!appError && insertedApp) {
        const mappedApp = mapApplication(insertedApp as unknown as Record<string, unknown>);
        set((s) => ({
          applications: [mappedApp, ...s.applications.filter((a) => a.id !== mappedApp.id)],
          jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, applicantsCount: (j.applicantsCount || 0) + 1 } : j)),
        }));
      }

      await supabase.rpc('increment_applicants', { job_id: jobId });

      // Notify employer of new applicant
      const job = get().jobs.find((j) => j.id === jobId);
      if (job) {
        await supabase.from('notifications').insert({
          user_id: job.employerId,
          type: 'new_applicant',
          title: 'New applicant!',
          message: `Someone applied for "${job.title}". Review their profile now.`,
          action_id: jobId,
          is_read: false,
        });
      }
    }
    set({ isLoading: false });
  },

  saveJob: (jobId) => {
    const { savedJobIds } = get();
    if (!savedJobIds.includes(jobId)) set({ savedJobIds: [...savedJobIds, jobId] });
  },
  unsaveJob: (jobId) => set(s => ({ savedJobIds: s.savedJobIds.filter(id => id !== jobId) })),
  setFilters: (f) => set(s => ({ filters: { ...s.filters, ...f } })),

  /** Employer posts a new job */
  postJob: async (data: Partial<Job>, employerId: string) => {
    set({ isLoading: true });
    const { data: newRow, error } = await supabase
      .from('jobs')
      .insert({
        ...toDbJobRow(data),
        title: data.title || '',
        category: data.category || '',
        category_emoji: data.categoryEmoji || '💼',
        description: data.description || '',
        date: data.date || new Date().toISOString().split('T')[0],
        reporting_time: data.reportingTime || '09:00',
        end_time: data.endTime || '18:00',
        location: data.location || '',
        address: data.address || '',
        lat: data.lat || 19.076,
        lng: data.lng || 72.877,
        workers_needed: data.workersNeeded || 1,
        workers_hired: 0,
        pay_per_worker: data.payPerWorker || 0,
        food_provided: data.foodProvided || false,
        transport_provided: data.transportProvided || false,
        dress_code: data.dressCode || 'Casual',
        languages_required: data.languagesRequired || [],
        gender_preference: data.genderPreference || 'any',
        status: 'active',
        employer_id: employerId,
        is_featured: false,
        is_urgent: data.isUrgent || false,
        applicants_count: 0,
        need_location_based_workers: data.needLocationBasedWorkers || false,
        nature_of_work: data.natureOfWork || '',
        client_name: data.clientName || '',
        client_id: data.clientId || '',
        mode_of_payment: data.modeOfPayment || 'Online',
        payment_date: data.paymentDate || '',
        dos_and_donts: data.dosAndDonts || '',
      })
      .select()
      .single();

    set({ isLoading: false });
    if (error || !newRow) {
      throw new Error(error?.message || 'Failed to post job');
    }
    const newJob = mapJob(newRow as unknown as Record<string, unknown>);
    set(s => ({
      myJobs: [newJob, ...s.myJobs.filter(j => j.id !== newJob.id)],
      jobs: [newJob, ...s.jobs.filter(j => j.id !== newJob.id)],
    }));
    return newJob.id;
  },

  /** Employer edits an existing job. If the job starts within 60 minutes,
   * a flat credit-point penalty is applied to discourage last-minute changes. */
  updateJob: async (jobId: string, updates: Partial<Job>, employerId: string) => {
    const { myJobs } = get();
    const existing = myJobs.find(j => j.id === jobId);

    let creditPenaltyApplied = false;
    if (existing) {
      const reportingDateTime = new Date(`${existing.date}T${existing.reportingTime || '00:00'}`);
      const msUntilStart = reportingDateTime.getTime() - Date.now();
      if (msUntilStart > 0 && msUntilStart <= 60 * 60 * 1000) {
        creditPenaltyApplied = true;
      }
    }

    const { data: updatedRow, error } = await supabase
      .from('jobs')
      .update(toDbJobRow(updates))
      .eq('id', jobId)
      .eq('employer_id', employerId)
      .select()
      .single();

    if (error || !updatedRow) {
      throw new Error(error?.message || 'Failed to update job');
    }

    if (creditPenaltyApplied) {
      await supabase.rpc('decrement_credit_point', { p_user_id: employerId, p_amount: LATE_EDIT_CREDIT_PENALTY });
    }

    const updatedJob = mapJob(updatedRow as unknown as Record<string, unknown>);
    set(s => ({ myJobs: s.myJobs.map(j => (j.id === jobId ? updatedJob : j)) }));

    return { creditPenaltyApplied };
  },

  fetchChatThreadId: async (jobId: string, workerId: string, employerId?: string) => {
    try {
      const res = await api.post<{ threadId: string }>('/api/chat/threads', {
        jobId,
        workerId,
        employerId,
      });
      if (res?.threadId) return res.threadId;
    } catch (backendErr) {
      console.warn('[jobStore] Backend fetchChatThreadId fallback to Supabase:', backendErr);
    }

    const { data: existing } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_id', workerId)
      .maybeSingle();

    if (existing?.id) return existing.id;

    let empId = employerId;
    if (!empId) {
      const { data: j } = await supabase.from('jobs').select('employer_id').eq('id', jobId).single();
      empId = j?.employer_id;
    }

    if (!empId) return null;

    const { data: newThread } = await supabase
      .from('chat_threads')
      .upsert(
        { job_id: jobId, worker_id: workerId, employer_id: empId, last_message_at: new Date().toISOString() },
        { onConflict: 'job_id,worker_id' }
      )
      .select('id')
      .single();

    return newThread?.id ?? null;
  },

  completeJob: async (jobId: string) => {
    const { error } = await supabase
      .from('jobs')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    if (error) {
      console.error('Error marking job as completed:', error);
      throw error;
    }

    set((s) => ({
      myJobs: s.myJobs.map((j) => (j.id === jobId ? { ...j, status: 'completed' as const } : j)),
      jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, status: 'completed' as const } : j)),
    }));
  },

  /** Fetch applicants for a specific job (employer view) */
  fetchJobCandidates: async (jobId: string) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        jobs(*),
        profiles!applications_worker_id_fkey(
          id, name, avatar, rating, review_count, city, area, bio,
          skills, languages, categories, age, gender, is_verified,
          is_approved, aadhaar_verified, selfie_verified, completed_jobs,
          total_earnings, attendance_rate, phone, email, created_at, kyc_status
        )
      `)
      .eq('job_id', jobId)
      .order('applied_at', { ascending: false });

    if (!error && data) {
      const jobCandidates = data.map((row) => mapApplication(row as unknown as Record<string, unknown>));
      set({ jobCandidates });
    }
    set({ isLoading: false });
  },

  /** Employer accepts a worker's application */
  hireWorker: async (jobId, applicationId) => {
    const { jobCandidates, myJobs } = get();
    const candidate = jobCandidates.find((c) => c.id === applicationId);

    // Optimistic update
    set((s) => ({
      myJobs: s.myJobs.map((j) =>
        j.id === jobId && j.workersHired < j.workersNeeded
          ? { ...j, workersHired: j.workersHired + 1 }
          : j
      ),
      jobCandidates: s.jobCandidates.map((c) =>
        c.id === applicationId ? { ...c, status: 'hired' as const } : c
      ),
    }));

    await supabase
      .from('applications')
      .update({ status: 'hired', updated_at: new Date().toISOString() })
      .eq('id', applicationId);

    await supabase.rpc('increment_workers_hired', { job_id: jobId });

    // Re-fetch the updated job to sync workersHired count in myJobs
    const { data: refreshedJob } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    if (refreshedJob) {
      const updatedJob = mapJob(refreshedJob as unknown as Record<string, unknown>);
      set((s) => ({
        myJobs: s.myJobs.map((j) => j.id === jobId ? updatedJob : j),
        jobs: s.jobs.map((j) => j.id === jobId ? updatedJob : j),
      }));
    }

    // Create chat thread between employer and worker
    const job = get().myJobs.find((j) => j.id === jobId);
    if (candidate && job) {
      await supabase.from('chat_threads').upsert(
        {
          job_id: jobId,
          employer_id: job.employerId,
          worker_id: candidate.workerId,
          last_message: null,
          last_message_at: new Date().toISOString(),
        },
        { onConflict: 'job_id,worker_id', ignoreDuplicates: true }
      );

      // Notify the worker they've been offered the job — they still need to confirm
      await supabase.from('notifications').insert({
        user_id: candidate.workerId,
        type: 'application_accepted',
        title: 'You got hired! 🎉',
        message: `"${job.title}" wants to hire you! Please confirm to accept.`,
        action_id: jobId,
        is_read: false,
      });
    }
  },

  /** Employer rejects a pending applicant */
  rejectWorker: async (applicationId) => {
    const { jobCandidates } = get();
    const candidate = jobCandidates.find((c) => c.id === applicationId);

    set((s) => ({
      jobCandidates: s.jobCandidates.map((c) =>
        c.id === applicationId ? { ...c, status: 'rejected' as const } : c
      ),
    }));

    await supabase
      .from('applications')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (candidate) {
      await supabase.from('notifications').insert({
        user_id: candidate.workerId,
        type: 'application_rejected',
        title: 'Application not selected',
        message: `Your application for "${candidate.job?.title || 'a job'}" was not selected this time.`,
        action_id: candidate.jobId,
        is_read: false,
      });
    }
  },

  /** Worker confirms a hire offer, becoming fully active on the job */
  confirmHire: async (applicationId) => {
    const { applications } = get();
    const application = applications.find((a) => a.id === applicationId);

    set((s) => ({
      applications: s.applications.map((a) =>
        a.id === applicationId ? { ...a, status: 'confirmed' as const } : a
      ),
    }));

    await supabase
      .from('applications')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (application?.job?.employerId) {
      await supabase.from('notifications').insert({
        user_id: application.job.employerId,
        type: 'hire_confirmed',
        title: 'Worker confirmed! ✅',
        message: `${application.workerName} confirmed for "${application.job.title}".`,
        action_id: application.jobId,
        is_read: false,
      });
    }
  },

  /** Worker declines a hire offer */
  declineHire: async (applicationId) => {
    const { applications } = get();
    const application = applications.find((a) => a.id === applicationId);

    set((s) => ({
      applications: s.applications.map((a) =>
        a.id === applicationId ? { ...a, status: 'rejected' as const } : a
      ),
    }));

    await supabase
      .from('applications')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (application?.job?.employerId) {
      await supabase.from('notifications').insert({
        user_id: application.job.employerId,
        type: 'hire_declined',
        title: 'Offer declined',
        message: `${application.workerName} declined the offer for "${application.job.title}".`,
        action_id: application.jobId,
        is_read: false,
      });
    }
  },

  /** Update pipeline tracking step for an application */
  updatePipelineStep: async (applicationId, stepId) => {
    // Map stepId to database column
    const stepColumnMap: Record<string, string> = {
      reporting: 'reporting_completed',
      selfie: 'selfie_completed',
      tshirt: 'tshirt_completed',
      shoes: 'shoes_completed'
    };

    const column = stepColumnMap[stepId];
    if (!column) return;

    // Optimistic update
    set((s) => ({
      applications: s.applications.map((app) =>
        app.id === applicationId
          ? {
            ...app,
            reportingCompleted: stepId === 'reporting' ? true : app.reportingCompleted,
            selfieCompleted: stepId === 'selfie' ? true : app.selfieCompleted,
            tshirtCompleted: stepId === 'tshirt' ? true : app.tshirtCompleted,
            shoesCompleted: stepId === 'shoes' ? true : app.shoesCompleted,
          }
          : app
      ),
      jobCandidates: s.jobCandidates.map((app) =>
        app.id === applicationId
          ? {
            ...app,
            reportingCompleted: stepId === 'reporting' ? true : app.reportingCompleted,
            selfieCompleted: stepId === 'selfie' ? true : app.selfieCompleted,
            tshirtCompleted: stepId === 'tshirt' ? true : app.tshirtCompleted,
            shoesCompleted: stepId === 'shoes' ? true : app.shoesCompleted,
          }
          : app
      ),
    }));

    await supabase
      .from('applications')
      .update({ [column]: true, updated_at: new Date().toISOString() })
      .eq('id', applicationId);
  },

  /** Update negotiated pay override for a worker's application */
  updateNegotiatedPay: async (applicationId, pay) => {
    const cleanPay = pay !== null && !isNaN(Number(pay)) && Number(pay) > 0 ? Number(pay) : null;

    // Optimistic update
    set((s) => ({
      applications: s.applications.map((app) =>
        app.id === applicationId ? { ...app, negotiatedPay: cleanPay } : app
      ),
      jobCandidates: s.jobCandidates.map((app) =>
        app.id === applicationId ? { ...app, negotiatedPay: cleanPay } : app
      ),
    }));

    const { error } = await supabase
      .from('applications')
      .update({ negotiated_pay: cleanPay, updated_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (error) {
      console.error('Failed to update negotiated pay:', error);
      throw error;
    }

    // Notify the worker if pay was updated
    const { jobCandidates, applications } = get();
    const candidate = jobCandidates.find((c) => c.id === applicationId) || applications.find((c) => c.id === applicationId);
    if (candidate && candidate.workerId) {
      const payMsg = cleanPay !== null ? `₹${cleanPay}` : `standard job rate`;
      try {
        await supabase.from('notifications').insert({
          user_id: candidate.workerId,
          type: 'application_accepted',
          title: 'Pay Rate Updated 💰',
          message: `Agreed pay rate updated to ${payMsg} for "${candidate.job?.title || 'your gig'}".`,
          action_id: candidate.jobId,
          is_read: false,
        });
      } catch (notifErr) {
        console.error('Failed to insert notification:', notifErr);
      }
    }
  },
}));
