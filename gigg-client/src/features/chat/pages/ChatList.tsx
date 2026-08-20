import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppHeader } from '../../../components/layout/Navigation';
import { Avatar, Skeleton, EmptyState } from '../../../components/ui';
import { useChatStore } from '../../../store/chatStore';
import { useAuthStore } from '../../../store/authStore';
import { Briefcase, Search, Users, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';
import { formatTime12h } from '../../../lib/time';

function formatTime(timestamp: string) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return formatTime12h(date);
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatList() {
  const navigate = useNavigate();
  const { threads, fetchThreads, isLoading, markThreadRead } = useChatStore();
  const { user } = useAuthStore();
  const [filterChip, setFilterChip] = useState<'all' | 'unread' | 'groups'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      fetchThreads(user.id);
      const interval = setInterval(() => {
        fetchThreads(user.id);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [fetchThreads, user?.id]);

  if (!user) return null;

  // Filter threads based on chip selection and search query
  let filtered = threads;

  if (filterChip === 'unread') {
    filtered = filtered.filter((t) => t.unreadCount > 0);
  } else if (filterChip === 'groups') {
    filtered = filtered.filter((t) => t.isGroup);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.otherPartyName.toLowerCase().includes(q) ||
        t.jobTitle.toLowerCase().includes(q) ||
        t.lastMessage.toLowerCase().includes(q)
    );
  }

  const unreadTotal = threads.reduce((sum, t) => sum + (t.unreadCount > 0 ? 1 : 0), 0);
  const groupsTotal = threads.filter((t) => t.isGroup).length;

  return (
    <div className="pb-24 bg-slate-50 dark:bg-dark-900 min-h-screen font-sans">
      <AppHeader title="Messages" />

      <div className="px-5 pt-3 flex flex-col gap-3">
        {/* Search Bar */}
        <div className="flex items-center gap-2.5 bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 px-4 py-2.5 rounded-2xl shadow-sm">
          <Search size={18} className="text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats or gigs..."
            className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
          />
        </div>

        {/* WhatsApp Style Filter Chips: All | Unread | Groups */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setFilterChip('all')}
            className={clsx(
              'px-4 py-1.5 text-xs font-extrabold rounded-full transition-all flex items-center gap-1.5 flex-shrink-0',
              filterChip === 'all'
                ? 'bg-primary-600 text-white shadow-sm scale-105'
                : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-dark-700 hover:bg-slate-100'
            )}
          >
            All
            <span className={clsx('text-[10px] px-1.5 py-0.2 rounded-full font-black', filterChip === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-dark-700 text-slate-500')}>
              {threads.length}
            </span>
          </button>

          <button
            onClick={() => setFilterChip('unread')}
            className={clsx(
              'px-4 py-1.5 text-xs font-extrabold rounded-full transition-all flex items-center gap-1.5 flex-shrink-0',
              filterChip === 'unread'
                ? 'bg-primary-600 text-white shadow-sm scale-105'
                : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-dark-700 hover:bg-slate-100'
            )}
          >
            Unread
            {unreadTotal > 0 && (
              <span className={clsx('text-[10px] px-1.5 py-0.2 rounded-full font-black', filterChip === 'unread' ? 'bg-white/20 text-white' : 'bg-emerald-500 text-white')}>
                {unreadTotal}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilterChip('groups')}
            className={clsx(
              'px-4 py-1.5 text-xs font-extrabold rounded-full transition-all flex items-center gap-1.5 flex-shrink-0',
              filterChip === 'groups'
                ? 'bg-primary-600 text-white shadow-sm scale-105'
                : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-dark-700 hover:bg-slate-100'
            )}
          >
            <Users size={12} />
            Groups
            {groupsTotal > 0 && (
              <span className={clsx('text-[10px] px-1.5 py-0.2 rounded-full font-black', filterChip === 'groups' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-dark-700 text-slate-500')}>
                {groupsTotal}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-5 pt-3 flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-4 bg-white dark:bg-dark-800 rounded-2xl border border-slate-100 dark:border-dark-700">
              <Skeleton className="w-12 h-12" rounded="full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))
        ) : filtered.length > 0 ? (
          filtered.map((thread, i) => {
            const isEmployer = thread.employerId === user.id;
            const hasUnread = thread.unreadCount > 0;

            return (
              <motion.div
                key={thread.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => {
                  markThreadRead(thread.id, user.id);
                  navigate(thread.isGroup ? `/group-chat/${thread.jobId}` : `/chat/${thread.id}`);
                }}
                className={clsx(
                  'p-4 rounded-2xl border cursor-pointer flex gap-3.5 items-center shadow-sm transition-all active:scale-[0.99]',
                  hasUnread
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30'
                    : 'bg-white dark:bg-dark-800 border-slate-100 dark:border-dark-700 hover:border-primary-500/40'
                )}
              >
                {thread.isGroup ? (
                  <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-950/40 flex items-center justify-center text-2xl flex-shrink-0 border border-primary-200 dark:border-primary-900/30 shadow-inner">
                    {thread.otherPartyAvatar || '👥'}
                  </div>
                ) : (
                  <Avatar src={thread.otherPartyAvatar} name={thread.otherPartyName} size="md" online />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className={clsx('text-sm truncate flex items-center gap-1.5', hasUnread ? 'font-black text-slate-900 dark:text-white' : 'font-extrabold text-slate-800 dark:text-slate-200')}>
                      {thread.otherPartyName}
                      {thread.isGroup ? (
                        thread.isClosed ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400">
                            Closed
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-primary-50 dark:bg-primary-950/30 text-primary-500 dark:text-primary-400">
                            Team
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-100 dark:bg-dark-700 text-slate-500 dark:text-slate-400">
                          {isEmployer ? 'Worker' : 'Employer'}
                        </span>
                      )}
                    </h3>
                    <span className={clsx('text-[10px] flex-shrink-0 ml-2', hasUnread ? 'font-black text-emerald-600 dark:text-emerald-400' : 'font-bold text-slate-400')}>
                      {formatTime(thread.lastMessageAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-primary-600 dark:text-primary-400 mb-1 truncate">
                    <Briefcase size={12} className="flex-shrink-0" />
                    <span className="truncate">{thread.jobTitle || 'Gig Listing'}</span>
                  </div>

                  <div className="flex justify-between items-center gap-2">
                    <p className={clsx('text-xs truncate', hasUnread ? 'font-extrabold text-slate-900 dark:text-white' : 'font-medium text-slate-500 dark:text-slate-400')}>
                      {thread.lastMessage || 'Tap to view conversation'}
                    </p>
                    {hasUnread && (
                      <span className="min-w-[20px] h-5 px-1.5 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center flex-shrink-0 shadow-sm animate-pulse">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <EmptyState
            emoji="💬"
            title={filterChip === 'unread' ? 'No unread messages' : filterChip === 'groups' ? 'No group chats' : 'No messages found'}
            description="Conversations will appear here when you message employers or join gig teams."
          />
        )}
      </div>
    </div>
  );
}


