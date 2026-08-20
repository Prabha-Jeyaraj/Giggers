import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, Briefcase, FileText, Activity, Compass, MessageCircle, ShieldAlert, MapPin, Check, X as XIcon, Users, Star } from 'lucide-react';
import { AppHeader } from '../../../components/layout/Navigation';
import { JobCard } from '../../../components/shared/Cards';
import { Button, Input, Modal, Chip, Skeleton, Toggle, Badge } from '../../../components/ui';
import { useJobStore } from '../../../store/jobStore';
import { useAuthStore } from '../../../store/authStore';
import { useUIStore } from '../../../store/uiStore';
import { JOB_CATEGORIES } from '../constants';
import { supabase } from '../../../lib/supabase';
import { formatTimeString12h } from '../../../lib/time';

export default function Jobs() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuthStore();
  const { jobs, myJobs, applications, fetchJobs, fetchPostedJobs, fetchAppliedJobs, fetchChatThreadId, isLoading, savedJobIds, saveJob, unsaveJob, confirmHire, declineHire } = useJobStore();
  const { addToast } = useUIStore();
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [appRatings, setAppRatings] = useState<Record<string, number>>({});
  const [employerRatings, setEmployerRatings] = useState<Record<string, number>>({});

  const [rateEmpTarget, setRateEmpTarget] = useState<any>(null);
  const [selectedEmpRating, setSelectedEmpRating] = useState<number>(10);
  const [submittingEmpRating, setSubmittingEmpRating] = useState<boolean>(false);

  useEffect(() => {
    if (user && user.role === 'worker') {
      (async () => {
        try {
          const { data } = await supabase
            .from('job_ratings')
            .select('job_id, rating')
            .eq('worker_id', user.id);
          if (data) {
            const map: Record<string, number> = {};
            data.forEach((r: any) => { map[r.job_id] = r.rating; });
            setAppRatings(map);
          }
        } catch {}

        try {
          const { data } = await supabase
            .from('employer_ratings')
            .select('job_id, rating')
            .eq('worker_id', user.id);
          if (data) {
            const map: Record<string, number> = {};
            data.forEach((r: any) => { map[r.job_id] = r.rating; });
            setEmployerRatings(map);
          }
        } catch {}
      })();
    }
  }, [user?.id]);

  const handleSaveEmpRating = async () => {
    if (!rateEmpTarget || !user) return;
    setSubmittingEmpRating(true);
    try {
      await supabase.from('employer_ratings').upsert({
        job_id: rateEmpTarget.jobId,
        employer_id: rateEmpTarget.job.employerId || rateEmpTarget.job.employer_id,
        worker_id: user.id,
        rating: selectedEmpRating,
        created_at: new Date().toISOString()
      }, { onConflict: 'job_id,worker_id' });

      setEmployerRatings(prev => ({ ...prev, [rateEmpTarget.jobId]: selectedEmpRating }));
      addToast('Employer rating submitted! ★', 'success');
      setRateEmpTarget(null);
    } catch (err) {
      console.error('Failed to submit employer rating:', err);
    } finally {
      setSubmittingEmpRating(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'explore' | 'postings' | 'applications' | 'ongoing'>(() => {
    const tabParam = params.get('tab');
    if (user?.role === 'employer') {
      if (tabParam === 'ongoing' || tabParam === 'postings') return tabParam as any;
      return 'postings';
    } else {
      if (tabParam === 'explore' || tabParam === 'applications' || tabParam === 'ongoing') return tabParam as any;
      return 'explore';
    }
  });

  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeCategory, setActiveCategory] = useState(params.get('category') || 'All');
  const [activeSort, setActiveSort] = useState('recent');
  const [urgentOnly, setUrgentOnly] = useState(params.get('filter') === 'urgent');
  const [locationFilter, setLocationFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState<'any' | 'male' | 'female'>('any');

  // Enforce role-based tab access
  useEffect(() => {
    if (user) {
      if (user.role === 'employer') {
        if (activeTab !== 'postings' && activeTab !== 'ongoing') {
          setActiveTab('postings');
        }
      } else {
        if (activeTab !== 'explore' && activeTab !== 'applications' && activeTab !== 'ongoing') {
          setActiveTab('explore');
        }
      }
    }
  }, [user, activeTab]);

  useEffect(() => {
    fetchJobs();
    if (user) {
      fetchPostedJobs(user.id);
      fetchAppliedJobs(user.id);
    }
  }, [fetchJobs, fetchPostedJobs, fetchAppliedJobs, user]);

  const filteredExploreJobs = jobs.filter(j => {
    // Hide jobs posted by current user or jobs already applied for
    if (user && j.employerId === user.id) return false;
    if (user && applications.some(a => a.jobId === j.id)) return false;
    
    if (activeCategory !== 'All' && j.category !== activeCategory) return false;
    if (urgentOnly && !j.isUrgent) return false;
    if (locationFilter && !j.location.toLowerCase().includes(locationFilter.toLowerCase())) return false;
    if (genderFilter !== 'any' && j.genderPreference !== 'any' && j.genderPreference !== genderFilter) return false;
    if (search && !j.title.toLowerCase().includes(search.toLowerCase()) && !j.employerName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pendingConfirmation = applications.filter(a => a.status === 'hired');
  const confirmedOngoing = applications.filter(a => a.status === 'confirmed');

  const ongoingJobs = [
    ...myJobs.filter(j => j.status === 'active'),
    ...confirmedOngoing.map(a => a.job)
  ];

  const visibleTabs = user?.role === 'employer'
    ? [
        { id: 'postings', label: 'Postings', icon: Briefcase },
        { id: 'ongoing', label: 'Ongoing', icon: Activity },
      ]
    : [
        { id: 'explore', label: 'Explore', icon: Compass },
        { id: 'applications', label: 'Applications', icon: FileText },
        { id: 'ongoing', label: 'Ongoing', icon: Activity },
      ];

  const kycIncomplete = user && !user.isApproved && (user.kycStatus === 'not_started' || user.kycStatus === 'rejected');

  if (kycIncomplete) {
    return (
      <div className="pb-24 bg-slate-50 dark:bg-dark-900 min-h-screen">
        <AppHeader title="Jobs Hub" />
        <div className="px-5 pt-16 flex flex-col items-center text-center gap-4">
          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
            <ShieldAlert size={36} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">KYC Required</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-xs">
            Complete your Aadhaar KYC verification to browse and apply for jobs or post gigs.
          </p>
          <button onClick={() => navigate('/kyc')}
            className="mt-2 bg-primary-600 text-white font-extrabold text-sm px-8 py-3 rounded-2xl shadow-lg shadow-primary-500/30">
            Complete KYC Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 bg-slate-50 dark:bg-dark-900 min-h-screen">
      <AppHeader title="Jobs Hub" />

      {/* Tabs */}
      <div className="sticky top-[60px] z-30 bg-white dark:bg-dark-800 border-b border-slate-100 dark:border-dark-600 px-2 pt-2 shadow-sm">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[80px] py-3 text-xs font-bold flex flex-col items-center justify-center gap-1 border-b-2 transition-all ${
                activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-4">
        <AnimatePresence mode="wait">
          {activeTab === 'explore' && (
            <motion.div key="explore" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-4">
              {/* Search and Filters Bar */}
              <div className="flex items-center gap-3 mb-1">
                <Input
                  placeholder="Search jobs..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  leftIcon={<Search size={18} />}
                  className="flex-1"
                />
                <button
                  onClick={() => setShowFilters(true)}
                  className="w-11 h-11 bg-slate-100 dark:bg-dark-600 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 relative flex-shrink-0"
                >
                  <Filter size={18} />
                  {(activeCategory !== 'All' || urgentOnly || locationFilter || genderFilter !== 'any') && <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-primary-500 rounded-full border-2 border-white dark:border-dark-600" />}
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <Chip active={activeCategory === 'All'} onClick={() => setActiveCategory('All')}>All</Chip>
                <Chip active={urgentOnly} onClick={() => setUrgentOnly(!urgentOnly)}>🚨 Urgent</Chip>
                {JOB_CATEGORIES.map(cat => (
                  <Chip key={cat.value} active={activeCategory === cat.value} onClick={() => setActiveCategory(cat.value)}>{cat.icon} {cat.label}</Chip>
                ))}
              </div>

              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-dark-800 p-4 rounded-2xl flex gap-3 border border-slate-100 dark:border-dark-600"><Skeleton className="w-12 h-12" /><div className="flex-1"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-1/2 mb-3" /><Skeleton className="h-4 w-1/4" /></div></div>
                ))
              ) : filteredExploreJobs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredExploreJobs.map((job, i) => (
                    <motion.div key={job.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <JobCard job={job} onClick={() => navigate(`/jobs/${job.id}`)} saved={savedJobIds.includes(job.id)} onSave={() => savedJobIds.includes(job.id) ? unsaveJob(job.id) : saveJob(job.id)} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="text-5xl mb-4">🔍</div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">No jobs found</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Try adjusting your filters or search terms.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'postings' && (
            <motion.div key="postings" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-4">
              {isLoading ? (
                <p className="text-slate-500 text-center py-8">Loading postings...</p>
              ) : myJobs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myJobs.map((job) => <JobCard key={job.id} job={job} isEmployerOwn onClick={() => navigate(`/assign-work/${job.id}`)} />)}
                </div>
              ) : (
                <div className="text-center py-16 bg-white dark:bg-dark-800 rounded-2xl border border-slate-100 dark:border-dark-600 shadow-sm">
                  <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Briefcase size={24} className="text-primary-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">No Active Postings</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px] mx-auto mb-6">You haven't posted any jobs yet. Need some extra hands?</p>
                  <button onClick={() => navigate('/post-job')} className="px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30">Post a Job Now</button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'applications' && (
            <motion.div key="applications" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">
              {isLoading ? (
                <p className="text-slate-500 text-center py-8">Loading applications...</p>
              ) : applications.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {applications.map((app) => (
                    <div key={app.id} className="bg-white dark:bg-dark-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-dark-600">
                      <div className="flex justify-between items-start mb-3 cursor-pointer" onClick={() => navigate(`/jobs/${app.jobId}`)}>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white">{app.job.title}</h4>
                          <p className="text-xs text-slate-500 mt-1">{app.job.employerName}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg ${
                            app.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                            app.status === 'hired' ? 'bg-blue-100 text-blue-700' :
                            app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            app.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {app.status === 'hired' ? 'Action Required' : app.status}
                          </div>
                          {appRatings[app.jobId] && (
                            <span className="text-[11px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/30 flex items-center gap-1">
                              ★ {appRatings[app.jobId]}/10
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-dark-700 p-2.5 rounded-xl mb-3">
                        <span>{app.job.date}</span>
                        <span className="font-black text-slate-900 dark:text-white">₹{app.job.payPerWorker}</span>
                      </div>
                      {app.status === 'confirmed' && user && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/worker-pipeline/${app.jobId}`)}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary-600 text-white text-xs font-bold shadow-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Track Job
                          </button>
                          {/* 1-on-1 chat with employer */}
                          <button
                            title="Chat with Employer"
                            onClick={async () => {
                              const threadId = await fetchChatThreadId(app.jobId, user.id);
                              if (threadId) navigate(`/chat/${threadId}`);
                              else addToast('Could not open chat. Please try again.', 'error');
                            }}
                            className="w-10 flex items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800/30"
                          >
                            <MessageCircle size={16} />
                          </button>
                          {/* Group / Team chat */}
                          <button
                            title="Team Group Chat"
                            onClick={() => navigate(`/group-chat/${app.jobId}`)}
                            className="w-10 flex items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30"
                          >
                            <Users size={16} />
                          </button>
                        </div>
                      )}
                      {(app.status === 'completed' || (app as any).paid) && user && (
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-dark-700 flex flex-col gap-2">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                            <span>Job Rating Received:</span>
                            {appRatings[app.jobId] ? (
                              <span className="text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/40">
                                <Star size={12} className="fill-current" /> ★ {appRatings[app.jobId]}/10
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium italic">No rating received yet</span>
                            )}
                          </div>

                          <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                            <span>Your Employer Rating:</span>
                            {employerRatings[app.jobId] ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
                                <Star size={12} className="fill-current" /> ★ {employerRatings[app.jobId]}/10
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setRateEmpTarget(app);
                                  setSelectedEmpRating(10);
                                }}
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold rounded-lg shadow-sm flex items-center gap-1 transition-colors"
                              >
                                <Star size={12} className="fill-current" /> Rate Employer
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-white dark:bg-dark-800 rounded-2xl border border-slate-100 dark:border-dark-600 shadow-sm">
                  <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText size={24} className="text-amber-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">No Applications</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px] mx-auto mb-6">You haven't applied to any jobs yet. Explore available gigs.</p>
                  <button onClick={() => setActiveTab('explore')} className="px-6 py-2.5 bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30">Find Gigs</button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'ongoing' && (
            <motion.div key="ongoing" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">
              {isLoading ? (
                <p className="text-slate-500 text-center py-8">Loading ongoing jobs...</p>
              ) : (ongoingJobs.length > 0 || pendingConfirmation.length > 0) ? (
                <>
                  {user?.role !== 'employer' && pendingConfirmation.length > 0 && (
                    <div className="flex flex-col gap-3 mb-2">
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Awaiting Your Confirmation</h4>
                      {pendingConfirmation.map((app) => (
                        <div key={app.id} className="bg-white dark:bg-dark-800 p-4 rounded-2xl shadow-sm border border-blue-200 dark:border-blue-800/40">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-white">{app.job.title}</h4>
                              <p className="text-xs text-slate-500 mt-1">{app.job.employerName}</p>
                            </div>
                            <Badge variant="primary">Action Required</Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-dark-700 p-2.5 rounded-xl mb-3">
                            <span>{app.job.date}</span>
                            <span>{formatTimeString12h(app.job.reportingTime)}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              fullWidth
                              loading={actioningId === app.id}
                              leftIcon={<Check size={16} />}
                              onClick={async () => {
                                setActioningId(app.id);
                                try {
                                  await confirmHire(app.id);
                                  addToast('Job confirmed!', 'success');
                                } catch {
                                  addToast('Failed to confirm', 'error');
                                } finally {
                                  setActioningId(null);
                                }
                              }}
                            >
                              Accept
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              fullWidth
                              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800/40 dark:hover:bg-red-900/20"
                              loading={actioningId === app.id}
                              leftIcon={<XIcon size={16} />}
                              onClick={async () => {
                                setActioningId(app.id);
                                try {
                                  await declineHire(app.id);
                                  addToast('Offer declined', 'info');
                                } catch {
                                  addToast('Failed to decline', 'error');
                                } finally {
                                  setActioningId(null);
                                }
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {ongoingJobs.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ongoingJobs.map((job) => (
                        <JobCard key={job.id} job={job} onClick={() => navigate(`/jobs/${job.id}`)} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-16 bg-white dark:bg-dark-800 rounded-2xl border border-slate-100 dark:border-dark-600 shadow-sm">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Activity size={24} className="text-blue-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">No Ongoing Jobs</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px] mx-auto mb-6">You have no active or ongoing jobs right now.</p>
                  <button onClick={() => setActiveTab('explore')} className="px-6 py-2.5 bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30">Find Gigs</button>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <Modal open={showFilters} onClose={() => setShowFilters(false)} title="Filters">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-white mb-3">Sort By</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'recent', label: 'Most Recent' },
                { id: 'pay_high', label: 'Highest Pay' },
                { id: 'distance', label: 'Nearest to me' },
                { id: 'urgent', label: 'Urgent First' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSort(s.id)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${activeSort === s.id ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-600' : 'border-slate-200 dark:border-dark-500 text-slate-600 dark:text-slate-400'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-px bg-slate-100 dark:bg-dark-500" />
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-white mb-3">Location</p>
            <Input placeholder="e.g. Andheri West" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} leftIcon={<MapPin size={16} />} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-white mb-3">Gender Preference</p>
            <div className="grid grid-cols-3 gap-2">
              {(['any', 'male', 'female'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGenderFilter(g)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all capitalize ${genderFilter === g ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-600' : 'border-slate-200 dark:border-dark-500 text-slate-600 dark:text-slate-400'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="h-px bg-slate-100 dark:bg-dark-500" />
          <div className="flex flex-col gap-4">
            <Toggle checked={urgentOnly} onChange={setUrgentOnly} label="Urgent Requirements Only" />
            <Toggle checked={false} onChange={() => {}} label="Verified Employers Only" />
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" fullWidth onClick={() => { setActiveCategory('All'); setUrgentOnly(false); setActiveSort('recent'); setLocationFilter(''); setGenderFilter('any'); }}>Reset</Button>
            <Button fullWidth onClick={() => setShowFilters(false)}>Apply Filters</Button>
          </div>
        </div>
      </Modal>

      {/* Rate Employer Modal */}
      {rateEmpTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-800 rounded-3xl p-6 w-full max-w-sm border border-slate-100 dark:border-dark-700 shadow-2xl flex flex-col items-center gap-4 text-center">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Rate Employer
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              How was your experience working on <strong>{rateEmpTarget.job?.title}</strong> for {rateEmpTarget.job?.employerName}?
            </p>

            <div className="flex flex-col items-center gap-2 my-2">
              <div className="text-4xl font-black text-amber-500 flex items-center justify-center gap-1">
                <span>{selectedEmpRating}</span>
                <span className="text-xl font-bold text-slate-400">/ 10</span>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 max-w-xs mt-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
                  <button
                    key={star}
                    onClick={() => setSelectedEmpRating(star)}
                    className={`w-9 h-9 rounded-xl font-black text-xs transition-all flex items-center justify-center ${
                      selectedEmpRating >= star
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
              <Button variant="outline" className="flex-1" onClick={() => setRateEmpTarget(null)} disabled={submittingEmpRating}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold" onClick={handleSaveEmpRating} loading={submittingEmpRating}>
                Submit Rating
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
