import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { useJobStore } from '../../../store/jobStore';
import { useWalletStore } from '../../../store/walletStore';
import { useUIStore } from '../../../store/uiStore';
import { HomeHeader } from '../../../components/layout/Navigation';
import { JobCard } from '../../../components/shared/Cards';
import { Shield, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatTime12Hour } from '../../../utils/formatters';

export default function Home() {
  const { user } = useAuthStore();
  const { jobs, featuredJobs, myJobs, jobCandidates, fetchJobs, fetchPostedJobs, fetchAppliedJobs, isLoading } = useJobStore();
  const { wallet, fetchWallet } = useWalletStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();
  const [actualHiredCount, setActualHiredCount] = React.useState(0);

  // Real category counts from Supabase
  const cateringCount = jobs.filter(j => j.category === 'Catering').length;
  const pamphletsCount = jobs.filter(j => j.category === 'Pamphlet Dist.').length;

  useEffect(() => {
    fetchJobs();
    if (user && user.role === 'employer') {
      fetchPostedJobs(user.id);
      // Fetch actual hired count from applications (workers_hired column may be stale)
      supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['hired', 'confirmed', 'completed'])
        .then(({ count }) => setActualHiredCount(count ?? 0));
    }
    if (user && user.role === 'worker') {
      fetchAppliedJobs(user.id);
      fetchWallet();
    }
  }, [fetchJobs, fetchPostedJobs, fetchAppliedJobs, fetchWallet, user]);

  if (!user) return null;

  // Real Employer Metrics — use actualHiredCount from DB not stale workers_hired column
  const jobsPostedCount = myJobs.length;
  const inProgressCount = myJobs.filter(j => j.status === 'active').length;
  const completedCount = myJobs.filter(j => j.status === 'completed').length;
  const totalApplications = actualHiredCount;

  // Real Worker Metrics
  const walletBalance = wallet?.currentBalance ?? 0;
  const totalEarnings = wallet?.totalEarnings ?? 0;
  const workerCompletedJobs = myJobs.filter(j => j.status === 'completed').length; // myJobs holds applied jobs for workers


  return (
    <div className="pb-24 bg-slate-50 dark:bg-dark-900 min-h-screen">
      <HomeHeader
        name={user.name}
        city={user.city}
        avatar={user.selfie}
      />

      {user.role === 'employer' ? (
        <div className="px-5 mt-4 relative z-10 flex flex-col gap-6 pb-20">
          
          {/* Overview Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-5 shadow-lg relative overflow-hidden flex flex-col"
            style={{ backgroundColor: '#01133b' }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white font-extrabold text-base">Overview</h3>
              <button className="text-white/60 text-xs font-semibold flex items-center gap-1">
                This Week <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>
            
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-2xl font-black mb-1" style={{ color: '#60A5FA' }}>{jobsPostedCount}</p>
                <p className="text-[10px] text-white/70 font-semibold leading-tight">Jobs Posted</p>
              </div>
              <div>
                <p className="text-2xl font-black text-white mb-1">{totalApplications}</p>
                <p className="text-[10px] text-white/70 font-semibold leading-tight">Hired</p>
              </div>
              <div>
                <p className="text-2xl font-black mb-1" style={{ color: '#60A5FA' }}>{inProgressCount}</p>
                <p className="text-[10px] text-white/70 font-semibold leading-tight">In Progress</p>
              </div>
              <div>
                <p className="text-2xl font-black mb-1" style={{ color: '#4ADE80' }}>{completedCount}</p>
                <p className="text-[10px] text-white/70 font-semibold leading-tight">Completed</p>
              </div>
            </div>
          </motion.div>

          {/* My Jobs List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">My Jobs</h2>
              <button onClick={() => navigate('/jobs?tab=postings')} className="text-xs font-extrabold text-blue-600">View All</button>
            </div>

            <div className="flex flex-col gap-3">
              {myJobs.slice(0, 3).map((job, idx) => (
                <motion.div key={job.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                  className="bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-600 rounded-2xl p-4 flex items-center gap-4 shadow-sm cursor-pointer"
                  onClick={() => navigate(`/assign-work/${job.id}`)}
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-dark-700 flex items-center justify-center text-xl flex-shrink-0">
                    {job.categoryEmoji}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-0.5">{job.title}</h4>
                    <p className="text-[10px] font-semibold text-slate-500 mb-0.5">{job.date} • {formatTime12Hour(job.reportingTime)}</p>
                    <p className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                      📍 {job.location}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={clsx(
                      "text-[10px] font-extrabold",
                      job.status === 'active' ? "text-amber-500" :
                      job.status === 'completed' ? "text-green-500" :
                      "text-blue-600"
                    )}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Floating CTA */}
          <div className="lg:hidden fixed bottom-24 left-0 right-0 px-5 z-40 max-w-lg mx-auto">
            <button 
              onClick={() => navigate('/post-job')}
              className="w-full py-4 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(37,99,235,0.35)] active:scale-[0.98] transition-all"
              style={{ backgroundColor: '#2563EB' }}
            >
              + Post a New Job
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 mt-4 relative z-10 flex flex-col gap-6 pb-20">
          
          {/* Wallet Balance Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-5 shadow-lg relative overflow-hidden flex flex-col"
            style={{ backgroundColor: '#16a34a' }}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-white/90 font-extrabold text-sm mb-1">Wallet Balance</h3>
                <p className="text-3xl font-black text-white">₹{walletBalance.toLocaleString('en-IN')}</p>
              </div>
              <button 
                onClick={() => navigate('/wallet')}
                className="bg-white text-green-700 text-xs font-black py-2 px-4 rounded-full shadow-sm hover:scale-105 transition-transform"
              >
                Withdraw
              </button>
            </div>
            
            <div className="flex items-center justify-between border-t border-white/20 pt-4 mt-2">
              <div>
                <p className="text-[10px] text-white/70 font-semibold mb-0.5">Total Earnings</p>
                <p className="text-sm font-black text-white">₹{totalEarnings.toLocaleString('en-IN')}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/70 font-semibold mb-0.5">Jobs Completed</p>
                <p className="text-sm font-black text-white">{workerCompletedJobs}</p>
              </div>
            </div>
          </motion.div>

          {/* Available Jobs List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Available Jobs</h2>
              <button onClick={() => navigate('/jobs')} className="text-xs font-extrabold text-green-600">View All</button>
            </div>

            <div className="flex flex-col gap-3">
              {jobs.length === 0 ? (
                <div className="bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-600 rounded-2xl p-6 text-center">
                  <p className="text-sm font-semibold text-slate-500 mb-1">No active jobs posted yet</p>
                  <p className="text-xs text-slate-400">New gigs will appear here as soon as employers post them.</p>
                </div>
              ) : (
                jobs.slice(0, 5).map((job, idx) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-600 rounded-2xl p-4 flex items-center gap-4 shadow-sm cursor-pointer hover:border-green-500/30 transition-all"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-dark-700 flex items-center justify-center text-xl flex-shrink-0">
                      {job.categoryEmoji || '💼'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-0.5 truncate">{job.title}</h4>
                      <p className="text-[10px] font-semibold text-slate-500 mb-0.5">{job.date} • {formatTime12Hour(job.reportingTime)}</p>
                      <p className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 truncate">
                        📍 {job.location}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-black text-green-600">
                        ₹{job.payPerWorker}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Floating CTA */}
          <div className="lg:hidden fixed bottom-24 left-0 right-0 px-5 z-40 max-w-lg mx-auto">
            <button 
              onClick={() => navigate('/jobs')}
              className="w-full py-4 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(22,163,74,0.35)] active:scale-[0.98] transition-all"
              style={{ backgroundColor: '#16a34a' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              Find More Jobs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
