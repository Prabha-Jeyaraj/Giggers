import { create } from 'zustand';
import type { ChatThread, ChatMessage, GroupChatMessage } from '../types';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuthStore } from './authStore';

interface ChatState {
  threads: ChatThread[];
  activeThread: ChatThread | null;
  messages: ChatMessage[];
  groupMessages: GroupChatMessage[];
  isLoading: boolean;
  fetchThreads: (userId: string) => Promise<void>;
  openThread: (thread: ChatThread) => Promise<void>;
  loadThreadById: (threadId: string, currentUserId: string) => Promise<ChatThread | null>;
  getOrCreateThread: (jobId: string, workerId: string, employerId: string) => Promise<string | null>;
  sendMessage: (threadId: string, senderId: string, text: string) => Promise<void>;
  subscribeToThread: (threadId: string) => () => void;
  refetchMessagesSilently: (threadId: string) => Promise<void>;
  markThreadRead: (threadId: string, userId?: string) => void;
  appendMessage: (message: ChatMessage) => void;
  fetchGroupMessages: (jobId: string) => Promise<void>;
  refetchGroupMessagesSilently: (jobId: string) => Promise<void>;
  sendGroupMessage: (jobId: string, senderId: string, text: string, type?: 'text' | 'image' | 'file') => Promise<void>;
  subscribeToGroupChat: (jobId: string) => () => void;
  closeGroupChat: (jobId: string) => Promise<void>;
}

