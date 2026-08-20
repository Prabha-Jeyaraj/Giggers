import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../../components/layout/Navigation';
import { Avatar, Button, Badge } from '../../../components/ui';
import { useAuthStore } from '../../../store/authStore';
import { supabase } from '../../../lib/supabase';
import type { ApplicationStatus } from '../../../types';
import { MessageCircle, Briefcase, Star, MapPin, User } from 'lucide-react';
import { useJobStore } from '../../../store/jobStore';

interface HiredWorker {
  id: string;
  jobId: string;
  job: { title: string };
  workerId: string;
  workerName: string;
  workerAvatar: string | null;
  workerRating: number | null;
  specificRating: number | null;
  workerProfile: Record<string, unknown>;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
  paid: boolean;
  paidAt: string | null;
  negotiatedPay?: number | null;
  defaultPay: number;
}

export default function EmployerWorkers() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { fetchChatThreadId } = useJobStore();
  const [workers, setWorkers] = useState<HiredWorker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchWorkers = async () => {
      setLoading(true);
      try {
        // Step 1: Get all job IDs posted by this employer
        const { data: jobRows } = await supabase
          .from('jobs')
          .select('id, title, pay_per_worker')
          .eq('employer_id', user.id);

        if (!jobRows || jobRows.length === 0) {
          setWorkers([]);
          setLoading(false);
          return;
        }

        const jobIds = jobRows.map(j => j.id);
        const jobTitleMap: Record<string, string> = {};
        const jobPayMap: Record<string, number> = {};
        jobRows.forEach(j => {
          jobTitleMap[j.id] = j.title;
          jobPayMap[j.id] = Number(j.pay_per_worker) || 0;
        });

        // Step 2: Get applications for those job IDs with hired/confirmed/completed status
        const { data: appsData, error: appsErr } = await supabase
          .from('applications')
          .select('id, status, applied_at, worker_id, job_id, paid, paid_at, negotiated_pay')
          .in('job_id', jobIds)
          .in('status', ['hired', 'confirmed', 'completed'])
          .order('applied_at', { ascending: false });
          
        if (appsErr) throw appsErr;

        if (!appsData || appsData.length === 0) {
          setWorkers([]);
          setLoading(false);
          return;
        }

        // Step 3: Collect unique workerIds and fetch profiles
        const workerIds = [...new Set(appsData.map(a => a.worker_id as string))];

        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, name, selfie_url, avatar, city')
          .in('id', workerIds);

        const profileMap: Record<string, Record<string, unknown>> = {};
        if (profileRows) {
          profileRows.forEach(p => { profileMap[p.id] = p as Record<string, unknown>; });
        }

        // Step 4: Fetch worker ratings from job_ratings
        const { data: ratingsData } = await supabase
          .from('job_ratings')
          .select('job_id, worker_id, rating')
          .in('worker_id', workerIds);

        const workerRatingMap: Record<string, { sum: number; count: number }> = {};
        const jobRatingMap: Record<string, number> = {}; // key: jobId_workerId

        if (ratingsData) {
          ratingsData.forEach((r: any) => {
            if (!workerRatingMap[r.worker_id]) {
              workerRatingMap[r.worker_id] = { sum: 0, count: 0 };
            }
            workerRatingMap[r.worker_id].sum += Number(r.rating) || 0;
            workerRatingMap[r.worker_id].count += 1;
            jobRatingMap[`${r.job_id}_${r.worker_id}`] = Number(r.rating);
          });
        }

        const mappedData: HiredWorker[] = appsData.map(row => {
          const prof = profileMap[row.worker_id] || {};
          const rStats = workerRatingMap[row.worker_id];
          const avgRating = rStats && rStats.count > 0 ? (rStats.sum / rStats.count).toFixed(1) : null;
          const specificRating = jobRatingMap[`${row.job_id}_${row.worker_id}`] ?? null;

          return {
            id: row.id as string,
            jobId: row.job_id as string,
            job: { title: (jobTitleMap[row.job_id] || 'Job') },
            workerId: row.worker_id as string,
            workerName: (prof.name as string) || 'Worker',
            workerAvatar: (prof.selfie_url as string) || (prof.avatar as string) || null,
            workerRating: avgRating ? Number(avgRating) : null,
            specificRating,
            workerProfile: prof,
            status: row.status as ApplicationStatus,
            appliedAt: row.applied_at as string,
            updatedAt: row.applied_at as string,
            paid: Boolean(row.paid),
            paidAt: (row.paid_at as string) ?? null,
            negotiatedPay: row.negotiated_pay != null ? Number(row.negotiated_pay) : null,
            defaultPay: jobPayMap[row.job_id] ?? 0,
          };
        });
        
        setWorkers(mappedData);
      } catch (err) {
        console.error('Failed to fetch hired workers:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWorkers();
  }, [user]);

  const [ratingTarget, setRatingTarget] = useState<any>(null);
  const [selectedRating, setSelectedRating] = useState<number>(10);
  const [submittingRating, setSubmittingRating] = useState(false);

  const handleSaveRating = async () => {
    if (!ratingTarget || !user) return;
    setSubmittingRating(true);
    try {
      await supabase.from('job_ratings').upsert({
        job_id: ratingTarget.jobId,
        worker_id: ratingTarget.workerId,
        employer_id: user.id,
        rating: selectedRating,
        created_at: new Date().toISOString()
      }, { onConflict: 'job_id,worker_id' });

      // Update local state
      setWorkers(prev => prev.map(w => w.id === ratingTarget.id ? { ...w, specificRating: selectedRating } : w));
      setRatingTarget(null);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <div className="pb-24 font-sans bg-slate-50 dark:bg-dark-900 min-h-screen">
      <AppHeader title="My Hired Workers" />
      
      <div className="px-5 pt-6 flex flex-col gap-4">
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          A list of all workers you have hired for your jobs.
        </p>

        {loading ? (
          <div className="flex justify-center p-10 text-slate-400">Loading...</div>
        ) : workers.length === 0 ? (
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 text-center shadow-sm border border-slate-100 dark:border-dark-700">
            <User size={48} className="mx-auto text-slate-200 dark:text-dark-600 mb-4" />
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">No Hires Yet</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              When you hire workers for your jobs, they will appear here.
            </p>
            <Button className="mt-6" onClick={() => navigate('/jobs?tab=postings')}>
              View My Jobs
            </Button>
          </div>
        ) : (
          workers.map(application => (
            <div key={application.id} className="bg-white dark:bg-dark-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-dark-700 flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <Avatar src={(application.workerProfile?.selfie as string) || application.workerAvatar || undefined} name={application.workerName} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-slate-900 dark:text-white truncate pr-2">{application.workerName}</h4>
                    <Badge variant={application.status === 'completed' ? 'success' : 'primary'}>
                      {application.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <span className="flex items-center text-amber-500 font-bold">
                      <Star size={12} className="mr-0.5 fill-current" />
                      {application.workerRating !== null ? `★ ${application.workerRating}` : 'No ratings yet'}
                    </span>
                    {!!application.workerProfile?.city && (
                      <span className="flex items-center truncate"><MapPin size={12} className="mr-0.5" /> {String(application.workerProfile.city)}</span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Briefcase size={12} className="text-primary-500" />
                      <span className="truncate">{application.job.title}</span>
                    </div>
                    {application.specificRating && (
                      <span className="text-[11px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                        Rated ★ {application.specificRating}/10
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Pay: ₹{application.negotiatedPay != null ? application.negotiatedPay : application.defaultPay}
                    </span>
                    {application.negotiatedPay != null && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                        Negotiated
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => navigate(`/jobs/${application.jobId}`)}
                >
                  View Job
                </Button>

                {!application.specificRating ? (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold"
                    onClick={() => {
                      setRatingTarget(application);
                      setSelectedRating(10);
                    }}
                  >
                    <Star size={14} className="mr-1.5 fill-current" /> Rate Worker
                  </Button>
                ) : (
                  <Button 
                    variant="primary" 
                    size="sm" 
                    className="flex-1"
                    onClick={async () => {
                      if (!user) return;
                      const threadId = await fetchChatThreadId(application.jobId, application.workerId);
                      if (threadId) navigate(`/chat/${threadId}`);
                    }}
                  >
                    <MessageCircle size={16} className="mr-1.5" /> Chat
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rate Worker Modal */}
      {ratingTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-800 rounded-3xl p-6 w-full max-w-sm border border-slate-100 dark:border-dark-700 shadow-2xl flex flex-col items-center gap-4 text-center">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Rate {ratingTarget.workerName}
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              How satisfied are you with performance for <strong>{ratingTarget.job.title}</strong>?
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
                    className={`w-9 h-9 rounded-xl font-black text-xs transition-all flex items-center justify-center ${
                      selectedRating >= star
                        ? 'bg-amber-400 text-amber-950 shadow-sm scale-105'
                        : 'bg-slate-100 dark:bg-dark-700 text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {star}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 w-full mt-2">
              <Button variant="outline" className="flex-1" onClick={() => setRatingTarget(null)} disabled={submittingRating}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold" onClick={handleSaveRating} loading={submittingRating}>
                Submit Rating
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
