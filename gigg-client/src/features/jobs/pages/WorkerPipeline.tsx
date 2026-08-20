import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppHeader } from '../../../components/layout/Navigation';
import { Button, Input } from '../../../components/ui';
import { useJobStore } from '../../../store/jobStore';
import { useAuthStore } from '../../../store/authStore';
import { usePipelineStore } from '../../../store/pipelineStore';
import { useUIStore } from '../../../store/uiStore';
import { supabase } from '../../../lib/supabase';
import { CheckCircle2, Circle, Camera, MapPin, Upload, Clock, XCircle, Share2, ChevronLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { JobTask, TaskCompletion, TaskCompletionStatus } from '../../../types';
import CameraCaptureModal from '../../../components/shared/CameraCaptureModal';
import { computeTaskClockWindow } from '../../../utils/formatters';

const STATUS_STYLES: Record<string, string> = {
  complete: 'bg-green-500 border-green-200 dark:border-green-900/50 text-white',
  failed: 'bg-red-500 border-red-200 dark:border-red-900/50 text-white',
  submitted: 'bg-amber-400 border-amber-100 dark:border-amber-900/50 text-white',
  in_progress: 'bg-amber-400 border-amber-100 dark:border-amber-900/50 text-white',
  not_started: 'bg-white dark:bg-dark-800 border-slate-200 dark:border-dark-600 text-slate-400',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  complete: <CheckCircle2 size={20} />,
  failed: <XCircle size={20} />,
  submitted: <Clock size={20} />,
  in_progress: <Clock size={20} />,
  not_started: <Circle size={20} />,
};



export default function WorkerPipeline() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { jobs, fetchJobs, applications, fetchAppliedJobs } = useJobStore();
  const { user } = useAuthStore();
  const { tasks: storeTasks, completions, isLoading, fetchCompletions, fetchJobTasks, refetchCompletionsSilently, submitTick, submitForm, submitImage } = usePipelineStore();
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

  // Fallback default tasks if database has not populated custom tasks
  const fallbackTasks: JobTask[] = [
    {
      id: `default-opening-${jobId}`,
      jobId: jobId || '',
      kind: 'opening',
      sortOrder: 0,
      title: 'Confirm Arrival',
      description: 'Upload a photo showing you have arrived at the venue.',
      completionType: 'image',
      responseWindowMinutes: 15,
      autoFailMinutes: 30,
      openMinutesBefore: 15,
      openMinutesAfter: 30,
      requiresReview: true,
    },
    {
      id: `default-closing-${jobId}`,
      jobId: jobId || '',
      kind: 'closing',
      sortOrder: 1,
      title: 'Confirm Checkout',
      description: 'Upload a photo before you leave the venue.',
      completionType: 'image',
      responseWindowMinutes: 15,
      autoFailMinutes: 30,
      openMinutesBefore: 15,
      openMinutesAfter: 30,
      requiresReview: true,
    },
  ];

  const tasks = storeTasks.length > 0 ? storeTasks : fallbackTasks;

  useEffect(() => {
    if (!storeJob) fetchJobs();
    if (user && !storeApp) fetchAppliedJobs(user.id);
    if (jobId) fetchJobTasks(jobId).catch(() => {});
  }, [storeJob, user, storeApp, jobId, fetchJobs, fetchAppliedJobs, fetchJobTasks]);

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

  const [pendingTask, setPendingTask] = useState<JobTask | null>(null);

  const completionByTaskId = new Map(completions.map((c) => [c.jobTaskId, c]));
  const allComplete = tasks.length > 0 && tasks.every((t) => completionByTaskId.get(t.id)?.status === 'complete');

  const handleTick = async (task: JobTask, completion?: TaskCompletion) => {
    let completionId = completion?.id;
    if (!completionId && application?.id) {
      try {
        const { data: created } = await supabase
          .from('application_task_completions')
          .upsert({
            application_id: application.id,
            job_task_id: task.id,
            status: 'in_progress',
            available_at: new Date().toISOString(),
          }, { onConflict: 'application_id,job_task_id' })
          .select('*')
          .single();
        if (created?.id) completionId = created.id;
      } catch {}
    }
    if (!completionId) {
      addToast('Could not find task to mark complete', 'error');
      return;
    }

    setLoadingTaskId(task.id);
    try {
      await submitTick(completionId);
      addToast('Task marked complete', 'success');
      if (application?.id) await refetchCompletionsSilently(application.id);
    } catch {
      addToast('Failed to submit task', 'error');
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleFormSubmit = async (task: JobTask, completion?: TaskCompletion) => {
    const key = completion?.id || task.id;
    const value = formDrafts[key];
    if (!value?.trim()) {
      addToast('Please fill in the field before submitting', 'warning');
      return;
    }
    let completionId = completion?.id;
    if (!completionId && application?.id) {
      try {
        const { data: created } = await supabase
          .from('application_task_completions')
          .upsert({
            application_id: application.id,
            job_task_id: task.id,
            status: 'in_progress',
            available_at: new Date().toISOString(),
          }, { onConflict: 'application_id,job_task_id' })
          .select('*')
          .single();
        if (created?.id) completionId = created.id;
      } catch {}
    }
    if (!completionId) {
      addToast('Could not find task to submit form', 'error');
      return;
    }

    setLoadingTaskId(task.id);
    try {
      await submitForm(completionId, { response: value.trim() });
      addToast('Task submitted to employer for verification', 'success');
      if (application?.id) await refetchCompletionsSilently(application.id);
    } catch {
      addToast('Failed to submit task', 'error');
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleOpenCamera = async (task: JobTask, completion?: TaskCompletion) => {
    setPendingTask(task);
    if (completion?.id) {
      setPendingImageCompletionId(completion.id);
    } else if (application?.id) {
      try {
        const { data: created } = await supabase
          .from('application_task_completions')
          .upsert({
            application_id: application.id,
            job_task_id: task.id,
            status: 'in_progress',
            available_at: new Date().toISOString(),
          }, { onConflict: 'application_id,job_task_id' })
          .select('*')
          .single();
        if (created?.id) setPendingImageCompletionId(created.id);
      } catch {}
    }
    setCameraOpen(true);
  };

  const handleCameraCapture = async (dataUrl: string) => {
    setCameraOpen(false);
    let completionId = pendingImageCompletionId;
    const task = pendingTask;
    setPendingImageCompletionId(null);
    setPendingTask(null);

    if (!completionId && task && application?.id) {
      try {
        const { data: created } = await supabase
          .from('application_task_completions')
          .upsert({
            application_id: application.id,
            job_task_id: task.id,
            status: 'in_progress',
            available_at: new Date().toISOString(),
          }, { onConflict: 'application_id,job_task_id' })
          .select('*')
          .single();
        if (created?.id) completionId = created.id;
      } catch {}
    }

    if (!completionId) {
      addToast('Could not find task to submit photo', 'error');
      return;
    }

    setLoadingTaskId(task?.id || completionId);
    try {
      await submitImage(completionId, dataUrl);
      addToast('Task submitted to employer for verification', 'success');
      if (application?.id) await refetchCompletionsSilently(application.id);
    } catch {
      addToast('Failed to submit photo', 'error');
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleShareLink = async () => {
    if (!application?.id) return;
    const url = `${window.location.origin}/pipeline/share/${application.id}`;
    try {
      await navigator.clipboard.writeText(url);
      addToast('Your pipeline share link copied to clipboard!', 'success');
    } catch {
      addToast('Failed to copy link', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-900 pb-20">
      <CameraCaptureModal
        open={cameraOpen}
        jobLocation={job.location || job.address}
        onCapture={handleCameraCapture}
        onClose={() => { setCameraOpen(false); setPendingImageCompletionId(null); setPendingTask(null); }}
      />
      
      <div className="bg-slate-900 dark:bg-dark-950 text-white px-8 pt-6 pb-16">
        <button
          type="button"
          onClick={() => navigate('/jobs')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-medium mb-3 cursor-pointer"
        >
          <ChevronLeft size={16} />
          Active Job
        </button>
        <h1 className="text-xl font-bold">{job.title}</h1>
        {job.location && (
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
            <MapPin size={12} className="text-primary-500" />
            {job.location}
          </p>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-6 -mt-8">
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-slate-100 dark:border-dark-700 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">YOUR PIPELINE TASKS</h2>
            <button
              type="button"
              onClick={handleShareLink}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              <Share2 size={13} />
              Share
            </button>
          </div>

          <div className="flex flex-col gap-4 relative">
            {tasks.map((task, idx) => {
              const completion = completionByTaskId.get(task.id);
              const status: TaskCompletionStatus = completion?.status || 'not_started';
              const isWorking = loadingTaskId === task.id || loadingTaskId === completion?.id;
              const isLast = idx === tasks.length - 1;

              const isClockAnchored = task.kind === 'opening' || task.kind === 'closing' || !!task.anchorTime;
              const clockWindow = isClockAnchored && job ? computeTaskClockWindow(task, job, completion) : null;
              const opensAtMs = clockWindow?.opensAtMs ?? (completion?.availableAt ? new Date(completion.availableAt).getTime() : null);
              const deadlineMs = clockWindow?.deadlineMs ?? (completion?.availableAt && task.responseWindowMinutes
                ? new Date(completion.availableAt).getTime() + task.responseWindowMinutes * 60 * 1000
                : null);

              const now = Date.now();
              const isNotYetOpen = opensAtMs !== null && now < opensAtMs;
              const isPastResponseWindow = deadlineMs !== null && now > deadlineMs;

              const canAct = (status === 'in_progress' || status === 'not_started') && !isNotYetOpen && !isPastResponseWindow;

              return (
                <div key={task.id} className="relative flex items-start">
                  {!isLast && (
                    <div className="absolute left-[1.125rem] top-7 bottom-0 w-0.5 bg-slate-200 dark:bg-dark-700 -mb-4 z-0" />
                  )}

                  <div className={clsx(
                    'w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 z-10',
                    STATUS_STYLES[status]
                  )}>
                    {STATUS_ICONS[status]}
                  </div>

                  <div className="w-[calc(100%-3.5rem)] p-4 rounded-xl border border-slate-100 dark:border-dark-700 bg-white dark:bg-dark-800 shadow-sm ml-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={clsx('font-bold text-sm', status === 'complete' ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white')}>
                        {task.title}
                      </span>
                    </div>
                    {task.description && <p className="text-xs text-slate-400 mb-3">{task.description}</p>}

                    {isNotYetOpen && (
                      <div className="text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-dark-700 px-2 py-1 rounded inline-block">
                        Not open yet
                      </div>
                    )}

                    {canAct && task.completionType === 'tick' && (
                      <Button size="sm" className="w-full mt-2 py-1.5" onClick={() => handleTick(task, completion)} loading={isWorking}>
                        Mark Complete
                      </Button>
                    )}

                    {canAct && task.completionType === 'image' && (
                      <Button size="sm" variant="primary" className="w-full mt-2 py-1.5" onClick={() => handleOpenCamera(task, completion)} loading={isWorking}>
                        Open Camera
                      </Button>
                    )}

                    {canAct && task.completionType === 'form' && (
                      <div className="mt-2 flex flex-col gap-2">
                        <Input
                          placeholder="Your response"
                          value={formDrafts[completion?.id || task.id] || ''}
                          onChange={(e) => setFormDrafts((prev) => ({ ...prev, [completion?.id || task.id]: e.target.value }))}
                        />
                        <Button size="sm" variant="outline" className="w-full py-1.5" onClick={() => handleFormSubmit(task, completion)} loading={isWorking}>
                          Submit
                        </Button>
                      </div>
                    )}

                    {status === 'submitted' && (
                      <div className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded inline-block mt-2">
                        Awaiting employer verification
                      </div>
                    )}
                    {status === 'complete' && (
                      <div className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded inline-block mt-2">
                        Verified
                      </div>
                    )}
                    {status === 'failed' && (
                      <div className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded inline-block mt-2">
                        {completion?.rejectionReason || 'Missed'}
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
