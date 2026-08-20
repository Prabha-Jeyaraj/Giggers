import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppHeader } from '../../../components/layout/Navigation';
import { Button, Input } from '../../../components/ui';
import { useJobStore } from '../../../store/jobStore';
import { useAuthStore } from '../../../store/authStore';
import { usePipelineStore } from '../../../store/pipelineStore';
import { useUIStore } from '../../../store/uiStore';
import { supabase } from '../../../lib/supabase';
import { CheckCircle2, Circle, Camera, MapPin, Upload, Clock, XCircle, Share2 } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { JobTask, TaskCompletion } from '../../../types';
import CameraCaptureModal from '../../../components/shared/CameraCaptureModal';



export default function WorkerPipeline() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { jobs, fetchJobs, applications, fetchAppliedJobs } = useJobStore();
  const { user } = useAuthStore();
  const { tasks, completions, isLoading, fetchCompletions, refetchCompletionsSilently, submitTick, submitForm, submitImage } = usePipelineStore();
  const { addToast } = useUIStore();

  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [formDrafts, setFormDrafts] = useState<Record<string, string>>({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingImageCompletionId, setPendingImageCompletionId] = useState<string | null>(null);

  const [directApp, setDirectApp] = useState<any>(null);
  const [directJob, setDirectJob] = useState<any>(null);

  const storeJob = jobs.find((j) => j.id === jobId);
  const storeApp = applications.find((a) => a.jobId === jobId);
  const job = storeJob || directJob;
  const application = storeApp || directApp;

  useEffect(() => {
    if (!storeJob) fetchJobs();
    if (user && !storeApp) fetchAppliedJobs(user.id);
  }, [storeJob, user, storeApp, fetchJobs, fetchAppliedJobs]);

  useEffect(() => {
    if (!jobId || !user?.id) return;
    (async () => {
      const { data: appData } = await supabase
        .from('applications')
        .select('*')
        .eq('job_id', jobId)
        .eq('worker_id', user.id)
        .maybeSingle();
      if (appData) {
        setDirectApp({
          id: appData.id,
          jobId: appData.job_id,
          workerId: appData.worker_id,
          status: appData.status,
        });
      }

      const { data: jData } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();
      if (jData) {
        setDirectJob(jData);
      }
    })();
  }, [jobId, user?.id]);

  useEffect(() => {
    if (application?.id) {
      fetchCompletions(application.id).catch((err) => {
        console.error('Failed to load completions for worker pipeline:', application.id, err);
      });
    }
  }, [application?.id, fetchCompletions]);

  // Poll so an idle worker still observes server-side auto-fail/auto-approve flips without interacting.
  useEffect(() => {
    if (!application) return;
    const interval = setInterval(() => {
      refetchCompletionsSilently(application.id).catch(() => {});
    }, 15_000);
    return () => clearInterval(interval);
  }, [application?.id, refetchCompletionsSilently]);

  // 1-second dynamic clock ticker so window open/close transitions occur immediately
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user?.role === 'employer' && jobId) {
      navigate(`/client-pipeline/${jobId}`, { replace: true });
    }
  }, [user?.role, jobId, navigate]);

  if (user?.role === 'employer') {
    return null;
  }

  if (isLoading && !job) {
    return (
      <div className="p-5 text-center mt-20 font-bold dark:text-white flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading pipeline...</span>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-5 text-center mt-20 font-bold dark:text-white">
        <p className="text-slate-500 mb-3">Job details could not be found.</p>
        <Button onClick={() => navigate('/jobs')}>Back to Gigs</Button>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="p-5 text-center mt-20 font-bold dark:text-white max-w-sm mx-auto flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center text-xl">
          ⏳
        </div>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Application Required</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          The live pipeline unlocks once you apply and are confirmed for this gig.
        </p>
        <Button onClick={() => navigate(`/jobs/${jobId}`)}>View Gig Details</Button>
      </div>
    );
  }

  const completionByTaskId = new Map(completions.map((c) => [c.jobTaskId, c]));
  const allComplete = tasks.length > 0 && tasks.every((t) => completionByTaskId.get(t.id)?.status === 'complete');

  const handleTick = async (completion: TaskCompletion) => {
    setLoadingTaskId(completion.jobTaskId);
    try {
      await submitTick(completion.id);
      addToast('Task marked complete', 'success');
    } catch {
      addToast('Failed to submit task', 'error');
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleFormSubmit = async (completion: TaskCompletion) => {
    const value = formDrafts[completion.id];
    if (!value?.trim()) {
      addToast('Please fill in the field before submitting', 'warning');
      return;
    }
    setLoadingTaskId(completion.jobTaskId);
    try {
      await submitForm(completion.id, { response: value.trim() });
      addToast('Task submitted to employer for verification', 'success');
    } catch {
      addToast('Failed to submit task', 'error');
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleOpenCamera = (completion: TaskCompletion) => {
    setPendingImageCompletionId(completion.id);
    setCameraOpen(true);
  };

  const handleCameraCapture = async (dataUrl: string) => {
    setCameraOpen(false);
    const completionId = pendingImageCompletionId;
    setPendingImageCompletionId(null);
    if (!completionId) return;
    const completion = completions.find((c) => c.id === completionId);
    if (!completion) return;
    setLoadingTaskId(completion.jobTaskId);
    try {
      await submitImage(completionId, dataUrl);
      addToast('Task submitted to employer for verification', 'success');
    } catch {
      addToast('Failed to submit photo', 'error');
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleShareLink = async () => {
    if (!application?.id) {
      addToast('Pipeline is not initialized yet', 'error');
      return;
    }
    const token = application.id;
    const url = `${window.location.origin}/pipeline/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      addToast('Your pipeline share link copied to clipboard!', 'success');
    } catch {
      addToast(`Pipeline link: ${url}`, 'info');
    }
  };

  return (
    <div className="pb-24 font-sans bg-slate-50 dark:bg-dark-900 min-h-screen">
      <AppHeader title="Active Job" showBack onBack={() => navigate(-1)} />
      <CameraCaptureModal
        open={cameraOpen}
        jobLocation={job.location || job.address}
        onCapture={handleCameraCapture}
        onClose={() => { setCameraOpen(false); setPendingImageCompletionId(null); }}
      />

      <div className="bg-slate-800 h-40 w-full relative">
        <div className="absolute inset-0 opacity-50 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=19.076,72.877&zoom=14&size=600x300&maptype=roadmap&style=feature:all|element:labels|visibility:off')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
        <div className="absolute bottom-4 left-5 right-5 text-white">
          <h2 className="text-xl font-extrabold shadow-sm">{job.title}</h2>
          <p className="text-xs font-semibold opacity-90 flex items-center gap-1 mt-1">
            <MapPin size={12} /> {job.location}
          </p>
        </div>
      </div>

      <div className="px-5 pt-6">
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-dark-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Your Pipeline Tasks</h3>
            <button
              onClick={handleShareLink}
              title="Copy shareable pipeline link"
              className="flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
            >
              <Share2 size={14} /> Share
            </button>
          </div>

          <div className="flex flex-col relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 dark:before:via-dark-600 before:to-transparent">
            {tasks.map((task: JobTask, index) => {
              const completion = completionByTaskId.get(task.id);
              const status = completion?.status || 'not_started';
              const isWorking = loadingTaskId === task.id;

              const isClockAnchored = Boolean(completion?.opensAt && completion?.deadlineAt);
              const opensAtMs = completion?.opensAt ? new Date(completion.opensAt).getTime() : null;
              const isNotYetOpen = isClockAnchored && status === 'not_started' && opensAtMs !== null && now < opensAtMs;
              const isLocked = status === 'not_started' && !isNotYetOpen;

              const deadlineMs = isClockAnchored
                ? new Date(completion!.deadlineAt!).getTime()
                : completion?.availableAt
                ? new Date(completion.availableAt).getTime() + task.responseWindowMinutes * 60_000
                : null;
              const isPastResponseWindow = status === 'in_progress' && deadlineMs !== null && now > deadlineMs;

              const timeLabel = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={task.id} className={clsx(
                  'relative flex items-start justify-between group mb-6 last:mb-0 transition-opacity',
                  isLocked ? 'opacity-50 grayscale pointer-events-none' : isPastResponseWindow || isNotYetOpen ? 'opacity-60' : 'opacity-100'
                )}>
                  <div className={clsx(
                    'flex items-center justify-center w-10 h-10 rounded-full border-4 shrink-0 z-10 transition-colors',
                    status === 'complete'
                      ? 'bg-green-500 border-green-200 dark:border-green-900/50 text-white'
                      : status === 'failed'
                      ? 'bg-red-500 border-red-200 dark:border-red-900/50 text-white'
                      : status === 'submitted' || status === 'in_progress'
                      ? 'bg-amber-400 border-amber-100 dark:border-amber-900/50 text-white'
                      : 'bg-white dark:bg-dark-800 border-slate-200 dark:border-dark-600 text-slate-400'
                  )}>
                    {status === 'complete' ? <CheckCircle2 size={20} /> : status === 'failed' ? <XCircle size={20} /> : status === 'submitted' || status === 'in_progress' ? <Clock size={20} /> : <Circle size={20} />}
                  </div>

                  <div className="w-[calc(100%-3.5rem)] p-4 rounded-xl border border-slate-100 dark:border-dark-700 bg-white dark:bg-dark-800 shadow-sm ml-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={clsx('font-bold text-sm', status === 'complete' ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white')}>
                        {task.title}
                      </span>
                      {task.completionType === 'image' && <Camera size={16} className="text-slate-400" />}
                      {task.completionType === 'form' && <Upload size={16} className="text-slate-400" />}
                    </div>
                    {task.description && <p className="text-xs text-slate-400 mb-2">{task.description}</p>}

                    {isClockAnchored && (status === 'not_started' || status === 'in_progress') && (
                      <p className="text-[10px] font-bold text-slate-400 mb-2">
                        {isNotYetOpen
                          ? `Opens at ${timeLabel(opensAtMs!)}`
                          : deadlineMs !== null && `Close by ${timeLabel(deadlineMs)}`}
                      </p>
                    )}

                    {isNotYetOpen && (
                      <div className="text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-dark-700 px-2 py-1 rounded inline-block">
                        Not open yet
                      </div>
                    )}

                    {status === 'in_progress' && completion && task.completionType === 'tick' && !isPastResponseWindow && !isNotYetOpen && (
                      <Button size="sm" className="w-full mt-2 py-1.5" onClick={() => handleTick(completion)} loading={isWorking}>
                        Mark Complete
                      </Button>
                    )}

                    {status === 'in_progress' && completion && task.completionType === 'image' && !isPastResponseWindow && !isNotYetOpen && (
                      <Button size="sm" variant="primary" className="w-full mt-2 py-1.5" onClick={() => handleOpenCamera(completion)} loading={isWorking}>
                        Open Camera
                      </Button>
                    )}

                    {status === 'in_progress' && completion && task.completionType === 'form' && !isPastResponseWindow && !isNotYetOpen && (
                      <div className="mt-2 flex flex-col gap-2">
                        <Input
                          placeholder="Your response"
                          value={formDrafts[completion.id] || ''}
                          onChange={(e) => setFormDrafts((prev) => ({ ...prev, [completion.id]: e.target.value }))}
                        />
                        <Button size="sm" variant="outline" className="w-full py-1.5" onClick={() => handleFormSubmit(completion)} loading={isWorking}>
                          Submit
                        </Button>
                      </div>
                    )}

                    {status === 'in_progress' && isPastResponseWindow && (
                      <div className="mt-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-2">
                        <XCircle size={15} className="shrink-0" />
                        <span>Submission time has expired ({deadlineMs !== null ? timeLabel(deadlineMs) : 'window closed'}). If you missed this with a valid reason, ask your employer to reopen the task.</span>
                      </div>
                    )}

                    {status === 'submitted' && (
                      <div className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded inline-block mt-2">
                        Awaiting employer verification
                      </div>
                    )}
                    {status === 'complete' && (
                      <div className="text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-dark-700 px-2 py-1 rounded inline-block mt-2">
                        Submitted & Verified
                      </div>
                    )}
                    {status === 'failed' && (
                      <div className="mt-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-2">
                        <XCircle size={15} className="shrink-0" />
                        <span>{completion?.rejectionReason || 'Missed the response window. Ask your employer to reopen this task.'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {allComplete && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">You're All Set!</h3>
            <p className="text-sm text-slate-500 mt-1">Enjoy your gig. Payment will be processed after completion.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
