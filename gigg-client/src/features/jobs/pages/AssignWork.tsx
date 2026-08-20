import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppHeader } from '../../../components/layout/Navigation';
import { Button, Modal, Avatar, Chip } from '../../../components/ui';
import { useJobStore } from '../../../store/jobStore';
import { useAuthStore } from '../../../store/authStore';
import { useUIStore } from '../../../store/uiStore';
import { CheckCircle2, UserCircle2, ChevronRight, Share2, X, Info, Phone, MapPin, Briefcase, ShieldCheck, ShieldAlert, Coins } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from '../../../components/ui';
import { NegotiatedPayModal } from '../components/NegotiatedPayModal';
import type { Application } from '../../../types';

export default function AssignWork() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { myJobs, jobCandidates, fetchJobCandidates, hireWorker, rejectWorker, isLoading } = useJobStore();
  const { addToast } = useUIStore();

  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed'>('pending');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [isHiring, setIsHiring] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const [profileApp, setProfileApp] = useState<Application | null>(null);
  const [payModalApp, setPayModalApp] = useState<Application | null>(null);

  const job = myJobs.find(j => j.id === id);

  useEffect(() => {
    if (id) {
      fetchJobCandidates(id);
    }
  }, [id, fetchJobCandidates]);

  if (!job) {
    return <div className="p-5 text-center mt-20 font-bold dark:text-white">Job not found.</div>;
  }

  const pendingWorkers = jobCandidates.filter(c => c.status === 'applied');
  const offeredWorkers = jobCandidates.filter(c => c.status === 'hired');
  const confirmedWorkers = jobCandidates.filter(c => c.status === 'confirmed' || c.status === 'completed');
  const hiredTabWorkers = [...offeredWorkers, ...confirmedWorkers];

  const handleToggleSelection = (applicationId: string) => {
    setSelectedWorkers(prev => 
      prev.includes(applicationId) ? prev.filter(i => i !== applicationId) : [...prev, applicationId]
    );
  };

  const handleAssignWork = async () => {
    if (selectedWorkers.length === 0) {
      addToast('Please select at least one worker', 'error');
      return;
    }
    
    if (job.workersHired + selectedWorkers.length > job.workersNeeded) {
      addToast(`You only need ${job.workersNeeded - job.workersHired} more workers!`, 'error');
      return;
    }

    setIsHiring(true);
    for (const appId of selectedWorkers) {
      await hireWorker(job.id, appId);
    }
    setIsHiring(false);
    setSelectedWorkers([]);
    addToast('Workers successfully assigned!', 'success');
    setActiveTab('confirmed');
  };

  const handleShareAllWorkersPipeline = async () => {
    const token = job.pipelineShareToken || (job as any).pipeline_share_token || job.id;
    const url = `${window.location.origin}/pipeline/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      addToast('All workers pipeline share link copied to clipboard!', 'success');
    } catch {
      addToast(`Share link: ${url}`, 'info');
    }
  };

  const handleReject = async (applicationId: string) => {
    setRejectingId(applicationId);
    try {
      await rejectWorker(applicationId);
      addToast('Applicant rejected', 'info');
    } catch {
      addToast('Failed to reject applicant', 'error');
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div className="pb-24 font-sans bg-slate-50 dark:bg-dark-900 min-h-screen">
      <AppHeader
        title="Assign Work"
        showBack
        onBack={() => navigate(-1)}
        rightAction={
          <button onClick={handleShareAllWorkersPipeline} title="Share All Workers' Pipeline" className="p-2 text-slate-500 hover:text-primary-600 transition-colors">
            <Share2 size={20} />
          </button>
        }
      />

      {/* Tabs */}
      <div className="px-5 pt-4">
        <div className="flex p-1 bg-slate-200/50 dark:bg-dark-800 rounded-xl mb-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={clsx(
              "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
              activeTab === 'pending'
                ? "bg-white dark:bg-dark-600 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            Pending Worker
          </button>
          <button
            onClick={() => setActiveTab('confirmed')}
            className={clsx(
              "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
              activeTab === 'confirmed'
                ? "bg-white dark:bg-dark-600 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            Hired Worker
          </button>
        </div>

        {/* Job Summary */}
        <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-xl border border-primary-100 dark:border-primary-900/30 mb-4 flex justify-between items-center">
          <div>
            <h3 className="text-primary-900 dark:text-primary-100 font-extrabold text-sm">{job.title}</h3>
            <p className="text-primary-700/70 dark:text-primary-300/70 text-xs font-semibold mt-0.5">
              Hired: {job.workersHired} / {job.workersNeeded}
            </p>
          </div>
          <div className="w-10 h-10 bg-white dark:bg-dark-800 rounded-full flex items-center justify-center font-black text-primary-600 shadow-sm text-sm">
            {Math.round((job.workersHired / job.workersNeeded) * 100)}%
          </div>
        </div>

        {/* Content */}
        {isLoading && <div className="text-center py-10 text-slate-500 font-bold">Loading workers...</div>}
        
        {!isLoading && activeTab === 'pending' && (
          <div className="flex flex-col gap-3">
            {pendingWorkers.length === 0 ? (
              <div className="text-center py-10 text-slate-500 font-bold">No pending workers yet.</div>
            ) : (
              pendingWorkers.map((app) => (
                <div 
                  key={app.id} 
                  onClick={() => handleToggleSelection(app.id)}
                  className={clsx(
                    "bg-white dark:bg-dark-800 p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3",
                    selectedWorkers.includes(app.id) 
                      ? "border-primary-500 bg-primary-50/30 dark:bg-primary-900/10" 
                      : "border-slate-100 dark:border-dark-700 hover:border-slate-200"
                  )}
                >
                  <div className={clsx(
                    "w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors",
                    selectedWorkers.includes(app.id)
                      ? "bg-primary-500 border-primary-500 text-white"
                      : "border-slate-300 dark:border-dark-600 bg-transparent"
                  )}>
                    {selectedWorkers.includes(app.id) && <CheckCircle2 size={14} strokeWidth={4} />}
                  </div>
                  
                  {app.workerAvatar ? (
                    <img src={app.workerAvatar} alt={app.workerName} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-slate-100 dark:bg-dark-700 rounded-full flex items-center justify-center text-slate-400">
                      <UserCircle2 size={24} />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{app.workerName}</h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-slate-500">⭐ {app.workerRating.toFixed(1)}</span>
                      <span className="text-slate-300 dark:text-dark-600">•</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{app.negotiatedPay != null ? app.negotiatedPay : job.payPerWorker}
                      </span>
                      {app.negotiatedPay != null && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                          Negotiated
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); setPayModalApp(app); }}
                    title="Set custom pay"
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                  >
                    <Coins size={16} />
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); setProfileApp(app); }}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary-600 rounded-full hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                  >
                    <Info size={16} />
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleReject(app.id); }}
                    disabled={rejectingId === app.id}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {!isLoading && activeTab === 'confirmed' && (
          <div className="flex flex-col gap-3">
            {hiredTabWorkers.length === 0 ? (
              <div className="text-center py-10 text-slate-500 font-bold">No workers assigned yet.</div>
            ) : (
              hiredTabWorkers.map((app) => (
                <div
                  key={app.id}
                  onClick={() => navigate(`/pipeline/${job.id}/${app.workerId}`)}
                  className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-slate-100 dark:border-dark-700 flex items-center gap-3 cursor-pointer hover:border-slate-300 transition-colors"
                >
                  {app.workerAvatar ? (
                    <img src={app.workerAvatar} alt={app.workerName} className={clsx("w-10 h-10 rounded-full object-cover border-2", app.status === 'confirmed' || app.status === 'completed' ? "border-green-500" : "border-blue-400")} />
                  ) : (
                    <div className={clsx("w-10 h-10 bg-slate-100 dark:bg-dark-700 rounded-full flex items-center justify-center text-slate-400 border-2", app.status === 'confirmed' || app.status === 'completed' ? "border-green-500" : "border-blue-400")}>
                      <UserCircle2 size={24} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{app.workerName}</h4>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {app.status === 'hired' ? (
                        <Badge variant="warning">Awaiting Response</Badge>
                      ) : (
                        <Badge variant="success">Confirmed</Badge>
                      )}
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{app.negotiatedPay != null ? app.negotiatedPay : job.payPerWorker}
                      </span>
                      {app.negotiatedPay != null && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                          Negotiated
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); setPayModalApp(app); }}
                    title="Update negotiated pay"
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex-shrink-0"
                  >
                    <Coins size={16} />
                  </button>

                  <ChevronRight size={20} className="text-slate-400 flex-shrink-0" />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {activeTab === 'pending' && pendingWorkers.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-dark-800/90 backdrop-blur-md border-t border-slate-100 dark:border-dark-600 z-40 max-w-lg mx-auto">
          <Button 
            fullWidth 
            size="lg" 
            onClick={handleAssignWork}
            loading={isHiring}
            disabled={selectedWorkers.length === 0}
          >
            Assign Work ({selectedWorkers.length})
          </Button>
        </div>
      )}

      {/* Worker Verification Modal */}
      <Modal open={!!profileApp} onClose={() => setProfileApp(null)} title="Verify Worker">
        {profileApp && (
          <div className="flex flex-col gap-5 py-2">
            <div className="flex items-center gap-4">
              <Avatar src={profileApp.workerProfile?.selfie || profileApp.workerAvatar} name={profileApp.workerName} size="xl" />
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{profileApp.workerName}</h3>
                <p className="text-sm font-semibold text-slate-500 flex items-center gap-1">
                  <MapPin size={14} /> {profileApp.workerProfile?.city}{profileApp.workerProfile?.area ? `, ${profileApp.workerProfile.area}` : ''}
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="warning" className="flex gap-1 items-center">⭐ {profileApp.workerRating.toFixed(1)}</Badge>
                  <Badge variant="success">{profileApp.workerProfile?.attendanceRate ?? 100}% Attendance</Badge>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 mb-2">Verification Status</p>
              <div className="grid grid-cols-2 gap-3">
                <div className={clsx(
                  'p-3 rounded-xl border flex items-center gap-2',
                  profileApp.workerProfile?.kycStatus === 'approved'
                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30'
                    : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30'
                )}>
                  {profileApp.workerProfile?.kycStatus === 'approved' ? (
                    <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0" />
                  ) : (
                    <ShieldAlert size={18} className="text-amber-600 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">KYC</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white capitalize">{profileApp.workerProfile?.kycStatus?.replace('_', ' ') || 'Not started'}</p>
                  </div>
                </div>
                <div className={clsx(
                  'p-3 rounded-xl border flex items-center gap-2',
                  profileApp.workerProfile?.aadhaarVerified
                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30'
                    : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30'
                )}>
                  {profileApp.workerProfile?.aadhaarVerified ? (
                    <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0" />
                  ) : (
                    <ShieldAlert size={18} className="text-amber-600 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Aadhaar</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{profileApp.workerProfile?.aadhaarVerified ? 'Verified' : 'Unverified'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 mb-2">Contact</p>
              <a
                href={profileApp.workerProfile?.phone ? `tel:${profileApp.workerProfile.phone}` : undefined}
                className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-dark-800 border border-slate-100 dark:border-dark-600 text-sm font-bold text-slate-900 dark:text-white"
              >
                <Phone size={16} className="text-primary-500" /> {profileApp.workerProfile?.phone || 'Not available'}
              </a>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 mb-2">Track Record</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-dark-800 p-3 rounded-xl border border-slate-100 dark:border-dark-600 flex items-center gap-2">
                  <Briefcase size={16} className="text-primary-500 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Completed Jobs</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{profileApp.workerProfile?.completedJobs ?? 0}</p>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-dark-800 p-3 rounded-xl border border-slate-100 dark:border-dark-600">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Age / Gender</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">{profileApp.workerProfile?.age ?? '—'} • {profileApp.workerProfile?.gender ?? '—'}</p>
                </div>
              </div>
            </div>

            {profileApp.workerProfile?.bio && (
              <div className="bg-slate-50 dark:bg-dark-800 p-4 rounded-2xl border border-slate-100 dark:border-dark-600">
                <p className="text-xs font-bold text-slate-500 mb-2">About</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{profileApp.workerProfile.bio}</p>
              </div>
            )}

            {!!profileApp.workerProfile?.skills?.length && (
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {profileApp.workerProfile.skills.map((skill) => (
                    <Chip key={skill} active={false}>{skill}</Chip>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { handleReject(profileApp.id); setProfileApp(null); }}
              >
                Reject
              </Button>
              <Button
                className="flex-1"
                onClick={() => { handleToggleSelection(profileApp.id); setProfileApp(null); }}
              >
                {selectedWorkers.includes(profileApp.id) ? 'Selected — Deselect' : 'Select to Hire'}
              </Button>
            </div>
          </div>
        )}
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
            if (id) fetchJobCandidates(id);
          }}
        />
      )}
    </div>
  );
}