export function mapMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: row.id as string,
    threadId: row.thread_id as string,
    senderId: row.sender_id as string,
    text: (row.content as string) || (row.text as string) || '',
    type: (row.type as ChatMessage['type']) || 'text',
    sentAt: (row.created_at as string) || (row.sent_at as string) || new Date().toISOString(),
    isRead: Boolean(row.is_read) || Boolean(row.read_at),
    duration: row.video_duration_seconds as number | undefined,
    jobTaskId: row.job_task_id as string | undefined,
    deliveredAt: row.delivered_at as string | undefined,
    readAt: row.read_at as string | undefined,
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  threads: [],
  activeThread: null,
  messages: [],
  groupMessages: [],
  isLoading: false,

  fetchThreads: async (userId: string) => {
    set({ isLoading: true });

    // 1. Try backend endpoint (service role bypasses RLS and handles joins smoothly)
    try {
      const res = await api.get<{ threads: ChatThread[] }>('/api/chat/threads');
      if (res?.threads) {
        set({ threads: res.threads, isLoading: false });
        return;
      }
    } catch (backendErr) {
      console.warn('[Chat] Backend fetchThreads fallback to Supabase:', backendErr);
    }

    let { data: threadsData, error } = await supabase
      .from('chat_threads')
      .select(`
        *,
        jobs!chat_threads_job_id_fkey(title),
        employer_profile:profiles!chat_threads_employer_id_fkey(name, avatar),
        worker_profile:profiles!chat_threads_worker_id_fkey(name, avatar)
      `)
      .or(`employer_id.eq.${userId},worker_id.eq.${userId}`);

    if (error || !threadsData) {
      const { data: rawThreads } = await supabase
        .from('chat_threads')
        .select('*')
        .or(`employer_id.eq.${userId},worker_id.eq.${userId}`);
      threadsData = rawThreads || [];
    }

    const enrichedThreads: ChatThread[] = (threadsData && threadsData.length > 0)
      ? (
        await Promise.all(
          threadsData.map(async (row) => {
            const isEmployer = row.employer_id === userId;
            const otherPartyId = isEmployer ? (row.worker_id as string) : (row.employer_id as string);

            let jobTitle = (row.jobs as { title?: string } | null)?.title || (row.job_title as string) || '';
            let otherName = isEmployer
              ? (row.worker_profile as { name?: string } | null)?.name
              : (row.employer_profile as { name?: string } | null)?.name;
            let otherAvatar = isEmployer
              ? (row.worker_profile as { avatar?: string } | null)?.avatar
              : (row.employer_profile as { avatar?: string } | null)?.avatar;

            if (!jobTitle && row.job_id) {
              const { data: jobData } = await supabase.from('jobs').select('title').eq('id', row.job_id).maybeSingle();
              if (jobData?.title) jobTitle = jobData.title;
            }

            if ((!otherName || otherName === 'User') && otherPartyId) {
              const { data: profData } = await supabase.from('profiles').select('id, name, first_name, last_name, avatar, profile_photo, selfie_url').eq('id', otherPartyId).maybeSingle();
              if (profData) {
                otherName = profData.name || `${profData.first_name || ''} ${profData.last_name || ''}`.trim() || 'User';
                otherAvatar = profData.avatar || profData.profile_photo || profData.selfie_url;
              }
            }

            const { data: lastMsgRows } = await supabase
              .from('chat_messages')
              .select('*')
              .eq('thread_id', row.id)
              .order('created_at', { ascending: false })
              .limit(1);

            const lastMsgObj = lastMsgRows?.[0];
            let lastMsgText = lastMsgObj?.content || lastMsgObj?.text || (row.last_message as string) || '';
            if (!lastMsgText && lastMsgObj) {
              if (lastMsgObj.type === 'image') lastMsgText = '📷 Photo';
              else if (lastMsgObj.type === 'video') lastMsgText = '🎥 Video';
              else if (lastMsgObj.type === 'audio') lastMsgText = '🎵 Audio';
            }
            if (!lastMsgText) lastMsgText = 'Tap to start conversation';
            const lastMsgTime = lastMsgObj?.created_at || lastMsgObj?.sent_at || (row.last_message_at as string) || (row.created_at as string) || new Date().toISOString();

            let dbLastRead = isEmployer ? row.employer_last_read_at : row.worker_last_read_at;
            if (!dbLastRead) {
              try {
                dbLastRead = localStorage.getItem(`private_last_read_${userId}_${row.id}`) || null;
              } catch {}
            }

            let unreadCount = 0;
            if (dbLastRead) {
              const { count } = await supabase
                .from('chat_messages')
                .select('*', { count: 'exact', head: true })
                .eq('thread_id', row.id)
                .neq('sender_id', userId)
                .gt('created_at', dbLastRead);
              unreadCount = count || 0;
            } else {
              const { count } = await supabase
                .from('chat_messages')
                .select('*', { count: 'exact', head: true })
                .eq('thread_id', row.id)
                .neq('sender_id', userId)
                .or('is_read.eq.false,is_read.is.null');
              unreadCount = count || 0;
            }

            if (!lastMsgText || lastMsgText === 'No messages yet') {
              lastMsgText = unreadCount > 0 ? `${unreadCount} new message${unreadCount > 1 ? 's' : ''}` : 'Tap to start conversation';
            }

            // Mark unread messages delivered for recipient
            if (unreadCount > 0) {
              try {
                await supabase
                  .from('chat_messages')
                  .update({ delivered_at: new Date().toISOString() })
                  .eq('thread_id', row.id)
                  .neq('sender_id', userId)
                  .is('delivered_at', null);
              } catch {}
            }

            return {
              id: row.id as string,
              jobId: row.job_id as string,
              jobTitle: jobTitle || 'Job Listing',
              employerId: row.employer_id as string,
              workerId: row.worker_id as string,
              otherPartyId,
              otherPartyName: otherName || 'User',
              otherPartyAvatar: otherAvatar,
              lastMessage: lastMsgText,
              lastMessageAt: lastMsgTime,
              unreadCount,
              employerLastReadAt: row.employer_last_read_at as string | undefined,
              workerLastReadAt: row.worker_last_read_at as string | undefined,
            };
          })
        )
      ).filter(Boolean) as ChatThread[]
      : [];

    const { data: employerJobs } = await supabase
      .from('jobs')
      .select('id, title, employer_id, is_group_closed, group_closed_at, created_at, category_emoji')
      .eq('employer_id', userId);

    const { data: workerApps } = await supabase
      .from('applications')
      .select('job_id')
      .eq('worker_id', userId)
      .in('status', ['hired', 'confirmed', 'completed']);

    let workerJobs: any[] = [];
    if (workerApps && workerApps.length > 0) {
      const jobIds = workerApps.map((a: any) => a.job_id).filter(Boolean);
      if (jobIds.length > 0) {
        const { data: fetchedJobs } = await supabase
          .from('jobs')
          .select('id, title, employer_id, is_group_closed, group_closed_at, created_at, category_emoji')
          .in('id', jobIds);
        workerJobs = fetchedJobs || [];
      }
    }

    const groupJobs = [...(employerJobs || []), ...workerJobs];
    const uniqueGroupJobs = Array.from(new Map(groupJobs.map(j => [j.id, j])).values());

    let groupThreads: ChatThread[] = [];
    if (uniqueGroupJobs.length > 0) {
      const jobIds = uniqueGroupJobs.map(j => j.id);

      const { data: groupMsgs } = await supabase
        .from('job_group_messages')
        .select('job_id, content, type, created_at, sender_id')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false });

      const latestMsgMap = new Map<string, any>();
      if (groupMsgs) {
        for (const m of groupMsgs) {
          if (!latestMsgMap.has(m.job_id)) {
            latestMsgMap.set(m.job_id, m);
          }
        }
      }

      groupThreads = uniqueGroupJobs.map(job => {
        const lastMsg = latestMsgMap.get(job.id);
        const lastMsgTime = lastMsg?.created_at || job.created_at || new Date().toISOString();

        let lastRead = null;
        try {
          lastRead = localStorage.getItem(`group_last_read_${userId}_${job.id}`);
        } catch {}

        let unreadCount = 0;
        if (lastMsg && lastMsg.sender_id !== userId) {
          if (!lastRead || new Date(lastMsgTime).getTime() > new Date(lastRead).getTime()) {
            unreadCount = 1;
          }
        }

        return {
          id: job.id,
          jobId: job.id,
          jobTitle: job.title,
          employerId: job.employer_id,
          workerId: '',
          otherPartyId: '',
          otherPartyName: `Team: ${job.title}`,
          otherPartyAvatar: job.category_emoji || '👥',
          lastMessage: lastMsg ? (lastMsg.type === 'image' ? '📷 Photo' : lastMsg.content) : 'No group messages yet',
          lastMessageAt: lastMsgTime,
          unreadCount,
          isGroup: true,
          isClosed: Boolean(job.is_group_closed)
        };
      });

      try {
        const deletedGroupIds: string[] = JSON.parse(localStorage.getItem(`deleted_group_chats_${userId}`) || '[]');
        if (deletedGroupIds.length > 0) {
          groupThreads = groupThreads.filter(gt => !deletedGroupIds.includes(gt.jobId));
        }
      } catch {}
    }

    let filteredPrivateThreads = enrichedThreads;
    try {
      const deletedPrivateIds: string[] = JSON.parse(localStorage.getItem(`deleted_private_chats_${userId}`) || '[]');
      if (deletedPrivateIds.length > 0) {
        filteredPrivateThreads = enrichedThreads.filter(t => !deletedPrivateIds.includes(t.id));
      }
    } catch {}

    const allThreads = [...filteredPrivateThreads, ...groupThreads];
    allThreads.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    set({ threads: allThreads, isLoading: false });
  },

  getOrCreateThread: async (jobId: string, workerId: string, employerId?: string) => {
    // 1. Try backend endpoint first (uses service role, no RLS issue)
    try {
      const res = await api.post<{ threadId: string }>('/api/chat/threads', {
        jobId,
        workerId,
        employerId,
      });
      if (res?.threadId) return res.threadId;
    } catch (backendErr) {
      console.warn('[Chat] Backend getOrCreateThread fallback to Supabase:', backendErr);
    }

    // 2. Direct Supabase fallback
    let effectiveEmployerId = employerId;
    if (!effectiveEmployerId) {
      const { data: job } = await supabase.from('jobs').select('employer_id').eq('id', jobId).maybeSingle();
      effectiveEmployerId = job?.employer_id;
    }

    const { data: existing } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_id', workerId)
      .maybeSingle();

    if (existing?.id) return existing.id;

    if (!effectiveEmployerId) return null;

    const { data: newThread, error } = await supabase
      .from('chat_threads')
      .insert({ job_id: jobId, worker_id: workerId, employer_id: effectiveEmployerId })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating chat thread:', error);
      return null;
    }
    return newThread.id;
  },

  loadThreadById: async (threadId: string, currentUserId: string) => {
    set({ isLoading: true });

    // 1. Try backend endpoint first (service role bypasses RLS and handles job_id fallback)
    try {
      const res = await api.get<{ thread: ChatThread; messages: any[] }>(`/api/chat/threads/${threadId}`);
      if (res?.thread) {
        const mappedMessages = (res.messages || []).map((m) => mapMessage(m as Record<string, unknown>));
        set({ activeThread: res.thread, messages: mappedMessages, isLoading: false });
        get().markThreadRead(res.thread.id, currentUserId);
        return res.thread;
      }
    } catch (backendErr) {
      console.warn('[Chat] Backend loadThreadById fallback to Supabase:', backendErr);
    }

    // 2. Direct Supabase fallback
    const { data: row, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('id', threadId)
      .maybeSingle();

    if (error || !row) {
      set({ isLoading: false, activeThread: null });
      return null;
    }

    const isEmployer = row.employer_id === currentUserId;
    const otherPartyId = isEmployer ? (row.worker_id as string) : (row.employer_id as string);

    let jobTitle = (row.job_title as string) || '';
    if (row.job_id) {
      const { data: j } = await supabase.from('jobs').select('title').eq('id', row.job_id).maybeSingle();
      if (j?.title) jobTitle = j.title;
    }

    let otherName = 'User';
    let otherAvatar: string | undefined = undefined;
    if (otherPartyId) {
      const { data: p } = await supabase.from('profiles').select('id, name, first_name, last_name, avatar, profile_photo, selfie_url').eq('id', otherPartyId).maybeSingle();
      if (p) {
        otherName = p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'User';
        otherAvatar = p.avatar || p.profile_photo || p.selfie_url;
      }
    }

    const { data: lastMsgData } = await supabase
      .from('chat_messages')
      .select('content, text, created_at, sent_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const activeThread: ChatThread = {
      id: row.id as string,
      jobId: row.job_id as string,
      jobTitle: jobTitle || 'Job Listing',
      employerId: row.employer_id as string,
      workerId: row.worker_id as string,
      otherPartyId,
      otherPartyName: otherName,
      otherPartyAvatar: otherAvatar,
      lastMessage: lastMsgData?.content || lastMsgData?.text || (row.last_message as string) || '',
      lastMessageAt: lastMsgData?.created_at || lastMsgData?.sent_at || (row.created_at as string) || new Date().toISOString(),
      unreadCount: 0,
    };

    const { data: msgData } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    const now = new Date().toISOString();
    const messages = (msgData || []).map((m) => {
      const msg = mapMessage(m as Record<string, unknown>);
      if (msg.senderId !== currentUserId) {
        if (!msg.deliveredAt) msg.deliveredAt = now;
        msg.isRead = true;
        msg.readAt = now;
      }
      return msg;
    });

    try {
      await supabase
        .from('chat_messages')
        .update({ delivered_at: now, read_at: now, is_read: true })
        .eq('thread_id', threadId)
        .neq('sender_id', currentUserId);

      const colName = isEmployer ? 'employer_last_read_at' : 'worker_last_read_at';
      await supabase.from('chat_threads').update({ [colName]: now }).eq('id', threadId);
    } catch {}

    try {
      localStorage.setItem(`private_last_read_${currentUserId}_${threadId}`, now);
    } catch {}

    set({ activeThread, messages, isLoading: false });
    get().markThreadRead(threadId, currentUserId);
    return activeThread;
  },

  openThread: async (thread: ChatThread) => {
    set({ activeThread: thread, isLoading: true, messages: [] });

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true });

    const now = new Date().toISOString();
    const currentUserId = useAuthStore.getState().user?.id;

    if (currentUserId) {
      try {
        // Mark messages from other user as delivered & read in DB
        await supabase
          .from('chat_messages')
          .update({ delivered_at: now, read_at: now, is_read: true })
          .eq('thread_id', thread.id)
          .neq('sender_id', currentUserId);

        const isEmployer = useAuthStore.getState().user?.role === 'employer';
        const colName = isEmployer ? 'employer_last_read_at' : 'worker_last_read_at';
        await supabase.from('chat_threads').update({ [colName]: now }).eq('id', thread.id);
        localStorage.setItem(`private_last_read_${currentUserId}_${thread.id}`, now);
      } catch {}
    }

    if (!error && data) {
      const messages = await Promise.all(
        data.map(async (row) => {
          const msg = mapMessage(row as unknown as Record<string, unknown>);
          if (msg.type === 'video') {
            try {
              const res = await api.get<{ videoUrl?: string }>(`/api/recordings/${msg.id}/url`);
              msg.videoUrl = res.videoUrl;
            } catch {}
          }
          return msg;
        })
      );
      set({ messages });
    }
    set({ isLoading: false });
  },

  sendMessage: async (threadId: string, senderId: string, text: string) => {
    const newMsgId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newMsg: ChatMessage = {
      id: newMsgId,
      threadId,
      senderId,
      text,
      type: 'text',
      sentAt: now,
      isRead: false,
    };

    set((s) => ({
      messages: s.messages.some((m) => m.id === newMsgId) ? s.messages : [...s.messages, newMsg],
      threads: s.threads.map((t) =>
        t.id === threadId ? { ...t, lastMessage: text, lastMessageAt: now } : t
      ),
    }));

    // 1. Try backend API (service role bypasses RLS)
    try {
      await api.post('/api/chat/messages', {
        threadId,
        content: text,
        type: 'text',
      });
      return;
    } catch (backendErr) {
      console.warn('[Chat] Backend sendMessage fallback to Supabase:', backendErr);
    }

    // 2. Fallback to direct Supabase
    const { error: insertErr } = await supabase.from('chat_messages').insert({
      id: newMsgId,
      thread_id: threadId,
      sender_id: senderId,
      content: text,
      type: 'text',
      created_at: now,
    });

    if (insertErr) {
      console.error('[Chat] Failed to insert message into Supabase:', insertErr);
    }

    try {
      await supabase
        .from('chat_threads')
        .update({ last_message: text, last_message_at: now })
        .eq('id', threadId);
    } catch {}
  },

  refetchMessagesSilently: async (threadId: string) => {
    try {
      const res = await api.get<{ thread: ChatThread; messages: any[] }>(`/api/chat/threads/${threadId}`);
      if (res?.messages) {
        const mapped = res.messages.map((r) => mapMessage(r as Record<string, unknown>));
        const current = get().messages;
        if (
          mapped.length !== current.length ||
          mapped.some((m, i) => m.id !== current[i]?.id || m.isRead !== current[i]?.isRead || m.deliveredAt !== current[i]?.deliveredAt)
        ) {
          set({ messages: mapped });
        }
        return;
      }
    } catch {}

    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (data) {
        const mapped = data.map((r) => mapMessage(r as Record<string, unknown>));
        const current = get().messages;
        if (
          mapped.length !== current.length ||
          mapped.some((m, i) => m.id !== current[i]?.id || m.isRead !== current[i]?.isRead || m.deliveredAt !== current[i]?.deliveredAt)
        ) {
          set({ messages: mapped });
        }
      }
    } catch {}
  },

  subscribeToThread: (threadId: string) => {
    const channelName = `chat-thread-${threadId}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
        },
        async (payload) => {
          const row = (payload.new || payload.old) as Record<string, any> | undefined;
          if (!row || row.thread_id !== threadId) return;

          const currentUserId = useAuthStore.getState().user?.id;
          if (payload.eventType === 'INSERT') {
            const msg = mapMessage(payload.new as Record<string, unknown>);
            const { messages } = get();

            // If message is from other user, mark delivered (and read if active thread)
            if (currentUserId && msg.senderId !== currentUserId) {
              const now = new Date().toISOString();
              const isViewing = get().activeThread?.id === threadId;
              try {
                if (isViewing) {
                  await supabase
                    .from('chat_messages')
                    .update({ delivered_at: now, read_at: now, is_read: true })
                    .eq('id', msg.id);
                  msg.deliveredAt = now;
                  msg.readAt = now;
                  msg.isRead = true;
                } else {
                  await supabase
                    .from('chat_messages')
                    .update({ delivered_at: now })
                    .eq('id', msg.id)
                    .is('delivered_at', null);
                  msg.deliveredAt = now;
                }
              } catch {}
            }

            if (!messages.find((m) => m.id === msg.id)) {
              if (msg.type === 'video') {
                try {
                  const res = await api.get<{ videoUrl?: string }>(`/api/recordings/${msg.id}/url`);
                  msg.videoUrl = res.videoUrl;
                } catch {}
              }
              set({ messages: [...get().messages, msg] });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = mapMessage(payload.new as Record<string, unknown>);
            set((s) => ({
              messages: s.messages.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
            }));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Immediately fetch any missed messages
          get().refetchMessagesSilently(threadId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  },

  markThreadRead: (threadId: string, userId?: string) => {
    const now = new Date().toISOString();
    set((s) => ({
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, unreadCount: 0 } : t)),
    }));

    if (userId) {
      try {
        localStorage.setItem(`private_last_read_${userId}_${threadId}`, now);
        localStorage.setItem(`group_last_read_${userId}_${threadId}`, now);
      } catch {}

      (async () => {
        try {
          const { data: thread } = await supabase.from('chat_threads').select('employer_id').eq('id', threadId).maybeSingle();
          if (thread) {
            const isEmployer = thread.employer_id === userId;
            const colName = isEmployer ? 'employer_last_read_at' : 'worker_last_read_at';
            await supabase.from('chat_threads').update({ [colName]: now }).eq('id', threadId);
            await supabase.from('chat_messages').update({ is_read: true, read_at: now, delivered_at: now }).eq('thread_id', threadId).neq('sender_id', userId);
          }
        } catch {}
      })();
    }
  },

  appendMessage: (message: ChatMessage) => {
    set((s) => (s.messages.find((m) => m.id === message.id) ? s : { messages: [...s.messages, message] }));
  },

  fetchGroupMessages: async (jobId: string) => {
    set({ isLoading: true });
    try {
      const res = await api.get<{ messages: any[] }>(`/api/chat/group-messages/${jobId}`);
      if (res?.messages) {
        set({ groupMessages: res.messages as unknown as GroupChatMessage[], isLoading: false });
        return;
      }
    } catch {}

    const { data, error } = await supabase
      .from('job_group_messages')
      .select('*, profiles:sender_id(name, avatar)')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const mapped = data.map((row: any) => ({
        id: row.id,
        jobId: row.job_id,
        senderId: row.sender_id,
        type: row.type || 'text',
        content: row.content || '',
        createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        profiles: row.profiles || { name: 'User', avatar: '' }
      }));
      set({ groupMessages: mapped as unknown as GroupChatMessage[] });
    } else {
      set({ groupMessages: [] });
    }
    set({ isLoading: false });
  },

  sendGroupMessage: async (jobId: string, senderId: string, text: string, type: 'text' | 'image' | 'file' = 'text') => {
    const newMsgId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar')
      .eq('id', senderId)
      .maybeSingle();

    const newMsg: GroupChatMessage = {
      id: newMsgId,
      jobId,
      senderId,
      type,
      content: text,
      createdAt: now,
      profiles: profile || { name: 'User', avatar: '' }
    };

    // Optimistically update groupMessages
    set((s) => ({
      groupMessages: s.groupMessages.some((m) => m.id === newMsgId) ? s.groupMessages : [...s.groupMessages, newMsg],
      threads: s.threads.map((t) =>
        t.isGroup && t.jobId === jobId ? { ...t, lastMessage: type === 'image' ? '📷 Photo' : text, lastMessageAt: now } : t
      ),
    }));

    // 1. Try backend API (service role bypasses RLS)
    try {
      await api.post('/api/chat/group-messages', {
        jobId,
        content: text,
        type,
      });
      return;
    } catch (backendErr) {
      console.warn('[GroupChat] Backend sendGroupMessage fallback to Supabase:', backendErr);
    }

    // 2. Direct Supabase fallback
    const { error: groupInsertErr } = await supabase.from('job_group_messages').insert({
      id: newMsgId,
      job_id: jobId,
      sender_id: senderId,
      type,
      content: text,
      created_at: now,
    });

    if (groupInsertErr) {
      console.error('[GroupChat] Failed to insert group message into Supabase:', groupInsertErr);
    }
  },

  refetchGroupMessagesSilently: async (jobId: string) => {
    try {
      const res = await api.get<{ messages: any[] }>(`/api/chat/group-messages/${jobId}`);
      if (res?.messages) {
        const current = get().groupMessages;
        if (
          res.messages.length !== current.length ||
          res.messages.some((m: any, i: number) => m.id !== current[i]?.id)
        ) {
          set({ groupMessages: res.messages as unknown as GroupChatMessage[] });
        }
        return;
      }
    } catch {}

    try {
      const { data } = await supabase
        .from('job_group_messages')
        .select('*, profiles:sender_id(name, avatar)')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      if (data) {
        const mapped = data.map((row: any) => ({
          id: row.id,
          jobId: row.job_id,
          senderId: row.sender_id,
          type: row.type || 'text',
          content: row.content || '',
          createdAt: row.created_at || row.createdAt || new Date().toISOString(),
          profiles: row.profiles || { name: 'User', avatar: '' },
        }));
        const current = get().groupMessages;
        if (
          mapped.length !== current.length ||
          mapped.some((m, i) => m.id !== current[i]?.id)
        ) {
          set({ groupMessages: mapped as unknown as GroupChatMessage[] });
        }
      }
    } catch {}
  },

  subscribeToGroupChat: (jobId: string) => {
    const channelName = `group-chat-${jobId}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_group_messages',
        },
        async (payload) => {
          const newMsg = (payload.new || payload.old) as any;
          if (!newMsg || newMsg.job_id !== jobId) return;

          const { groupMessages } = get();
          if (!groupMessages.find((m) => m.id === newMsg.id)) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, avatar')
              .eq('id', newMsg.sender_id)
              .maybeSingle();

            const enrichedMsg: GroupChatMessage = {
              id: newMsg.id,
              jobId: newMsg.job_id,
              senderId: newMsg.sender_id,
              type: newMsg.type,
              content: newMsg.content,
              createdAt: newMsg.created_at,
              profiles: profile || { name: 'User', avatar: '' }
            };

            set((s) => ({
              groupMessages: [...s.groupMessages, enrichedMsg],
              threads: s.threads.map((t) =>
                t.isGroup && t.jobId === jobId ? { ...t, lastMessage: newMsg.type === 'image' ? '📷 Photo' : newMsg.content, lastMessageAt: newMsg.created_at } : t
              ),
            }));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          get().refetchGroupMessagesSilently(jobId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  },

  closeGroupChat: async (jobId: string) => {
    const now = new Date().toISOString();
    await supabase
      .from('jobs')
      .update({ is_group_closed: true, group_closed_at: now })
      .eq('id', jobId);

    // Update locally
    set((s) => ({
      threads: s.threads.map((t) =>
        t.isGroup && t.jobId === jobId ? { ...t, isClosed: true } : t
      ),
    }));
  },
}));

