import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical, Send, Image as ImageIcon, Video, CheckCircle2, Circle, Clock, XCircle, Play, Trash2, Check, CheckCheck, Coins } from 'lucide-react';
import { AppHeader } from '../../../components/layout/Navigation';
import { Avatar, Button, Modal } from '../../../components/ui';
import { useChatStore } from '../../../store/chatStore';
import { useAuthStore } from '../../../store/authStore';
import { useJobStore } from '../../../store/jobStore';
import { usePipelineStore } from '../../../store/pipelineStore';
import { RecordingRecorder } from '../components/RecordingRecorder';
import { NegotiatedPayModal } from '../../jobs/components/NegotiatedPayModal';
import { supabase } from '../../../lib/supabase';
import { useUIStore } from '../../../store/uiStore';
import type { Application, Job } from '../../../types';
import { formatTime12h } from '../../../lib/time';
import { clsx } from 'clsx';

function TaskStatusIcon({ status }: { status: string }) {
  if (status === 'complete') return <CheckCircle2 size={16} className="text-green-500" />;
  if (status === 'failed') return <XCircle size={16} className="text-red-500" />;
  if (status === 'submitted' || status === 'in_progress') return <Clock size={16} className="text-amber-500" />;
  return <Circle size={16} className="text-slate-300 dark:text-dark-500" />;
}

