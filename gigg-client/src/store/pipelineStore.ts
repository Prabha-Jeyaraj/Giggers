import { create } from 'zustand';
import type { JobTask, TaskCompletion } from '../types';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

function mapTask(t: any): JobTask {
  return {
    id: t.id,
    jobId: t.jobId,
    kind: t.kind,
    sortOrder: t.sortOrder,
    title: t.title,
    description: t.description,
    completionType: t.completionType,
    formSchema: t.formSchema,
    responseWindowMinutes: t.responseWindowMinutes,
    autoFailMinutes: t.autoFailMinutes,
    openMinutesBefore: t.openMinutesBefore,
    openMinutesAfter: t.openMinutesAfter,
    anchorTime: t.anchorTime,
    requiresReview: t.requiresReview,
  };
}

function mapCompletion(c: any): TaskCompletion {
  return {
    id: c.id,
    applicationId: c.applicationId,
    jobTaskId: c.jobTaskId,
    status: c.status,
    imageUrl: c.imageUrl,
    formData: c.formData,
    availableAt: c.availableAt,
    submittedAt: c.submittedAt,
    reviewedAt: c.reviewedAt,
    rejectionReason: c.rejectionReason,
    opensAt: c.opensAt,
    deadlineAt: c.deadlineAt,
  };
}

export interface TaskDraft {
  kind: 'opening' | 'task' | 'closing';
  title: string;
  description: string;
  completionType: 'image' | 'form' | 'tick';
  responseWindowMinutes: number;
  autoFailMinutes: number;
  openMinutesBefore: number;
  openMinutesAfter: number;
  anchorTime?: string;
  requiresReview: boolean;
}

interface PipelineState {
  tasks: JobTask[];
  completions: TaskCompletion[];
  isLoading: boolean;
  fetchJobTasks: (jobId: string) => Promise<JobTask[]>;
  saveJobTasks: (jobId: string, tasks: TaskDraft[]) => Promise<void>;
  fetchCompletions: (applicationId: string) => Promise<void>;
  refetchCompletionsSilently: (applicationId: string) => Promise<void>;
  submitTick: (completionId: string) => Promise<void>;
  submitForm: (completionId: string, formData: Record<string, string | number>) => Promise<void>;
  submitImage: (completionId: string, imageDataUrl: string) => Promise<void>;
  reviewCompletion: (completionId: string, approve: boolean, rejectionReason?: string) => Promise<void>;
  employerCompleteTask: (completionId: string) => Promise<void>;
  employerReopenTask: (completionId: string) => Promise<void>;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  tasks: [],
  completions: [],
  isLoading: false,

  fetchJobTasks: async (jobId: string) => {
    const res = await api.get<{ tasks: any[] }>(`/api/pipeline/jobs/${jobId}/tasks`);
    const tasks = res.tasks.map(mapTask);
    set({ tasks });
    return tasks;
  },

  saveJobTasks: async (jobId: string, tasks: TaskDraft[]) => {
    const res = await api.post<{ tasks: any[] }>(`/api/pipeline/jobs/${jobId}/tasks`, { tasks });
    set({ tasks: res.tasks.map(mapTask) });
  },

  fetchCompletions: async (applicationId: string) => {
    set({ isLoading: true });
    try {
      const res = await api.get<{ tasks: any[]; completions: any[] }>(`/api/pipeline/applications/${applicationId}/completions`);
      if (res && Array.isArray(res.tasks) && res.tasks.length > 0) {
        set({ tasks: res.tasks.map(mapTask), completions: (res.completions || []).map(mapCompletion), isLoading: false });
        return;
      }
    } catch (err) {
      console.warn('[pipelineStore] API completions fetch failed, attempting Supabase fallback:', err);
    }

    // Direct Supabase fallback
    try {
      const { data: app } = await supabase.from('applications').select('job_id').eq('id', applicationId).maybeSingle();
      if (app?.job_id) {
        const { data: dbTasks } = await supabase.from('job_tasks').select('*').eq('job_id', app.job_id).order('sort_order', { ascending: true });
        const { data: dbCompletions } = await supabase.from('application_task_completions').select('*').eq('application_id', applicationId);
        if (dbTasks && dbTasks.length > 0) {
          set({
            tasks: dbTasks.map(mapTask),
            completions: (dbCompletions || []).map(mapCompletion),
            isLoading: false,
          });
          return;
        }
      }
    } catch (dbErr) {
      console.error('[pipelineStore] Direct Supabase fallback failed:', dbErr);
    }
    set({ isLoading: false });
  },

  /** Re-fetch tasks/completions without toggling isLoading — used after a
   * submit/review so newly-unlocked tasks appear without flashing the
   * page's full loading state. */
  refetchCompletionsSilently: async (applicationId: string) => {
    try {
      const res = await api.get<{ tasks: any[]; completions: any[] }>(`/api/pipeline/applications/${applicationId}/completions`);
      if (res && Array.isArray(res.tasks) && res.tasks.length > 0) {
        set({ tasks: res.tasks.map(mapTask), completions: (res.completions || []).map(mapCompletion) });
        return;
      }
    } catch {
      // Ignore silent refetch errors
    }
  },

  submitTick: async (completionId: string) => {
    const res = await api.post<{ completion: any }>(`/api/pipeline/completions/${completionId}/tick`);
    await get().refetchCompletionsSilently(res.completion.applicationId);
  },

  submitForm: async (completionId: string, formData: Record<string, string | number>) => {
    const res = await api.post<{ completion: any }>(`/api/pipeline/completions/${completionId}/form`, { formData });
    await get().refetchCompletionsSilently(res.completion.applicationId);
  },

  submitImage: async (completionId: string, imageDataUrl: string) => {
    const res = await api.post<{ completion: any }>(`/api/pipeline/completions/${completionId}/image`, { image: imageDataUrl });
    await get().refetchCompletionsSilently(res.completion.applicationId);
  },

  reviewCompletion: async (completionId: string, approve: boolean, rejectionReason?: string) => {
    const res = await api.post<{ completion: any }>(`/api/pipeline/completions/${completionId}/review`, { approve, rejectionReason });
    await get().refetchCompletionsSilently(res.completion.applicationId);
  },

  employerCompleteTask: async (completionId: string) => {
    const res = await api.post<{ completion: any }>(`/api/pipeline/completions/${completionId}/employer-complete`);
    await get().refetchCompletionsSilently(res.completion.applicationId);
  },

  employerReopenTask: async (completionId: string) => {
    const res = await api.post<{ completion: any }>(`/api/pipeline/completions/${completionId}/employer-reopen`);
    await get().refetchCompletionsSilently(res.completion.applicationId);
  },
}));
