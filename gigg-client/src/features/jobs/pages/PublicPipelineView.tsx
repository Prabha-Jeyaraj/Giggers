import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Circle, Clock, XCircle, UserSquare2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { supabase } from '../../../lib/supabase';
import type { JobTask, TaskCompletion } from '../../../types';
import { formatTime12h } from '../../../lib/time';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function StatusDot({ status }: { status: string | undefined }) {
  const s = status || 'not_started';
  if (s === 'complete') return <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />;
  if (s === 'failed') return <XCircle size={18} className="text-red-500 shrink-0" />;
  if (s === 'submitted' || s === 'in_progress') return <Clock size={18} className="text-amber-500 shrink-0" />;
  return <Circle size={18} className="text-slate-300 shrink-0" />;
}

function statusLabel(status: string | undefined) {
  const s = status || 'not_started';
  if (s === 'complete') return 'Complete';
  if (s === 'failed') return 'Missed';
  if (s === 'submitted') return 'Submitted';
  if (s === 'in_progress') return 'In Progress';
  return 'Pending';
}

interface WorkerRow {
  applicationId: string;
  workerName: string;
  workerAvatar?: string;
  tasks: JobTask[];
  completions: TaskCompletion[];
}

interface ShareData {
  pageTitle?: string;
  jobTitle: string;
  jobLocation: string;
  jobId: string;
  isSingleWorker?: boolean;
  singleWorkerName?: string;
  workers: WorkerRow[];
}

