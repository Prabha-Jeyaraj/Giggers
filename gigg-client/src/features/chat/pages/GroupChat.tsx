import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image as ImageIcon, CheckCircle, Info, Users, X, Lock, CheckCheck } from 'lucide-react';
import { AppHeader } from '../../../components/layout/Navigation';
import { Avatar, Button, Badge, Modal } from '../../../components/ui';
import { useChatStore } from '../../../store/chatStore';
import { useAuthStore } from '../../../store/authStore';
import { useUIStore } from '../../../store/uiStore';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import { clsx } from 'clsx';

interface GroupMember {
  id: string;
  name: string;
  avatar?: string;
  role: 'employer' | 'worker' | 'admin';
}

const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export default function GroupChat() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  
  const {
    groupMessages,
    fetchGroupMessages,
    refetchGroupMessagesSilently,
    sendGroupMessage,
    subscribeToGroupChat,
    closeGroupChat,
    isLoading
  } = useChatStore();

  const [job, setJob] = useState<any>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeletedLocally, setIsDeletedLocally] = useState(false);

  useEffect(() => {
    if (jobId && user?.id) {
      try {
        localStorage.setItem(`group_last_read_${user.id}_${jobId}`, new Date().toISOString());
      } catch {}
      try {
        const deletedIds: string[] = JSON.parse(localStorage.getItem(`deleted_group_chats_${user.id}`) || '[]');
        if (deletedIds.includes(jobId)) {
          setIsDeletedLocally(true);
        }
      } catch {}
    }
  }, [jobId, user?.id]);

  const handleDeleteChatForMe = () => {
    if (!jobId || !user?.id) return;
    try {
      const key = `deleted_group_chats_${user.id}`;
      const deletedIds: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      if (!deletedIds.includes(jobId)) {
        deletedIds.push(jobId);
        localStorage.setItem(key, JSON.stringify(deletedIds));
      }
      addToast('Group chat deleted from your list', 'info');
      navigate('/chat');
    } catch (err) {
      console.error(err);
      addToast('Failed to delete chat', 'error');
    }
  };

  // Fetch job details and members
  const fetchJobAndMembers = async () => {
    if (!jobId) return;
    try {
      // 1. Fetch Job details
      const { data: jobData } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();

      if (!jobData) {
        addToast('Job not found', 'error');
        navigate('/chat');
        return;
      }
      setJob(jobData);

      // 2. Fetch Employer profile
      const { data: empData } = await supabase
        .from('profiles')
        .select('id, name, avatar')
        .eq('id', jobData.employer_id)
        .maybeSingle();

      // 3. Fetch Hired workers profiles
      const { data: workersData } = await supabase
        .from('applications')
        .select('profiles:worker_id(id, name, avatar)')
        .eq('job_id', jobId)
        .in('status', ['hired', 'confirmed', 'completed']);

      const memberList: GroupMember[] = [];
      if (empData) {
        memberList.push({
          id: empData.id,
          name: empData.name || 'Employer',
          avatar: empData.avatar || undefined,
          role: 'admin' // WhatsApp style Admin
        });
      }

      if (workersData) {
        workersData.forEach((row: any) => {
          const profile = row.profiles;
          if (profile && !memberList.some(m => m.id === profile.id)) {
            memberList.push({
              id: profile.id,
              name: profile.name || 'Worker',
              avatar: profile.avatar || undefined,
              role: 'worker'
            });
          }
        });
      }

      // 4. Fetch System / Platform Admins as default group overseers
      const { data: adminsData } = await supabase
        .from('profiles')
        .select('id, name, avatar')
        .eq('role', 'admin');

      if (adminsData) {
        adminsData.forEach((admin: any) => {
          if (!memberList.some(m => m.id === admin.id)) {
            memberList.push({
              id: admin.id,
              name: admin.name || 'Platform Admin',
              avatar: admin.avatar || undefined,
              role: 'admin' // WhatsApp style Admin
            });
          }
        });
      }

      setMembers(memberList);
    } catch (err) {
      console.error('Error fetching job/members:', err);
    }
  };

  useEffect(() => {
    if (!jobId || !user) return;

    fetchJobAndMembers();
    fetchGroupMessages(jobId);

    // Subscribe to real-time group messages with 2.5s background sync
    const unsubscribe = subscribeToGroupChat(jobId);
    const interval = setInterval(() => {
      refetchGroupMessagesSilently(jobId);
    }, 2500);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [jobId, user?.id, subscribeToGroupChat, refetchGroupMessagesSilently]);

  // Scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages]);

  if (!user || !jobId) return null;

  const isEmployer = job && job.employer_id === user.id;
  const isGroupClosed = job ? Boolean(job.is_group_closed) : false;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending || isGroupClosed) return;

    setSending(true);
    try {
      await sendGroupMessage(jobId, user.id, inputText.trim(), 'text');
      setInputText('');
    } catch (err: any) {
      console.error(err);
      addToast(err?.message || 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleImageClick = () => {
    if (isGroupClosed) return;
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isGroupClosed) return;

    setSending(true);
    try {
      const base64 = await convertToBase64(file);
      const response = await api.post<{ imageUrl: string }>('/api/chat/upload', {
        image: base64
      });

      if (response.imageUrl) {
        await sendGroupMessage(jobId, user.id, response.imageUrl, 'image');
      } else {
        throw new Error('Upload returned empty URL');
      }
    } catch (err: any) {
      console.error('Failed to send image:', err);
      addToast(err?.message || 'Failed to upload image', 'error');
    } finally {
      setSending(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCloseGroup = async () => {
    setIsClosing(true);
    try {
      await closeGroupChat(jobId);
      setJob((prev: any) => prev ? { ...prev, is_group_closed: true, group_closed_at: new Date().toISOString() } : null);
      addToast('Group chat closed. No new messages can be sent.', 'info');
      setShowCloseConfirmModal(false);
    } catch (err) {
      console.error('Error closing group:', err);
      addToast('Failed to close group chat', 'error');
    } finally {
      setIsClosing(false);
    }
  };

  const activeHeaderTitle = (
    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowMembersModal(true)}>
      <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-950/40 flex items-center justify-center text-xl flex-shrink-0 border border-primary-200 dark:border-primary-900/30 shadow-inner">
        {job?.category_emoji || '👥'}
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight flex items-center gap-1">
          {job?.title || 'Team Chat'}
        </h2>
        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
          <Users size={10} /> {members.length} members
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-dark-900 font-sans">
      <AppHeader
        showBack
        onBack={() => navigate(-1)}
        title={activeHeaderTitle as any}
        rightAction={
          (isEmployer || user?.role === 'admin') && !isGroupClosed ? (
            <button
              onClick={() => setShowCloseConfirmModal(true)}
              className="text-xs font-black text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-xl transition-all"
            >
              Close Team
            </button>
          ) : isGroupClosed ? (
            <div className="flex items-center gap-2">
              <Badge variant="danger" className="text-[9px]">Closed</Badge>
              <button
                onClick={() => setShowDeleteConfirmModal(true)}
                className="text-xs font-black text-slate-600 dark:text-slate-300 hover:text-red-500 bg-slate-100 dark:bg-dark-700 px-2.5 py-1 rounded-lg transition-all"
              >
                Delete Chat
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Main message area */}
      <div className="flex-1 overflow-y-auto p-5 pb-safe flex flex-col gap-4">
        {groupMessages.length === 0 && !isLoading && (
          <div className="text-center py-10 flex flex-col items-center justify-center gap-3">
            <span className="text-4xl">💬</span>
            <p className="text-sm text-slate-400 font-medium max-w-xs">
              Welcome to the Group Chat for coordination! Type a message below.
            </p>
          </div>
        )}
        
        {groupMessages.map((msg) => {
          const isMe = msg.senderId === user.id;
          const isMsgSenderEmployer = job && msg.senderId === job.employer_id;
          const senderProfile = msg.profiles;
          const rawTime = msg.createdAt || (msg as any).created_at || (msg as any).sentAt;
          const formattedTime = rawTime && !isNaN(new Date(rawTime).getTime())
            ? new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
          
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              {!isMe && (
                <Avatar
                  src={senderProfile?.avatar}
                  name={senderProfile?.name || 'User'}
                  size="xs"
                />
              )}
              
              <div className="flex flex-col max-w-[70%]">
                {!isMe && (
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 ml-1 flex items-center gap-1.5">
                    {senderProfile?.name || 'User'}
                    {isMsgSenderEmployer && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded font-black bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 uppercase tracking-wide">
                        Employer
                      </span>
                    )}
                  </span>
                )}
                
                <div
                  className={clsx(
                    'px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed shadow-sm',
                    isMe
                      ? 'bg-primary-500 text-white rounded-br-sm shadow-primary-sm'
                      : 'bg-white dark:bg-dark-700 text-slate-800 dark:text-slate-200 rounded-bl-sm border border-slate-100 dark:border-dark-600'
                  )}
                >
                  {msg.type === 'image' ? (
                    <img src={msg.content} alt="Upload" className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer" onClick={() => window.open(msg.content, '_blank')} />
                  ) : (
                    msg.content
                  )}
                  
                  {formattedTime && (
                    <div className={clsx('text-[9px] font-bold mt-1 flex items-center justify-end gap-1', isMe ? 'text-primary-100' : 'text-slate-400')}>
                      <span>{formattedTime}</span>
                      {isMe && <CheckCheck size={14} className="text-white stroke-[2.2] flex-shrink-0" />}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input or Closed Banner */}
      <div className="bg-white dark:bg-dark-800 p-4 pb-safe-or-4 border-t border-slate-100 dark:border-dark-600">
        {isGroupClosed ? (
          <div className="bg-slate-100 dark:bg-dark-700 border border-slate-200 dark:border-dark-600 p-3 rounded-2xl flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
            <Lock size={16} />
            <span className="text-xs font-bold">This group is closed. No new messages can be sent.</span>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex gap-2 items-end">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            <button
              type="button"
              onClick={handleImageClick}
              disabled={sending}
              className="w-11 h-11 flex-shrink-0 flex items-center justify-center text-slate-400 hover:text-primary-500 bg-slate-50 dark:bg-dark-700 rounded-xl transition-all"
            >
              <ImageIcon size={20} />
            </button>
            <div className="flex-1 bg-slate-50 dark:bg-dark-700 rounded-2xl border border-slate-100 dark:border-dark-600 px-4 py-1 flex items-center">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
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
        )}
      </div>

      {/* Members Modal */}
      <Modal open={showMembersModal} onClose={() => setShowMembersModal(false)} title="Team Members">
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto no-scrollbar">
            {members.map(m => (
              <div key={m.id} className="flex justify-between items-center bg-slate-50 dark:bg-dark-800/40 p-3 rounded-2xl border border-slate-100/50 dark:border-dark-700">
                <div className="flex items-center gap-3">
                  <Avatar src={m.avatar} name={m.name} size="sm" />
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{m.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 capitalize">
                      {m.role === 'admin' ? 'Admin' : 'Worker'}
                    </p>
                  </div>
                </div>
                {m.role === 'admin' ? (
                  <Badge variant="primary" className="text-[9px]">Admin</Badge>
                ) : (
                  <Badge variant="gray" className="text-[9px]">Worker</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Close Confirm Modal */}
      <Modal open={showCloseConfirmModal} onClose={() => setShowCloseConfirmModal(false)} title="Close Team Chat">
        <div className="flex flex-col gap-4 py-2">
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3 rounded-xl flex items-start gap-2.5">
            <Info className="text-red-500 mt-0.5 flex-shrink-0" size={18} />
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 leading-relaxed">
              Are you sure you want to close this group? No new messages can be sent after this. Hired workers will still be able to view the chat history.
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowCloseConfirmModal(false)} disabled={isClosing}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleCloseGroup} loading={isClosing}>
              Close Group
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Chat Confirm Modal */}
      <Modal open={showDeleteConfirmModal} onClose={() => setShowDeleteConfirmModal(false)} title="Delete Group Chat">
        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to delete this closed group chat from your view? It will be removed from your chat list without affecting other members.
          </p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirmModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleDeleteChatForMe}>
              Delete Chat
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
