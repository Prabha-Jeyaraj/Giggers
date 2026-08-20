import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { uploadDataUrlToStorage } from '../utils/storage';
import { supabase } from '../utils/supabase';
import { z } from 'zod';

const BUCKET = 'group-chat-attachments';

export async function uploadChatImage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { image } = req.body;
    if (!image) {
      res.status(400).json({ error: 'No image data provided' });
      return;
    }

    // Upload base64 image to public storage bucket
    const path = await uploadDataUrlToStorage(BUCKET, image, req.user!.id, 'chat-image');
    
    // Construct the public URL of the uploaded image
    const supabaseUrl = process.env.SUPABASE_URL;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;

    res.json({ imageUrl: publicUrl });
  } catch (error: any) {
    console.error('Error uploading chat image:', error);
    res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
}

// GET /api/chat/threads/:threadId
export async function getThreadDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { threadId } = req.params;
  const currentUserId = req.user!.id;

  try {
    // 1. Find thread by id or job_id fallback
    let { data: thread } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('id', threadId)
      .maybeSingle();

    if (!thread) {
      // Fallback: maybe threadId was a jobId
      const { data: threadByJob } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('job_id', threadId)
        .or(`worker_id.eq.${currentUserId},employer_id.eq.${currentUserId}`)
        .maybeSingle();
      if (threadByJob) {
        thread = threadByJob;
      }
    }

    if (!thread) {
      res.status(404).json({ error: 'Chat thread not found' });
      return;
    }

    const isEmployer = thread.employer_id === currentUserId;
    const otherPartyId = isEmployer ? thread.worker_id : thread.employer_id;

    let jobTitle = 'Job Listing';
    if (thread.job_id) {
      const { data: job } = await supabase.from('jobs').select('title').eq('id', thread.job_id).maybeSingle();
      if (job?.title) jobTitle = job.title;
    }

    let otherName = 'User';
    let otherAvatar: string | undefined = undefined;
    if (otherPartyId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, first_name, last_name, avatar, profile_photo, selfie_url')
        .eq('id', otherPartyId)
        .maybeSingle();
      if (profile) {
        otherName = profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User';
        otherAvatar = profile.avatar || profile.profile_photo || profile.selfie_url;
      }
    }

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true });

    res.json({
      thread: {
        id: thread.id,
        jobId: thread.job_id,
        jobTitle,
        employerId: thread.employer_id,
        workerId: thread.worker_id,
        otherPartyId,
        otherPartyName: otherName,
        otherPartyAvatar: otherAvatar,
        lastMessage: thread.last_message || '',
        lastMessageAt: thread.last_message_at || thread.created_at,
        unreadCount: 0,
      },
      messages: messages || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get thread details' });
  }
}

