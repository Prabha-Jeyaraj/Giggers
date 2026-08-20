import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppHeader } from '../../../components/layout/Navigation';
import { Button, Badge } from '../../../components/ui';
import { useJobStore } from '../../../store/jobStore';
import { usePipelineStore } from '../../../store/pipelineStore';
import { useUIStore } from '../../../store/uiStore';
import { useAuthStore } from '../../../store/authStore';
import { supabase } from '../../../lib/supabase';
import { CheckCircle2, Circle, Clock, XCircle, UserSquare2, Users, Image as ImageIcon, RotateCcw, Share2, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import type { TaskCompletion } from '../../../types';
import { computeTaskClockWindow } from '../../../utils/formatters';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';


function StatusIcon({ status }: { status: TaskCompletion['status'] }) {
  if (status === 'complete') return <CheckCircle2 size={20} />;
  if (status === 'failed') return <XCircle size={20} />;
  if (status === 'submitted' || status === 'in_progress') return <Clock size={20} />;
  return <Circle size={20} />;
}

/** Shows a pipeline task image.
 * - Tries the cached signed URL first (valid for 2h from page load)
 * - On error or click, fetches a fresh signed URL from /image-url
 * - Opens full image in a new tab on click */
function TaskImage({ completionId, initialUrl }: { completionId: string; initialUrl: string }) {
  const [src, setSrc] = useState(initialUrl);
  const [refreshing, setRefreshing] = useState(false);
  const [errored, setErrored] = useState(false);

  const refreshUrl = async () => {
    setRefreshing(true);
    try {
      const token = (() => {
        try { return JSON.parse(sessionStorage.getItem('giggers-auth') || '{}')?.state?.token || ''; } catch { return ''; }
      })();
      const res = await fetch(`${BACKEND_URL}/api/pipeline/completions/${completionId}/image-url`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('failed');
      const { imageUrl } = await res.json();
      if (imageUrl) {
        setSrc(imageUrl);
        setErrored(false);
        // Open in new tab for full view
        window.open(imageUrl, '_blank');
      }
    } catch {
      // silently ignore
    } finally {
      setRefreshing(false);
    }
  };

  if (errored) {
    return (
      <button
        onClick={refreshUrl}
        disabled={refreshing}
        className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 underline"
      >
        <RotateCcw size={12} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Loading…' : 'Reload photo'}
      </button>
    );
  }

  return (
    <div className="mt-2 relative group cursor-pointer" onClick={refreshUrl}>
      <img
        src={src}
        alt="Geo-tagged submission"
        className="w-full h-36 object-cover rounded-lg border border-slate-100 dark:border-dark-700"
        onError={() => setErrored(true)}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
        <ExternalLink size={20} className="text-white drop-shadow" />
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<TaskCompletion['status'], string> = {
  complete: 'bg-green-500 border-green-200 dark:border-green-900/50 text-white',
  failed: 'bg-red-500 border-red-200 dark:border-red-900/50 text-white',
  submitted: 'bg-amber-400 border-amber-100 dark:border-amber-900/50 text-white',
  in_progress: 'bg-amber-400 border-amber-100 dark:border-amber-900/50 text-white',
  not_started: 'bg-white dark:bg-dark-800 border-slate-200 dark:border-dark-600 text-slate-400',
};

export default function PipelineManager() {
  const { jobId, workerId } = useParams<{ jobId: string; workerId: string }>();
  const navigate = useNavigate();
  useAuthStore();
  const { myJobs, jobCandidates, fetchJobCandidates, fetchPostedJobs } = useJobStore();
  const { user } = useAuthStore();
  const { tasks, completions, isLoading, fetchCompletions, refetchCompletionsSilently, reviewCompletion, employerCompleteTask, employerReopenTask } = usePipelineStore();
  const { addToast } = useUIStore();

  const [directApp, setDirectApp] = useState<any>(null);
  const [directJob, setDirectJob] = useState<any>(null);

  useEffect(() => {
    if (jobId) {
      fetchJobCandidates(jobId);
    }
    if (user?.id) {
      fetchPostedJobs(user.id);
    }
  }, [jobId, user?.id, fetchJobCandidates, fetchPostedJobs]);

  useEffect(() => {
    if (!jobId || !workerId) return;
    (async () => {
      const { data: appData } = await supabase
        .from('applications')
        .select('*, profiles:worker_id(name, avatar)')
        .eq('job_id', jobId)
        .eq('worker_id', workerId)
        .maybeSingle();

      if (appData) {
        setDirectApp({
          id: appData.id,
          jobId: appData.job_id,
          workerId: appData.worker_id,
          workerName: appData.profiles?.name || 'Worker',
          workerAvatar: appData.profiles?.avatar || undefined,
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
  }, [jobId, workerId]);

  const candidateApp = jobCandidates.find((c) => c.jobId === jobId && c.workerId === workerId);
  const application = candidateApp || directApp;
  const storeJob = myJobs.find((j) => j.id === jobId);
  const job = storeJob || directJob;

  useEffect(() => {
    if (application?.id) {
      fetchCompletions(application.id).catch((err) => {
        console.error('Failed to load completions for application:', application.id, err);
      });
      const interval = setInterval(() => {
        refetchCompletionsSilently(application.id).catch(() => {});
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [application?.id, fetchCompletions, refetchCompletionsSilently]);

  // 1-second clock ticker so deadlines update dynamically in real time
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading || !job || !application) {
    return <div className="p-5 text-center mt-20 font-bold dark:text-white">Loading pipeline...</div>;
  }

  const completionByTaskId = new Map(completions.map((c) => [c.jobTaskId, c]));
  const isJobComplete = completions.length > 0 && completions.every((c) => c.status === 'complete');

  const handleReview = async (completion: TaskCompletion, approve: boolean) => {
    try {
      await reviewCompletion(completion.id, approve);
      addToast(approve ? 'Task approved & completed!' : 'Task rejected', approve ? 'success' : 'info');
    } catch {
      addToast('Failed to review task', 'error');
    }
  };

  const handleForceComplete = async (completion: TaskCompletion) => {
    try {
      await employerCompleteTask(completion.id);
      addToast('Task force-completed', 'success');
    } catch {
      addToast('Failed to complete task', 'error');
    }
  };

  const handleReopen = async (completion: TaskCompletion) => {
    try {
      await employerReopenTask(completion.id);
      addToast('Task reopened for worker with fresh window', 'info');
    } catch {
      addToast('Failed to reopen task', 'error');
    }
  };

  const handleShareWorkerLink = async () => {
    const token = application.id;
    const url = `${window.location.origin}/pipeline/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      addToast(`${application.workerName}'s pipeline share link copied to clipboard!`, 'success');
    } catch {
      addToast(`Pipeline link: ${url}`, 'info');
    }
  };

  const handleShareAllWorkersLink = async () => {
    const token = job.pipelineShareToken || (job as any).pipeline_share_token || job.id;
    const url = `${window.location.origin}/pipeline/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      addToast(`All workers' pipeline share link copied to clipboard!`, 'success');
    } catch {
      addToast(`Pipeline link: ${url}`, 'info');
    }
  };

  const timeLabel = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();

  return (
    <div className="pb-24 font-sans bg-slate-50 dark:bg-dark-900 min-h-screen">
      <AppHeader title="Pipeline" showBack onBack={() => navigate(-1)} />

      <div className="px-5 pt-6">
        <div className="flex items-center gap-4 mb-6 bg-white dark:bg-dark-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-dark-700">
          {application.workerAvatar ? (
            <img src={application.workerAvatar} alt={application.workerName} className="w-16 h-16 rounded-full object-cover border-2 border-primary-500 p-0.5" />
          ) : (
            <div className="w-16 h-16 bg-slate-100 dark:bg-dark-700 rounded-full flex items-center justify-center text-slate-400 border-2 border-primary-500 p-0.5">
              <UserSquare2 size={32} />
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{application.workerName}</h2>
            <p className="text-sm font-semibold text-slate-500">ID: {application.workerId.slice(0, 6)}</p>
          </div>
          {isJobComplete && <Badge variant="success">Completed</Badge>}
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-dark-700">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Job Pipeline</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShareWorkerLink}
                title={`Copy ${application.workerName}'s single pipeline link`}
                className="flex items-center gap-1 text-[11px] font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40 px-2.5 py-1 rounded-lg hover:bg-primary-100 transition-colors"
              >
                <Share2 size={12} /> Share {application.workerName.split(' ')[0]}'s Pipeline
              </button>
              <button
                onClick={handleShareAllWorkersLink}
                title="Copy share link for all workers on this job"
                className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-dark-700 px-2.5 py-1 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Users size={12} /> Share All Workers
              </button>
            </div>
          </div>

          <div className="flex flex-col relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 dark:before:via-dark-600 before:to-transparent">
            {tasks.map((task) => {
              const completion = completionByTaskId.get(task.id);
              const status = completion?.status || 'not_started';

              const { opensAtMs, deadlineMs, isClockAnchored } = computeTaskClockWindow(
                {
                  kind: task.kind,
                  anchorTime: task.anchorTime,
                  openMinutesBefore: task.openMinutesBefore,
                  openMinutesAfter: task.openMinutesAfter,
                  responseWindowMinutes: task.responseWindowMinutes,
                },
                job,
                completion
              );

              const isNotYetOpen = isClockAnchored && status === 'not_started' && opensAtMs !== null && now < opensAtMs;
              const isWindowExpired = deadlineMs !== null && now > deadlineMs;
              const isOverdueOrFailed = isWindowExpired || status === 'failed' || Boolean(completion?.rejectionReason);

              return (
                <div key={task.id} className="relative flex items-start justify-between mb-6 last:mb-0">
                  <div
                    className={clsx(
                      'flex items-center justify-center w-10 h-10 rounded-full border-4 shrink-0 z-10 transition-colors',
                      STATUS_STYLES[status]
                    )}
                  >
                    <StatusIcon status={status} />
                  </div>

                  <div className="w-[calc(100%-3.5rem)] p-4 rounded-xl border border-slate-100 dark:border-dark-700 bg-white dark:bg-dark-800 shadow-sm ml-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary-500">
                        {task.kind === 'opening' ? 'Opening' : task.kind === 'closing' ? 'Closing' : 'Task'}
                      </span>
                      {task.completionType === 'image' && <ImageIcon size={12} className="text-slate-400" />}
                    </div>
                    <span className={clsx('font-bold text-sm block', status === 'not_started' ? 'text-slate-500' : 'text-slate-900 dark:text-white')}>
                      {task.title}
                    </span>
                    {task.description && <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>}

                    {/* Time Window Status Indicators */}
                    {isNotYetOpen && opensAtMs !== null && (
                      <p className="text-[11px] font-semibold text-slate-400 mt-1.5 flex items-center gap-1">
                        <Clock size={12} /> Opens at {timeLabel(opensAtMs)}
                      </p>
                    )}
                    {status === 'in_progress' && !isWindowExpired && deadlineMs !== null && (
                      <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1">
                        <Clock size={12} /> Active window — Worker must submit by {timeLabel(deadlineMs)}
                      </p>
                    )}
                    {isWindowExpired && status !== 'complete' && status !== 'submitted' && (
                      <p className="text-[11px] font-semibold text-red-500 mt-1.5 flex items-center gap-1">
                        <Clock size={12} /> Time Over — Submission window closed at {timeLabel(deadlineMs!)}
                      </p>
                    )}

                    {completion?.imageUrl && completion?.id && (
                      <TaskImage completionId={completion.id} initialUrl={completion.imageUrl} />
                    )}

                    {completion?.formData && (
                      <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                        {Object.entries(completion.formData).map(([k, v]) => (
                          <div key={k}><span className="font-bold">{k}:</span> {String(v)}</div>
                        ))}
                      </div>
                    )}
                    {completion?.rejectionReason && (
                      <p className="text-xs text-red-500 mt-1 font-semibold">Rejected: {completion.rejectionReason}</p>
                    )}

                    {/* Normal Flow Review: When worker submits on time */}
                    {status === 'submitted' && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-dark-700">
                        <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                          <Clock size={12} /> Worker submitted proof — Review to approve & complete task
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="danger" className="flex-1" onClick={() => handleReview(completion!, false)}>
                            Reject
                          </Button>
                          <Button size="sm" variant="primary" className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-bold text-white" onClick={() => handleReview(completion!, true)}>
                            Approve & Complete Task
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Manual Overrides: ONLY VISIBLE WHEN TIME IS OVER OR FAILED/REJECTED */}
                    {completion && status !== 'complete' && status !== 'submitted' && isOverdueOrFailed && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-dark-700">
                        <p className="text-[10px] font-bold text-red-500 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                          <Clock size={11} /> Time Expired — Manual Override
                        </p>
                        <div className="flex gap-2 items-center flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-primary-600 dark:text-primary-400 border-primary-200 dark:border-primary-900/50 hover:bg-primary-50 dark:hover:bg-primary-950/30 font-semibold"
                            onClick={() => handleReopen(completion)}
                            leftIcon={<RotateCcw size={13} />}
                          >
                            Reopen Task
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-slate-600 dark:text-slate-300 font-semibold"
                            onClick={() => handleForceComplete(completion)}
                            leftIcon={<CheckCircle2 size={13} />}
                          >
                            Force Mark Complete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-slate-400 font-medium text-center mt-4 px-4 leading-relaxed">
          <strong>Note:</strong> In normal flow, clicking <strong>Approve</strong> completes the task automatically. "Force Mark Complete" & "Reopen" appear only when a task deadline has expired or failed.
        </p>
      </div>
    </div>
  );
}
