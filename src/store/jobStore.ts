import { create } from 'zustand';
import type { Job, Application, Work, FilterState } from '../types';
import { supabase } from '../lib/supabase';

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
  fetchPostedJobs: (userId: string) => Promise<void>;
  fetchAppliedJobs: (userId: string) => Promise<void>;
  selectJob: (job: Job | null) => void;
  applyToJob: (jobId: string, workerId: string) => Promise<void>;
  saveJob: (jobId: string) => void;
  unsaveJob: (jobId: string) => void;
  setFilters: (f: Partial<FilterState>) => void;
  postJob: (data: Partial<Job>, employerId: string) => Promise<void>;
  completeJob: (jobId: string) => void;
  fetchJobCandidates: (jobId: string) => Promise<void>;
  hireWorker: (jobId: string, applicationId: string) => Promise<void>;
  fetchChatThreadId: (jobId: string, workerId: string) => Promise<string | null>;
}

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
  };
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
        bio: profilesData.bio as string | undefined,
        skills: profilesData.skills as string[] | undefined,
        languages: profilesData.languages as string[] | undefined,
        categories: profilesData.categories as string[] | undefined,
        gender: profilesData.gender as 'male' | 'female' | 'other' | undefined,
        age: profilesData.age as number | undefined,
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

  /** Fetch jobs posted by a specific employer */
  fetchPostedJobs: async (userId: string) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('employer_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const myJobs = data.map((row) => mapJob(row as unknown as Record<string, unknown>));
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
      .single();

    if (!existing) {
      await supabase.from('applications').insert({
        job_id: jobId,
        worker_id: workerId,
        status: 'applied',
      });
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
      })
      .select()
      .single();

    if (!error && newRow) {
      const newJob = mapJob(newRow as unknown as Record<string, unknown>);
      set(s => ({ myJobs: [newJob, ...s.myJobs], isLoading: false }));
    } else {
      set({ isLoading: false });
    }
  },

  fetchChatThreadId: async (jobId: string, workerId: string) => {
    const { data } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_id', workerId)
      .single();
    return data?.id ?? null;
  },

  completeJob: (jobId) => set(s => ({
    myJobs: s.myJobs.map(j => j.id === jobId ? { ...j, status: 'completed' as const } : j),
    jobs: s.jobs.map(j => j.id === jobId ? { ...j, status: 'completed' as const } : j),
  })),

  /** Fetch applicants for a specific job (employer view) */
  fetchJobCandidates: async (jobId: string) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        profiles!applications_worker_id_fkey(
          id, name, avatar, rating, review_count, city, area, bio,
          skills, languages, categories, age, gender, is_verified,
          is_approved, aadhaar_verified, selfie_verified, completed_jobs,
          total_earnings, attendance_rate, phone, email, created_at
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
        c.id === applicationId ? { ...c, status: 'accepted' as const } : c
      ),
    }));

    await supabase
      .from('applications')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', applicationId);

    await supabase.rpc('increment_workers_hired', { job_id: jobId });

    // Create chat thread between employer and worker
    const job = myJobs.find((j) => j.id === jobId);
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

      // Notify the worker they were hired
      await supabase.from('notifications').insert({
        user_id: candidate.workerId,
        type: 'application_accepted',
        title: 'You got hired! 🎉',
        message: `You have been selected for "${job.title}". Check your messages to connect with the employer.`,
        action_id: jobId,
        is_read: false,
      });
    }
  },
}));