// POST /api/chat/threads
export async function getOrCreateThread(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parsed = z.object({
    jobId: z.string().min(1),
    workerId: z.string().min(1),
    employerId: z.string().optional().nullable(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { jobId, workerId } = parsed.data;
  let employerId = parsed.data.employerId?.trim() || undefined;

  if (!employerId) {
    const { data: job } = await supabase.from('jobs').select('employer_id').eq('id', jobId).maybeSingle();
    if (!job?.employer_id) {
      res.status(404).json({ error: 'Job or employer not found' });
      return;
    }
    employerId = job.employer_id;
  }

  try {
    const { data: existing } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_id', workerId)
      .maybeSingle();

    if (existing?.id) {
      res.json({ threadId: existing.id });
      return;
    }

    const { data: newThread, error } = await supabase
      .from('chat_threads')
      .insert({ job_id: jobId, worker_id: workerId, employer_id: employerId })
      .select('id')
      .single();

    if (error) {
      console.error('[Chat Backend] Error creating chat thread:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ threadId: newThread.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create chat thread' });
  }
}

// POST /api/chat/messages
export async function sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parsed = z.object({
    threadId: z.string().uuid(),
    content: z.string().min(1),
    type: z.enum(['text', 'image', 'video', 'system']).default('text'),
    duration: z.number().optional(),
    jobTaskId: z.string().uuid().optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { threadId, content, type, duration, jobTaskId } = parsed.data;
  const senderId = req.user!.id;
  const now = new Date().toISOString();

  try {
    const { data: newMsg, error: insertErr } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        sender_id: senderId,
        content,
        type,
        video_duration_seconds: duration,
        job_task_id: jobTaskId,
        created_at: now,
      })
      .select('*')
      .single();

    if (insertErr) {
      console.error('[Chat Backend] Failed to insert chat message:', insertErr);
      res.status(500).json({ error: insertErr.message });
      return;
    }

    await supabase
      .from('chat_threads')
      .update({ last_message: content, last_message_at: now })
      .eq('id', threadId);

    res.json({ message: newMsg });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send message' });
  }
}

// POST /api/chat/group-messages
export async function sendGroupMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parsed = z.object({
    jobId: z.string().uuid(),
    content: z.string().min(1),
    type: z.enum(['text', 'image', 'file']).default('text'),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { jobId, content, type } = parsed.data;
  const senderId = req.user!.id;
  const now = new Date().toISOString();

  try {
    const { data: newMsg, error: insertErr } = await supabase
      .from('job_group_messages')
      .insert({
        job_id: jobId,
        sender_id: senderId,
        content,
        type,
        created_at: now,
      })
      .select('*')
      .single();

    if (insertErr) {
      console.error('[Chat Backend] Failed to insert group message:', insertErr);
      res.status(500).json({ error: insertErr.message });
      return;
    }

    res.json({ message: newMsg });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send group message' });
  }
}

// GET /api/chat/threads
export async function listUserThreads(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user!.id;

  try {
    const { data: rawThreads } = await supabase
      .from('chat_threads')
      .select('*')
      .or(`employer_id.eq.${userId},worker_id.eq.${userId}`);

    const threadsData = rawThreads || [];

    const enrichedThreads = await Promise.all(
      threadsData.map(async (row) => {
        const isEmployer = row.employer_id === userId;
        const otherPartyId = isEmployer ? row.worker_id : row.employer_id;

        let jobTitle = row.job_title || 'Job Listing';
        if (row.job_id) {
          const { data: jobData } = await supabase.from('jobs').select('title').eq('id', row.job_id).maybeSingle();
          if (jobData?.title) jobTitle = jobData.title;
        }

        let otherName = 'User';
        let otherAvatar: string | undefined = undefined;
        if (otherPartyId) {
          const { data: profData } = await supabase
            .from('profiles')
            .select('id, name, first_name, last_name, avatar, profile_photo, selfie_url')
            .eq('id', otherPartyId)
            .maybeSingle();
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
        let lastMsgText = lastMsgObj?.content || lastMsgObj?.text || row.last_message || 'Tap to start conversation';
        const lastMsgTime = lastMsgObj?.created_at || row.last_message_at || row.created_at || new Date().toISOString();

        return {
          id: row.id,
          jobId: row.job_id,
          jobTitle,
          employerId: row.employer_id,
          workerId: row.worker_id,
          otherPartyId,
          otherPartyName: otherName,
          otherPartyAvatar: otherAvatar,
          lastMessage: lastMsgText,
          lastMessageAt: lastMsgTime,
          unreadCount: 0,
        };
      })
    );

    // Group chats: Jobs where user is employer OR has applications
    const { data: employerJobs } = await supabase
      .from('jobs')
      .select('id, title, employer_id, is_group_closed, group_closed_at, created_at, category_emoji')
      .eq('employer_id', userId);

    const { data: workerApps } = await supabase
      .from('applications')
      .select('job_id')
      .eq('worker_id', userId);

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

    let groupThreads: any[] = [];
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
          unreadCount: 0,
          isGroup: true,
          isClosed: Boolean(job.is_group_closed)
        };
      });
    }

    const allThreads = [...enrichedThreads, ...groupThreads];
    allThreads.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    res.json({ threads: allThreads });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list threads' });
  }
}

// GET /api/chat/group-messages/:jobId
export async function listGroupMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { jobId } = req.params;
  try {
    const { data: msgs, error } = await supabase
      .from('job_group_messages')
      .select('*, profiles:sender_id(name, avatar)')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const mapped = (msgs || []).map((row: any) => ({
      id: row.id,
      jobId: row.job_id,
      senderId: row.sender_id,
      type: row.type || 'text',
      content: row.content || '',
      createdAt: row.created_at || new Date().toISOString(),
      profiles: row.profiles || { name: 'User', avatar: '' }
    }));

    res.json({ messages: mapped });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list group messages' });
  }
}