export default function ChatThread() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { threads, activeThread, messages, openThread, loadThreadById, sendMessage, subscribeToThread, refetchMessagesSilently, markThreadRead, fetchThreads, isLoading } = useChatStore();
  const { jobCandidates, fetchJobCandidates, fetchJobById, myJobs, jobs, applications } = useJobStore();
  const { tasks, completions, fetchCompletions } = usePipelineStore();
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'message' | 'pipeline'>('message');
  const [recordingTaskId, setRecordingTaskId] = useState<string | 'general' | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [threadApplication, setThreadApplication] = useState<Application | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { addToast } = useUIStore();

  const thread = (activeThread && activeThread.id === id) ? activeThread : threads.find((t) => t.id === id);

  useEffect(() => {
    if (!id || !user) return;
    if (activeThread?.id === id) return;

    const existing = threads.find((t) => t.id === id);
    if (existing) {
      openThread(existing);
      markThreadRead(existing.id);
    } else {
      loadThreadById(id, user.id);
    }
  }, [id, user?.id, activeThread?.id, threads]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeToThread(id);
    const interval = setInterval(() => {
      refetchMessagesSilently(id);
    }, 2500);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [id, subscribeToThread, refetchMessagesSilently]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (thread?.jobId) {
      fetchJobCandidates(thread.jobId);
      fetchJobById(thread.jobId);
    }
  }, [thread?.jobId, fetchJobCandidates, fetchJobById]);

  // Fetch application details directly if needed for 1-on-1 thread
  useEffect(() => {
    if (!thread?.jobId || !thread?.workerId || thread.isGroup) return;
    supabase
      .from('applications')
      .select('id, job_id, worker_id, status, negotiated_pay, paid, paid_at, applied_at, updated_at, jobs(*), profiles!applications_worker_id_fkey(name, avatar, rating)')
      .eq('job_id', thread.jobId)
      .eq('worker_id', thread.workerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const profilesData = (Array.isArray(data.profiles) ? data.profiles[0] : data.profiles) as Record<string, any> | undefined;
          const jobData = (Array.isArray(data.jobs) ? data.jobs[0] : data.jobs) as Record<string, any> | undefined;
          const mapped: Application = {
            id: data.id,
            jobId: data.job_id,
            job: jobData ? {
              id: jobData.id,
              title: jobData.title || '',
              payPerWorker: Number(jobData.pay_per_worker) || 0,
            } as any : {} as Job,
            workerId: data.worker_id,
            workerName: (profilesData?.name as string) || 'Worker',
            workerAvatar: profilesData?.avatar as string | undefined,
            workerRating: Number(profilesData?.rating) || 0,
            status: data.status || 'applied',
            negotiatedPay: data.negotiated_pay != null ? Number(data.negotiated_pay) : null,
            paid: Boolean(data.paid),
            paidAt: data.paid_at,
            appliedAt: data.applied_at || new Date().toISOString(),
            updatedAt: data.updated_at || new Date().toISOString(),
          };
          setThreadApplication(mapped);
        }
      });
  }, [thread?.jobId, thread?.workerId, thread?.isGroup]);

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDeleteChatForMe = () => {
    if (!thread || !user?.id) return;
    try {
      const key = `deleted_private_chats_${user.id}`;
      const deletedIds: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      if (!deletedIds.includes(thread.id)) {
        deletedIds.push(thread.id);
        localStorage.setItem(key, JSON.stringify(deletedIds));
      }
      addToast('Chat deleted from your list', 'info');
      navigate('/chat');
    } catch (err) {
      console.error(err);
      addToast('Failed to delete chat', 'error');
    }
  };

  const storeCandidate = thread ? jobCandidates.find((c) => c.jobId === thread.jobId && c.workerId === thread.workerId) : undefined;
  const storeApplication = thread ? applications.find((a) => a.jobId === thread.jobId && a.workerId === thread.workerId) : undefined;
  const targetApplication = threadApplication || storeCandidate || storeApplication;

  const associatedJob =
    myJobs.find((j) => j.id === thread?.jobId && Number(j.payPerWorker) > 0) ||
    jobs.find((j) => j.id === thread?.jobId && Number(j.payPerWorker) > 0) ||
    (threadApplication?.job?.payPerWorker ? threadApplication.job : undefined) ||
    (storeCandidate?.job?.payPerWorker ? storeCandidate.job : undefined) ||
    (storeApplication?.job?.payPerWorker ? storeApplication.job : undefined) ||
    targetApplication?.job;

  const baseJobPay =
    (associatedJob && Number(associatedJob.payPerWorker) > 0 ? Number(associatedJob.payPerWorker) : 0) ||
    (threadApplication?.job?.payPerWorker ? Number(threadApplication.job.payPerWorker) : 0) ||
    (storeCandidate?.job?.payPerWorker ? Number(storeCandidate.job.payPerWorker) : 0) ||
    (storeApplication?.job?.payPerWorker ? Number(storeApplication.job.payPerWorker) : 0);

  const negotiatedPay =
    targetApplication?.negotiatedPay !== undefined && targetApplication?.negotiatedPay !== null
      ? Number(targetApplication.negotiatedPay)
      : threadApplication?.negotiatedPay !== undefined && threadApplication?.negotiatedPay !== null
      ? Number(threadApplication.negotiatedPay)
      : storeCandidate?.negotiatedPay !== undefined && storeCandidate?.negotiatedPay !== null
      ? Number(storeCandidate.negotiatedPay)
      : null;

  const effectivePay = negotiatedPay != null ? negotiatedPay : baseJobPay;
  // Requires the account's CURRENT role to be employer — a phone number's
  // role can be switched on login, so someone who owns this thread as
  // job.employerId but is now logged in as a worker should not see pay
  // controls ("Update Worker Pay") for their own old job's chat thread.
  const isEmployer = user?.role === 'employer' && Boolean(thread && user?.id === thread.employerId);

  useEffect(() => {
    if (activeTab === 'pipeline' && targetApplication) {
      fetchCompletions(targetApplication.id).catch(() => undefined);
    }
  }, [activeTab, targetApplication?.id, fetchCompletions]);

  if (isLoading && !thread) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 dark:bg-dark-900 font-sans">
        <AppHeader showBack onBack={() => navigate(-1)} title="Chat" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!thread || !user) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 dark:bg-dark-900 font-sans">
        <AppHeader showBack onBack={() => navigate(-1)} title="Chat" />
        <div className="flex-1 flex flex-col items-center justify-center p-5 text-center">
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-4">Chat thread not found or unavailable.</p>
          <button onClick={() => navigate('/chat')} className="px-4 py-2 bg-primary-500 text-white rounded-xl font-bold text-sm">
            Back to Messages
          </button>
        </div>
      </div>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;
    setSending(true);
    await sendMessage(thread.id, user.id, inputText.trim());
    setInputText('');
    setSending(false);
  };

  const completionByTaskId = new Map(completions.map((c) => [c.jobTaskId, c]));

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-dark-900 font-sans">
      <AppHeader
        showBack
        onBack={() => navigate(-1)}
        title={
          <div className="flex items-center gap-3">
            <Avatar src={thread.otherPartyAvatar} name={thread.otherPartyName} size="sm" />
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                {thread.otherPartyName}
              </h2>
              <p className="text-[10px] font-bold text-slate-400 truncate max-w-[140px]">{thread.jobTitle}</p>
            </div>
          </div> as any
        }
        rightAction={
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setShowMenu(prev => !prev)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-700 transition-colors"
            >
              <MoreVertical size={18} />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-10 w-44 bg-white dark:bg-dark-800 rounded-2xl shadow-lg border border-slate-100 dark:border-dark-600 overflow-hidden z-50"
                >
                  {isEmployer && targetApplication && !thread.isGroup && (
                    <button
                      onClick={() => { setShowMenu(false); setShowPayModal(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors border-b border-slate-100 dark:border-dark-700"
                    >
                      <Coins size={15} />
                      Update Worker Pay
                    </button>
                  )}
                  <button
                    onClick={() => { setShowMenu(false); setShowDeleteModal(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <Trash2 size={15} />
                    Delete Chat
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        }
      />

      {/* Negotiated Pay Banner (for 1-on-1 chats associated with a job) */}
      {thread?.jobId && !thread.isGroup && (
        <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-sm flex-shrink-0">
              ₹
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isEmployer ? `${thread.otherPartyName}'s Pay:` : 'Agreed Pay:'}
                </span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  ₹{effectivePay}
                </span>
                {negotiatedPay != null ? (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                    Negotiated (Base: ₹{baseJobPay})
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                    (Standard Rate)
                  </span>
                )}
              </div>
            </div>
          </div>

          {isEmployer && targetApplication && !targetApplication.paid && (
            <button
              onClick={() => setShowPayModal(true)}
              className="px-2.5 py-1 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1 flex-shrink-0 shadow-sm"
            >
              <Coins size={13} /> Update Pay
            </button>
          )}
        </div>
      )}

      <div className="flex bg-white dark:bg-dark-800 border-b border-slate-100 dark:border-dark-600">
        <button
          onClick={() => setActiveTab('message')}
          className={clsx(
            'flex-1 py-2.5 text-sm font-bold transition-colors border-b-2',
            activeTab === 'message' ? 'text-primary-600 border-primary-500' : 'text-slate-400 border-transparent'
          )}
        >
          Message
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={clsx(
            'flex-1 py-2.5 text-sm font-bold transition-colors border-b-2',
            activeTab === 'pipeline' ? 'text-primary-600 border-primary-500' : 'text-slate-400 border-transparent'
          )}
        >
          Pipeline
        </button>
      </div>

      {activeTab === 'message' ? (
        <>
          <div className="flex-1 overflow-y-auto p-5 pb-safe flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="text-center py-10 text-sm text-slate-400 font-medium">
                No messages yet. Say hello!
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.senderId === user.id;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed ${isMe
                        ? 'bg-primary-500 text-white rounded-br-sm shadow-primary-sm'
                        : 'bg-white dark:bg-dark-700 text-slate-800 dark:text-slate-200 rounded-bl-sm shadow-sm border border-slate-100 dark:border-dark-600'
                      }`}
                  >
                    {msg.type === 'video' ? (
                      msg.videoUrl ? (
                        <video src={msg.videoUrl} controls className="rounded-lg max-w-full max-h-64" />
                      ) : (
                        <div className="flex items-center gap-2 text-xs font-bold opacity-80">
                          <Play size={14} /> Recording unavailable
                        </div>
                      )
                    ) : (
                      msg.text
                    )}
                    <div className={`text-[9px] font-bold mt-1 flex items-center justify-end gap-1 ${isMe ? 'text-primary-100' : 'text-slate-400'}`}>
                      <span>{formatTime12h(new Date(msg.sentAt))}</span>
                      {isMe && (
                        msg.isRead || msg.readAt ? (
                          <CheckCheck size={14} className="text-cyan-300 stroke-[2.5] flex-shrink-0 drop-shadow-sm" />
                        ) : msg.deliveredAt ? (
                          <CheckCheck size={14} className="text-white stroke-[2.2] flex-shrink-0" />
                        ) : (
                          <Check size={14} className="text-slate-200 stroke-[2.2] flex-shrink-0" />
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            <div ref={endRef} />
          </div>

          <div className="bg-white dark:bg-dark-800 p-4 pb-safe-or-4 border-t border-slate-100 dark:border-dark-600">
            <form onSubmit={handleSend} className="flex gap-2 items-end">
              <button
                type="button"
                onClick={() => setRecordingTaskId('general')}
                className="w-11 h-11 flex-shrink-0 flex items-center justify-center text-slate-400 hover:text-primary-500 bg-slate-50 dark:bg-dark-700 rounded-xl"
              >
                <Video size={20} />
              </button>
              <div className="flex-1 bg-slate-50 dark:bg-dark-700 rounded-2xl border border-slate-100 dark:border-dark-600 px-4 py-1 flex items-center">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full bg-transparent text-sm text-slate-900 dark:text-white font-medium resize-none max-h-32 py-3 focus:outline-none placeholder:text-slate-400"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className="w-11 h-11 flex-shrink-0 flex items-center justify-center bg-primary-500 text-white rounded-xl shadow-primary disabled:opacity-50 transition-all active:scale-95"
              >
                <Send size={18} className="ml-1" />
              </button>
            </form>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
          {!targetApplication ? (
            <p className="text-center text-slate-400 font-semibold py-10">No pipeline for this conversation yet.</p>
          ) : tasks.length === 0 ? (
            <p className="text-center text-slate-400 font-semibold py-10">Loading pipeline...</p>
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.map((task) => {
                const completion = completionByTaskId.get(task.id);
                const status = completion?.status || 'not_started';
                return (
                  <div key={task.id} className="bg-white dark:bg-dark-800 rounded-xl p-3 border border-slate-100 dark:border-dark-700 flex items-center gap-3">
                    <TaskStatusIcon status={status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{task.title}</p>
                    </div>
                    {task.completionType === 'image' && status === 'in_progress' && (
                      <button
                        onClick={() => setRecordingTaskId(task.id)}
                        className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 flex items-center justify-center"
                      >
                        <Video size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {recordingTaskId && (
        <RecordingRecorder
          threadId={thread.id}
          jobTaskId={recordingTaskId === 'general' ? undefined : recordingTaskId}
          onClose={() => setRecordingTaskId(null)}
        />
      )}

      {/* Delete Chat Confirmation Modal */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Chat">
        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to delete this chat from your view? It will be removed from your chat list without affecting the other person.
          </p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleDeleteChatForMe}>
              Delete Chat
            </Button>
          </div>
        </div>
      </Modal>

      {/* Negotiated Pay Modal */}
      {showPayModal && targetApplication && (
        <NegotiatedPayModal
          open={showPayModal}
          onClose={() => setShowPayModal(false)}
          applicationId={targetApplication.id}
          workerName={thread.otherPartyName}
          defaultPay={baseJobPay}
          currentNegotiatedPay={targetApplication.negotiatedPay}
          onSuccess={(newPay) => {
            if (threadApplication) {
              setThreadApplication({ ...threadApplication, negotiatedPay: newPay });
            }
            if (thread.jobId) fetchJobCandidates(thread.jobId);
          }}
        />
      )}
    </div>
  );
}