export default function PublicPipelineView() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchData = async (token: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/pipeline/public/${token}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Not found');
      }
      const json: ShareData = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load pipeline');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!shareToken) {
      setError('Invalid link');
      setIsLoading(false);
      return;
    }
    fetchData(shareToken);

    // Periodic poll every 15s to catch clock window timeouts
    const interval = setInterval(() => {
      fetchData(shareToken);
    }, 15000);
    return () => clearInterval(interval);
  }, [shareToken]);

  // Supabase Realtime: subscribe to task_completions changes for this job
  useEffect(() => {
    if (!data?.jobId || !shareToken) return;

    subRef.current = supabase
      .channel(`public-pipeline-${shareToken}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'application_task_completions',  // correct table name
        },
        () => {
          // Silently refetch on any completion change
          fetchData(shareToken);
        }
      )
      .subscribe();

    return () => {
      subRef.current?.unsubscribe();
    };
  }, [data?.jobId, shareToken]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw size={28} className="animate-spin" />
          <p className="font-bold text-sm">Loading pipeline…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="font-extrabold text-slate-800 text-lg mb-2">Link Not Found</h1>
          <p className="text-slate-500 text-sm">{error || 'This pipeline link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const workersList = data.workers || [];
  const overallComplete =
    workersList.length > 0 &&
    workersList.every(
      (w) =>
        (w.tasks || []).length > 0 &&
        (w.tasks || []).every((t) => (w.completions || []).find((c) => c.jobTaskId === t.id)?.status === 'complete')
    );

  const displayTitle = data.pageTitle || (data.isSingleWorker && data.singleWorkerName ? `${data.singleWorkerName}'s Pipeline — ${data.jobTitle}` : data.jobTitle || 'Job Pipeline');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 font-sans">
      {/* Header */}
      <div className="px-5 pt-12 pb-6 text-center">
        <span className="inline-block bg-emerald-500/20 text-emerald-400 text-xs font-extrabold px-3 py-1 rounded-full mb-3 tracking-widest uppercase">
          🔴 Live Pipeline
        </span>
        <h1 className="text-white font-extrabold text-2xl leading-tight">{displayTitle}</h1>
        {data.jobLocation && (
          <p className="text-slate-400 text-sm mt-1 font-medium">📍 {data.jobLocation}</p>
        )}
        <p className="text-slate-500 text-[11px] mt-3">
          Last updated: {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
          <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </p>
      </div>

      {/* Workers */}
      <div className="px-4 pb-16 flex flex-col gap-4 max-w-lg mx-auto">
        {overallComplete && (
          <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-2xl p-4 text-center mb-2">
            <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-emerald-300 font-extrabold text-sm">All tasks complete! 🎉</p>
          </div>
        )}

        {workersList.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-slate-400">
            <p className="font-bold text-sm">No active workers currently assigned to this pipeline.</p>
          </div>
        )}

        {workersList.map((w) => {
          const wTasks = w.tasks || [];
          const wCompletions = w.completions || [];
          const allDone = wTasks.length > 0 && wTasks.every((t) => wCompletions.find((c) => c.jobTaskId === t.id)?.status === 'complete');
          const completedCount = wTasks.filter((t) => wCompletions.find((c) => c.jobTaskId === t.id)?.status === 'complete').length;
          const progress = wTasks.length > 0 ? Math.round((completedCount / wTasks.length) * 100) : 0;

          return (
            <div
              key={w.applicationId}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 shadow-xl"
            >
              {/* Worker header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {w.workerAvatar ? (
                    <img src={w.workerAvatar} alt={w.workerName} className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20" />
                  ) : (
                    <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-slate-300">
                      <UserSquare2 size={20} />
                    </div>
                  )}
                  <div>
                    <h2 className="font-extrabold text-white text-sm">{w.workerName || 'Worker'}</h2>
                    <p className="text-slate-400 text-[11px] font-medium">
                      {completedCount}/{wTasks.length} tasks done
                    </p>
                  </div>
                </div>
                {allDone && (
                  <span className="text-xs font-extrabold bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full">
                    ✓ Done
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {wTasks.length > 0 && (
                <div className="h-1.5 bg-white/10 rounded-full mb-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {/* Task list */}
              <div className="flex flex-col gap-2.5">
                {wTasks.length === 0 && (
                  <p className="text-slate-500 text-xs text-center py-2">No tasks defined</p>
                )}
                {wTasks.map((task) => {
                  const completion = wCompletions.find((c) => c.jobTaskId === task.id);
                  const s = completion?.status || 'not_started';
                  return (
                    <div
                      key={task.id}
                      className={clsx(
                        'flex items-center gap-3 p-2.5 rounded-xl border',
                        s === 'complete'
                          ? 'bg-emerald-500/10 border-emerald-500/20'
                          : s === 'failed'
                          ? 'bg-red-500/10 border-red-500/20'
                          : s === 'submitted' || s === 'in_progress'
                          ? 'bg-amber-500/10 border-amber-500/20'
                          : 'bg-white/5 border-white/10'
                      )}
                    >
                      <StatusDot status={s} />
                      <div className="flex-1 min-w-0">
                        <p className={clsx(
                          'text-xs font-bold truncate',
                          s === 'complete' ? 'text-emerald-300' : s === 'failed' ? 'text-red-300' : 'text-slate-200'
                        )}>
                          {task.title}
                        </p>
                        {completion?.submittedAt && (
                          <p className="text-slate-500 text-[10px] mt-0.5">
                            {formatTime12h(completion.submittedAt)}
                          </p>
                        )}
                      </div>
                      <span className={clsx(
                        'text-[10px] font-extrabold shrink-0',
                        s === 'complete' ? 'text-emerald-400' : s === 'failed' ? 'text-red-400' : s === 'in_progress' || s === 'submitted' ? 'text-amber-400' : 'text-slate-500'
                      )}>
                        {statusLabel(s)}
                      </span>

                      {/* Show geo-tagged image thumbnail if submitted — links to full size */}
                      {completion?.imageUrl && (
                        <a href={completion.imageUrl} target="_blank" rel="noopener noreferrer" className="ml-2 shrink-0">
                          <img
                            src={completion.imageUrl}
                            alt="Geo-tagged proof"
                            className="w-12 h-12 rounded-lg object-cover ring-2 ring-emerald-500/40 hover:ring-emerald-400 transition-all"
                            title="Click to view full geo-tagged photo"
                          />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Footer branding */}
        <div className="text-center mt-4">
          <p className="text-slate-600 text-[11px] font-bold tracking-wider">Powered by GIGGERS</p>
        </div>
      </div>
    </div>
  );
}
